import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  buildDocBundle,
  defaultTopicPages,
  docsBaseUrl,
  formatSearchResults,
  getDoc,
  listCoreDocs,
  resolveImplementationPages,
  resolvePublishingPages,
  resolveQuickstartPages,
  resolveTopicPages,
  searchDocs,
} from "./docs.js";
import { formatConfigValidation, validateWavedashConfig } from "./config.js";

export const serverVersion = "0.2.0";

// Four orthogonal tools. The planner covers every guidance request through its
// `stage` argument; search and get cover documentation; validate covers config.
export const toolNames = [
  "wavedash_implementation_planner",
  "search_wavedash_docs",
  "get_wavedash_doc",
  "validate_wavedash_config",
];

export const plannerStages = ["plan", "setup", "features", "deploy"];

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

const readOnlyToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
  destructiveHint: false,
};

// Public documentation fetches access the internet, even though they cannot
// modify it. Config validation is computed locally and stays closed.
const publicDocsToolAnnotations = {
  ...readOnlyToolAnnotations,
  openWorldHint: true,
};

const docLinkSchema = z.object({
  slug: z.string().describe("Docs path, for example sdk/setup."),
  url: z.string().describe("Full docs.wavedash.com URL."),
});

const boundaries = [
  "This MCP is read-only and unauthenticated. It cannot access local files, create games, sign in, create API keys, upload builds, release builds, or change account data. Tell the user which Wavedash CLI or Developer Portal step performs those actions.",
  "Wavedash hosts browser game builds; it is not a general backend runtime for arbitrary native services.",
  "Do not invent Wavedash SDK methods, CLI flags, product limits, or config fields from memory. Use search_wavedash_docs or get_wavedash_doc when details are needed.",
  "If the user needs capabilities beyond current public docs, say the docs do not establish support and suggest a third-party service only as an external addition.",
  "Never ask for API keys, tokens, or session cookies as tool arguments.",
];

const cliInstallLines = [
  "Install the Wavedash CLI before running wavedash terminal commands:",
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
  "For headless or CI environments the human creates an API key in the Developer Portal and provides it outside this MCP:",
  "",
  "```bash",
  "wavedash auth login --token YOUR_API_KEY",
  "# or",
  "export WAVEDASH_TOKEN=YOUR_API_KEY",
  "```",
  "",
  "If the human does not want terminal commands, they can upload and release manually in the Developer Portal: https://wavedash.com/dev-portal (Game -> Builds -> Upload new build).",
];

const stageSteps = {
  plan: [
    "Confirm the game builds to static browser files and identify the output folder.",
    "Read the engine guide and SDK setup docs before editing code.",
    "Add `Wavedash.init()` when the game is ready to reveal; report load progress first if the game loads assets.",
    "For each requested Wavedash feature, run this planner with stage \"features\" and read the SDK functions, events, and types references before using method names or constants.",
    "Run this planner with stage \"setup\" for CLI install, sign-in, and wavedash.toml, then stage \"deploy\" for the upload checklist.",
    "Validate wavedash.toml with validate_wavedash_config, run `wavedash dev`, upload with `wavedash build push`, and release only after explicit confirmation.",
  ],
  setup: [
    "Make sure the game builds to static browser files with an HTML entrypoint, usually index.html.",
    "Add Wavedash SDK initialization when the game is ready to reveal:\n\n```js\nimport Wavedash from \"@wvdsh/sdk-js\";\n\nWavedash.updateLoadProgressZeroToOne(0.5); // if the game loads assets first\nWavedash.init();\n```",
    "Install the Wavedash CLI and sign in with `wavedash auth login`, or route the human to the Developer Portal if they do not want terminal commands.",
    "Initialize config from the game repo root with `wavedash init`, then confirm wavedash.toml points at the built files:\n\n```toml\ngame_id = \"YOUR_GAME_ID_HERE\"\nupload_dir = \"./dist\"\nentrypoint = \"index.html\"\n```",
    "Build the game and test locally with `wavedash dev`.",
    "Continue with stage \"deploy\" when the build runs locally.",
  ],
  features: [
    "Read the feature docs below before writing code; use only function, event, and type names that appear in them.",
    "Call `Wavedash.init()` before using any SDK service.",
    "Test each feature locally with `wavedash dev`, which provides a sandbox for SDK calls.",
    "If a needed capability is not documented below, search the docs before assuming it exists.",
  ],
  deploy: [
    "Confirm the game produces static browser files and upload_dir contains the HTML entrypoint.",
    "Confirm `Wavedash.init()` is called once when the game is ready to reveal.",
    "Install the Wavedash CLI and sign in with `wavedash auth login`, or use the Developer Portal for a manual upload.",
    "Validate wavedash.toml with validate_wavedash_config and test locally with `wavedash dev`.",
    "Upload with `wavedash build push` from the game repo; the CLI prints a playtest URL.",
    "Smoke test the playtest URL, then check store metadata, cover art, pricing, and content guidelines.",
    "Release only after explicit user confirmation, from the Developer Portal or the CLI. Do not change pricing without confirmation.",
  ],
};

