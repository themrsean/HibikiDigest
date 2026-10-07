# Decisions

- Use TypeScript.
- Use npm.
- Use Vitest.
- Enable strict TypeScript.
- Use ESLint.
- Use Prettier.
- TDD is required for generated production behavior.
- The MCP server is a stateless Cloudflare Worker using Streamable HTTP and the current `createMcpHandler()` approach. No Durable Object stores MCP session state.
- Authentication is deferred only while the server exposes no private data or meaningful writes. Slice 0B contains only a static diagnostic probe.
- D1 remains the intended separate application-state store for a later slice.
- A remote MCP integration is intended.
- Repository documentation is the persistent context for fresh coding-agent sessions.
