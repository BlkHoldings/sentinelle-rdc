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
policy-engine ──HANDOFF: builder──► builder ──HANDOFF: reviewer──► reviewer
                                                                        │
                                                              ┌─────────┴─────────┐
                                                         REVIEW: PASS        REVIEW: FAIL
                                                              │                   │
                                                            done          ROUTE_TO: policy-engine
                                                                               or builder
                                                                               (loop ≤ 3)
```

## Handoff blocks

Each agent ends its turn with a structured block that the orchestrator parses.

### policy-engine output
```
HANDOFF: builder
TASK: <what builder must do>
FILES_CHANGED: src/lib/policy-engine/coefficients.ts, ...
```

### builder output
```
HANDOFF: reviewer
TASK: <what reviewer should verify>
FILES_CHANGED: src/components/Simulator.tsx, ...
```

### reviewer output (pass)
```
REVIEW: PASS
```

### reviewer output (fail)
```
REVIEW: FAIL
ISSUES:
- <blocker 1>
- <blocker 2>
ROUTE_TO: builder
```

## Loop budget

- Maximum **3 review loops** before the orchestrator exits with a non-zero code and prints the outstanding issues for human resolution.
- On ROUTE_TO: policy-engine, re-run policy-engine then builder before going back to reviewer.
- On ROUTE_TO: builder, re-run builder only.

## Invariants

- Nobody grades their own homework: policy-engine and builder never review themselves.
- The reviewer never modifies files.
- The builder never imports engine internals (only `@/lib/policy-engine`).
- The engine never calls `Math.random`, `Date`, or any I/O.
