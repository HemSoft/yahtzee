# Yahtzee

Classic Yahtzee dice game with support for **5, 6, or N dice**, **multiplayer**, and **leaderboards**. Available as an Electron desktop app, Expo mobile app, and web app — all sharing a single codebase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI** | React + TypeScript |
| **Desktop** | Electron (electron-vite) |
| **Mobile** | React Native / Expo |
| **Web** | Vite + React |
| **Backend** | Convex (realtime DB + serverless functions) |
| **Package Manager** | Bun |
| **Monorepo** | Bun Workspaces |

## Project Structure

```
yahtzee/
├── apps/
│   ├── desktop/          # Electron desktop app
│   ├── mobile/           # Expo / React Native mobile app
│   └── web/              # Vite React web app
├── packages/
│   ├── game-engine/      # Pure TS game logic (rules, scoring, dice)
│   └── ui/               # Shared React components
├── convex/               # Convex backend (schema, queries, mutations)
└── package.json          # Bun workspace root
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Node.js](https://nodejs.org/) v20+ (for Convex CLI)

### Install

```bash
bun install
```

### Development

```bash
# Start Convex backend (required for multiplayer/leaderboards)
bun run dev:convex

# Start web app (fastest iteration)
bun run dev:web

# Start desktop app
bun run dev:desktop

# Start mobile app
bun run dev:mobile
```

### Testing

```bash
bun test              # Run game engine tests
bun run test:watch    # Watch mode
```

## Game Features

- **Variable dice**: Play classic 5-dice, extended 6-dice, or custom N-dice variants
- **Multiplayer**: Create games and play with friends in real-time
- **Leaderboards**: Track high scores across all game modes
- **Cross-platform**: Same game on desktop, mobile, and web
- **Scoring**: Full Yahtzee scoring — upper section (ones through sixes), lower section (3/4-of-a-kind, full house, straights, yahtzee, chance)

## License

MIT
