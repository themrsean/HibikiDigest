# Architecture

Agreed high-level flow:

```text
raw sources -> MCP/service retrieval -> ChatGPT semantic analysis
            -> normalized persisted state -> digest/on-demand presentation
```

- The service handles mechanical retrieval, authentication, and persistence.
- ChatGPT handles semantic interpretation.
- Discord mutations are outside the system boundary.
- The MCP service is a stateless Cloudflare Worker using Streamable HTTP at `/mcp`.
- The Worker uses `createMcpHandler()` with a fresh `McpServer` for each request. MCP protocol session state is not persisted.
- Application state will later live separately in D1; D1 is not part of Phase 0.
- The temporary Phase 0 endpoint is unauthenticated because its diagnostic tools expose only harmless deterministic data and perform no writes.
- Slice 0C evaluates direct MCP image content for visual sources and embedded binary PDF resources for PDFs. No production source-retrieval representation is selected until ChatGPT visual validation is complete.
