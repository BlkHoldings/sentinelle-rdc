# Orchestration Flow

## Agents

| Agent | Owns | Allowed operations |
|-------|------|--------------------|
| `policy-engine` | `src/lib/policy-engine/**` | Read + write engine files |
| `builder` | `src/app/**`, `src/components/**` | Read + write app files; read engine index only |
| `reviewer` | — | Read all; run `typecheck` and `test:determinism`; no writes |

## Execution order

```
task
  │
  ▼
policy-engine ──HANDOFF -> builder──► builder ──HANDOFF -> reviewer──► reviewer
                                                                            │
                                                              ┌─────────────┴─────────────┐
                                                         verdict: PASS        verdict: CHANGES_REQUESTED
                                                              │                            │
                                                            done                  routed_to: policy-engine
                                                                                       or builder
                                                                                       (loop ≤ 3)
```

## Block format

The orchestrator (`orchestrate.mjs`) parses these literal strings from agent output.

### policy-engine output
```
HANDOFF -> builder
```

### builder output
```
HANDOFF -> reviewer
```

### reviewer output (pass)
```
verdict: PASS
```

### reviewer output (fail)
```
verdict: CHANGES_REQUESTED
routed_to: builder
```
or
```
verdict: CHANGES_REQUESTED
routed_to: policy-engine
```

## Loop budget

- Maximum **3 review cycles** before the orchestrator exits non-zero and prints outstanding issues for human resolution.
- `routed_to: policy-engine` → re-run policy-engine then builder before returning to reviewer.
- `routed_to: builder` → re-run builder only.

## Invariants

- Nobody grades their own homework: policy-engine and builder never review themselves.
- The reviewer never modifies files.
- The builder never imports engine internals (only `@/lib/policy-engine`).
- The engine never calls `Math.random`, `Date`, or any I/O.
