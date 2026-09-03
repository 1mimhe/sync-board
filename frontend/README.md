# SyncBoard Frontend 🚀

> Modern, blazing-fast real-time collaborative workspace, Kanban board, and document management client built with **React 19**, **TypeScript**, and **Vite**.

---

## 📸 Screenshots & Visual Tour

> [!TIP]
> **To add screenshots**: Take 16:9 high-resolution screenshots of the running application and save them to `frontend/docs/screenshots/` matching the filenames below. Markdown preview will automatically render them.

### 1. Workspaces Dashboard
_Browse, search, and manage your personal and team workspaces with slug-based routing._

![Workspaces Dashboard](docs/screenshots/01-workspaces-dashboard.png)
<!-- Screenshot guide: Navigate to http://localhost:5173/workspaces with 2+ workspaces created -->

---

### 2. Real-Time Kanban Board
_Drag-and-drop lists and cards powered by LexoRank with real-time multiplayer updates._

![Kanban Board View](docs/screenshots/02-kanban-board.png)
<!-- Screenshot guide: Open a board with To Do, In Progress, and Done lists populated with cards -->

---

### 3. Card Detail & Checklists
_Inspect assignees, colored labels, due dates, checklists, attachments, comments, and linked documents._

![Card Detail Modal](docs/screenshots/03-card-detail-modal.png)
<!-- Screenshot guide: Click any card to open the CardModal with populated checklists and comments -->

---

### 4. Collaborative Document Editor
_Live multiplayer markdown documentation with real-time awareness and snapshot history._

![Document Editor](docs/screenshots/04-document-editor.png)
<!-- Screenshot guide: Open a workspace document in /workspaces/:wid/docs/:did with headings and code blocks -->

---

### 5. Workspace Members & Role-Based Access Control
_Manage workspace members, transfer ownership, assign roles (`owner`, `admin`, `member`, `viewer`), and handle pending email invitations._

![Workspace Members](docs/screenshots/05-workspace-members.png)
<!-- Screenshot guide: Open Workspace Settings modal -> Members / Invitations tab -->

---

### 6. Real-Time Activity Drawer
_Full audit trail of workspace and board modifications streaming over WebSockets in real time._

![Activity Drawer](docs/screenshots/06-activity-drawer.png)
<!-- Screenshot guide: Click the 'Activity' button in the Board header to slide open the ActivityDrawer -->

---

## ✨ Features

- **Multi-Tenant Workspaces**:
  - Slug-based and UUID-based routing (`/workspaces/:slugOrId`).
  - Granular Role-Based Access Control (RBAC): `owner`, `admin`, `member`, and `viewer`.
  - Email invitation dispatch with secure token handling and MailHog acceptance.
  - Workspace-level shared labels and customizable settings.

- **Real-Time Collaborative Kanban**:
  - Fluid Drag & Drop for lists and cards using `@hello-pangea/dnd`.
  - Deterministic LexoRank ordering for zero-conflict reordering at scale.
  - WebSocket synchronization (`board:join`, `board:leave`, `board:presence`, mutations relay).
  - Multi-user presence badges and live cursor broadcast relay.
  - Soft-delete (archiving) with two-step restoration or permanent deletion.

- **Comprehensive Card Features**:
  - Title, description, due date tracking, and completion toggles.
  - Workspace and board label assignment with color indicators.
  - Member assignees with user avatar tooltips.
  - Checklists with interactive progress indicators.
  - File attachments and URL link bookmarks.
  - Real-time discussion thread with comment history and author attribution.
  - Linked workspace documents directly accessible from the card modal.

- **Real-Time Markdown Documents**:
  - Live collaborative document editor powered by Socket.io and Yjs.
  - Editor presence tracking (viewers, active cursor line/column indicators).
  - Snapshot version history with instant rollback preview.
  - Document association with boards and cards.

- **Resilient Authentication**:
  - Dual-token model: short-lived 15m JWT access token + secure HttpOnly refresh cookie.
  - Automatic silent refresh interceptor with token rotation & reuse protection.
  - Single-device and "Logout All Devices" session revocation.
  - Google OAuth single sign-on redirect callback (`/auth/callback`).
  - Email verification banner with resend throttling and password reset flow.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict mode) |
