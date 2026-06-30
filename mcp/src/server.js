#!/usr/bin/env node

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createWavedashMcpServer, serverInfo } from "./createServer.js";

const openAiAppsChallengeToken = "IFIllc5LKPW77e7VdTtkv2xtZgzWrK144a4gbfXA4Hg";

const app = createMcpExpressApp();

app.get("/", (_req, res) => {
  res.json(serverInfo());
});

app.get("/.well-known/openai-apps-challenge", (_req, res) => {
  res.type("text/plain").send(openAiAppsChallengeToken);
});

app.post("/mcp", async (req, res) => {
  const server = createWavedashMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  } finally {
    res.on("close", () => {
      transport.close();
      server.close();
    });
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

app.delete("/mcp", (_req, res) => {
  res.status(405).set("Allow", "POST").send("Method Not Allowed");
});

const port = Number(process.env.PORT || 3000);
app.listen(port, (error) => {
  if (error) {
    console.error("Failed to start Wavedash MCP server:", error);
    process.exit(1);
  }

  console.log(`Wavedash MCP server listening on http://localhost:${port}/mcp`);
});
