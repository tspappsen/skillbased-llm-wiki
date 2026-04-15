import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { handleAdd } from "./tools/add.js";
import { handleQuery } from "./tools/query.js";

const server = new McpServer({
  name: "knowledge-base",
  version: "0.1.0",
});

server.tool(
  "kb_add",
  "Store markdown in the local knowledge base and refresh the QMD index.",
  {
    title: z.string(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  },
  async (params) => ({
    content: [{ type: "text", text: JSON.stringify(await handleAdd(params)) }],
  }),
);

server.tool(
  "kb_query",
  "Query the local knowledge base through the QMD index.",
  {
    query: z.string(),
    n: z.number().optional(),
  },
  async (params) => ({
    content: [{ type: "text", text: JSON.stringify(await handleQuery(params)) }],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("knowledge-base MCP server failed to start", error);
  process.exit(1);
});
