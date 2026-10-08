import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { IMAGE_PNG_BASE64, PDF_BASE64 } from "./fixtures.js";

const SERVICE_NAME = "HibikiDigest";
const SERVICE_VERSION = "0.1.0";
const PROBE_RESULT = {
  service: SERVICE_NAME,
  phase: "0B",
  status: "ready",
};
const DIAGNOSTIC_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};
const PDF_RESOURCE_URI = "fixture://phase0/pdf";
const MCP_PATH = "/mcp";
const NOT_FOUND_STATUS = 404;

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

  server.registerTool(
    "phase0_image_probe",
    {
      description: "Return a static image fixture for visual inspection.",
      annotations: DIAGNOSTIC_ANNOTATIONS,
    },
    async () => ({
      content: [
        { type: "text", text: "Inspect the attached image visually." },
        { type: "image", mimeType: "image/png", data: IMAGE_PNG_BASE64 },
      ],
    }),
  );

  server.registerTool(
    "phase0_pdf_probe",
    {
      description: "Return a static PDF fixture for visual inspection.",
      annotations: DIAGNOSTIC_ANNOTATIONS,
    },
    async () => ({
      content: [
        { type: "text", text: "Inspect the attached PDF visually." },
        {
          type: "resource",
          resource: {
            uri: PDF_RESOURCE_URI,
            mimeType: "application/pdf",
            blob: PDF_BASE64,
          },
        },
      ],
    }),
  );

  return server;
}

const mcpHandler = createMcpHandler(createServer, { legacy: "stateless" });

export default {
  async fetch(request: Request): Promise<Response> {
    return new URL(request.url).pathname === MCP_PATH
      ? mcpHandler.fetch(request)
      : new Response("Not Found", { status: NOT_FOUND_STATUS });
  },
} satisfies ExportedHandler;
