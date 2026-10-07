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
- Application state will later live separately in D1; D1 is not part of Slice 0B.
- The temporary Slice 0B endpoint is unauthenticated only because its single static probe exposes no private data and performs no writes.
