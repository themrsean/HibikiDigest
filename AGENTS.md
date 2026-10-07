# Coding Agent Instructions

This file is the mandatory entry point for every coding-agent session in this repository.

- Read `docs/` before coding, especially `STATUS.md`, `REQUIREMENTS.md`, and the relevant design documents.
- Follow TDD for generated production behavior: write a failing test, confirm the expected failure, implement the minimum behavior, then run focused and complete checks.
- Follow these coding standards: no `break`, `continue`, or `while (true)`; no early `return` from void functions; use named constants for behavioral/configuration values; prefer small functions and explicit types; avoid `any` unless a compelling boundary reason is documented.
- Keep implementation, tests, and documentation synchronized.
- Update `docs/STATUS.md` after every slice. Update architecture, contracts, or decisions only when implementation or a durable decision changes.
- Never commit secrets or private deployment configuration. This is a public repository.
