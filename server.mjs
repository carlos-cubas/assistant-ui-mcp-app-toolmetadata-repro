// Fixture MCP server over stdio. The tool DEFINITION always declares the app,
// which is where the MCP Apps spec puts it. ECHO=1 also repeats it on the result.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const URI = "ui://repro/card";
const echo = process.env.ECHO === "1";
const server = new McpServer({ name: "repro", version: "1.0.0" });

server.registerResource("card", URI, { mimeType: "text/html;profile=mcp-app" }, async () => ({
  contents: [{ uri: URI, mimeType: "text/html;profile=mcp-app", text: "<!doctype html><p>card</p>" }],
}));

server.registerTool(
  "show_card",
  {
    description: "Show a card to the user",
    inputSchema: { cardId: z.string() },
    _meta: { ui: { resourceUri: URI } },
  },
  async ({ cardId }) => ({
    content: [{ type: "text", text: `Card ${cardId} is on screen.` }],
    structuredContent: { cardId, title: "Fractions" },
    ...(echo ? { _meta: { ui: { resourceUri: URI } } } : {}),
  }),
);

await server.connect(new StdioServerTransport());
