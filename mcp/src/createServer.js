import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  buildDocBundle,
  docsBaseUrl,
  formatSearchResults,
  getDoc,
  listCoreDocs,
  resolvePublishingPages,
  resolveQuickstartPages,
  resolveTopicPages,
  searchDocs,
} from "./docs.js";
import { formatConfigValidation, validateWavedashConfig } from "./config.js";

export const serverVersion = "0.1.0";

export const toolNames = [
  "wavedash_get_agent_workflow",
  "wavedash_search_docs",
  "wavedash_get_doc",
  "wavedash_get_quickstart",
  "wavedash_get_sdk_reference",
  "wavedash_get_publishing_checklist",
  "wavedash_validate_config",
];

export function serverInfo() {
  return {
    name: "Wavedash",
    version: serverVersion,
    transport: "streamable-http",
    endpoint: "/mcp",
    auth: "none",
    docs: docsBaseUrl,
    tools: toolNames,
  };
}

function textContent(text) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent: {
      text,
    },
  };
}

const readOnlyToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

const textOutputSchema = {
  text: z.string().describe("Human-readable tool result text."),
};

function cliInstallGuide() {
  return [
    "Install the Wavedash CLI before running Wavedash terminal commands:",
    "",
    "```bash",
    "# macOS/Linux",
    "curl -fsSL https://wavedash.com/cli/install.sh | sh",
    "",
    "# macOS with Homebrew",
    "brew install wvdsh/tap/wavedash",
    "```",
    "",
    "```powershell",
    "# Windows PowerShell",
    "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; irm https://wavedash.com/cli/install.ps1 | iex",
    "```",
    "",
    "Verify and sign in:",
    "",
    "```bash",
    "wavedash --version",
    "wavedash auth login",
    "```",
    "",
    "Official docs:",
    "- Install docs: https://docs.wavedash.com/cli/installation",
    "- Authentication docs: https://docs.wavedash.com/cli/authentication",
  ].join("\n");
}

