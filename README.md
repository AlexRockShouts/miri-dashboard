# Miri Dashboard

A modern, high-performance web dashboard for interacting with and managing the **Miri Autonomous Agent** server.

## 🚀 Overview

The Miri Dashboard provides a streamlined interface for both developers and users to monitor the Miri server's health, manage sessions, and interact with the agent in real-time.

### Key Features:
- **Admin Dashboard**: Real-time overview of server health, active sessions, stored human profiles, and system configuration.
- **Reactive Prompt**: A modern chat interface using **WebSockets** for low-latency, streaming responses from the Miri agent.
- **Modern Stack**: Built with SvelteKit, Tailwind CSS 4, and shadcn-svelte for a premium look and feel.
- **SDK Powered**: Built directly on top of the `@miri/sdk` for reliable communication with the Miri API.

## 🏗️ Architecture

The project follows a modern decoupled architecture:

1.  **Frontend (SvelteKit)**: A server-rendered (SSR) and client-hydrated application that handles all UI logic and state management.
2.  **Styling (Tailwind CSS 4)**: Uses the latest Tailwind 4 engine with the `@tailwindcss/vite` plugin for lightning-fast builds and modern CSS features.
3.  **UI Components (shadcn-svelte)**: High-quality, accessible UI components customized for the Miri aesthetic.
4.  **SDK Integration**: Communicates with the Miri server via a locally-linked TypeScript SDK (`@miri/sdk`).
    -   **Admin Data**: Fetched server-side via `+page.server.ts` using the SDK's `Api` client.
    -   **Prompt Streaming**: Handles real-time communication via WebSockets directly from the browser.

## 🛠️ Prerequisites

- **Node.js**: v20 or later.
- **Miri Server**: A running instance of the Miri server (default: `http://localhost:8080`).
- **Miri SDK**: The TypeScript SDK must be available locally.

## ⚙️ Configuration

### Local SDK Setup
The project currently expects the `@miri/sdk` to be located at:
`../../GolandProjects/miri-main/api/sdk/typescript`

If your SDK is in a different location, you must update two files:
1.  `package.json`: Update the `dependencies["@miri/sdk"]` path.
2.  `vite.config.ts`: Update the `server.fs.allow` path to permit Vite to access the symlinked SDK source.

### Server URL & Authentication
The dashboard uses SvelteKit environment variables for configuration. Copy the example file to get started:
```bash
cp .env.example .env
```
Then, edit `.env` to match your Miri server settings:
- `PUBLIC_MIRI_SERVER_URL`: The URL of your Miri server (e.g., `http://localhost:8080`).
- `MIRI_SERVER_KEY`: The security key for authentication. It is used both server-side (for `X-Server-Key` headers) and client-side (passed to the Prompt view via a server load function).
    - For WebSockets, it is passed in the `Sec-WebSocket-Protocol` header during the handshake using the tokens `miri-key` and `YOUR_KEY`.
- `MIRI_ADMIN_USER`: The admin username for server-side API calls.
- `MIRI_ADMIN_PASSWORD`: The admin password for server-side API calls.

## 🧑‍💻 Development

The project includes a `Makefile` to simplify common tasks:

```bash
# Start the development server
make dev

# Build the project for production (automatically builds the local SDK first)
make build

# Preview the production build
make preview

# Run type checks and Svelte validation
make check

# Manually rebuild the local SDK
make sdk-build

# Clean build artifacts
make clean
```

### Manual Commands
If you don't have `make` installed:
- `npm run dev`: Start development server.
- `npm run build`: Build production app.
- `npm run check`: Run `svelte-check`.

## 📁 Project Structure

- `src/routes/admin`: Dashboard overview and system monitoring.
- `src/routes/prompt`: Real-time chat interface with WebSocket support.
- `src/lib/components/ui`: shadcn-svelte UI components.
- `src/lib/utils.ts`: Core utilities and TypeScript helpers.
- `Makefile`: Centralized task management.

---
Built with ❤️ for the Miri Ecosystem.
