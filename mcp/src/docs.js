// Docs access layer.
//
// The source of truth for page slugs, titles, descriptions, headings, and
// keywords is the public docs site's search index at /api/search. Engine
// pages, SDK topics, and feature pages are all resolved against that index at
// runtime so adding a page in the docs repo needs no change here. The only
// fixed lists in this file describe workflow ordering (which core pages to
// read first), not which pages exist.

const DEFAULT_DOCS_BASE_URL = "https://docs.wavedash.com";
const env = globalThis.process?.env || {};

export const docsBaseUrl = (
  env.WAVEDASH_DOCS_BASE_URL || DEFAULT_DOCS_BASE_URL
).replace(/\/+$/, "");

const searchIndexUrl = `${docsBaseUrl}/api/search`;
const requestTimeoutMs = Number(env.WAVEDASH_MCP_FETCH_TIMEOUT_MS || 10000);

// Workflow ordering: the pages every integration should read, in order.
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

const quickstartLeadPages = ["getting-started/quickstart", "sdk/setup", "cli/configuration"];
const quickstartTailPages = ["cli/commands", "publishing/upload", "publishing/publish"];
const publishingPages = [
  "cli/configuration",
  "cli/commands",
  "publishing/upload",
  "publishing/publish",
  "publishing/metadata",
  "publishing/content-guidelines",
  "tutorials/best-practices",
  "tutorials/shader-stutter",
];
const defaultSdkPages = ["sdk/setup", "sdk/functions", "sdk/events", "sdk/types"];
const enginesIndexSlug = "engines";

// Generic English filler that carries no meaning when matching a free-form
// phrase such as "add leaderboards and multiplayer to my game" against docs.
const stopWords = new Set([
  "a", "add", "an", "and", "are", "as", "at", "be", "browser", "by", "can", "do", "does", "for",
  "from", "game", "games", "get", "has", "have", "how", "i", "in", "into", "is", "it", "its", "me", "my",
  "of", "on", "or", "our", "should", "that", "the", "their", "them", "then", "this", "to", "up",
  "use", "using", "want", "wavedash", "we", "web", "what", "when", "where", "which", "will", "with",
  "you", "your",
]);

// Minimum search scores when resolving pages for guidance tools. Title, slug,
// and keyword words score 8 to 15; description and heading substrings score 5;
// body-only hits score 1 per token and are treated as noise.
const minTopicScore = 8;
const minFeatureScore = 12;
// Pages under these prefixes are the SDK reference proper; nudge them above
// HTTP API or engine pages that mention the same feature.
const sdkReferencePrefixes = ["sdk/", "multiplayer/"];

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

function compact(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9@.#+-]+/i)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 2 && !stopWords.has(token));
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

  if (/^https?:\/\//i.test(value)) {
    throw new Error(
      `Only pages on ${docsBaseUrl} can be fetched. "${input}" is not a Wavedash documentation URL.`,
    );
  }

  if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(value)) {
    throw new Error(`Invalid docs path: ${input}. Use a docs path such as sdk/setup or a ${docsBaseUrl} URL.`);
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

// Like getSearchIndex, but degrades to the stale cache or an empty index so
// guidance tools keep working when the docs site is briefly unreachable.
async function getSearchIndexSafe() {
  try {
    return await getSearchIndex();
  } catch {
    return searchIndexCache || [];
  }
}

function entryKeywords(entry) {
  return Array.isArray(entry.keywords) ? entry.keywords.map((keyword) => String(keyword).toLowerCase()) : [];
}

function singularize(token) {
  return token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token;
}

function words(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9.#+]+/)
      .filter(Boolean)
      .map(singularize),
  );
}

// Titles and slugs are matched on whole words so "player" does not hit
// "Multiplayer". Longer tokens may match as a word prefix so "config" hits
// "configuration" and "leaderboard" hits "leaderboards".
function hasWord(wordSet, token) {
  const singular = singularize(token);
  if (wordSet.has(token) || wordSet.has(singular)) return true;
  if (singular.length < 5) return false;
  for (const word of wordSet) {
    if (word.startsWith(singular)) return true;
  }
  return false;
}

function scoreEntry(entry, query, tokens) {
  const title = String(entry.title || "").toLowerCase();
  const slug = String(entry.slug || "").toLowerCase();
  const titleWords = words(title);
  const slugWords = words(slug);
  const slugTail = singularize(slug.split("/").pop() || "");
  const description = String(entry.description || "").toLowerCase();
  const headings = (entry.headings || [])
    .map((heading) => String(heading.text || ""))
    .join(" ")
    .toLowerCase();
  const body = String(entry.body || "").toLowerCase();
  const keywords = entryKeywords(entry);
  const haystack = `${title} ${slug} ${description} ${headings} ${keywords.join(" ")} ${body}`;

  // Whole-phrase bonus only for multi-word queries; a single word already
  // scores through the per-token checks below.
  let score = tokens.length >= 2 && haystack.includes(query) ? 20 : 0;
  for (const token of tokens) {
    const singular = singularize(token);
    if (keywords.some((keyword) => keyword === token || keyword === singular)) score += 15;
    if (hasWord(titleWords, token)) score += 12;
    if (hasWord(slugWords, token) || slugTail === singular) score += 8;
    if (description.includes(singular)) score += 5;
    if (headings.includes(singular)) score += 5;
    if (body.includes(singular)) score += 1;
  }

  return score;
}

export async function searchDocs(query, limit = 8) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    throw new Error("A search query is required.");
  }

  const tokens = tokenize(normalizedQuery);
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

