import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentService } from '../../services/document.service';
import { DocumentRepository } from '../../repositories/document.repository';
import { EntityNotFoundException } from '../../../../common/exceptions/app.exception';
import { DOCUMENT_EVENTS } from '../../constants';
import {
  DocumentCreatedEvent,
  DocumentRenamedEvent,
  DocumentArchivedEvent,
} from '../../events/document.events';

const DOC = '00000000-0000-4000-8000-000000000001';

describe('DocumentService', () => {
  let service: DocumentService;
  let repo: DeepMockProxy<DocumentRepository>;
  let emitter: DeepMockProxy<EventEmitter2>;

  beforeEach(() => {
    repo = mockDeep<DocumentRepository>();
    emitter = mockDeep<EventEmitter2>();
    service = new DocumentService(repo, emitter);
  });

  describe('create', () => {
    it('creates a standalone document with the default title and emits created', async () => {
      repo.create.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
        title: 'Untitled',
        parentCardId: null,
        createdBy: 'u-1',
      } as any);

      const result = await service.create('ws-1', {}, 'u-1');

      expect(repo.create).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        title: 'Untitled',
        createdBy: 'u-1',
        parentCardId: null,
      });
      expect(emitter.emit).toHaveBeenCalledTimes(1);
      const [eventKey, event] = emitter.emit.mock.calls[0];
      expect(eventKey).toBe(DOCUMENT_EVENTS.created);
      expect(event).toBeInstanceOf(DocumentCreatedEvent);
      expect(event.boardId).toBeNull();
      expect(result.id).toBe(DOC);
    });

    it('resolves the board through the parent card chain when linked', async () => {
      repo.cardExistsInWorkspace.mockResolvedValue(true);
      repo.findBoardIdByCard.mockResolvedValue('b-1');
      repo.create.mockResolvedValue({
        id: DOC,
        parentCardId: 'c-1',
        title: 'Linked',
      } as any);

      await service.create(
        'ws-1',
        { title: 'Linked', parentCardId: 'c-1' },
        'u-1',
      );

      const [, event] = emitter.emit.mock.calls[0];
      expect(event.boardId).toBe('b-1');
      expect(event.parentCardId).toBe('c-1');
      expect(event.title).toBe('Linked');
    });

    it('throws when the parent card is not in the workspace', async () => {
      repo.cardExistsInWorkspace.mockResolvedValue(false);

      await expect(
        service.create('ws-1', { parentCardId: 'c-404' }, 'u-1'),
      ).rejects.toThrow(EntityNotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the active document', async () => {
      repo.findActiveById.mockResolvedValue({ id: DOC } as any);

      await expect(service.findById(DOC)).resolves.toEqual({ id: DOC });
    });

    it('returns the active document when workspace matches', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);

      await expect(service.findById(DOC, 'ws-1')).resolves.toEqual({
        id: DOC,
        workspaceId: 'ws-1',
      });
    });

    it('throws when the document is absent or archived', async () => {
      repo.findActiveById.mockResolvedValue(null);

      await expect(service.findById(DOC)).rejects.toThrow(
        new EntityNotFoundException('Document', DOC),
      );
    });

    it('throws when workspace does not match', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);

      await expect(service.findById(DOC, 'ws-2')).rejects.toThrow(
        new EntityNotFoundException('Document', DOC),
      );
    });
  });

  describe('listInWorkspace', () => {
    it('uses the cursor branch without a search term and defaults the limit', async () => {
      repo.findPage.mockResolvedValue([{ id: DOC }] as any);

      const result = await service.listInWorkspace('ws-1', {});

      expect(repo.findPage).toHaveBeenCalledWith('ws-1', undefined, 20);
      expect(result.items).toEqual([{ id: DOC }]);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('trims the search term and switches to the full-text branch', async () => {
      repo.searchPage.mockResolvedValue([
        { id: DOC },
        { id: '00000000-0000-4000-8000-000000000002' },
        { id: '00000000-0000-4000-8000-000000000003' },
      ] as any);

      const result = await service.listInWorkspace('ws-1', {
        search: '  alpha  ',
        limit: 2,
      });

      expect(repo.searchPage).toHaveBeenCalledWith('ws-1', 'alpha', undefined, 2);
      expect(result.items).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.cursor).toBe(
        '00000000-0000-4000-8000-000000000002',
      );
    });

    it('ignores whitespace-only search terms', async () => {
      repo.findPage.mockResolvedValue([]);

      await service.listInWorkspace('ws-1', { search: '   ' });

      expect(repo.searchPage).not.toHaveBeenCalled();
      expect(repo.findPage).toHaveBeenCalled();
    });

    it('passes cursor to repository findPage', async () => {
      repo.findPage.mockResolvedValue([{ id: DOC }] as any);

      const result = await service.listInWorkspace('ws-1', {
        cursor: '00000000-0000-4000-8000-000000000099',
        limit: 5,
      });

      expect(repo.findPage).toHaveBeenCalledWith(
        'ws-1',
        '00000000-0000-4000-8000-000000000099',
        5,
      );
      expect(result.items).toEqual([{ id: DOC }]);
    });
  });

  describe('listByCard', () => {
    it('returns the documents of a card in the workspace', async () => {
      repo.cardExistsInWorkspace.mockResolvedValue(true);
      repo.findByCard.mockResolvedValue([{ id: DOC }] as any);

      const result = await service.listByCard('ws-1', 'c-1');

      expect(result).toEqual([{ id: DOC }]);
    });

    it('throws when the card is not in the workspace', async () => {
      repo.cardExistsInWorkspace.mockResolvedValue(false);

      await expect(service.listByCard('ws-1', 'c-404')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('listByBoard', () => {
    it('returns the documents attached to cards on the board', async () => {
      repo.findByBoard.mockResolvedValue([
        {
          id: DOC,
          parentCard: { id: 'c-1', title: 'Feature' },
        } as any,
      ]);

      const result = await service.listByBoard('ws-1', 'b-1');

      expect(repo.findByBoard).toHaveBeenCalledWith('ws-1', 'b-1');
      expect(result).toEqual([
        {
          id: DOC,
          parentCard: { id: 'c-1', title: 'Feature' },
        },
      ]);
    });
  });

  describe('rename', () => {
    it('renames and emits renamed', async () => {
      repo.findActiveById.mockResolvedValue({ id: DOC } as any);
      repo.rename.mockResolvedValue({ id: DOC, title: 'New title' } as any);

      const result = await service.rename(DOC, { title: 'New title' }, 'u-1');

      expect(repo.rename).toHaveBeenCalledWith(DOC, 'New title');
      expect(emitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.renamed,
        new DocumentRenamedEvent(DOC, 'New title', 'u-1'),
      );
      expect(result.title).toBe('New title');
    });

    it('renames with workspace scope', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);
      repo.rename.mockResolvedValue({ id: DOC, title: 'Scoped' } as any);

      const result = await service.rename(
        DOC,
        { title: 'Scoped' },
        'u-1',
        'ws-1',
      );

      expect(result.title).toBe('Scoped');
    });

    it('throws when the document is absent', async () => {
      repo.findActiveById.mockResolvedValue(null);

      await expect(service.rename(DOC, { title: 'x' }, 'u-1')).rejects.toThrow(
        EntityNotFoundException,
      );
      expect(repo.rename).not.toHaveBeenCalled();
    });

    it('throws when workspace mismatches on rename', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);

      await expect(
        service.rename(DOC, { title: 'x' }, 'u-1', 'ws-2'),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('archive', () => {
    it('archives and emits archived with the workspace scope', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);
      repo.archive.mockResolvedValue({ id: DOC, status: 'archived' } as any);

      const result = await service.archive(DOC, 'u-1');

      expect(repo.archive).toHaveBeenCalledWith(DOC);
      expect(emitter.emit).toHaveBeenCalledWith(
        DOCUMENT_EVENTS.archived,
        new DocumentArchivedEvent(DOC, 'ws-1', 'u-1'),
      );
      expect(result.status).toBe('archived');
    });

    it('archives with workspace scope', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);
      repo.archive.mockResolvedValue({ id: DOC, status: 'archived' } as any);

      const result = await service.archive(DOC, 'u-1', 'ws-1');

      expect(result.status).toBe('archived');
    });

    it('throws when the document is absent', async () => {
      repo.findActiveById.mockResolvedValue(null);

      await expect(service.archive(DOC, 'u-1')).rejects.toThrow(
        EntityNotFoundException,
      );
    });

    it('throws when workspace mismatches on archive', async () => {
      repo.findActiveById.mockResolvedValue({
        id: DOC,
        workspaceId: 'ws-1',
      } as any);

      await expect(service.archive(DOC, 'u-1', 'ws-2')).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });
});
