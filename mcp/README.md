# Wavedash MCP

Read-only remote MCP server for Wavedash docs, SDK guidance, engine setup, and
publishing checklists.

This server is intentionally unauthenticated. It only reads public docs from
`https://docs.wavedash.com` and does not access user accounts, games, builds,
local files, API keys, or private Wavedash data.

## Tools

- `wavedash_search_docs` - search official Wavedash docs.
- `wavedash_get_agent_workflow` - get a concise end-to-end workflow for
  creating a browser game and preparing it for Wavedash upload.
- `wavedash_get_doc` - fetch a docs page as Markdown.
- `wavedash_get_quickstart` - get setup guidance for an engine and optional SDK
  features.
- `wavedash_get_sdk_reference` - fetch SDK reference docs for a topic.
- `wavedash_get_publishing_checklist` - get upload and publishing guidance.
- `wavedash_validate_config` - validate pasted `wavedash.toml` text.

## Run Locally

```bash
npm install
npm start
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

Health/info endpoint:

```text
http://localhost:3000/
```

## Docker

```bash
docker build -t wavedash-mcp .
docker run --rm -p 3000:3000 wavedash-mcp
```

## Cloudflare Workers

The Worker entrypoint is `src/worker.js`, configured by `wrangler.toml`.
It serves a stateless Streamable HTTP MCP endpoint at `/mcp`.

Local Worker dev:

```bash
npm run worker:dev
```

Validate the Worker bundle without publishing:

```bash
npm run deploy:dry-run
```

Deploy:

```bash
npm run deploy
```

From the repo root, use:

```bash
npm run mcp:deploy
```

The production MCP endpoint is:

```text
https://mcp.wavedash.com/mcp
```

`wrangler.toml` declares `mcp.wavedash.com` as a Cloudflare Workers Custom
Domain. If `wavedash.com` is in the same Cloudflare account, Wrangler can attach
the hostname without a manual DNS record.

## Remote Client Testing

Health/info endpoint:

```text
https://mcp.wavedash.com/
```

Cloudflare AI Playground can test the deployed endpoint directly:

```text
https://mcp.wavedash.com/mcp
```

Remote MCP clients that support Streamable HTTP can connect directly to the
same endpoint.

For Claude Desktop or other local MCP clients that expect stdio, use
`mcp-remote`:

```json
{
  "mcpServers": {
    "wavedash": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.wavedash.com/mcp"]
    }
  }
}
```

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port. |
| `WAVEDASH_DOCS_BASE_URL` | `https://docs.wavedash.com` | Public docs origin. |
| `WAVEDASH_MCP_FETCH_TIMEOUT_MS` | `10000` | Fetch timeout for docs requests. |
| `WAVEDASH_MCP_SEARCH_CACHE_MS` | `300000` | Search index cache TTL. |

## v0 / Lovable / Bolt Scope

Use this server as a no-auth Wavedash MCP listing. It can guide agents while
they generate browser games, but it cannot upload or publish builds.

For authenticated steps, the MCP should instruct the human or host agent to use:

- Wavedash CLI install docs: `https://docs.wavedash.com/cli/installation`
- Wavedash CLI browser login: `wavedash auth login`
- CI/API token login: `wavedash auth login --token ...` or `WAVEDASH_TOKEN`
- Developer Portal manual upload/publish: `https://wavedash.com/dev-portal`

The Wavedash CLI is the command-line app for signing in, initializing
`wavedash.toml`, testing locally, uploading builds, and publishing from a
project folder. For users who do not want terminal commands, route them to the
Developer Portal instead.

Do not pass API keys, session cookies, or private credentials as MCP tool
arguments.

Authenticated tools such as creating games, uploading builds, or publishing
should live in a separate authenticated MCP surface backed by Wavedash OAuth or
scoped agent grants.
