import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const MCP_URL = new URL("https://hibiki-digest.example/mcp");
const TOOL_NAMES = ["phase0_probe", "phase0_image_probe", "phase0_pdf_probe"];
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
};
const PNG_SIGNATURE = "89504e470d0a1a0a";
const PDF_SIGNATURE = "%PDF-";
const BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const PROBE_RESULT = {
  service: "HibikiDigest",
  phase: "0B",
  status: "ready",
};

function expectNoVisualAnswer(text: string): void {
  expect(text).not.toMatch(
    /KIRI|NAMI|MORI|SORA|blue|red|yellow|green|square|circle|triangle|upper|lower|left|right|aligned/i,
  );
}

describe("Phase 0 MCP Worker", () => {
  it("connects over Streamable HTTP, exposes exactly three diagnostic tools, and preserves the 0B probe", async () => {
    const client = new Client({ name: "phase0-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(MCP_URL, {
      fetch: (url, init) =>
        worker.fetch(new Request(url, init), {}, {} as ExecutionContext),
    });

    try {
      await client.connect(transport);

      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name)).toEqual(TOOL_NAMES);
      for (const tool of tools) {
        expect(tool.annotations).toMatchObject(READ_ONLY_ANNOTATIONS);
      }
      for (const tool of tools.slice(1)) {
        expectNoVisualAnswer(JSON.stringify(tool));
      }

      const result = await client.callTool({ name: "phase0_probe" });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(PROBE_RESULT) },
      ]);
    } finally {
      await client.close();
    }
  });

  it("delivers a valid PNG as MCP image content without a textual answer", async () => {
    const client = new Client({ name: "phase0-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(MCP_URL, {
      fetch: (url, init) =>
        worker.fetch(new Request(url, init), {}, {} as ExecutionContext),
    });
    try {
      await client.connect(transport);
      const result = await client.callTool({ name: "phase0_image_probe" });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result._meta).toBeUndefined();
      expect(
        result.content.filter((block) => block.type === "image"),
      ).toHaveLength(1);
      expect(
        result.content.every(
          (block) => block.type === "text" || block.type === "image",
        ),
      ).toBe(true);
      const image = result.content.find((block) => block.type === "image");
      expect(image?.mimeType).toBe("image/png");
      expect(image?.data).toMatch(BASE64_PATTERN);
      expect(image?.data.length).toBeGreaterThan(0);
      expect(
        Buffer.from(image?.data ?? "", "base64")
          .subarray(0, 8)
          .toString("hex"),
      ).toBe(PNG_SIGNATURE);
      expectNoVisualAnswer(
        JSON.stringify(result.content.filter((block) => block.type === "text")),
      );
    } finally {
      await client.close();
    }
  });

  it("delivers a valid PDF as an embedded binary MCP resource without a textual answer", async () => {
    const client = new Client({ name: "phase0-test", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(MCP_URL, {
      fetch: (url, init) =>
        worker.fetch(new Request(url, init), {}, {} as ExecutionContext),
    });
    try {
      await client.connect(transport);
      const result = await client.callTool({ name: "phase0_pdf_probe" });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result._meta).toBeUndefined();
      expect(
        result.content.filter((block) => block.type === "resource"),
      ).toHaveLength(1);
      expect(
        result.content.every(
          (block) => block.type === "text" || block.type === "resource",
        ),
      ).toBe(true);
      const embedded = result.content.find(
        (block) => block.type === "resource",
      );
      expect(embedded?.resource.mimeType).toBe("application/pdf");
      expect(embedded?.resource).not.toHaveProperty("text");
      expect(embedded?.resource).toHaveProperty("blob");
      if (embedded?.resource && "blob" in embedded.resource) {
        expect(embedded.resource.blob).toMatch(BASE64_PATTERN);
        expect(
          Buffer.from(embedded.resource.blob, "base64")
            .subarray(0, 5)
            .toString(),
        ).toBe(PDF_SIGNATURE);
      }
      expectNoVisualAnswer(
        JSON.stringify(
          result.content.map((block) =>
            block.type === "resource"
              ? { uri: block.resource.uri, mimeType: block.resource.mimeType }
              : block,
          ),
        ),
      );
    } finally {
      await client.close();
    }
  });
});
