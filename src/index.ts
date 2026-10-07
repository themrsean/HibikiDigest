import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

const SERVICE_NAME = "HibikiDigest";
const SERVICE_VERSION = "0.1.0";
const PROBE_RESULT = {
  service: SERVICE_NAME,
  phase: "0B",
  status: "ready",
};

function createServer(): McpServer {
  const server = new McpServer({
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
  });

  server.registerTool(
    "phase0_probe",
    {
      description: "Return the static Phase 0B transport readiness result.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => ({
      content: [{ type: "text", text: JSON.stringify(PROBE_RESULT) }],
    }),
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer, { route: "/mcp" });

export default { fetch: mcpHandler } satisfies ExportedHandler;
