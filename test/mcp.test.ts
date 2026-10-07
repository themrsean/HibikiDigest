import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const MCP_URL = new URL("https://hibiki-digest.example/mcp");
const PROBE_RESULT = {
  service: "HibikiDigest",
  phase: "0B",
  status: "ready",
};

describe("Phase 0B MCP Worker", () => {
  it("connects over Streamable HTTP and exposes the deterministic probe", async () => {
    const client = new Client({ name: "phase0-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(MCP_URL, {
      fetch: (url, init) =>
        worker.fetch(new Request(url, init), {}, {} as ExecutionContext),
    });

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(["phase0_probe"]);
      expect(tools[0]?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });

      const result = await client.callTool({ name: "phase0_probe" });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(PROBE_RESULT) },
      ]);
    } finally {
      await client.close();
    }
  });
});
