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
- Stateless serving uses the native MCP v2 Web-standard `createMcpHandler()` from `@modelcontextprotocol/server` with a fresh `McpServer` for each request and explicit `legacy: "stateless"` compatibility. A Worker route guard serves MCP only at exactly `/mcp`; unrelated paths return a plain 404. MCP protocol session state is not persisted.
- The permanent `/mcp` endpoint is protected by Cloudflare Access. Access Managed OAuth supplies OAuth discovery and token transport for MCP clients; the Access policy is the authorization boundary. Worker application code does not host OAuth or maintain a duplicate user allowlist.
- When application behavior needs the authenticated caller, obtain the identity from Cloudflare Workers' authenticated Access context (`ctx.access` / `ctx.access.getIdentity()`). Fail closed when caller identity is required but unavailable. Do not parse Access JWTs manually or trust caller-supplied identity headers.
- D1 is the normalized operational-state store. It holds audit state, Discord identifiers and observations, source references, and normalized performance, practice, question, poll, and reporting state.
- The production `hibiki-digest` D1 database is provisioned and bound to the Worker as `DB`. Production MCP tools do not read or write D1 yet.
- Raw Discord message bodies, attachment bytes, and source document contents are transient retrieval inputs. They are not stored in D1. Private/raw source retrieval remains behind the authenticated Access boundary.
- The production Worker is `hibiki-digest` at `https://hibiki-digest.themrsean.workers.dev`; its permanent MCP endpoint is `https://hibiki-digest.themrsean.workers.dev/mcp`. The Access team domain is `hibikidigest.cloudflareaccess.com`. The obsolete `hibiki-digest-phase0b` Worker was retired after successful permanent deployment and remote regression; permanent health was verified afterward.
- The validated initial production source transport uses direct MCP `image` content for ordinary visual images and embedded binary `application/pdf` MCP resources for PDF sources. ChatGPT manually interpreted both Phase 0 fixtures correctly. PDF-to-image conversion and a `resource_link` fallback are not part of the initial implementation.
