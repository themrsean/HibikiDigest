# MCP Contract

## Implemented in Slice 0B

- `phase0_probe` takes no input and returns a deterministic static result: `{"service":"HibikiDigest","phase":"0B","status":"ready"}`.
- It is a read-only, non-destructive, closed-domain temporary diagnostic capability. It performs no retrieval or writes.

## Planned production contract

The following tools are planned and are not implemented. Their detailed schemas remain open.

- `prepare_audit`: prepare the mechanical inputs needed for an audit.
- `read_sources`: retrieve source material for ChatGPT to interpret.
- `commit_audit`: persist only normalized Hibiki audit state after interpretation.
- `get_current_state`: read the latest normalized audit state.
- `get_health`: read service health information.
- `get_audit_history`: read prior normalized audit records.

Service retrieval is mechanical; ChatGPT performs semantic interpretation. No MCP tool will mutate Discord or Google sources.
