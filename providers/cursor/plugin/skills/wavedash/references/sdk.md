# SDK Integration

Canonical docs:

- SDK overview: https://docs.wavedash.com/sdk/overview
- SDK setup: https://docs.wavedash.com/sdk/setup
- Players: https://docs.wavedash.com/sdk/players
- Achievements and stats: https://docs.wavedash.com/sdk/achievements
- Leaderboards: https://docs.wavedash.com/sdk/leaderboards
- Cloud saves: https://docs.wavedash.com/sdk/cloud-saves
- User-generated content: https://docs.wavedash.com/sdk/ugc
- Multiplayer lobbies: https://docs.wavedash.com/multiplayer/lobbies
- Networking: https://docs.wavedash.com/multiplayer/networking
- Events: https://docs.wavedash.com/sdk/events
- Types: https://docs.wavedash.com/sdk/types
- Functions: https://docs.wavedash.com/sdk/functions

## Required init

Every game must initialize Wavedash once when it is ready to show:

```javascript
Wavedash.init();
```

For games with loading work, report progress first:

```javascript
Wavedash.updateLoadProgressZeroToOne(0.0);
await loadAssets();
Wavedash.updateLoadProgressZeroToOne(1.0);
Wavedash.init();
```

For TypeScript/editor types:

```bash
npm install @wvdsh/sdk-js
```

```typescript
import Wavedash from "@wvdsh/sdk-js";

Wavedash.init({ debug: true });
```

The platform injects the SDK when the game runs on Wavedash. The npm package is
for types and import ergonomics.

## Feature routing

- Player identity: read `sdk/players`.
- Achievements or stats: define items in Developer Portal or CLI, then read
  `sdk/achievements`.
- Leaderboards: read `sdk/leaderboards`.
- Cloud saves: read `sdk/cloud-saves`.
- User-generated content: read `sdk/ugc`.
- Multiplayer: read `multiplayer/lobbies` first, then `multiplayer/networking`.
- Events and exact method names: read `sdk/events`, `sdk/functions`, and
  `sdk/types`.

## Traps to avoid

- Do not call multiplayer join logic before subscribing to the relevant lobby
  events.
- Creating a lobby already joins it; do not immediately call join on the lobby
  returned by create unless the docs say otherwise.
- Do not invent identifiers for achievements/stats in code without making sure
  they exist in the game configuration.
- Do not assume local browser testing equals Wavedash testing; run `wavedash dev`
  or test an uploaded build.
