# SketchFlow

SketchFlow is a collaborative, browser-based canvas application for creating diagrams, shapes, and text notes. It provides authenticated board management, persistent PostgreSQL storage, REST APIs, and WebSocket-based collaboration.

## Capabilities

- Create and manage boards and board members.
- Draw circles, rectangles, points, polygons, polylines, lines, arrows, and freehand pen objects.
- Add, position, resize, and style text notes.
- Select and manipulate canvas objects with pan and zoom navigation.
- Persist board objects and operation history in PostgreSQL.
- Synchronize edits, cursor movement, and presence over WebSockets.
- Undo and redo object operations.
- Assign `owner`, `editor`, and `viewer` board roles.
- Fall back to local storage when the canvas is opened without a board or the API is unavailable.

## Architecture

The repository contains two runtime applications:

- The Vite and React frontend is defined in `src/` and bootstrapped by `src/main.tsx`.
- The Express API and WebSocket server are defined in `server/src/` and bootstrapped by `server/src/index.ts`.
- Shared canvas and collaboration contracts are defined in `shared/` and imported by both applications.
- PostgreSQL schema changes are applied from `server/migrations/`.

The frontend uses REST requests for authentication, board management, and initial object synchronization. Authenticated WebSocket clients connect to `/ws`, join a board, and exchange validated collaboration events. The server authorizes each operation before writing the resulting state and operation history, then broadcasts the confirmed event to board members.

## Technology

- React 19 and React Router
- TypeScript
- Vite
- Redux Toolkit
- Tailwind CSS and Radix UI
- Express 5
- PostgreSQL and `pg`
- WebSocket server using `ws`
- Zod request and event validation
- JWT authentication and bcrypt password hashing
- Vitest, Testing Library, Supertest, and V8 coverage

## Requirements

- Node.js with pnpm
- pnpm
- Docker with Docker Compose, for local PostgreSQL and integration testing

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create the local environment file:

```bash
copy .env.example .env
```

Set a unique `JWT_SECRET` containing at least 32 characters. Start PostgreSQL and apply the migrations:

```bash
docker compose up -d postgres
pnpm db:migrate
```

Start the frontend and API in separate terminals:

```bash
pnpm dev
pnpm server:dev
```

Alternatively, start both development processes with:

```bash
pnpm dev:all
```

The frontend runs on the Vite development port, normally `http://localhost:5173`. The API listens on port `3001` by default. The API health endpoint is available at `/health`.

## Environment Variables

The server validates its environment at startup. The supported variables are:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | API and WebSocket port | `3001` |
| `CORS_ORIGIN` | Comma-separated allowed frontend origins | `http://localhost:5173` |
| `JWT_SECRET` | JWT signing secret | Required, minimum 32 characters |
| `JWT_EXPIRES_IN` | JWT lifetime, such as `7d` or `2h` | `7d` |
| `NODE_ENV` | Runtime environment | `development` |
| `LOG_LEVEL` | Server log level | `info` |
| `VITE_API_URL` | Frontend base URL for REST requests | `http://localhost:3001` |
| `VITE_WS_URL` | Frontend base URL for WebSocket requests | Derived from `VITE_API_URL` |

Production deployments must provide a non-placeholder `JWT_SECRET` and an explicit `CORS_ORIGIN`. Do not commit `.env` or place real credentials in `.env.example`.

## User Workflow

1. Register or log in through the frontend.
2. Create or open a board from the board list.
3. Use the canvas toolbar to create and modify objects.
4. Use the mouse wheel to zoom and Shift-drag or middle-mouse drag to pan.
5. Press Delete to remove a selected object, Ctrl+Z to undo, and Ctrl+Y to redo.
6. Invite members and assign editor or viewer access from the board controls.

Boards opened from the board list are restored from the API after reload. The PostgreSQL `board_objects` table is the current-state recovery source; `board_operations` stores operation history used for audit, undo, and redo.

## Repository Layout

```text
src/
   auth/                    Authentication context and protected routes
   canvas/components/       Canvas renderer, toolbar, dialogs, and profile UI
   components/ui/           Shared UI primitives
   hooks/                   React hooks, including board persistence
   lib/                     Shared frontend utilities
   pages/                   Landing, authentication, board, canvas, and error pages
   services/                Authentication, board API, and WebSocket clients
   state/                   State-related frontend modules
   store/                   Redux store, slices, hooks, and local storage
   sync/                    Synchronization helpers
   tools/                   Frontend tools
   types/                   Frontend type declarations
   main.tsx                 React application entry point
shared/
   canvas.ts                Shared board and canvas object contracts
   collaboration.ts         Shared collaboration event contracts
server/
   src/
      collaboration/         WebSocket collaboration server
      config/                 Environment parsing and validation
      controllers/            HTTP request controllers
      db/                     PostgreSQL access and migration runner
      middleware/             Authentication, validation, and rate limiting
      repositories/           Persistence abstractions
      routes/                 Authentication and board routes
      services/               Authentication, board, and domain services
      app.ts                  Express application configuration
      index.ts                HTTP and WebSocket server entry point
   migrations/              Ordered PostgreSQL migrations
tests/                      Frontend, API, authorization, and security tests
```

## Development Commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite frontend development server |
| `pnpm server:dev` | Start the Express and WebSocket server |
| `pnpm dev:all` | Start frontend and server concurrently |
| `pnpm build` | Type-check and build the frontend and server |
| `pnpm server:build` | Type-check the server project |
| `pnpm preview` | Serve the production frontend build locally |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format the repository with Prettier |
| `pnpm db:migrate` | Apply pending PostgreSQL migrations |
| `pnpm test` | Run the Vitest test suite |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:coverage` | Generate the V8 coverage report in `coverage/` |
| `pnpm audit` | Audit production dependencies |

The automated test suite uses the configured test environment and does not require a running database for unit, validation, authorization, state, and security tests. REST integration tests and multi-client WebSocket checks require PostgreSQL, applied migrations, and the API server.

## Security Model

The API validates request bodies, route identifiers, pagination, canvas objects, roles, and operation identifiers with strict Zod schemas. JSON requests and WebSocket messages have size limits, authentication endpoints are rate-limited, and security headers are enabled.

JWTs are signed with the configured server secret and verified with HS256. Passwords are stored as bcrypt hashes. Board membership and roles are enforced server-side: owners manage board settings and membership, editors can modify objects and use undo/redo, and viewers have read-only access. WebSocket clients must authenticate and be members of a board before joining its collaboration room.

Errors are returned using the stable shape `{ "error": { "code": "...", "message": "..." } }`. Internal server, database, and filesystem details are not exposed in public error responses.