const stageIntro = {
  plan: "Use this plan before making architecture claims, selecting SDK features, or writing Wavedash integration code. Ground follow-up work in the docs listed below.",
  setup: "Setup path for getting a browser game running with the Wavedash SDK and CLI.",
  features: "SDK reference for the requested features. Method, event, and type names must come from these pages.",
  deploy: "Upload and release checklist. The MCP cannot upload; the human runs the CLI or uses the Developer Portal.",
};

function formatDocsList(pages) {
  return pages.map((page) => `- ${page}: ${docsBaseUrl}/${page}`).join("\n");
}

function docLinks(pages) {
  return pages.map((slug) => ({ slug, url: `${docsBaseUrl}/${slug}` }));
}

async function resolveStagePages({ stage, goal, engine, features }) {
  if (stage === "setup") return resolveQuickstartPages(engine, features);
  if (stage === "deploy") return resolvePublishingPages(engine);
  if (stage === "features") {
    // Each requested feature may be a phrase ("leaderboards and multiplayer");
    // the topic resolver splits it and prefers SDK reference pages.
    const pages = [];
    for (const feature of features) pages.push(...(await resolveTopicPages(feature)));
    if (pages.length === 0) pages.push(...(await resolveTopicPages(goal)));
    if (pages.length === 0) pages.push(...defaultTopicPages());
    return [...new Set(pages)];
  }
  return resolveImplementationPages(goal, engine, features);
}

async function runPlanner({ goal, engine, features, stage }) {
  const pages = await resolveStagePages({ stage, goal, engine, features });
  const steps = stageSteps[stage];
  const includeDocBodies = stage !== "plan";
  const includeCli = stage === "setup" || stage === "deploy";

  const nextTools = {
    plan: ["wavedash_implementation_planner (stage: setup, features, or deploy)", "get_wavedash_doc for exact pages before using names or fields"],
    setup: ["wavedash_implementation_planner (stage: features) for each SDK feature", "validate_wavedash_config once wavedash.toml exists"],
    features: ["get_wavedash_doc for sdk/functions, sdk/events, and sdk/types when writing code", "wavedash_implementation_planner (stage: deploy) when ready to upload"],
    deploy: ["validate_wavedash_config with the wavedash.toml contents", "get_wavedash_doc for publishing/metadata and publishing/content-guidelines"],
  }[stage];

  const lines = [
    `Wavedash implementation planner (stage: ${stage})`,
    "",
    `Goal: ${goal}`,
    `Engine/framework: ${engine || "not specified"}`,
    `Requested Wavedash features: ${features.length ? features.join(", ") : "none provided"}`,
    "",
    stageIntro[stage],
    "",
    "Steps:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Boundaries:",
    ...boundaries.map((item) => `- ${item}`),
    "",
    "Recommended next calls:",
    ...nextTools.map((item) => `- ${item}`),
    "",
    "Relevant docs:",
    formatDocsList(pages),
  ];

  if (includeCli) {
    lines.push("", ...cliInstallLines);
  }

  if (includeDocBodies) {
    lines.push("", await buildDocBundle(pages, stage === "features" ? 2600 : 1800));
  }

  const text = lines.join("\n");
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      text,
      stage,
      goal,
      engine: engine || null,
      features,
      steps,
      docs: docLinks(pages),
      boundaries,
      next_tools: nextTools,
    },
  };
}