export function createWavedashMcpServer() {
  const server = new McpServer({
    name: "wavedash",
    version: serverVersion,
  });

  server.registerTool(
    "wavedash_get_agent_workflow",
    {
      title: "Get Wavedash Agent Workflow",
      description:
        "Return a concise end-to-end workflow for AI agents creating a browser game from scratch and preparing it for Wavedash upload. Read-only and unauthenticated; upload still happens through the Wavedash CLI or Developer Portal.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        engine: z
          .string()
          .optional()
          .describe("Optional engine/framework, for example javascript, phaser, unity, godot, three.js, react, or custom."),
        features: z
          .array(z.string())
          .default([])
          .describe("Optional requested Wavedash features, for example multiplayer, achievements, leaderboards, cloud-saves, ugc, players."),
      },
    },
    async ({ engine, features }) => {
      const pages = resolveQuickstartPages(engine, features);
      const links = pages.map((page) => `- ${page}: ${docsBaseUrl}/${page}`).join("\n");
      return textContent(
        [
          "Wavedash from-scratch agent workflow:",
          "",
          "1. Create a browser-playable game that builds to static files.",
          "2. Ensure the build output contains an HTML entrypoint, usually index.html.",
          "3. Add Wavedash SDK initialization when the game is ready to reveal:",
          "",
          "```js",
          "import Wavedash from \"@wvdsh/sdk-js\";",
          "",
          "Wavedash.init();",
          "```",
          "",
          "4. If the game has loading work, report progress before init:",
          "",
          "```js",
          "Wavedash.updateLoadProgressZeroToOne(0.5);",
          "Wavedash.init();",
          "```",
          "",
          "5. Choose how the human will authenticate and upload.",
          "",
          "The Wavedash CLI is the Wavedash command-line app. It runs in a terminal and is used to sign in, create wavedash.toml, test locally, upload builds, and publish from a project folder. Use it when the human or host environment can run terminal commands.",
          "",
          cliInstallGuide(),
          "",
          "For headless or CI environments, the human should create an API key in the Wavedash Developer Portal and provide it to the CLI outside this MCP:",
          "",
          "```bash",
          "wavedash auth login --token YOUR_API_KEY",
          "# or",
          "export WAVEDASH_TOKEN=YOUR_API_KEY",
          "```",
          "",
          "If the human does not want to use terminal commands, they can upload and publish manually in the Wavedash Developer Portal instead:",
          "",
          "```text",
          "https://wavedash.com/dev-portal",
          "Game -> Builds -> Upload new build",
          "```",
          "",
          "6. If using the CLI, initialize Wavedash config from the game repo root:",
          "",
          "```bash",
          "wavedash init",
          "```",
          "",
          "7. Confirm wavedash.toml points at the built files:",
          "",
          "```toml",
          "game_id = \"YOUR_GAME_ID_HERE\"",
          "upload_dir = \"./dist\"",
          "entrypoint = \"index.html\"",
          "```",
          "",
          "8. Build the game, then test locally with the Wavedash sandbox:",
          "",
          "```bash",
          "npm run build",
          "wavedash dev",
          "```",
          "",
          "9. If using the CLI, upload the build:",
          "",
          "```bash",
          "wavedash build push",
          "```",
          "",
          "10. Smoke test the playtest URL printed by the CLI or shown in the Developer Portal.",
          "11. Publish only after explicit user confirmation:",
          "",
          "```bash",
          "wavedash publish <BUILD_ID>",
          "```",
          "",
          "Important boundary: this MCP is read-only and cannot upload, publish, list games, authenticate users, create API keys, or access local files. It should tell the human exactly which authenticated CLI, Developer Portal, or CI step to perform, but it must not ask for secrets in MCP tool arguments.",
          "",
          "Relevant docs:",
          links,
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "wavedash_search_docs",
    {
      title: "Search Wavedash Docs",
      description:
        "Search official Wavedash docs for browser game development, SDK integration, engines, CLI, upload, and publishing. Read-only and unauthenticated.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        query: z.string().min(1).describe("Search query, for example: sdk setup, multiplayer lobbies, unity webgl, build push."),
        limit: z.number().int().min(1).max(20).default(8).describe("Maximum number of results to return."),
      },
    },
    async ({ query, limit }) => {
      const results = await searchDocs(query, limit);
      return textContent(formatSearchResults(results));
    },
  );

  server.registerTool(
    "wavedash_get_doc",
    {
      title: "Get Wavedash Doc",
      description:
        "Fetch a full Wavedash docs page as Markdown by path or docs.wavedash.com URL. Read-only and unauthenticated.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe("Docs path or URL, for example sdk/setup, engines/phaser, publishing/upload, or https://docs.wavedash.com/sdk/setup."),
      },
    },
    async ({ path }) => {
      const doc = await getDoc(path);
      return textContent(`URL: ${doc.url}\n\n${doc.markdown}`);
    },
  );

  server.registerTool(
    "wavedash_get_quickstart",
    {
      title: "Get Wavedash Quickstart",
      description:
        "Return the Wavedash setup path for a browser game, optionally including an engine and SDK features. Read-only and unauthenticated.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        engine: z
          .string()
          .optional()
          .describe("Optional engine/framework, for example phaser, unity, godot, three.js, react, rust, or custom."),
        features: z
          .array(z.string())
          .default([])
          .describe("Optional Wavedash features, for example multiplayer, achievements, leaderboards, cloud-saves, ugc, players."),
      },
    },
    async ({ engine, features }) => {
      const pages = resolveQuickstartPages(engine, features);
      const links = pages.map((page) => `- ${page}: ${docsBaseUrl}/${page}`).join("\n");
      const docs = await buildDocBundle(pages, 1800);
      return textContent(
        [
          "Use this order when guiding a game toward Wavedash:",
          "",
          "1. Make sure the game builds to static browser files with an HTML entrypoint.",
          "2. Add Wavedash SDK initialization before using SDK services.",
          "3. Install the Wavedash CLI before suggesting wavedash terminal commands.",
          "4. Sign in with wavedash auth login, or tell the human to use the Developer Portal if they do not want terminal commands.",
          "5. Configure wavedash.toml with game_id, upload_dir, and entrypoint.",
          "6. Test with wavedash dev.",
          "7. Push a build with wavedash build push.",
          "8. Publish only after explicit user confirmation.",
          "",
          cliInstallGuide(),
          "",
          "Relevant docs:",
          links,
          "",
          docs,
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "wavedash_get_sdk_reference",
    {
      title: "Get Wavedash SDK Reference",
      description:
        "Fetch Wavedash SDK docs for a specific feature such as setup, multiplayer, achievements, leaderboards, cloud saves, UGC, players, events, or types. Read-only and unauthenticated.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        topic: z
          .string()
          .min(1)
          .describe("SDK topic, for example setup, multiplayer, lobbies, p2p, achievements, stats, leaderboards, cloud-saves, ugc, players, cli, config."),
      },
    },
    async ({ topic }) => {
      const pages = resolveTopicPages(topic);
      const docs = await buildDocBundle(pages, 2600);
      return textContent(docs);
    },
  );

  server.registerTool(
    "wavedash_get_publishing_checklist",
    {
      title: "Get Wavedash Publishing Checklist",
      description:
        "Return Wavedash upload and publishing checklist guidance, optionally including an engine-specific docs page. Read-only and unauthenticated.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        engine: z
          .string()
          .optional()
          .describe("Optional engine/framework, for example unity, godot, phaser, three.js, react, rust, or custom."),
      },
    },
    async ({ engine }) => {
      const pages = resolvePublishingPages(engine);
      const links = pages.map((page) => `- ${page}: ${docsBaseUrl}/${page}`).join("\n");
      const docs = await buildDocBundle(pages, 1600);
      return textContent(
        [
          "Wavedash publishing checklist:",
          "",
          "- Confirm the game produces static browser files.",
          "- Confirm upload_dir contains the HTML entrypoint, usually index.html.",
          "- Confirm Wavedash.init() is called once when the game is ready to reveal.",
          "- Install the Wavedash CLI before running wavedash terminal commands.",
          "- Sign in with wavedash auth login, or use the Developer Portal for manual upload/publish.",
          "- Test SDK features locally with wavedash dev.",
          "- Run wavedash build push from the game repo.",
          "- Smoke test the playtest URL after upload.",
          "- Check metadata, cover art, pricing, and content guidelines.",
          "- Do not publish or change pricing without explicit user confirmation.",
          "",
          "Relevant docs:",
          links,
          "",
          cliInstallGuide(),
          "",
          docs,
        ].join("\n"),
      );
    },
  );

  server.registerTool(
    "wavedash_validate_config",
    {
      title: "Validate Wavedash Config",
      description:
        "Validate pasted wavedash.toml text for basic Wavedash CLI config issues. This does not read files; provide the config text as input.",
      annotations: readOnlyToolAnnotations,
      outputSchema: textOutputSchema,
      inputSchema: {
        toml: z.string().min(1).describe("Contents of wavedash.toml."),
      },
    },
    async ({ toml }) => {
      const result = validateWavedashConfig(toml);
      return textContent(formatConfigValidation(result));
    },
  );

  server.registerResource(
    "wavedash-docs-index",
    "wavedash://docs/index",
    {
      title: "Wavedash Docs Index",
      description: "Core Wavedash docs entry points.",
      mimeType: "text/markdown",
    },
    async () => {
      const links = listCoreDocs()
        .map((doc) => `- [${doc.slug}](${doc.url})`)
        .join("\n");
      return {
        contents: [
          {
            uri: "wavedash://docs/index",
            mimeType: "text/markdown",
            text: `# Wavedash Docs Index\n\n${links}`,
          },
        ],
      };
    },
  );

  return server;
}
