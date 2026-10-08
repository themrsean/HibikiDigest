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
- The production `hibiki-digest` D1 database is provisioned and bound to the Worker as `DB`. Production MCP tools do not read or write D1 yet.
- Raw Discord message bodies, attachment bytes, and source document contents are transient retrieval inputs. They are not stored in D1.
- The production Worker is `hibiki-digest` at `https://hibiki-digest.themrsean.workers.dev`; its `/mcp` endpoint remains unauthenticated while it exposes only harmless deterministic diagnostics and performs no writes. The old `hibiki-digest-phase0b` Worker remains temporarily available for the existing ChatGPT connection pending manual reconnection.
- The validated initial production source transport uses direct MCP `image` content for ordinary visual images and embedded binary `application/pdf` MCP resources for PDF sources. ChatGPT manually interpreted both Phase 0 fixtures correctly. PDF-to-image conversion and a `resource_link` fallback are not part of the initial implementation.
