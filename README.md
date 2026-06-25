# Wavedash AI

AI integration assets for Wavedash.

The canonical skill source lives in the Wavedash docs repo under `skills/` and
is served from `https://docs.wavedash.com/.well-known/skills/index.json`.
This repo syncs that source into `skills/` so agent platforms can install or
index the published assets from GitHub.

No MCP server is bundled here. This repo is for skills and provider plugin
packaging.

## Layout

- `skills/` - synced canonical skills for platforms that consume skills directly.
- `providers/claude/plugin/` - Claude Code plugin package.
- `providers/cursor/plugin/` - Cursor plugin package.
- `providers/openai/plugin/` - Codex plugin package.
- `.claude-plugin/marketplace.json` - Claude Code marketplace manifest.
- `.cursor-plugin/marketplace.json` - Cursor marketplace manifest.
- `.agents/plugins/marketplace.json` - Codex marketplace manifest.
- `gemini-extension.json` - Gemini CLI extension manifest using the root
  `skills/` directory.

## Sync skills

Pull from the public docs endpoint:

```bash
npm run sync:skills
```

Pull from a local docs checkout:

```bash
WAVEDASH_SKILLS_SOURCE_DIR=/path/to/wvdsh/docs/skills npm run sync:skills
```

GitHub Actions runs the same sync daily and commits changes when docs updates
change the generated skill files.
