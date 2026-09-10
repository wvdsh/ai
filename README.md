# Wavedash AI

AI integration assets for Wavedash.

The canonical skill source lives in the Wavedash docs repo under `skills/` and
is served from `https://docs.wavedash.com/.well-known/skills/index.json`.
This repo syncs that source into `skills/` so agent platforms can install or
index the published assets from GitHub.

The `mcp/` package contains a read-only, unauthenticated remote MCP server for
public Wavedash docs. It does not access user accounts, local files, builds, or
private Wavedash data.

Provider plugins include Wavedash skills and, where supported, bundled config
for the hosted remote MCP server.

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

The Wavedash remote MCP server is live at:

```text
https://mcp.wavedash.com/mcp
```

It is read-only and unauthenticated. It exposes public Wavedash docs, SDK
guidance, engine setup help, and publishing checklists for agents.

Remote MCP clients that support Streamable HTTP can connect directly to the
endpoint above.

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

Pushes to `main` automatically deploy the MCP Worker when MCP source,
dependencies, Worker configuration, root package scripts, or the deployment
workflow change. Documentation, skills, and submission files do not trigger a
deployment. The `Deploy MCP to Production` GitHub Actions workflow also supports
manual runs and loads deployment credentials through Doppler.

Deploy the MCP Worker directly from an environment that provides Cloudflare credentials:

```bash
npm run mcp:deploy
```

## License

MIT
