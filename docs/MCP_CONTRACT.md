# MCP Contract

## Implemented diagnostic tools

- `phase0_probe` takes no input and returns a deterministic static result: `{"service":"HibikiDigest","phase":"0B","status":"ready"}`.
- It is a read-only, non-destructive, closed-domain temporary diagnostic capability. It performs no retrieval or writes.
- `phase0_image_probe` takes no input and returns a deterministic PNG in direct MCP `image` content with a neutral inspection instruction.
- `phase0_pdf_probe` takes no input and returns a deterministic one-page PDF in an embedded MCP `resource` with `application/pdf` and a base64 binary `blob`, plus a neutral inspection instruction.
- The image and PDF probes are temporary Phase 0 diagnostic tools, not part of the planned production API. Their descriptions, metadata, and text results do not disclose the visual relationships under test. Both are read-only, non-destructive, and closed-domain.
- Phase 1 Slice 1A adds no public MCP tools and preserves these diagnostics unchanged.

## Planned production contract

The following tools are planned and are not implemented. Their detailed schemas remain open.

- `prepare_audit`: prepare the mechanical inputs needed for an audit.
- `read_sources`: retrieve source material for ChatGPT to interpret.
- `commit_audit`: persist only normalized Hibiki audit state after interpretation.
- `get_current_state`: read the latest normalized audit state.
- `get_health`: read service health information.
- `get_audit_history`: read prior normalized audit records.

Service retrieval is mechanical; ChatGPT performs semantic interpretation. No MCP tool will mutate Discord or Google sources.
