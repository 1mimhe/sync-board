# SyncBoard

> A real-time collaborative task & document platform combining Kanban board management, Notion-like rich-text editing, and team workspace collaboration.

---

## 📌 Project Overview

**SyncBoard** is built as a production-grade **Modular Monolith** using **NestJS** (Node.js & TypeScript). It unites project management, document collaboration, and real-time event streaming in a single cohesive backend architecture.

### Key Features

- 🏢 **Workspaces & RBAC**: Multi-tenant team workspaces with fine-grained role-based access control (Owner, Admin, Member, Viewer).
- 📋 **Kanban Boards & Lexorank**: Drag-and-drop board lists and cards with fractional ordering (Lexorank).
- 📝 **Collaborative Documents**: Real-time rich-text collaborative document editing powered by CRDTs (**Yjs**).
- ⚡ **Real-Time Engine**: WebSocket event streaming for live cursors, presence, board updates, and notifications.
- 📜 **Activity Audit Trail**: Event-sourced append-only activity logging for compliance and history.
- 🔔 **Notification Infrastructure**: In-app notifications backed by **RabbitMQ** event queues.
- 📁 **File Attachments**: AWS S3 presigned URL uploads for cards and documents.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | NestJS (TypeScript) |
| **Database & ORM** | PostgreSQL 16+ & Prisma ORM (`@prisma/adapter-pg` pool) |
| **In-Memory Cache & Pub/Sub** | Redis 7+ (`ioredis`) |
| **Message Queue** | RabbitMQ 3.12+ |
| **Real-Time Synchronization** | Socket.IO / WebSockets & Yjs CRDT |
| **Security & Auth** | Passport.js, JWT, Google OAuth2, Helmet |
| **API Documentation** | OpenAPI 3.0 / Swagger UI (`/api/docs`) |
| **Logging & Tracing** | Structured Pino Logger (`nestjs-pino`) & Request Correlation IDs |

---

## 🏗️ Architecture & Module Structure

```text
src/
├── common/             # Cross-cutting concerns (Config, Database, Redis, Interceptors, Filters)
└── modules/
    ├── auth/           # Authentication, JWT, Google OAuth, Workspace Invitations
    ├── workspace/      # Multi-tenant Workspaces & Member Roles
    ├── board/          # Kanban Boards, Lists, Cards, Lexorank Ordering
    ├── document/       # Collaborative Documents (Yjs CRDT)
    ├── activity/       # Activity Audit Logs
    ├── notification/   # Real-time In-app Notifications
    └── file/           # S3 File Attachments & Presigned URLs
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js `^20.x` or `^22.x`
- PostgreSQL `^16.x`
- Redis `^7.x`
- RabbitMQ `^3.12.x` (optional for local dev)

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run database migrations:
   ```bash
   npx prisma db push
   ```

4. Start the application in development mode:
   ```bash
   npm run start:dev
   ```

---

## 📖 API Documentation

Once the application is running, access the interactive Swagger documentation at:
👉 **`http://localhost:3000/api/docs`**

---

> *Note: This is an interim public summary documentation. Comprehensive feature & deployment documentation will be updated upon final release.*
