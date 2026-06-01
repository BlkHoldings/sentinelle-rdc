#!/usr/bin/env node
/**
 * DISP-Lite Orchestrator
 *
 * Drives the three-agent loop by invoking the Claude Code CLI with each agent's
 * system prompt, parsing the structured HANDOFF / REVIEW block each turn, and
 * routing accordingly. This is a thin coordinator — all real work lives in the
 * agents (.claude/agents/*.md).
 *
 * Requires the `claude` CLI on PATH (npm i -g @anthropic-ai/claude-code).
 *
 * Usage:
 *   node orchestration/orchestrate.mjs "Add a 'sanction' scenario tuned for finance shocks"
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MAX_CYCLES = 3;

/** Load an agent's markdown definition (front matter + system prompt body). */
function loadAgent(name) {
  const raw = readFileSync(join(ROOT, ".claude", "agents", `${name}.md`), "utf8");
  const body = raw.replace(/^---[\s\S]*?---\n/, "").trim();
  return body;
}

/** Invoke Claude Code headlessly with a given system prompt + user prompt. */
function callAgent(agentName, task, context) {
  const system = loadAgent(agentName);
  const prompt = [
    `# TASK\n${task}`,
    context ? `# CONTEXT FROM PRIOR AGENT\n${context}` : "",
    `# WORKING DIR\n${ROOT}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = spawnSync(
    "claude",
    ["-p", prompt, "--append-system-prompt", system, "--permission-mode", "acceptEdits"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  );

  if (res.error) {
    throw new Error(`Failed to invoke claude CLI: ${res.error.message}`);
  }
  return res.stdout ?? "";
}

/** Extract the last HANDOFF or REVIEW block from agent output. */
function parseBlock(output) {
  const handoff = [...output.matchAll(/HANDOFF\s*->\s*(\w[\w-]*)/g)].pop();
  const verdict = [...output.matchAll(/verdict:\s*(PASS|CHANGES_REQUESTED)/g)].pop();
  const routed = [...output.matchAll(/routed_to:\s*(builder|policy-engine|none)/g)].pop();

  return {
    handoffTo: handoff?.[1] ?? null,
    verdict: verdict?.[1] ?? null,
    routedTo: routed?.[1] ?? null,
    raw: output,
  };
}

function log(stage, msg) {
  console.log(`\n=== [${stage}] ${msg} ===`);
}

async function orchestrate(task) {
  log("ORCHESTRATOR", `Task received: ${task}`);

  // 1. Contract first — policy engine authors/updates logic + types.
  log("policy-engine", "Authoring simulation logic and contract…");
  let out = callAgent("policy-engine", task);
  let block = parseBlock(out);
  let context = block.raw;

  // 2. Builder consumes the contract and builds the app.
  log("builder", "Implementing app against the engine contract…");
  out = callAgent("builder", task, context);
  block = parseBlock(out);
  context = block.raw;

  // 3. Review loop.
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    log("reviewer", `Review cycle ${cycle}/${MAX_CYCLES}…`);
    out = callAgent("reviewer", task, context);
    block = parseBlock(out);

    if (block.verdict === "PASS") {
      log("ORCHESTRATOR", "Reviewer PASSED. Ready to merge. ✅");
      return 0;
    }

    const target = block.routedTo && block.routedTo !== "none" ? block.routedTo : "builder";
    log("ORCHESTRATOR", `CHANGES_REQUESTED -> routing to ${target}.`);
    out = callAgent(target, task, block.raw);
    context = parseBlock(out).raw;
  }

  log("ORCHESTRATOR", "Max review cycles reached. Escalating to human. ⚠️");
  console.log(block.raw);
  return 1;
}

const task = process.argv.slice(2).join(" ");
if (!task) {
  console.error('Usage: node orchestration/orchestrate.mjs "<task description>"');
  process.exit(2);
}

orchestrate(task)
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
