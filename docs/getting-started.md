# Getting Started

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **AWS credentials** configured via `~/.aws/credentials`, `~/.aws/config`, or SSO
- **GCP credentials** (optional) via `gcloud auth application-default login`

## Installation

```bash
git clone https://github.com/FournineCS/turul-app.git
cd turul-app
npm install
```

### Native Module Rebuild

The app uses `better-sqlite3`, a native Node module. If you encounter build issues:

```bash
npm rebuild better-sqlite3
```

## Running the App

### Option 1: Desktop Mode (Electron)

```bash
# Recommended (avoids wait-on race conditions)
npm run dev:simple

# Alternative (can be unreliable)
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron window loading from Vite

### Option 2: Browser Mode (HTTP Server)

```bash
npm run dev:web
```

This starts:
- Vite dev server on `http://localhost:5173`
- Express API server on `http://localhost:3001`

Open `http://localhost:5173` in a browser. The renderer detects the non-Electron environment and uses HTTP requests instead of IPC.

### Option 3: Production Server

```bash
npm run server
```

Rebuilds `better-sqlite3`, compiles TypeScript, and starts the Express server on `PORT` (default 3001).

## Build & Package

```bash
# Compile TypeScript + bundle React
npm run build

# Package desktop app
npm run package          # Current platform
npm run package:mac      # macOS (dmg, zip)
npm run package:win      # Windows (nsis, zip)
npm run package:linux    # Linux (AppImage, deb)
```

Output goes to `release/`.

## Project Scripts

| Script | Description |
|--------|-------------|
| `dev:simple` | Vite + Electron (recommended for desktop dev) |
| `dev:web` | Vite + Express server (browser dev) |
| `dev:vite` | Vite dev server only |
| `dev:electron` | Wait for Vite, then launch Electron |
| `build` | Full build (Vite + TypeScript) |
| `build:vite` | Bundle renderer with Vite |
| `build:electron` | Compile main process TypeScript |
| `server` | Production HTTP server mode |
| `package` | Build + electron-builder |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port (server mode) |
| `DEVTOOLS` | - | Set to `1` to auto-open DevTools in Electron |

## Troubleshooting

### `npm run dev` hangs

Use `npm run dev:simple` instead. The `wait-on` tool used by `dev` can get stuck when run in background.

### SQLite build errors

```bash
npm rebuild better-sqlite3
```

### AWS credentials not found

Ensure your AWS CLI is configured:
```bash
aws sts get-caller-identity --profile <profile-name>
```

For SSO profiles:
```bash
aws sso login --profile <profile-name>
```