| **Build Tool** | [Vite 8](https://vitejs.dev/) with HMR |
| **Routing** | [React Router v7](https://reactrouter.com/) |
| **State Management** | [Zustand v5](https://zustand-demo.pmnd.rs/) (`auth`, `workspace`, `toast`) |
| **Real-Time Sockets** | [Socket.io Client v4](https://socket.io/) |
| **CRDT Collaboration** | [Yjs](https://yjs.dev/) |
| **Drag & Drop** | [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) |
| **Styling** | Vanilla CSS (`index.css`) design tokens, modern glassmorphism & dark palette |
| **Linter** | [Oxlint](https://oxc.rs/) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`+ recommended.
- **Backend Service**: Ensure the SyncBoard backend API is running on `http://localhost:3000`.
  ```bash
  # In the root repository:
  docker compose up -d       # Starts PostgreSQL, Redis, MailHog
  npm run start:dev          # Starts backend on port 3000
  ```

### Installation

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## 💻 Running the Application

### Development Server

Start Vite development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The app will be available at:
👉 **[http://localhost:5173](http://localhost:5173)**

> [!NOTE]
> The Vite dev server (`vite.config.ts`) is preconfigured with reverse-proxy rules:
> - `^/api/.*` ➔ `http://127.0.0.1:3000`
> - `^/socket.io/.*` ➔ `http://127.0.0.1:3000` (with WebSocket upgrade enabled)
> No manual CORS configuration is required for local development.

### Production Build

Typecheck and generate the optimized production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## 🧪 Linting & Quality Checks

Run fast Rust-powered Oxlint across all TypeScript and TSX files:

```bash
npm run lint
```

Typecheck without emitting artifacts:

```bash
npx tsc --noEmit
```

---

## 📁 Directory Structure

```text
frontend/
├── public/                     # Static assets (favicons, SVG icon sprites)
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── api/                    # HTTP client and REST endpoint declarations
│   │   ├── client.ts           # Fetch wrapper with interceptors & auto-refresh
│   │   └── endpoints.ts        # Typed API calls for Auth, Workspace, Board, Card, Doc
│   ├── components/             # Reusable UI component slices
│   │   ├── auth/               # EmailVerificationBanner, ProfileModal, FloatingLogout
│   │   ├── board/              # BoardCanvas, BoardHeader, ActivityDrawer, Modals
│   │   ├── card/               # CardModal, ChecklistSection, CommentSection, Pickers
│   │   ├── common/             # Header, Sidebar, Modal, ConfirmDialog, Avatar, Toast
│   │   ├── document/           # DocumentEditor, MarkdownViewer, SnapshotHistory
│   │   └── workspace/          # WorkspaceSettingsModal, MembersTab, InvitationsTab
│   ├── pages/                  # Page routes
│   │   ├── AuthCallbackPage.tsx    # OAuth callback token exchange & redirect
│   │   ├── BoardPage.tsx           # Board view with realtime sockets
│   │   ├── DocumentPage.tsx        # Document editor view
│   │   ├── DocumentsListPage.tsx   # Workspace documents directory
│   │   ├── ForgotPasswordPage.tsx  # Password reset request form
│   │   ├── HealthPage.tsx          # System health check monitor
│   │   ├── InvitePage.tsx          # Public invitation acceptance screen
│   │   ├── LoginPage.tsx           # Email/password + Google login
│   │   ├── RegisterPage.tsx        # Account registration
│   │   ├── ResetPasswordPage.tsx   # Password reset with email token
│   │   ├── VerifyEmailPage.tsx     # Email verification completion
│   │   ├── WorkspaceDetailPage.tsx # Boards & management overview
│   │   └── WorkspacesPage.tsx      # User workspace selector
│   ├── socket/                 # Socket.io connection manager
│   │   └── socket.ts           # Realtime connection & event listener registry
│   ├── stores/                 # Zustand state stores
│   │   ├── auth.store.ts       # User session, JWT tokens, logout handlers
│   │   ├── toast.store.ts      # Global notifications & toast alerts
│   │   └── workspace.store.ts  # Active workspace & membership role state
│   ├── types/                  # Global TypeScript contracts and DTO interfaces
│   │   └── index.ts
│   ├── App.tsx                 # Root layout, router setup & AuthBootstrapper
│   ├── index.css               # Global CSS tokens, resets & utility classes
│   └── main.tsx                # React DOM root entry point
├── package.json
├── tsconfig.json
└── vite.config.ts              # Vite proxy & React plugin configuration
```

---

## 🧭 Step-by-Step User Guide

### 1. Account Setup
1. Open [http://localhost:5173/register](http://localhost:5173/register).
2. Register an account with your email, display name, and password (min 8 chars, mixed case, number, special char).
3. If mail verification is enabled, check MailHog at [http://localhost:8025](http://localhost:8025) and click the verification link.

### 2. Creating a Workspace
1. In the **Workspaces** page, click **+ New Workspace**.
2. Enter a unique workspace name and slug.
3. Invite collaborators via their email address and select their initial permission tier.

### 3. Working with Boards & Cards
1. Inside a workspace, click **Create Board**.
2. Add workflow lists (e.g. *Backlog*, *In Progress*, *Review*, *Done*).
3. Add cards. Click any card to set due dates, assign team members, attach checklists, link documents, or leave comments.
4. Drag cards across lists to watch real-time LexoRank recalculations update instantly for other connected team members.

### 4. Creating Collaborative Documents
1. Open the **Documents** tab from the sidebar.
2. Click **+ New Document** to create a rich markdown document.
3. Multiple users can edit the document concurrently with live presence indicators showing active cursor positions.
4. Use **Snapshot History** to inspect earlier versions or restore prior milestones.

---

## 📄 License

This project is part of the **SyncBoard** monorepo licensed under the [MIT License](../LICENSE).
