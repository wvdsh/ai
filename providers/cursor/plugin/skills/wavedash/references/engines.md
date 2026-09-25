# Engine Guides

Canonical docs:

- Engine index: https://docs.wavedash.com/engines

Use the engine-specific guide before changing build settings. If no exact
engine guide exists, use the custom web build guide.

## General rule

Wavedash needs a folder of browser-playable static files. Engine-less builds
need an entrypoint (default `index.html`); Godot/Unity exports and
jsdos/ruffle/renpy configs boot through Wavedash's own loader. `wavedash.toml` should point `upload_dir` to that built
folder.

Common output directories:

- Vite/React/Three.js/Phaser: `dist`
- Godot web export: often `build` or export folder chosen by the project
- Unity WebGL: often `build` or the WebGL build output folder
- custom HTML/JS: folder containing `index.html`

## Before upload

- Run the project’s production build/export command.
- Confirm the output folder contains the playable entrypoint.
- Confirm assets are relative and included in the output folder.
- Run `wavedash dev` from the project root if possible.
- If an engine needs a special loader or executable config, read that engine’s
  guide before editing `wavedash.toml`.