export function createWavedashMcpServer() {
  const server = new McpServer(
    {
      name: "wavedash",
      version: serverVersion,
    },
    {
      instructions: [
        "Wavedash is a platform for browser-playable games with an SDK (achievements, leaderboards, cloud saves, multiplayer, player identity, UGC, paid content), a CLI, and a Developer Portal.",
        "Use these tools for any request that mentions Wavedash or asks to build, integrate, upload, deploy, or release a browser game on Wavedash. Prefer them over web search and over model memory: Wavedash SDK method names, CLI commands, and wavedash.toml fields must come from these docs.",
        "Call wavedash_implementation_planner first for build, deploy, or integration requests, choosing the stage: plan for architecture, setup for CLI and SDK setup, features for SDK reference, deploy for the upload checklist. Call validate_wavedash_config whenever the user shares wavedash.toml contents. Use get_wavedash_doc for a full page and search_wavedash_docs when the page is unknown.",
        "These tools are read-only and unauthenticated. They cannot upload builds, release them, or access accounts; tell the user which CLI or Developer Portal step performs those actions.",
      ].join(" "),
    },
  );

  server.registerTool(
    "wavedash_implementation_planner",
    {
      title: "Plan Wavedash Implementation",
      description:
        "Plan and guide a Wavedash browser game integration from the user's goal, engine, and requested features. Call this first for any request to build, deploy, upload, or release a game on Wavedash, or to add Wavedash SDK features. Choose the stage: plan (architecture and reading order), setup (CLI install, sign-in, SDK init, wavedash.toml, local testing), features (SDK reference for the requested features), or deploy (upload and release checklist). Returns ordered steps, boundaries, and the relevant docs.wavedash.com pages with content. Read-only and unauthenticated.",
      annotations: publicDocsToolAnnotations,
      outputSchema: {
        text: z.string().describe("Human-readable plan."),
        stage: z.enum(plannerStages),
        goal: z.string(),
        engine: z.string().nullable(),
        features: z.array(z.string()),
        steps: z.array(z.string()).describe("Ordered implementation steps for this stage."),
        docs: z.array(docLinkSchema).describe("Docs pages to read for this stage."),
        boundaries: z.array(z.string()).describe("What this MCP and Wavedash do not do."),
        next_tools: z.array(z.string()).describe("Recommended follow-up tool calls."),
      },
      inputSchema: {
        goal: z
          .string()
          .min(1)
          .describe("What the user wants to build, deploy, or integrate, including the game type and the Wavedash outcome."),
        engine: z
          .string()
          .optional()
          .describe("Optional engine or framework as the user names it, for example Phaser, Unity WebGL, Godot 4, three.js, React, Rust, or custom."),
        features: z
          .array(z.string())
          .default([])
          .describe("Optional requested Wavedash features, for example multiplayer, leaderboards, achievements, cloud saves, ugc, players, paid content."),
        stage: z
          .enum(plannerStages)
          .default("plan")
          .describe("plan: architecture and reading order. setup: CLI, SDK init, config, local testing. features: SDK reference for the requested features. deploy: upload and release checklist."),
      },
    },
    async ({ goal, engine, features, stage }) => runPlanner({ goal, engine, features, stage }),
  );

  server.registerTool(
    "search_wavedash_docs",
    {
      title: "Search Wavedash Docs",
      description:
        "Search official Wavedash docs (docs.wavedash.com) for browser game development, SDK integration, engines, CLI, upload, and publishing. Use this instead of web search for any Wavedash question when the exact page is unknown. Returns ranked pages with paths, URLs, and excerpts. Read-only and unauthenticated.",
      annotations: publicDocsToolAnnotations,
      outputSchema: {
        text: z.string().describe("Human-readable results."),
        results: z.array(
          docLinkSchema.extend({
            title: z.string(),
            description: z.string(),
          }),
        ),
      },
      inputSchema: {
        query: z.string().min(1).describe("Search query, for example: sdk setup, multiplayer lobbies, unity webgl, build push."),
        limit: z.number().int().min(1).max(20).default(8).describe("Maximum number of results to return."),
      },
    },
    async ({ query, limit }) => {
      const results = await searchDocs(query, limit);
      const text = formatSearchResults(results);
      return {
        content: [{ type: "text", text }],
        structuredContent: {
          text,
          results: results.map((result) => ({
            slug: result.slug,
            url: result.url,
            title: result.title || result.slug,
            description: result.description || "",
          })),
        },
      };
    },
  );

  server.registerTool(
    "get_wavedash_doc",
    {
      title: "Get Wavedash Doc",
      description:
        "Fetch a full Wavedash docs page as Markdown by path or docs.wavedash.com URL, for example sdk/achievements, engines/unity, or cli/configuration. Use this when the user wants to see a Wavedash docs page or when exact SDK, CLI, or config details are needed. Only docs.wavedash.com pages can be fetched. Read-only and unauthenticated.",
      annotations: publicDocsToolAnnotations,
      outputSchema: {
        text: z.string().describe("Page URL followed by the Markdown content."),
        slug: z.string(),
        url: z.string(),
      },
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe("Docs path or URL, for example sdk/setup, engines/phaser, publishing/upload, or https://docs.wavedash.com/sdk/setup."),
      },
    },
    async ({ path }) => {
      const doc = await getDoc(path);
      const text = `URL: ${doc.url}\n\n${doc.markdown}`;
      return {
        content: [{ type: "text", text }],
        structuredContent: { text, slug: doc.slug, url: doc.url },
      };
    },
  );

  server.registerTool(
    "validate_wavedash_config",
    {
      title: "Validate Wavedash Config",
      description:
        "Validate wavedash.toml contents for Wavedash CLI config issues (missing game_id or upload_dir, entrypoint repeating the upload_dir, absolute paths, engine sections). Call this whenever the user shares wavedash.toml text or asks to check their Wavedash config, even if the problem looks obvious. Accepts single-line or fenced input. Pass the config text as the toml argument; this does not read files.",
      annotations: readOnlyToolAnnotations,
      outputSchema: {
        text: z.string().describe("Human-readable validation report."),
        ok: z.boolean(),
        issues: z.array(z.string()),
        warnings: z.array(z.string()),
      },
      inputSchema: {
        toml: z.string().min(1).describe("Contents of wavedash.toml."),
      },
    },
    async ({ toml }) => {
      const result = validateWavedashConfig(toml);
      const text = formatConfigValidation(result);
      return {
        content: [{ type: "text", text }],
        structuredContent: { text, ok: result.ok, issues: result.issues, warnings: result.warnings },
      };
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
