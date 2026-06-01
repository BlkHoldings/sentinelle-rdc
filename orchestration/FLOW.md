# DISP-Lite Orchestration

A lightweight "policy simulation team" running inside the repo. Three specialized
agents, strict handoffs, one quality gate.

## Agents

| Agent           | Owns                              | May edit                       |
| --------------- | --------------------------------- | ------------------------------ |
| `policy-engine` | Simulation logic & the contract   | `src/lib/policy-engine/**`     |
| `builder`       | App, API routes, UI               | `src/app/**`, `src/components/**` |
| `reviewer`      | Quality gate (read + run only)    | nothing — verifies             |

## Flow

```
            ┌─────────────────┐
   task ───▶│  ORCHESTRATOR   │
            └────────┬────────┘
                     │  1. contract first
                     ▼
            ┌─────────────────┐
            │  policy-engine  │  authors types.ts + engine + coefficients
            └────────┬────────┘
                     │  HANDOFF -> reviewer (exports, assumptions)
                     ▼
            ┌─────────────────┐
            │     builder     │  consumes the contract, builds API + UI
            └────────┬────────┘
                     │  HANDOFF -> reviewer (files_changed, open_questions)
                     ▼
            ┌─────────────────┐
            │    reviewer     │  verifies contract, determinism, types, realism
            └────────┬────────┘
                     │
        PASS ────────┴──────── CHANGES_REQUESTED
         │                         │
         ▼                         ▼
       merge              route back to owning agent
```

## Handoff Rules (critical for consistency)

1. **Contract before code.** The `policy-engine` agent must publish `types.ts` and
   the `index.ts` exports *before* `builder` writes anything that consumes them.
2. **No cross-editing.** An agent edits only files it owns (see table). If it needs a
   change elsewhere, it raises it in the HANDOFF block — it does not reach in.
3. **No self-approval.** Only `reviewer` flips a task to PASS. An agent cannot grade
   its own work.
4. **Structured handoffs only.** Every agent ends its turn with a machine-readable
   block (`HANDOFF ->` or `REVIEW`). The orchestrator routes on that block alone.
5. **Determinism is non-negotiable.** Any `Math.random` / `Date.now` / `fetch` inside
   the engine is an automatic CHANGES_REQUESTED.
6. **Single source of truth for types.** Types live in `policy-engine/types.ts`. The
   app imports them; it never redefines or widens them.

## Loop termination

- Max 3 review cycles per task. On the 3rd `CHANGES_REQUESTED`, the orchestrator
  escalates to the human with the open `blocking_issues`.
