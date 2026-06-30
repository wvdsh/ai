const DEFAULT_DOCS_BASE_URL = "https://docs.wavedash.com";
const env = globalThis.process?.env || {};

export const docsBaseUrl = (
  env.WAVEDASH_DOCS_BASE_URL || DEFAULT_DOCS_BASE_URL
).replace(/\/+$/, "");

const searchIndexUrl = `${docsBaseUrl}/api/search`;
const requestTimeoutMs = Number(env.WAVEDASH_MCP_FETCH_TIMEOUT_MS || 10000);

const coreDocs = [
  "getting-started/quickstart",
  "sdk/setup",
  "sdk/functions",
  "sdk/events",
  "sdk/types",
  "multiplayer/lobbies",
  "multiplayer/networking",
  "cli/commands",
  "cli/configuration",
  "publishing/upload",
  "publishing/publish",
  "publishing/metadata",
  "publishing/monetization",
  "publishing/content-guidelines",
  "tutorials/best-practices",
  "tutorials/shader-stutter",
  "engines",
];

const topicPages = {
  sdk: ["sdk/setup", "sdk/functions", "sdk/events", "sdk/types"],
  setup: ["sdk/setup", "getting-started/quickstart"],
  multiplayer: ["multiplayer/lobbies", "multiplayer/networking", "sdk/events", "sdk/types"],
  lobby: ["multiplayer/lobbies", "sdk/events"],
  lobbies: ["multiplayer/lobbies", "sdk/events"],
  p2p: ["multiplayer/networking", "sdk/events", "sdk/types"],
  achievement: ["sdk/achievements", "sdk/functions"],
  achievements: ["sdk/achievements", "sdk/functions"],
  stats: ["sdk/achievements", "sdk/functions"],
  leaderboard: ["sdk/leaderboards", "sdk/functions"],
  leaderboards: ["sdk/leaderboards", "sdk/functions"],
  "cloud-save": ["sdk/cloud-saves", "sdk/functions"],
  "cloud-saves": ["sdk/cloud-saves", "sdk/functions"],
  save: ["sdk/cloud-saves", "sdk/functions"],
  saves: ["sdk/cloud-saves", "sdk/functions"],
  ugc: ["sdk/ugc", "sdk/functions"],
  "user-generated-content": ["sdk/ugc", "sdk/functions"],
  paywall: ["sdk/paid-content", "publishing/monetization", "sdk/functions"],
  "paid-content": ["sdk/paid-content", "publishing/monetization", "sdk/functions"],
  monetization: ["publishing/monetization", "sdk/paid-content"],
  players: ["sdk/players", "sdk/functions"],
  publishing: ["publishing/upload", "publishing/publish", "cli/commands"],
  cli: ["cli/commands", "cli/configuration", "cli/authentication"],
  config: ["cli/configuration", "cli/commands"],
};

const featurePages = {
  multiplayer: ["multiplayer/lobbies", "multiplayer/networking"],
  lobby: ["multiplayer/lobbies"],
  lobbies: ["multiplayer/lobbies"],
  p2p: ["multiplayer/networking"],
  achievement: ["sdk/achievements"],
  achievements: ["sdk/achievements"],
  stats: ["sdk/achievements"],
  leaderboard: ["sdk/leaderboards"],
  leaderboards: ["sdk/leaderboards"],
  "cloud-save": ["sdk/cloud-saves"],
  "cloud-saves": ["sdk/cloud-saves"],
  save: ["sdk/cloud-saves"],
  saves: ["sdk/cloud-saves"],
  ugc: ["sdk/ugc"],
  "user-generated-content": ["sdk/ugc"],
  paywall: ["sdk/paid-content", "publishing/monetization"],
  "paid-content": ["sdk/paid-content", "publishing/monetization"],
  monetization: ["publishing/monetization", "sdk/paid-content"],
  players: ["sdk/players"],
  identity: ["sdk/players"],
  publishing: ["publishing/upload", "publishing/publish"],
};

const engineAliases = {
  babylon: "babylonjs",
  "babylon.js": "babylonjs",
  cplusplus: "cpp",
  "c++": "cpp",
  cocoscreator: "cocos",
  construct3: "construct",
  "ct.js": "ctjs",
  gamemaker: "gamemaker",
  gb: "gbstudio",
  godot: "godot",
  html5: "custom",
  javascript: "javascript",
  js: "javascript",
  kaplay: "kaplay",
  love: "love2d",
  "löve": "love2d",
  monogame: "monogame",
  phaser: "phaser",
  pixi: "pixi",
  "pixi.js": "pixi",
  playcanvas: "playcanvas",
  react: "react",
  rust: "rust",
  three: "threejs",
  "three.js": "threejs",
  ts: "typescript",
  typescript: "typescript",
  unity: "unity",
  unreal: "unreal",
};

let searchIndexCache;
let searchIndexCachedAt = 0;
const searchIndexTtlMs = Number(env.WAVEDASH_MCP_SEARCH_CACHE_MS || 300000);

