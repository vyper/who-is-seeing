# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Who Is Seeing is a real-time viewer tracking widget that displays "X viewing this" on any webpage. It uses PocketBase as the backend for data persistence and Server-Sent Events (SSE) for real-time updates.

## Tech Stack

- **Backend**: PocketBase (embedded Go server with SQLite)
- **Frontend**: Vanilla JavaScript (no build tools)
- **Deployment**: Docker + Fly.io
- **Real-time**: Server-Sent Events (SSE)

## Commands

```bash
# Local development - run PocketBase directly
./pocketbase serve

# Build Docker image
docker build -t who-is-seeing .

# Deploy to Fly.io
fly deploy
```

## Architecture

```
├── pb_public/widget.js    # Client-side widget (IIFE, self-contained)
├── pb_hooks/main.pb.js    # PocketBase server-side hooks (cleanup cron)
├── Dockerfile             # Alpine + PocketBase binary
└── fly.toml               # Fly.io deployment config
```

### Widget (`pb_public/widget.js`)

Two main classes:
- **ViewerTracker**: Handles PocketBase communication, session management, heartbeat (30s interval), and SSE subscriptions
- **ViewerWidget**: Renders the UI (fixed bottom-right position), manages visibility based on viewer count

Exposes `window.WhoIsSeeing` global with:
- `getCount()`: Returns current viewer count
- `tracker.onCountChange(callback)`: Subscribe to count changes

### Backend Hooks (`pb_hooks/main.pb.js`)

Cleanup cron job runs every minute to remove stale sessions (inactive >2 minutes).

### Database

PocketBase collection `viewers` with fields:
- `url` (text): Page URL being viewed
- `session_id` (text): Unique session identifier

Composite unique index on `(url, session_id)` prevents duplicate sessions.

## Integration

```html
<script>
  window.WhoIsSeeing = { pbUrl: 'https://who-is-seeing.fly.dev' };
</script>
<script src="https://who-is-seeing.fly.dev/widget.js"></script>
```
