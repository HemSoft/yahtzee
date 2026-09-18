# Yahtzee

A dice game for web, Electron desktop and Expo mobile, sharing a TypeScript game engine. Play one local human against zero to three AI opponents. Convex stores completed game logs and leaderboards.

Remote play with friends is not implemented. There is no room creation, join flow or shared live-game API. Local solo play still requires a configured Convex backend at startup; this is not an offline application.

## Implemented gameplay

- Five-dice play and extended six-or-more-dice modes. Web and desktop offer custom counts from 2 to 20; mobile offers 5, 6, 8 and 10.
- One human player and up to three local AI opponents. AI turns use a single roll and greedy category selection.
- Dice holding, up to three rolls per turn, scorecard totals and upper-section bonuses.
- House-rule scoring includes pairs and scores three/four of a kind using matching dice only. The five-dice scorecard has 15 categories, rather than the standard 13-category Yahtzee sheet.
- Shared completed-game history and top-ten leaderboards per dice count. Display names are not authenticated account identities.

## Stack and layout

| Directory | Role |
|---|---|
| `apps/web` | React and Vite web application |
| `apps/desktop` | Electron and electron-vite application |
| `apps/mobile` | Expo and React Native application |
| `packages/game-engine` | Dice, scoring, totals and AI rules |
| `packages/ui` | Shared web/desktop React controls and theme values |
| `convex` | Schema, completed logs and leaderboard functions |

The project uses Bun workspaces. Native mobile renders its own controls; it does not render the shared HTML scorecard.

## Setup

Use Bun 1.3.7 or a compatible version and Node.js 20 or newer. The current Windows validation used Node 24.12.0. Install the checked-in dependency versions:

```sh
bun install --frozen-lockfile
```

### Backend and environment

1. Run `bun run dev:convex` from the repository root and follow the Convex development-project setup. This can create deployment configuration and deploy development functions. Use a development project, not production, for local testing.
2. Copy `.env.local.example` to `.env.local` in the repository root. Set `VITE_CONVEX_URL` to the development deployment's HTTPS URL. Both Vite configurations explicitly read environment files from this root.
3. For mobile, create `apps/mobile/.env.local` and set `EXPO_PUBLIC_CONVEX_URL` to the same URL. Expo runs from the mobile workspace and reads its environment there; putting only the Expo variable in the repository root is not enough.
4. Restart the frontend after changing environment values. Never commit local environment files or deployment credentials.

Example values, to replace with your own development URL:

```dotenv
# Repository-root .env.local, for web and desktop
VITE_CONVEX_URL=https://your-development-deployment.convex.cloud
```

```dotenv
# apps/mobile/.env.local, for Expo
EXPO_PUBLIC_CONVEX_URL=https://your-development-deployment.convex.cloud
```

The deployment URL is client-visible, not a secret. Do not put Convex deploy keys or other credentials in `VITE_` or `EXPO_PUBLIC_` variables. Missing URLs currently stop the applications with a startup error, including solo play.

### Run

Keep the development backend command running in one terminal and start one client in another:

```sh
bun run dev:web
bun run dev:desktop
bun run dev:mobile
```

Mobile device/simulator setup and native packaging require the corresponding Expo/platform tooling. A successful TypeScript check or desktop bundle does not prove a native package is signed or installable.

### Validate and build

```sh
bun run test          # Engine unit tests
bun run test:watch    # Watch mode
bun run typecheck     # All five workspaces and Convex
bun run build:web
bun run build:desktop
```

`bun run lint` is declared but its dependency/configuration repair is tracked in [issue #9](https://github.com/HemSoft/yahtzee/issues/9). No production deployment is needed for these checks. A frontend build without a URL can compile, but it will not start successfully until configured.

## Planned work

Remote human multiplayer is planned, not part of the current application. Do not interpret shared leaderboards as live multiplayer. Server-side result integrity, replay handling and application journey tests are tracked in the [issue queue](https://github.com/HemSoft/yahtzee/issues).

## License

[MIT](LICENSE).