function timeoutSignal() {
  return AbortSignal.timeout(requestTimeoutMs);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/markdown,text/plain,application/json;q=0.8,*/*;q=0.5",
      "user-agent": "wvdsh-ai-mcp/0.1.0",
    },
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "wvdsh-ai-mcp/0.1.0",
    },
    signal: timeoutSignal(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
}

export function normalizeSlug(input) {
  let value = String(input || "").trim();
  if (!value) {
    throw new Error("A docs path or URL is required.");
  }

  if (value.startsWith(docsBaseUrl)) {
    value = value.slice(docsBaseUrl.length);
  }

  value = value.replace(/^https?:\/\/docs\.wavedash\.com/i, "");
  value = value.split("#")[0].split("?")[0].replace(/^\/+/, "");
  value = value.replace(/\.md$/i, "");

  if (value === "llms.txt" || value === "llms-full.txt") {
    return value;
  }

  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(value)) {
    throw new Error(`Invalid docs path: ${input}`);
  }

  return value.toLowerCase();
}

export function docUrl(slug) {
  const normalized = normalizeSlug(slug);
  return `${docsBaseUrl}/${normalized}`;
}

export async function getSearchIndex() {
  const now = Date.now();
  if (searchIndexCache && now - searchIndexCachedAt < searchIndexTtlMs) {
    return searchIndexCache;
  }

  const index = await fetchJson(searchIndexUrl);
  if (!Array.isArray(index)) {
    throw new Error("Unexpected docs search index shape.");
  }

  searchIndexCache = index;
  searchIndexCachedAt = now;
  return index;
}

function scoreEntry(entry, query, tokens) {
  const title = String(entry.title || "").toLowerCase();
  const slug = String(entry.slug || "").toLowerCase();
  const description = String(entry.description || "").toLowerCase();
  const headings = (entry.headings || [])
    .map((heading) => String(heading.text || ""))
    .join(" ")
    .toLowerCase();
  const body = String(entry.body || "").toLowerCase();
  const haystack = `${title} ${slug} ${description} ${headings} ${body}`;

  let score = haystack.includes(query) ? 20 : 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 12;
    if (slug.includes(token)) score += 8;
    if (description.includes(token)) score += 5;
    if (headings.includes(token)) score += 5;
    if (body.includes(token)) score += 1;
  }

  return score;
}

export async function searchDocs(query, limit = 8) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    throw new Error("A search query is required.");
  }

  const tokens = normalizedQuery
    .split(/[^a-z0-9@.+-]+/i)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);

  const index = await getSearchIndex();
  return index
    .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery, tokens) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.slug.localeCompare(b.entry.slug))
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ entry, score }) => ({
      title: entry.title,
      slug: entry.slug,
      url: docUrl(entry.slug),
      description: entry.description,
      headings: entry.headings || [],
      excerpt: entry.body || "",
      score,
    }));
}

export async function getDoc(slug) {
  const normalized = normalizeSlug(slug);
  const suffix = normalized.endsWith(".txt") ? "" : ".md";
  const text = await fetchText(`${docsBaseUrl}/${normalized}${suffix}`);
  return {
    slug: normalized,
    url: `${docsBaseUrl}/${normalized}`,
    markdown: text,
  };
}

export function resolveTopicPages(topic) {
  const key = normalizeKey(topic);
  return topicPages[key] || [key];
}

export function resolveEnginePage(engine) {
  const key = normalizeKey(engine);
  if (!key) return undefined;
  const slug = engineAliases[key] || key;
  return `engines/${slug}`;
}

export function resolveQuickstartPages(engine, features = []) {
  const pages = ["getting-started/quickstart", "sdk/setup", "cli/configuration"];
  const enginePage = resolveEnginePage(engine);
  if (enginePage) pages.push(enginePage);

  for (const feature of features) {
    pages.push(...(featurePages[normalizeKey(feature)] || []));
  }

  pages.push("cli/commands", "publishing/upload", "publishing/publish");
  return unique(pages);
}

export function resolvePublishingPages(engine) {
  const pages = [
    "cli/configuration",
    "cli/commands",
    "publishing/upload",
    "publishing/publish",
    "publishing/metadata",
    "publishing/content-guidelines",
    "tutorials/best-practices",
    "tutorials/shader-stutter",
  ];
  const enginePage = resolveEnginePage(engine);
  if (enginePage) pages.unshift(enginePage);
  return unique(pages);
}

export function resolveImplementationPages(goal, engine, features = []) {
  const pages = [
    "getting-started/introduction",
    "getting-started/concepts",
    ...resolveQuickstartPages(engine, features),
  ];

  for (const token of String(goal || "").split(/[^a-z0-9@.+-]+/i)) {
    pages.push(...(featurePages[normalizeKey(token)] || topicPages[normalizeKey(token)] || []));
  }

  pages.push("sdk/functions", "sdk/events", "sdk/types", "tutorials/best-practices");
  return unique(pages);
}

export function formatSearchResults(results) {
  if (results.length === 0) {
    return "No matching Wavedash docs found. Try a broader query like \"sdk setup\", \"multiplayer\", \"upload\", or an engine name.";
  }

  return results
    .map((result, index) => {
      const headings = result.headings
        .slice(0, 4)
        .map((heading) => heading.text)
        .join(", ");
      return [
        `${index + 1}. ${result.title}`,
        `Path: ${result.slug}`,
        `URL: ${result.url}`,
        result.description ? `Description: ${result.description}` : undefined,
        headings ? `Headings: ${headings}` : undefined,
        result.excerpt ? `Excerpt: ${result.excerpt}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function trimMarkdown(markdown, maxChars = 3200) {
  if (markdown.length <= maxChars) return markdown;
  return `${markdown.slice(0, maxChars).trim()}\n\n[Truncated. Use wavedash_get_doc for the full page.]`;
}

export async function buildDocBundle(slugs, maxCharsPerDoc = 2200) {
  const docs = await Promise.all(
    unique(slugs).map(async (slug) => {
      const doc = await getDoc(slug);
      return `## ${doc.slug}\nURL: ${doc.url}\n\n${trimMarkdown(doc.markdown, maxCharsPerDoc)}`;
    }),
  );

  return docs.join("\n\n---\n\n");
}

export function listCoreDocs() {
  return coreDocs.map((slug) => ({ slug, url: docUrl(slug) }));
}
