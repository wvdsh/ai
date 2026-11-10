# Engine Guides

Canonical docs:

- Engine index: https://docs.wavedash.com/engines

Use the engine-specific guide before changing build settings. If no exact
engine guide exists, use the custom web build guide.

## General rule

Wavedash needs a folder of browser-playable static files. Engine-less builds
need an entrypoint (default `index.html`); Godot/Unity exports and
jsdos/ruffle configs boot through Wavedash's own loader, and `[renpy]` builds
boot the `index.html` in `upload_dir`. `wavedash.toml` should point `upload_dir` to that built
folder.

Common output directories:

- Vite/React/Three.js/Phaser: `dist`
- Godot web export: often `build` or export folder chosen by the project
- Unity WebGL: often `build` or the WebGL build output folder
- Unreal Engine 5.9+ (Wasm target, C++ projects, emscripten 6.0.10): the staged
  `Wasm` folder from `BuildCookRun -platform=Wasm -archive -archivedirectory=build`
  (never `Wasm-Debug`), with no engine section and `entrypoint = "index.html"`.
  Package Shipping with `-AdditionalPackageOptions=-WasmNoBrotli`. A page script in
  `Build/Wasm/Template/` loaded by `IntroShellScript` calls `Wavedash.init()`. See
  https://docs.wavedash.com/engines/unreal
- custom HTML/JS: folder containing `index.html`

## Before upload

- Run the project’s production build/export command.
- Confirm the output folder contains the playable entrypoint.
- Confirm assets are relative and included in the output folder.
- Run `wavedash dev` from the project root if possible.
- If an engine needs a special loader or executable config, read that engine’s
  guide before editing `wavedash.toml`.
