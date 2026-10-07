# HibikiDigest

HibikiDigest is a project to support audits of a small performance group's Discord server, with ChatGPT handling semantic analysis and digest generation.

## Local setup

Install the supported Node.js version and run `npm ci`.

Run the complete quality gate with `npm run check`.

Run the local MCP Worker with `npm run dev` and connect a Streamable HTTP MCP client to `http://localhost:8787/mcp`. Deploy with `npm run deploy` after authenticating Wrangler with `npx wrangler login`.

Slice 0B exposes only the public, static `phase0_probe` diagnostic tool.

Coding agents should start with [AGENTS.md](AGENTS.md). Project requirements and durable engineering context are in [docs/](docs/).
