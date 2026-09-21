import 'dotenv/config';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import {
  PrismaClient,
  WorkspaceRole,
  InvitationStatus,
  ActionType,
  EntityType,
  AttachmentType,
  CardPriority,
  CardStatus,
  CardFieldType,
  DocumentStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { LexoRank } from 'lexorank';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/syncboard?schema=public';

if (!process.env.DATABASE_URL) {
  console.log('ℹ️  DATABASE_URL not set, using local fallback.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Small deterministic helpers (idempotency-first: never delete, only converge)
// ---------------------------------------------------------------------------

const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

// Prisma v7 `Bytes` maps to Uint8Array<ArrayBuffer>. TextEncoder returns
// Uint8Array<ArrayBufferLike>, so copy into a fresh ArrayBuffer-backed array.
function toBytes(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const out = new Uint8Array(encoded.length);
  out.set(encoded);
  return out;
}

function nextRank(prev?: LexoRank | null): LexoRank {
  return prev ? prev.genNext() : LexoRank.middle();
}

// Per-scope rank chains. Only used when CREATING missing rows, so re-runs that
// find existing rows never allocate new ranks (no duplicates, no collisions).
const listRanks = new Map<string, LexoRank>();
const cardRanks = new Map<string, LexoRank>();
const itemRanks = new Map<string, LexoRank>();
const checklistRanks = new Map<string, LexoRank>();

function nextListRank(boardId: string): string {
  const nxt = nextRank(listRanks.get(boardId) ?? null);
  listRanks.set(boardId, nxt);
  return nxt.toString();
}

function nextCardRank(listId: string): string {
  const nxt = nextRank(cardRanks.get(listId) ?? null);
  cardRanks.set(listId, nxt);
  return nxt.toString();
}

function nextChecklistRank(cardId: string): string {
  const nxt = nextRank(checklistRanks.get(cardId) ?? null);
  checklistRanks.set(cardId, nxt);
  return nxt.toString();
}

function nextItemRank(checklistId: string): string {
  const nxt = nextRank(itemRanks.get(checklistId) ?? null);
  itemRanks.set(checklistId, nxt);
  return nxt.toString();
}

function log(section: string, detail: string) {
  console.log(`  • ${section}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Idempotent ensure-helpers
// ---------------------------------------------------------------------------

async function ensureMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  return prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId, userId } },
    update: { role },
    create: { workspaceId, userId, role },
  });
}

async function ensureStar(userId: string, boardId: string) {
  return prisma.userStarredBoard.upsert({
    where: { userId_boardId: { userId, boardId } },
    update: {},
    create: { userId, boardId },
  });
}

async function ensureAssignee(cardId: string, userId: string) {
  return prisma.cardAssignee.upsert({
    where: { cardId_userId: { cardId, userId } },
    update: {},
    create: { cardId, userId },
  });
}

async function ensureCardLabel(cardId: string, labelId: string) {
  return prisma.cardLabel.upsert({
    where: { cardId_labelId: { cardId, labelId } },
    update: {},
    create: { cardId, labelId },
  });
}

async function ensureLabel(workspaceId: string, name: string, color: string) {
  const existing = await prisma.label.findFirst({
    where: { workspaceId, name },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    if (existing.color !== color) {
      return prisma.label.update({
        where: { id: existing.id },
        data: { color },
      });
    }
    return existing;
  }
  return prisma.label.create({ data: { workspaceId, name, color } });
}

async function ensureFieldDef(params: {
  workspaceId: string;
  name: string;
  fieldType: CardFieldType;
  position: number;
  required?: boolean;
  options?: unknown;
}) {
  const { workspaceId, name, fieldType, position, required, options } = params;
  const existing = await prisma.cardFieldDef.findUnique({
    where: { workspaceId_name: { workspaceId, name } },
  });
  if (existing) {
    return prisma.cardFieldDef.update({
      where: { id: existing.id },
      data: {
        fieldType,
        position,
        required: required ?? false,
        options: (options ?? null) as never,
      },
    });
  }
  return prisma.cardFieldDef.create({
    data: {
      workspaceId,
      name,
      fieldType,
      position,
      required: required ?? false,
      options: (options ?? null) as never,
    },
  });
}

async function ensureFieldValue(
  fieldId: string,
  cardId: string,
  value: unknown,
) {
  return prisma.cardFieldValue.upsert({
    where: { fieldId_cardId: { fieldId, cardId } },
    update: { value: value as never },
    create: { fieldId, cardId, value: value as never },
  });
}

async function ensureBoard(params: {
  workspaceId: string;
  title: string;
  description: string | null;
  backgroundColor: string | null;
  createdBy: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  const existing = await prisma.board.findFirst({
    where: { workspaceId: params.workspaceId, title: params.title },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return prisma.board.update({
      where: { id: existing.id },
      data: {
        description: params.description,
        backgroundColor: params.backgroundColor,
        archivedAt: params.archivedAt ?? null,
        deletedAt: params.deletedAt ?? null,
      },
    });
  }
  return prisma.board.create({
    data: {
      workspaceId: params.workspaceId,
      title: params.title,
      description: params.description,
      backgroundColor: params.backgroundColor,
      createdBy: params.createdBy,
      archivedAt: params.archivedAt ?? null,
      deletedAt: params.deletedAt ?? null,
    },
  });
}

async function ensureList(params: {
  boardId: string;
  title: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  const existing = await prisma.list.findFirst({
    where: { boardId: params.boardId, title: params.title },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    // Converge archive/delete state so re-runs repair manual drift.
    if (
      (existing.archivedAt ?? null)?.getTime() !==
        (params.archivedAt ?? null)?.getTime() ||
      (existing.deletedAt ?? null)?.getTime() !==
        (params.deletedAt ?? null)?.getTime()
    ) {
      return prisma.list.update({
        where: { id: existing.id },
        data: {
          archivedAt: params.archivedAt ?? null,
          deletedAt: params.deletedAt ?? null,
        },
      });
    }
    // Backfill rank chain so later creates in this scope keep ordering.
    if (!listRanks.has(params.boardId)) {
      try {
        listRanks.set(params.boardId, LexoRank.parse(existing.rank));
      } catch {
        // Keep default chain if stored rank is unparseable.
      }
    }
    return existing;
  }
  return prisma.list.create({
    data: {
      boardId: params.boardId,
      title: params.title,
      rank: nextListRank(params.boardId),
      archivedAt: params.archivedAt ?? null,
      deletedAt: params.deletedAt ?? null,
    },
  });
}

type EnsureCardParams = {
  listId: string;
  title: string;
  description?: unknown;
  priority?: CardPriority;
  status?: CardStatus;
  parentCardId?: string | null;
  dueDate?: Date | null;
  isComplete?: boolean;
  coverImageUrl?: string | null;
  estimateMinutes?: number | null;
  loggedMinutes?: number;
  createdBy: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
};

async function ensureCard(params: EnsureCardParams) {
  const parentCardId = params.parentCardId ?? null;
  const existing = await prisma.card.findFirst({
    where: { listId: params.listId, title: params.title, parentCardId },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return prisma.card.update({
      where: { id: existing.id },
      data: {
        description: (params.description ?? undefined) as never,
        priority: params.priority ?? existing.priority,
        status: params.status ?? existing.status,
        dueDate:
          params.dueDate !== undefined ? params.dueDate : existing.dueDate,
        isComplete: params.isComplete ?? existing.isComplete,
        coverImageUrl:
          params.coverImageUrl !== undefined
            ? params.coverImageUrl
            : existing.coverImageUrl,
        estimateMinutes:
          params.estimateMinutes !== undefined
            ? params.estimateMinutes
            : existing.estimateMinutes,
        loggedMinutes: params.loggedMinutes ?? existing.loggedMinutes,
        archivedAt: params.archivedAt ?? null,
        deletedAt: params.deletedAt ?? null,
      },
    });
  }
  return prisma.card.create({
    data: {
      listId: params.listId,
      title: params.title,
      description: (params.description ?? undefined) as never,
      rank: nextCardRank(params.listId),
      priority: params.priority ?? CardPriority.medium,
      status: params.status ?? CardStatus.not_started,
      parentCardId,
      dueDate: params.dueDate ?? null,
      isComplete: params.isComplete ?? false,
      coverImageUrl: params.coverImageUrl ?? null,
      estimateMinutes: params.estimateMinutes ?? null,
      loggedMinutes: params.loggedMinutes ?? 0,
      createdBy: params.createdBy,
      archivedAt: params.archivedAt ?? null,
      deletedAt: params.deletedAt ?? null,
    },
  });
}

async function ensureTimeEntry(params: {
  cardId: string;
  userId: string;
  minutes: number;
  note: string | null;
}) {
  const existing = await prisma.cardTimeEntry.findFirst({
    where: {
      cardId: params.cardId,
      userId: params.userId,
      minutes: params.minutes,
      note: params.note,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return prisma.cardTimeEntry.create({ data: params });
}

async function ensureComment(params: {
  cardId: string;
  authorId: string;
  content: string;
  parentCommentId?: string | null;
  deletedAt?: Date | null;
}) {
  const parentCommentId = params.parentCommentId ?? null;
  const existing = await prisma.cardComment.findFirst({
    where: {
      cardId: params.cardId,
      authorId: params.authorId,
      content: params.content,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    // Repair threading / soft-delete state on re-run.
    if (
      (existing.parentCommentId ?? null) !== parentCommentId ||
      (existing.deletedAt ?? null)?.getTime() !==
        (params.deletedAt ?? null)?.getTime()
    ) {
      return prisma.cardComment.update({
        where: { id: existing.id },
        data: { parentCommentId, deletedAt: params.deletedAt ?? null },
      });
    }
    return existing;
  }
  return prisma.cardComment.create({
    data: {
      cardId: params.cardId,
      authorId: params.authorId,
      content: params.content,
      parentCommentId,
      deletedAt: params.deletedAt ?? null,
    },
  });
}

async function ensureAttachment(params: {
  cardId: string;
  name: string;
  type: AttachmentType;
  url: string;
  uploadedById: string;
  mimeType?: string | null;
  fileSize?: number | null;
  coverUrl?: string | null;
  archivedAt?: Date | null;
}) {
  const existing = await prisma.cardAttachment.findFirst({
    where: { cardId: params.cardId, name: params.name },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return prisma.cardAttachment.update({
      where: { id: existing.id },
      data: {
        type: params.type,
        url: params.url,
        mimeType: params.mimeType ?? null,
        fileSize: params.fileSize ?? null,
        coverUrl: params.coverUrl ?? null,
        archivedAt: params.archivedAt ?? null,
      },
    });
  }
  return prisma.cardAttachment.create({
    data: {
      cardId: params.cardId,
      name: params.name,
      type: params.type,
      url: params.url,
      uploadedById: params.uploadedById,
      mimeType: params.mimeType ?? null,
      fileSize: params.fileSize ?? null,
      coverUrl: params.coverUrl ?? null,
      archivedAt: params.archivedAt ?? null,
    },
  });
}

async function ensureChecklist(
  cardId: string,
  title: string,
  items: Array<{ content: string; isDone: boolean }>,
) {
  let checklist = await prisma.cardChecklist.findFirst({
    where: { cardId, title },
    include: { items: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!checklist) {
    checklist = await prisma.cardChecklist.create({
      data: {
        cardId,
        title,
        rank: nextChecklistRank(cardId),
      },
      include: { items: true },
    });
  }
  for (const item of items) {
    const existingItem = await prisma.checklistItem.findFirst({
      where: { checklistId: checklist.id, content: item.content },
      orderBy: { createdAt: 'asc' },
    });
    if (existingItem) {
      if (existingItem.isDone !== item.isDone) {
        await prisma.checklistItem.update({
          where: { id: existingItem.id },
          data: { isDone: item.isDone },
        });
      }
      continue;
    }
    await prisma.checklistItem.create({
      data: {
        checklistId: checklist.id,
        content: item.content,
        isDone: item.isDone,
        rank: nextItemRank(checklist.id),
      },
    });
  }
  return checklist;
}

async function ensureDocument(params: {
  workspaceId: string;
  title: string;
  createdBy: string;
  previewText?: string | null;
  parentCardId?: string | null;
  status?: DocumentStatus;
  yjsState?: Uint8Array<ArrayBuffer> | null;
}) {
  const existing = await prisma.document.findFirst({
    where: { workspaceId: params.workspaceId, title: params.title },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return prisma.document.update({
      where: { id: existing.id },
      data: {
        previewText: params.previewText ?? existing.previewText,
        parentCardId: params.parentCardId ?? existing.parentCardId,
        status: params.status ?? existing.status,
        // Only set yjsState if caller provides one and none is stored yet.
        // Never wipe an existing collaborative state on re-seed.
        yjsState:
          params.yjsState && !existing.yjsState ? params.yjsState : undefined,
      },
    });
  }
  return prisma.document.create({
    data: {
      workspaceId: params.workspaceId,
      title: params.title,
      createdBy: params.createdBy,
      previewText: params.previewText ?? null,
      parentCardId: params.parentCardId ?? null,
      status: params.status ?? DocumentStatus.active,
      yjsState: params.yjsState ?? null,
    },
  });
}

async function ensureSnapshot(params: {
  documentId: string;
  createdBy: string;
  snapshotName: string | null;
  yjsState: Uint8Array<ArrayBuffer>;
}) {
  const candidates = await prisma.documentSnapshot.findMany({
    where: { documentId: params.documentId, createdBy: params.createdBy },
    orderBy: { createdAt: 'asc' },
  });
  const existing = candidates.find(
    (s) => (s.snapshotName ?? null) === (params.snapshotName ?? null),
  );
  if (existing) return existing;
  return prisma.documentSnapshot.create({ data: params });
}

async function ensureInvitation(params: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
}) {
  const existing = await prisma.workspaceInvitation.findFirst({
    where: { workspaceId: params.workspaceId, email: params.email },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    return prisma.workspaceInvitation.update({
      where: { id: existing.id },
      data: {
        role: params.role,
        status: params.status,
        expiresAt: params.expiresAt,
        acceptedAt: params.acceptedAt ?? null,
        invitedBy: params.invitedBy,
        // Keep the original token stable so re-runs never hit the unique index.
      },
    });
  }
  return prisma.workspaceInvitation.create({ data: params });
}

async function ensureRefreshToken(params: {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: params.tokenHash },
  });
  if (existing) {
    return prisma.refreshToken.update({
      where: { id: existing.id },
      data: {
        expiresAt: params.expiresAt,
        revokedAt: params.revokedAt ?? null,
        replacedBy: params.replacedBy ?? existing.replacedBy,
      },
    });
  }
  return prisma.refreshToken.create({ data: params });
}

async function ensureActivity(params: {
  boardId: string | null;
  userId: string;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  entityTitle?: string | null;
  fromListId?: string | null;
  toListId?: string | null;
  details?: unknown;
}) {
  const scope = params.boardId
    ? await prisma.board.findUniqueOrThrow({ where: { id: params.boardId }, select: { workspaceId: true } })
    : await prisma.document.findUniqueOrThrow({ where: { id: params.entityId }, select: { workspaceId: true } });
  const existing = await prisma.activityEvent.findFirst({
    where: {
      workspaceId: scope.workspaceId,
      boardId: params.boardId,
      actorId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;
  return prisma.activityEvent.create({
    data: {
      workspaceId: scope.workspaceId,
      boardId: params.boardId,
      actorId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: {
        entityTitle: params.entityTitle ?? null,
        fromListId: params.fromListId ?? null,
        toListId: params.toListId ?? null,
        details: (params.details ?? null) as never,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('🌱 Starting SyncBoard database seeding (idempotent)...');

  try {
    await prisma.$executeRaw`SELECT ensure_activity_partitions()`;
  } catch {
    console.log('Skipping partition ensure: run prisma/activity-partitions.sql first');
  }
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ---- 1. Users: password, OAuth-only, unverified, viewer -----------------
  const userAlex = await prisma.user.upsert({
    where: { email: 'alex@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Alex Rivera',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-1),
    },
    create: {
      email: 'alex@syncboard.dev',
      passwordHash,
      displayName: 'Alex Rivera',
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-1),
    },
  });

  const userSarah = await prisma.user.upsert({
    where: { email: 'sarah@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Sarah Chen',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-1),
    },
    create: {
      email: 'sarah@syncboard.dev',
      passwordHash,
      displayName: 'Sarah Chen',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-1),
    },
  });

  const userMarcus = await prisma.user.upsert({
    where: { email: 'marcus@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Marcus Vance',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-2),
    },
    create: {
      email: 'marcus@syncboard.dev',
      passwordHash,
      displayName: 'Marcus Vance',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-2),
    },
  });

  const userElena = await prisma.user.upsert({
    where: { email: 'elena@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Elena Rostova',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-3),
    },
    create: {
      email: 'elena@syncboard.dev',
      passwordHash,
      displayName: 'Elena Rostova',
      avatarUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-3),
    },
  });

  // OAuth-only user: no local password, Google identity, verified.
  const userPriya = await prisma.user.upsert({
    where: { email: 'priya@syncboard.dev' },
    update: {
      displayName: 'Priya Nair',
      googleId: 'seed-google-priya-001',
      passwordHash: null,
      isEmailVerified: true,
      lastLoginAt: daysFromNow(0),
    },
    create: {
      email: 'priya@syncboard.dev',
      passwordHash: null,
      googleId: 'seed-google-priya-001',
      displayName: 'Priya Nair',
      avatarUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(0),
    },
  });

  // Unverified user who never logged in and has no avatar.
  const userTom = await prisma.user.upsert({
    where: { email: 'tom@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Tom Becker',
      avatarUrl: null,
      isEmailVerified: false,
      lastLoginAt: null,
    },
    create: {
      email: 'tom@syncboard.dev',
      passwordHash,
      displayName: 'Tom Becker',
      avatarUrl: null,
      isEmailVerified: false,
      lastLoginAt: null,
    },
  });

  // Viewer-only user.
  const userGrace = await prisma.user.upsert({
    where: { email: 'grace@syncboard.dev' },
    update: {
      passwordHash,
      displayName: 'Grace Kim',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-5),
    },
    create: {
      email: 'grace@syncboard.dev',
      passwordHash,
      displayName: 'Grace Kim',
      avatarUrl:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
      isEmailVerified: true,
      lastLoginAt: daysFromNow(-5),
    },
  });

  log(
    'users',
    'Alex, Sarah, Marcus, Elena, Priya (OAuth-only), Tom (unverified), Grace (viewer) — password: Password123!',
  );

  // ---- 2. Workspaces: active + archived ------------------------------------
  const workspaceAcme = await prisma.workspace.upsert({
    where: { slug: 'acme-engineering' },
    update: {
      name: 'Acme Engineering',
      description:
        'Core platform engineering, infrastructure, and real-time collaboration tools.',
      ownerId: userAlex.id,
      avatarUrl:
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&auto=format&fit=crop&q=80',
      archivedAt: null,
    },
    create: {
      name: 'Acme Engineering',
      slug: 'acme-engineering',
      description:
        'Core platform engineering, infrastructure, and real-time collaboration tools.',
      avatarUrl:
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&auto=format&fit=crop&q=80',
      ownerId: userAlex.id,
    },
  });

  const workspaceRoadmap = await prisma.workspace.upsert({
    where: { slug: 'product-roadmap' },
    update: {
      name: 'Product Roadmap',
      description:
        'Cross-functional quarterly objectives and feature roadmap planning.',
      ownerId: userSarah.id,
      avatarUrl: null,
      archivedAt: null,
    },
    create: {
      name: 'Product Roadmap',
      slug: 'product-roadmap',
      description:
        'Cross-functional quarterly objectives and feature roadmap planning.',
      ownerId: userSarah.id,
    },
  });

  const workspaceLegacy = await prisma.workspace.upsert({
    where: { slug: 'legacy-archive' },
    update: {
      name: 'Legacy Archive',
      description: 'Retired workspace kept for archived-board history.',
      ownerId: userAlex.id,
      archivedAt: daysFromNow(-60),
    },
    create: {
      name: 'Legacy Archive',
      slug: 'legacy-archive',
      description: 'Retired workspace kept for archived-board history.',
      ownerId: userAlex.id,
      archivedAt: daysFromNow(-60),
    },
  });

  log(
    'workspaces',
    'acme-engineering, product-roadmap, legacy-archive (archived)',
  );

  // ---- 3. Memberships: all four roles --------------------------------------
  await ensureMember(workspaceAcme.id, userAlex.id, WorkspaceRole.owner);
  await ensureMember(workspaceAcme.id, userSarah.id, WorkspaceRole.admin);
  await ensureMember(workspaceAcme.id, userMarcus.id, WorkspaceRole.member);
  await ensureMember(workspaceAcme.id, userElena.id, WorkspaceRole.member);
  await ensureMember(workspaceAcme.id, userPriya.id, WorkspaceRole.member);
  await ensureMember(workspaceAcme.id, userGrace.id, WorkspaceRole.viewer);

  await ensureMember(workspaceRoadmap.id, userSarah.id, WorkspaceRole.owner);
  await ensureMember(workspaceRoadmap.id, userAlex.id, WorkspaceRole.admin);
  await ensureMember(workspaceRoadmap.id, userElena.id, WorkspaceRole.member);
  await ensureMember(workspaceRoadmap.id, userMarcus.id, WorkspaceRole.viewer);

  await ensureMember(workspaceLegacy.id, userAlex.id, WorkspaceRole.owner);
  await ensureMember(workspaceLegacy.id, userSarah.id, WorkspaceRole.admin);

  log('members', 'owner/admin/member/viewer roles across 3 workspaces');

  // ---- 4. Invitations: pending / accepted / expired / revoked --------------
  await ensureInvitation({
    workspaceId: workspaceAcme.id,
    email: 'newhire@syncboard.dev',
    role: WorkspaceRole.member,
    token: 'seed-invite-acme-pending-001',
    invitedBy: userAlex.id,
    status: InvitationStatus.pending,
    expiresAt: daysFromNow(7),
  });
  await ensureInvitation({
    workspaceId: workspaceAcme.id,
    email: 'contractor@syncboard.dev',
    role: WorkspaceRole.viewer,
    token: 'seed-invite-acme-accepted-001',
    invitedBy: userSarah.id,
    status: InvitationStatus.accepted,
    expiresAt: daysFromNow(7),
    acceptedAt: daysFromNow(-2),
  });
  await ensureInvitation({
    workspaceId: workspaceAcme.id,
    email: 'oldinvite@syncboard.dev',
    role: WorkspaceRole.member,
    token: 'seed-invite-acme-expired-001',
    invitedBy: userAlex.id,
    status: InvitationStatus.expired,
    expiresAt: daysFromNow(-1),
  });
  await ensureInvitation({
    workspaceId: workspaceAcme.id,
    email: 'revoked@syncboard.dev',
    role: WorkspaceRole.member,
    token: 'seed-invite-acme-revoked-001',
    invitedBy: userSarah.id,
    status: InvitationStatus.revoked,
    expiresAt: daysFromNow(7),
  });
  await ensureInvitation({
    workspaceId: workspaceRoadmap.id,
    email: 'designer@syncboard.dev',
    role: WorkspaceRole.member,
    token: 'seed-invite-roadmap-pending-001',
    invitedBy: userSarah.id,
    status: InvitationStatus.pending,
    expiresAt: daysFromNow(14),
  });

  log('invitations', 'pending, accepted, expired, revoked');

  // ---- 5. Labels per workspace ----------------------------------------------
  const labelFrontend = await ensureLabel(
    workspaceAcme.id,
    'Frontend',
    '#3b82f6',
  );
  const labelBackend = await ensureLabel(
    workspaceAcme.id,
    'Backend',
    '#10b981',
  );
  const labelDesign = await ensureLabel(workspaceAcme.id, 'Design', '#ec4899');
  const labelDevOps = await ensureLabel(workspaceAcme.id, 'DevOps', '#8b5cf6');
  const labelBug = await ensureLabel(workspaceAcme.id, 'Bug', '#ef4444');
  const labelHighPriority = await ensureLabel(
    workspaceAcme.id,
    'High Priority',
    '#f59e0b',
  );

  const labelObjective = await ensureLabel(
    workspaceRoadmap.id,
    'Objective',
    '#3b82f6',
  );
  const labelKeyResult = await ensureLabel(
    workspaceRoadmap.id,
    'Key Result',
    '#10b981',
  );
  const labelRisk = await ensureLabel(workspaceRoadmap.id, 'Risk', '#ef4444');

  log('labels', '6 in Acme + 3 in Roadmap');

  // ---- 6. Custom field definitions (all field types) -------------------------
  const fdStoryPoints = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Story Points',
    fieldType: CardFieldType.number,
    position: 0,
    required: true,
  });
  const fdRelease = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Release Version',
    fieldType: CardFieldType.text,
    position: 1,
  });
  const fdEnv = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Environment',
    fieldType: CardFieldType.select,
    position: 2,
    options: ['Development', 'Staging', 'Production'],
  });
  const fdImpact = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Customer Impact',
    fieldType: CardFieldType.select,
    position: 3,
    options: ['Low', 'Medium', 'High', 'Critical'],
  });
  const fdTargetDate = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Target Sprint Date',
    fieldType: CardFieldType.date,
    position: 4,
  });
  const fdReviewer = await ensureFieldDef({
    workspaceId: workspaceAcme.id,
    name: 'Reviewer',
    fieldType: CardFieldType.user,
    position: 5,
  });
  const fdConfidence = await ensureFieldDef({
    workspaceId: workspaceRoadmap.id,
    name: 'OKR Confidence',
    fieldType: CardFieldType.number,
    position: 0,
  });
  const fdQuarter = await ensureFieldDef({
    workspaceId: workspaceRoadmap.id,
    name: 'Quarter',
    fieldType: CardFieldType.select,
    position: 1,
    options: ['Q1', 'Q2', 'Q3', 'Q4'],
  });

  log(
    'field-defs',
    'number/text/select/date/user incl. required Story Points + Roadmap defs',
  );

  // ---- 7. Boards: active across workspaces + archived + deleted --------------
  const boardSprint = await ensureBoard({
    workspaceId: workspaceAcme.id,
    title: 'Sprint 24 - Core Platform',
    description:
      'Two-week sprint focused on subcards, time tracking, custom fields, and real-time collaboration.',
    backgroundColor: '#1E1E2E',
    createdBy: userAlex.id,
  });
  const boardInfra = await ensureBoard({
    workspaceId: workspaceAcme.id,
    title: 'Infrastructure & DevOps',
    description: 'CI runners, secret rotation, and observability work.',
    backgroundColor: '#0F766E',
    createdBy: userSarah.id,
  });
  const boardRoadmap = await ensureBoard({
    workspaceId: workspaceRoadmap.id,
    title: 'Q4 Product Roadmap',
    description: 'Objectives and key results for the quarter.',
    backgroundColor: '#4338CA',
    createdBy: userSarah.id,
  });
  const boardArchived = await ensureBoard({
    workspaceId: workspaceAcme.id,
    title: 'Sprint 23 - Retired',
    description: 'Previous sprint, kept read-only for history.',
    backgroundColor: '#334155',
    createdBy: userAlex.id,
    archivedAt: daysFromNow(-30),
  });
  const boardDeleted = await ensureBoard({
    workspaceId: workspaceAcme.id,
    title: 'Spike - Deleted Draft',
    description: 'Soft-deleted draft used to exercise trash/restore flows.',
    backgroundColor: '#7C2D12',
    createdBy: userMarcus.id,
    deletedAt: daysFromNow(-5),
  });

  await ensureStar(userAlex.id, boardSprint.id);
  await ensureStar(userSarah.id, boardSprint.id);
  await ensureStar(userSarah.id, boardRoadmap.id);
  await ensureStar(userMarcus.id, boardInfra.id);

  log('boards', '3 active + 1 archived + 1 deleted, 4 stars');

  // ---- 8. Lists: active + archived + deleted ---------------------------------
  const listBacklog = await ensureList({
    boardId: boardSprint.id,
    title: 'Backlog',
  });
  const listInProgress = await ensureList({
    boardId: boardSprint.id,
    title: 'In Progress',
  });
  const listReview = await ensureList({
    boardId: boardSprint.id,
    title: 'Code Review',
  });
  const listDone = await ensureList({
    boardId: boardSprint.id,
    title: 'Done',
  });
  const listArchived = await ensureList({
    boardId: boardSprint.id,
    title: 'Archived Reference',
    archivedAt: daysFromNow(-10),
  });
  const listDeleted = await ensureList({
    boardId: boardSprint.id,
    title: 'Deleted Drafts',
    deletedAt: daysFromNow(-4),
  });

  const infraTodo = await ensureList({
    boardId: boardInfra.id,
    title: 'Todo',
  });
  const infraDoing = await ensureList({
    boardId: boardInfra.id,
    title: 'Doing',
  });
  const infraDone = await ensureList({
    boardId: boardInfra.id,
    title: 'Done',
  });

  const roadmapObjectives = await ensureList({
    boardId: boardRoadmap.id,
    title: 'Objectives',
  });
  const roadmapKeys = await ensureList({
    boardId: boardRoadmap.id,
    title: 'Key Results',
  });
  const roadmapRisks = await ensureList({
    boardId: boardRoadmap.id,
    title: 'Risks',
  });

  log('lists', '6 sprint (incl. archived/deleted) + 3 infra + 3 roadmap');

  // ---- 9. Cards: parents, subcards, and every status/priority edge -----------
  const desc = (text: string) => ({ text });

  const parentCardAuth = await ensureCard({
    listId: listInProgress.id,
    title: 'OAuth 2.0 & SSO Integration',
    description: desc(
      'Complete OAuth 2.0 social login, JWT token rotation, and Google provider integration.',
    ),
    priority: CardPriority.urgent,
    status: CardStatus.active,
    dueDate: daysFromNow(3),
    estimateMinutes: 480,
    loggedMinutes: 270,
    createdBy: userAlex.id,
    coverImageUrl:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
  });
  await ensureAssignee(parentCardAuth.id, userAlex.id);
  await ensureAssignee(parentCardAuth.id, userSarah.id);
  await ensureCardLabel(parentCardAuth.id, labelBackend.id);
  await ensureCardLabel(parentCardAuth.id, labelHighPriority.id);

  const authSubSpecs = [
    {
      title: 'Implement Google OAuth Provider & Callback Flow',
      status: CardStatus.done,
      priority: CardPriority.high,
      isComplete: true,
      dueDate: daysFromNow(-1) as Date | null,
      assigneeId: userAlex.id,
      estimateMinutes: 180,
      loggedMinutes: 180,
    },
    {
      title: 'Session Refresh Token Family & Reuse Detection',
      status: CardStatus.active,
      priority: CardPriority.urgent,
      isComplete: false,
      dueDate: daysFromNow(2) as Date | null,
      assigneeId: userSarah.id,
      estimateMinutes: 240,
      loggedMinutes: 90,
    },
    {
      title: 'Two-Factor Authentication (TOTP / Authenticator App)',
      status: CardStatus.not_started,
      priority: CardPriority.medium,
      isComplete: false,
      dueDate: daysFromNow(7) as Date | null,
      assigneeId: userMarcus.id,
      estimateMinutes: 300,
      loggedMinutes: 0,
    },
  ];
  for (const s of authSubSpecs) {
    const sub = await ensureCard({
      listId: listInProgress.id,
      parentCardId: parentCardAuth.id,
      title: s.title,
      description: desc(`Subtask of OAuth 2.0 & SSO Integration: ${s.title}.`),
      status: s.status,
      priority: s.priority,
      isComplete: s.isComplete,
      dueDate: s.dueDate,
      estimateMinutes: s.estimateMinutes,
      loggedMinutes: s.loggedMinutes,
      createdBy: userAlex.id,
    });
    await ensureAssignee(sub.id, s.assigneeId);
  }

  const parentCardRealtime = await ensureCard({
    listId: listInProgress.id,
    title: 'Real-time Collaboration Engine',
    description: desc(
      'Socket.IO multi-room broadcasts with Redis streams adapter and conflict-free cursor tracking.',
    ),
    priority: CardPriority.high,
    status: CardStatus.active,
    dueDate: daysFromNow(5),
    estimateMinutes: 600,
    loggedMinutes: 360,
    createdBy: userSarah.id,
  });
  await ensureAssignee(parentCardRealtime.id, userSarah.id);
  await ensureAssignee(parentCardRealtime.id, userMarcus.id);
  await ensureCardLabel(parentCardRealtime.id, labelBackend.id);
  await ensureCardLabel(parentCardRealtime.id, labelDevOps.id);

  const realtimeSubSpecs = [
    {
      title: 'WebSocket Gateway Redis Adapter & Cluster Pub/Sub',
      status: CardStatus.done,
      priority: CardPriority.high,
      isComplete: true,
      assigneeId: userSarah.id,
    },
    {
      title: 'Active Presence Heartbeat & User Cursor Rendering',
      status: CardStatus.active,
      priority: CardPriority.medium,
      isComplete: false,
      assigneeId: userMarcus.id,
    },
  ];
  for (const s of realtimeSubSpecs) {
    const sub = await ensureCard({
      listId: listInProgress.id,
      parentCardId: parentCardRealtime.id,
      title: s.title,
      description: desc(
        `Subtask of Real-time Collaboration Engine: ${s.title}.`,
      ),
      status: s.status,
      priority: s.priority,
      isComplete: s.isComplete,
      createdBy: userSarah.id,
    });
    await ensureAssignee(sub.id, s.assigneeId);
  }

  const cardCalendar = await ensureCard({
    listId: listDone.id,
    title: 'Calendar & Timeline Board Projections',
    description: desc(
      'Full monthly calendar grid view and gantt timeline view with due date milestone chips.',
    ),
    priority: CardPriority.medium,
    status: CardStatus.done,
    isComplete: true,
    dueDate: daysFromNow(-1),
    estimateMinutes: 300,
    loggedMinutes: 300,
    createdBy: userElena.id,
  });
  await ensureAssignee(cardCalendar.id, userElena.id);
  await ensureCardLabel(cardCalendar.id, labelFrontend.id);
  await ensureCardLabel(cardCalendar.id, labelDesign.id);

  const cardFields = await ensureCard({
    listId: listReview.id,
    title: 'Custom Fields & Dynamic Form Components',
    description: desc(
      'Workspace-level field definitions with polymorphic card values and validation.',
    ),
    priority: CardPriority.high,
    status: CardStatus.active,
    dueDate: daysFromNow(1),
    estimateMinutes: 360,
    loggedMinutes: 240,
    createdBy: userMarcus.id,
  });
  await ensureAssignee(cardFields.id, userMarcus.id);
  await ensureAssignee(cardFields.id, userElena.id);
  await ensureCardLabel(cardFields.id, labelFrontend.id);

  const cardPerformance = await ensureCard({
    listId: listBacklog.id,
    title: 'Performance Profiling & Database Query Caching',
    description: desc(
      'Benchmark p95 response times and add Redis query caching for heavy board projections.',
    ),
    priority: CardPriority.low,
    status: CardStatus.not_started,
    dueDate: daysFromNow(10),
    estimateMinutes: 240,
    loggedMinutes: 0,
    createdBy: userAlex.id,
  });
  await ensureAssignee(cardPerformance.id, userAlex.id);
  await ensureCardLabel(cardPerformance.id, labelBackend.id);
  await ensureCardLabel(cardPerformance.id, labelDevOps.id);

  // Edge cases: lowest+closed+unassigned+no due date, overdue, minimal, archived, deleted.
  const cardRetro = await ensureCard({
    listId: listDone.id,
    title: 'Sprint 23 Retrospective Notes',
    description: desc('Closed retro card with no assignee and no due date.'),
    priority: CardPriority.lowest,
    status: CardStatus.closed,
    isComplete: true,
    dueDate: null,
    estimateMinutes: 60,
    loggedMinutes: 60,
    createdBy: userSarah.id,
  });

  const cardOverdue = await ensureCard({
    listId: listBacklog.id,
    title: 'Fix flaky WebSocket reconnection backoff',
    description: desc(
      'Overdue bug: clients retry too aggressively after network blips.',
    ),
    priority: CardPriority.high,
    status: CardStatus.active,
    isComplete: false,
    dueDate: daysFromNow(-2),
    estimateMinutes: 120,
    loggedMinutes: 30,
    createdBy: userMarcus.id,
    coverImageUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
  });
  await ensureAssignee(cardOverdue.id, userMarcus.id);
  await ensureCardLabel(cardOverdue.id, labelBug.id);

  const cardIdea = await ensureCard({
    listId: listBacklog.id,
    title: 'Draft idea: offline-first board snapshots',
    description: desc('Minimal card: no estimate, no labels, single assignee.'),
    priority: CardPriority.medium,
    status: CardStatus.not_started,
    dueDate: null,
    estimateMinutes: null,
    loggedMinutes: 0,
    createdBy: userElena.id,
  });
  await ensureAssignee(cardIdea.id, userElena.id);

  const cardArchived = await ensureCard({
    listId: listDone.id,
    title: 'Archived spike: legacy drag-drop prototype',
    description: desc('Archived card used for archive-listing queries.'),
    priority: CardPriority.medium,
    status: CardStatus.done,
    isComplete: true,
    dueDate: daysFromNow(-20),
    estimateMinutes: 120,
    loggedMinutes: 120,
    createdBy: userAlex.id,
    archivedAt: daysFromNow(-2),
  });
  await ensureAssignee(cardArchived.id, userAlex.id);

  const cardDeleted = await ensureCard({
    listId: listDeleted.id,
    title: 'Deleted draft: experimental swimlanes',
    description: desc('Soft-deleted card used for trash/restore flows.'),
    priority: CardPriority.low,
    status: CardStatus.not_started,
    dueDate: null,
    estimateMinutes: null,
    loggedMinutes: 0,
    createdBy: userMarcus.id,
    deletedAt: daysFromNow(-3),
  });

  const infraCard1 = await ensureCard({
    listId: infraDoing.id,
    title: 'Migrate CI to ephemeral runners',
    description: desc('Move CI to ephemeral runners with build-layer caching.'),
    priority: CardPriority.high,
    status: CardStatus.active,
    dueDate: daysFromNow(4),
    estimateMinutes: 360,
    loggedMinutes: 120,
    createdBy: userSarah.id,
  });
  await ensureAssignee(infraCard1.id, userSarah.id);
  await ensureCardLabel(infraCard1.id, labelDevOps.id);

  const infraCard2 = await ensureCard({
    listId: infraTodo.id,
    title: 'Rotate production secrets',
    description: desc('Rotate DB, Redis, and JWT secrets with zero downtime.'),
    priority: CardPriority.urgent,
    status: CardStatus.not_started,
    dueDate: daysFromNow(2),
    estimateMinutes: 120,
    loggedMinutes: 0,
    createdBy: userAlex.id,
  });
  await ensureAssignee(infraCard2.id, userAlex.id);
  await ensureAssignee(infraCard2.id, userMarcus.id);

  const roadmapCard1 = await ensureCard({
    listId: roadmapObjectives.id,
    title: 'Increase weekly activation by 15%',
    description: desc('Q4 objective owned by product, supported by growth.'),
    priority: CardPriority.high,
    status: CardStatus.active,
    dueDate: daysFromNow(30),
    estimateMinutes: null,
    loggedMinutes: 0,
    createdBy: userSarah.id,
  });
  await ensureAssignee(roadmapCard1.id, userSarah.id);
  await ensureCardLabel(roadmapCard1.id, labelObjective.id);

  const roadmapCard2 = await ensureCard({
    listId: roadmapRisks.id,
    title: 'Enterprise SSO launch risk: IdP metadata drift',
    description: desc('Risk card with closed follow-up once mitigated.'),
    priority: CardPriority.medium,
    status: CardStatus.closed,
    isComplete: true,
    dueDate: daysFromNow(-5),
    createdBy: userAlex.id,
  });
  await ensureAssignee(roadmapCard2.id, userAlex.id);
  await ensureCardLabel(roadmapCard2.id, labelRisk.id);

  // Silence unused warnings while keeping the seed navigable.
  void cardRetro;
  void cardDeleted;

  log(
    'cards',
    'parents + subcards + closed/lowest/overdue/minimal/archived/deleted + infra/roadmap',
  );

  // ---- 10. Custom field values: diverse per type --------------------------------
  await ensureFieldValue(fdStoryPoints.id, parentCardAuth.id, 8);
  await ensureFieldValue(fdRelease.id, parentCardAuth.id, 'v2.4.0');
  await ensureFieldValue(fdEnv.id, parentCardAuth.id, 'Production');
  await ensureFieldValue(fdImpact.id, parentCardAuth.id, 'Critical');
  await ensureFieldValue(
    fdTargetDate.id,
    parentCardAuth.id,
    daysFromNow(7).toISOString(),
  );
  await ensureFieldValue(fdReviewer.id, parentCardAuth.id, userSarah.id);

  await ensureFieldValue(fdStoryPoints.id, parentCardRealtime.id, 13);
  await ensureFieldValue(fdRelease.id, parentCardRealtime.id, 'v2.5.0');
  await ensureFieldValue(fdEnv.id, parentCardRealtime.id, 'Staging');
  await ensureFieldValue(fdImpact.id, parentCardRealtime.id, 'High');
  await ensureFieldValue(
    fdTargetDate.id,
    parentCardRealtime.id,
    daysFromNow(14).toISOString(),
  );
  await ensureFieldValue(fdReviewer.id, parentCardRealtime.id, userMarcus.id);

  await ensureFieldValue(fdStoryPoints.id, cardCalendar.id, 5);
  await ensureFieldValue(fdRelease.id, cardCalendar.id, 'v2.3.0');
  await ensureFieldValue(fdEnv.id, cardCalendar.id, 'Production');
  await ensureFieldValue(fdImpact.id, cardCalendar.id, 'Medium');

  await ensureFieldValue(fdStoryPoints.id, cardFields.id, 3);
  await ensureFieldValue(fdRelease.id, cardFields.id, 'v2.4.0-beta');
  await ensureFieldValue(fdEnv.id, cardFields.id, 'Development');
  await ensureFieldValue(fdImpact.id, cardFields.id, 'Low');

  await ensureFieldValue(fdStoryPoints.id, cardPerformance.id, 2);
  await ensureFieldValue(fdEnv.id, cardPerformance.id, 'Development');

  await ensureFieldValue(fdConfidence.id, roadmapCard1.id, 7);
  await ensureFieldValue(fdQuarter.id, roadmapCard1.id, 'Q4');
  await ensureFieldValue(fdConfidence.id, roadmapCard2.id, 4);
  await ensureFieldValue(fdQuarter.id, roadmapCard2.id, 'Q4');

  log('field-values', 'number/text/select/date/user with varied values');

  // ---- 11. Time entries: incl. null note -----------------------------------------
  await ensureTimeEntry({
    cardId: parentCardAuth.id,
    userId: userAlex.id,
    minutes: 120,
    note: 'Initial OAuth provider configuration and Prisma schema migration.',
  });
  await ensureTimeEntry({
    cardId: parentCardAuth.id,
    userId: userSarah.id,
    minutes: 90,
    note: 'Implemented refresh token rotation and cryptographic hashing.',
  });
  await ensureTimeEntry({
    cardId: parentCardAuth.id,
    userId: userMarcus.id,
    minutes: 60,
    note: 'Unit tests and token family invalidation verification.',
  });
  await ensureTimeEntry({
    cardId: parentCardRealtime.id,
    userId: userSarah.id,
    minutes: 180,
    note: 'Socket.IO cluster Redis adapter setup and heartbeat tests.',
  });
  await ensureTimeEntry({
    cardId: parentCardRealtime.id,
    userId: userMarcus.id,
    minutes: 180,
    note: 'Frontend collaborative cursor and presence sync component.',
  });
  await ensureTimeEntry({
    cardId: cardFields.id,
    userId: userElena.id,
    minutes: 45,
    note: null,
  });
  await ensureTimeEntry({
    cardId: infraCard1.id,
    userId: userSarah.id,
    minutes: 120,
    note: 'Ephemeral runner pool sizing and cache warmup.',
  });

  log('time-entries', '7 entries incl. null note');

  // ---- 12. Comments: 3-level thread + standalone + soft-deleted (idempotent) -------
  const commentRoot = await ensureComment({
    cardId: parentCardAuth.id,
    authorId: userAlex.id,
    content:
      'Hey @sarah@syncboard.dev, please make sure the token rotation detects replay attacks and revokes the whole token family.',
  });
  const commentReply = await ensureComment({
    cardId: parentCardAuth.id,
    authorId: userSarah.id,
    parentCommentId: commentRoot.id,
    content:
      'Already implemented! When a revoked token is presented, all descendant tokens in the family are purged immediately.',
  });
  await ensureComment({
    cardId: parentCardAuth.id,
    authorId: userMarcus.id,
    parentCommentId: commentReply.id,
    content:
      'Verified locally with concurrent client requests. All test assertions pass! @alex@syncboard.dev ready for review.',
  });
  await ensureComment({
    cardId: parentCardRealtime.id,
    authorId: userSarah.id,
    content:
      'Redis stream channels are active. Multi-node synchronization latency is under 15ms. @elena@syncboard.dev looks fantastic!',
  });
  await ensureComment({
    cardId: cardFields.id,
    authorId: userElena.id,
    content: 'Draft validation rules — superseded, keeping for history.',
    deletedAt: daysFromNow(-1),
  });

  log('comments', '3-level thread + standalone + soft-deleted');

  // ---- 13. Attachments: file / image / link + archived (idempotent) -----------------
  const attachmentSpec = await ensureAttachment({
    cardId: parentCardAuth.id,
    name: 'oauth-architecture.pdf',
    type: AttachmentType.file,
    url: 'https://example.com/files/oauth-architecture.pdf',
    uploadedById: userAlex.id,
    mimeType: 'application/pdf',
    fileSize: 248112,
  });
  await ensureAttachment({
    cardId: parentCardAuth.id,
    name: 'login-flow.png',
    type: AttachmentType.image,
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
    uploadedById: userSarah.id,
    mimeType: 'image/png',
    fileSize: 184320,
    coverUrl:
      'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&auto=format&fit=crop&q=80',
  });
  await ensureAttachment({
    cardId: parentCardRealtime.id,
    name: 'presence-figma',
    type: AttachmentType.link,
    url: 'https://figma.com/file/seed-presence-cursors',
    uploadedById: userMarcus.id,
  });
  await ensureAttachment({
    cardId: cardFields.id,
    name: 'old-wireframe.pdf',
    type: AttachmentType.file,
    url: 'https://example.com/files/old-wireframe.pdf',
    uploadedById: userElena.id,
    mimeType: 'application/pdf',
    fileSize: 102400,
    archivedAt: daysFromNow(-2),
  });

  log('attachments', 'file + image (cover) + link + archived');

  // ---- 14. Checklists: mixed / all-todo / empty (idempotent) -------------------------
  await ensureChecklist(parentCardAuth.id, 'Production Readiness Checklist', [
    { content: 'OAuth callback rate limiting configured', isDone: true },
    { content: 'HTTPS cookie encryption flags validated', isDone: true },
    { content: 'Penetration testing on token refresh flow', isDone: false },
  ]);
  await ensureChecklist(cardFields.id, 'Code Review Steps', [
    { content: 'Field validation unit tests pass', isDone: false },
    { content: 'Storybook stories for select/date/user fields', isDone: false },
  ]);
  await ensureChecklist(cardPerformance.id, 'Profiling Plan', []);

  log('checklists', 'mixed + all-todo + empty');

  // ---- 15. Documents + snapshots ------------------------------------------------------
  const docRfc = await ensureDocument({
    workspaceId: workspaceAcme.id,
    title: 'Sprint 24 Architecture RFC: Subcards & Time Tracking',
    previewText:
      'Technical specification covering parent-child card invariants, rollup calculations, and time tracking database schema.',
    createdBy: userAlex.id,
    parentCardId: parentCardAuth.id,
    status: DocumentStatus.active,
    yjsState: toBytes('seed-yjs-rfc-v1'),
  });
  const docStandalone = await ensureDocument({
    workspaceId: workspaceAcme.id,
    title: 'Engineering Handbook',
    previewText: 'Workspace-level standalone doc without a linked card.',
    createdBy: userSarah.id,
    parentCardId: null,
    status: DocumentStatus.active,
    yjsState: null,
  });
  const docArchived = await ensureDocument({
    workspaceId: workspaceAcme.id,
    title: 'Retired ADR: polling presence',
    previewText: 'Archived ADR superseded by WebSocket presence.',
    createdBy: userMarcus.id,
    parentCardId: null,
    status: DocumentStatus.archived,
  });
  const docRoadmap = await ensureDocument({
    workspaceId: workspaceRoadmap.id,
    title: 'Q4 Narrative: activation',
    previewText: 'Roadmap narrative linked to the activation objective.',
    createdBy: userSarah.id,
    parentCardId: roadmapCard1.id,
    status: DocumentStatus.active,
    yjsState: toBytes('seed-yjs-roadmap-v1'),
  });

  await ensureSnapshot({
    documentId: docRfc.id,
    createdBy: userAlex.id,
    snapshotName: 'v1 - initial RFC',
    yjsState: toBytes('seed-yjs-rfc-snapshot-v1'),
  });
  await ensureSnapshot({
    documentId: docRfc.id,
    createdBy: userSarah.id,
    snapshotName: null,
    yjsState: toBytes('seed-yjs-rfc-autosave'),
  });
  await ensureSnapshot({
    documentId: docStandalone.id,
    createdBy: userSarah.id,
    snapshotName: 'v1 - handbook outline',
    yjsState: toBytes('seed-yjs-handbook-v1'),
  });

  void docArchived;
  void docRoadmap;

  log(
    'documents',
    'linked + standalone + archived; 3 snapshots (incl. unnamed)',
  );

  // ---- 16. Refresh tokens: active + rotation chain + revoked -----------------------------
  const familyActive = randomUUID();
  const familyRotated = randomUUID();

  await ensureRefreshToken({
    userId: userAlex.id,
    tokenHash: 'seed-tokenhash-alex-active-001',
    familyId: familyActive,
    expiresAt: daysFromNow(30),
    ipAddress: '127.0.0.1',
    userAgent: 'SyncBoard seed (active session)',
  });

  // Rotation chain: old (revoked) -> new (active). Create new first so the link target exists.
  const rotatedNew = await ensureRefreshToken({
    userId: userAlex.id,
    tokenHash: 'seed-tokenhash-alex-rotated-new-001',
    familyId: familyRotated,
    expiresAt: daysFromNow(30),
    ipAddress: '127.0.0.1',
    userAgent: 'SyncBoard seed (rotated session)',
  });
  await ensureRefreshToken({
    userId: userAlex.id,
    tokenHash: 'seed-tokenhash-alex-rotated-old-001',
    familyId: familyRotated,
    expiresAt: daysFromNow(30),
    revokedAt: daysFromNow(-1),
    replacedBy: rotatedNew.id,
    ipAddress: '127.0.0.1',
    userAgent: 'SyncBoard seed (rotated session)',
  });

  await ensureRefreshToken({
    userId: userAlex.id,
    tokenHash: 'seed-tokenhash-alex-revoked-001',
    familyId: randomUUID(),
    expiresAt: daysFromNow(-1),
    revokedAt: daysFromNow(-2),
    ipAddress: '10.0.0.2',
    userAgent: 'SyncBoard seed (revoked session)',
  });

  await ensureRefreshToken({
    userId: userSarah.id,
    tokenHash: 'seed-tokenhash-sarah-active-001',
    familyId: randomUUID(),
    expiresAt: daysFromNow(30),
    ipAddress: '127.0.0.1',
    userAgent: 'SyncBoard seed (active session)',
  });

  log(
    'refresh-tokens',
    'active + rotated chain (replacedBy) + revoked/expired',
  );

  // ---- 17. Activities: every ActionType + representative EntityTypes ------------------------
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userAlex.id,
    action: ActionType.created,
    entityType: EntityType.card,
    entityId: parentCardAuth.id,
    entityTitle: parentCardAuth.title,
    toListId: listInProgress.id,
    details: { title: parentCardAuth.title },
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userSarah.id,
    action: ActionType.moved,
    entityType: EntityType.card,
    entityId: parentCardRealtime.id,
    entityTitle: parentCardRealtime.title,
    fromListId: listBacklog.id,
    toListId: listInProgress.id,
    details: { from: 'Backlog', to: 'In Progress' },
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userAlex.id,
    action: ActionType.updated,
    entityType: EntityType.board,
    entityId: boardSprint.id,
    entityTitle: boardSprint.title,
    details: { field: 'description' },
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userSarah.id,
    action: ActionType.archived,
    entityType: EntityType.list,
    entityId: listArchived.id,
    entityTitle: listArchived.title,
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userAlex.id,
    action: ActionType.unarchived,
    entityType: EntityType.card,
    entityId: cardArchived.id,
    entityTitle: cardArchived.title,
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userMarcus.id,
    action: ActionType.deleted,
    entityType: EntityType.comment,
    entityId: commentRoot.id,
    entityTitle: 'comment on OAuth 2.0 & SSO Integration',
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userAlex.id,
    action: ActionType.created,
    entityType: EntityType.attachment,
    entityId: attachmentSpec.id,
    entityTitle: attachmentSpec.name,
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userElena.id,
    action: ActionType.created,
    entityType: EntityType.label,
    entityId: labelBug.id,
    entityTitle: labelBug.name,
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userSarah.id,
    action: ActionType.created,
    entityType: EntityType.assignee,
    entityId: parentCardAuth.id,
    entityTitle: parentCardAuth.title,
    details: { assigneeId: userSarah.id },
  });
  await ensureActivity({
    boardId: boardSprint.id,
    userId: userAlex.id,
    action: ActionType.created,
    entityType: EntityType.document,
    entityId: docRfc.id,
    entityTitle: docRfc.title,
  });

  log(
    'activities',
    'created/updated/deleted/moved/archived/unarchived x board/list/card/comment/label/assignee/attachment/document',
  );

  // ---- Summary -------------------------------------------------------------------------------
  const counts = {
    users: await prisma.user.count(),
    workspaces: await prisma.workspace.count(),
    members: await prisma.workspaceMember.count(),
    invitations: await prisma.workspaceInvitation.count(),
    boards: await prisma.board.count(),
    lists: await prisma.list.count(),
    cards: await prisma.card.count(),
    comments: await prisma.cardComment.count(),
    attachments: await prisma.cardAttachment.count(),
    checklists: await prisma.cardChecklist.count(),
    checklistItems: await prisma.checklistItem.count(),
    documents: await prisma.document.count(),
    snapshots: await prisma.documentSnapshot.count(),
    fieldDefs: await prisma.cardFieldDef.count(),
    fieldValues: await prisma.cardFieldValue.count(),
    timeEntries: await prisma.cardTimeEntry.count(),
    refreshTokens: await prisma.refreshToken.count(),
    activities: await prisma.activityEvent.count(),
    stars: await prisma.userStarredBoard.count(),
  };
  console.log('📊 Seed counts:', JSON.stringify(counts, null, 2));
  console.log('🎉 Seeding successfully completed! All tables are populated.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
