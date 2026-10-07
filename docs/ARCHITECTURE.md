# Architecture

Agreed high-level flow:

```text
raw sources -> MCP/service retrieval -> ChatGPT semantic analysis
            -> normalized D1 state -> digest/on-demand presentation
```

- The service handles mechanical retrieval, authentication, and persistence.
- ChatGPT handles semantic interpretation.
- Discord mutations are outside the system boundary.
- The MCP service is a stateless Cloudflare Worker using Streamable HTTP at `/mcp`.
- The Worker uses `createMcpHandler()` with a fresh `McpServer` for each request. MCP protocol session state is not persisted.
- D1 is the normalized operational-state store. It holds audit state, Discord identifiers and observations, source references, and normalized performance, practice, question, poll, and reporting state.
- Raw Discord message bodies, attachment bytes, and source document contents are transient retrieval inputs. They are not stored in D1.
- The temporary Phase 0 endpoint is unauthenticated because its diagnostic tools expose only harmless deterministic data and perform no writes.
- The validated initial production source transport uses direct MCP `image` content for ordinary visual images and embedded binary `application/pdf` MCP resources for PDF sources. ChatGPT manually interpreted both Phase 0 fixtures correctly. PDF-to-image conversion and a `resource_link` fallback are not part of the initial implementation.