async function searchSlugs(query, limit, minScore, preferPrefixes = []) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) return [];
  const tokens = tokenize(normalizedQuery);
  if (tokens.length === 0) return [];

  const index = await getSearchIndexSafe();
  return index
    .map((entry) => {
      const score = scoreEntry(entry, normalizedQuery, tokens);
      const preferred = preferPrefixes.some((prefix) => String(entry.slug).startsWith(prefix));
      return { slug: entry.slug, score: score >= minScore && preferred ? score + 8 : score };
    })
    .filter((result) => result.score >= minScore)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, limit)
    .map((result) => result.slug);
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

// Engine pages are whatever the docs site publishes under engines/. Each page
// is matched by its slug tail, its title, and any keywords declared in its
// frontmatter, so "Three.js", "threejs", "Godot 4", and "Unity WebGL" all
// resolve without an alias table here.
async function listEngineEntries() {
  const index = await getSearchIndexSafe();
  return index
    .filter((entry) => String(entry.slug || "").startsWith(`${enginesIndexSlug}/`))
    .map((entry) => {
      const slug = String(entry.slug);
      const names = unique([
        slug.slice(enginesIndexSlug.length + 1),
        normalizeKey(entry.title),
        ...entryKeywords(entry).map(normalizeKey),
      ]);
      return { slug, names, compactNames: unique(names.map(compact)) };
    });
}

function matchEngine(entries, key) {
  if (!key) return undefined;

  const exact = entries.find((entry) => entry.names.includes(key));
  if (exact) return exact.slug;

  const tokens = key.split(/[^a-z0-9.#+]+/).filter(Boolean);
  for (let size = Math.min(3, tokens.length); size >= 1; size -= 1) {
    for (let start = 0; start + size <= tokens.length; start += 1) {
      const candidate = tokens.slice(start, start + size).join("-");
      const hit = entries.find((entry) => entry.names.includes(candidate));
      if (hit) return hit.slug;
    }
  }

  const compactKey = compact(key);
  if (compactKey.length >= 4) {
    const partial = entries.find((entry) =>
      entry.compactNames.some((name) => name.length >= 4 && (compactKey.includes(name) || name.includes(compactKey))),
    );
    if (partial) return partial.slug;
  }

  return undefined;
}

// Resolve free-form engine text to an engines/<slug> page. Unknown engines
// fall back to the engines index so a tool call never fails on a 404.
export async function resolveEnginePage(engine) {
  const key = normalizeKey(engine);
  if (!key) return undefined;
  const entries = await listEngineEntries();
  return matchEngine(entries, key) || enginesIndexSlug;
}

// Resolve requested features such as "multiplayer" or "cloud saves" to docs
// pages by searching the index. Only strong matches (title, slug, keyword) are
// used so a vague feature word does not pull in unrelated pages.
export async function resolveFeaturePages(features = []) {
  const pages = [];
  for (const feature of features) {
    pages.push(...(await searchSlugs(feature, 2, minFeatureScore)));
  }
  return unique(pages);
}

// Resolve a free-form SDK topic such as "leaderboards and multiplayer" to docs
// pages. Returns [] when nothing matches so the caller can explain the
// fallback it uses.
export async function resolveTopicPages(topic, limit = 4) {
  const enginePage = await resolveEnginePage(topic);
  const pages = await searchSlugs(topic, limit, minTopicScore, sdkReferencePrefixes);
  if (enginePage && enginePage !== enginesIndexSlug) pages.push(enginePage);
  return unique(pages);
}

export function defaultTopicPages() {
  return [...defaultSdkPages];
}

export async function resolveQuickstartPages(engine, features = []) {
  const pages = [...quickstartLeadPages];
  const enginePage = await resolveEnginePage(engine);
  if (enginePage) pages.push(enginePage);
  pages.push(...(await resolveFeaturePages(features)));
  pages.push(...quickstartTailPages);
  return unique(pages);
}

export async function resolvePublishingPages(engine) {
  const pages = [...publishingPages];
  const enginePage = await resolveEnginePage(engine);
  if (enginePage) pages.unshift(enginePage);
  return unique(pages);
}

export async function resolveImplementationPages(goal, engine, features = []) {
  const pages = [
    "getting-started/introduction",
    "getting-started/concepts",
    ...(await resolveQuickstartPages(engine, features)),
    ...(await searchSlugs(goal, 3, minFeatureScore)),
    "sdk/functions",
    "sdk/events",
    "sdk/types",
    "tutorials/best-practices",
  ];
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
  return `${markdown.slice(0, maxChars).trim()}\n\n[Truncated. Use get_wavedash_doc for the full page.]`;
}

// Fetch several pages as one Markdown bundle. A single missing page is
// reported inline instead of failing the whole tool call.
export async function buildDocBundle(slugs, maxCharsPerDoc = 2200) {
  const results = await Promise.allSettled(
    unique(slugs).map(async (slug) => {
      const doc = await getDoc(slug);
      return `## ${doc.slug}\nURL: ${doc.url}\n\n${trimMarkdown(doc.markdown, maxCharsPerDoc)}`;
    }),
  );

  const docs = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failures = results
    .filter((result) => result.status === "rejected")
    .map((result) => String(result.reason?.message || result.reason));

  if (docs.length === 0) {
    throw new Error(
      `Could not load any Wavedash docs pages. ${failures.join("; ")}. Try search_wavedash_docs or the docs index at ${docsBaseUrl}.`,
    );
  }

  if (failures.length) {
    docs.push(`## Unavailable pages\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }

  return docs.join("\n\n---\n\n");
}

export function listCoreDocs() {
  return coreDocs.map((slug) => ({ slug, url: docUrl(slug) }));
}
