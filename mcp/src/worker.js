import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createWavedashMcpServer, serverInfo } from "./createServer.js";

const openAiAppsChallengeToken = "IFIllc5LKPW77e7VdTtkv2xtZgzWrK144a4gbfXA4Hg";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data, init = {}) {
  return withCors(
    new Response(JSON.stringify(data, null, 2), {
      ...init,
      headers: {
        "content-type": "application/json; charset=utf-8",
        ...(init.headers || {}),
      },
    }),
  );
}

function text(data, init = {}) {
  return withCors(
    new Response(data, {
      ...init,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        ...(init.headers || {}),
      },
    }),
  );
}

function methodNotAllowed() {
  return withCors(
    new Response("Method Not Allowed", {
      status: 405,
      headers: {
        allow: "POST",
        "content-type": "text/plain; charset=utf-8",
      },
    }),
  );
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return json(serverInfo());
    }

    if (url.pathname === "/.well-known/openai-apps-challenge" && request.method === "GET") {
      return text(openAiAppsChallengeToken);
    }

    if (url.pathname !== "/mcp") {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (request.method !== "POST") {
      return methodNotAllowed();
    }

    const server = createWavedashMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      return withCors(response);
    } finally {
      transport.close();
      server.close();
    }
  },
};
