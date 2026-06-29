# Wavedash AI

AI integration assets for Wavedash.

The canonical skill source lives in the Wavedash docs repo under `skills/` and
is served from `https://docs.wavedash.com/.well-known/skills/index.json`.
This repo syncs that source into `skills/` so agent platforms can install or
index the published assets from GitHub.

The `mcp/` package contains a read-only, unauthenticated remote MCP server for
public Wavedash docs. It does not access user accounts, local files, builds, or
private Wavedash data.

## Layout

- `skills/` - synced canonical skills for platforms that consume skills directly.
- `providers/claude/plugin/` - Claude Code plugin package.
- `providers/cursor/plugin/` - Cursor plugin package.
- `providers/openai/plugin/` - Codex plugin package.
- `mcp/` - read-only remote MCP server for public Wavedash docs.
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

## MCP server

Run the docs-only MCP server locally:

```bash
cd mcp
npm install
npm start
```

The endpoint is `http://localhost:3000/mcp`.

Validate the Cloudflare Worker bundle without publishing:

```bash
npm run mcp:deploy:dry-run
```

Deploy the MCP Worker from an environment that provides Cloudflare credentials:

```bash
npm run mcp:deploy
```

## License

MIT
