#!/usr/bin/env node
/**
 * DISP-Lite Multi-Agent Orchestrator
 *
 * Runs: policy-engine → builder → reviewer, with a review-loop up to MAX_LOOPS.
 *
 * Prerequisites:
 *   npm i -g @anthropic-ai/claude-code   # installs the `claude` CLI
 *   export ANTHROPIC_API_KEY=sk-...
 *
 * Usage:
 *   npm run orchestrate "Add a 'currency_crisis' scenario tuned for finance shocks"
 */

import { spawnSync }          from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname }   from 'node:path';
import { fileURLToPath }      from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, '..');
const AGENTS_DIR = resolve(ROOT, '.claude/agents');
const MAX_LOOPS  = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentFile(name) {
  return resolve(AGENTS_DIR, `${name}.md`);
}

function runAgent(name, prompt) {
  const file = agentFile(name);
  if (!existsSync(file)) throw new Error(`Agent definition missing: ${file}`);

  const result = spawnSync(
    'claude',
    ['--print', '--agent-file', file, prompt],
    { cwd: ROOT, encoding: 'utf8', timeout: 600_000 },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const msg = result.stderr?.trim() || `exit code ${result.status}`;
    throw new Error(`[${name}] ${msg}`);
  }
  return result.stdout ?? '';
}

function parseTag(output, tag) {
  const m = output.match(new RegExp(`${tag}:\\s*(.+)`, 'i'));
  return m?.[1]?.trim() ?? null;
}

function parseIssues(output) {
  // Capture everything between ISSUES: and the next all-caps tag (or end)
  const m = output.match(/ISSUES:\s*([\s\S]*?)(?=\n[A-Z_]+:|$)/i);
  return m?.[1]?.trim() ?? '(see reviewer output above)';
}

function sep(label) {
  console.log(`\n${'─'.repeat(56)}`);
  console.log(` ${label}`);
  console.log('─'.repeat(56));
}

// ── Entry point ───────────────────────────────────────────────────────────────

const task = process.argv.slice(2).join(' ').trim();
if (!task) {
  console.error('Usage: npm run orchestrate "<task description>"');
  process.exit(1);
}

console.log('═'.repeat(58));
console.log('  DISP-Lite Orchestrator');
console.log('═'.repeat(58));
console.log(`  Task: ${task}`);
console.log('═'.repeat(58));

try {
  // Phase 1: policy-engine
  sep('Phase 1 — policy-engine');
  let engineOut = runAgent('policy-engine', task);
  console.log(engineOut);

  // Phase 2: builder
  sep('Phase 2 — builder');
  let builderOut = runAgent('builder', `Task: ${task}\n\n${engineOut}`);
  console.log(builderOut);

  // Phase 3: reviewer loop
  for (let loop = 1; loop <= MAX_LOOPS; loop++) {
    sep(`Phase 3 — reviewer (loop ${loop}/${MAX_LOOPS})`);
    const reviewOut = runAgent('reviewer', `Task: ${task}\n\n${builderOut}`);
    console.log(reviewOut);

    const verdict = parseTag(reviewOut, 'REVIEW');

    if (verdict === 'PASS') {
      console.log('\n✓  Review passed — task complete.\n');
      process.exit(0);
    }

    if (loop === MAX_LOOPS) {
      console.error('\n✗  Max review loops reached. Escalating to human.\n');
      console.error('   Outstanding issues:\n', parseIssues(reviewOut));
      process.exit(1);
    }

    const routeTo = parseTag(reviewOut, 'ROUTE_TO') ?? 'builder';
    const issues  = parseIssues(reviewOut);
    console.log(`\n↩  Routing to ${routeTo} with issues:\n${issues}`);

    if (routeTo === 'policy-engine') {
      sep(`Phase 1 (retry ${loop}) — policy-engine`);
      engineOut = runAgent('policy-engine', `Task: ${task}\n\nFix these reviewer issues:\n${issues}`);
      console.log(engineOut);

      sep(`Phase 2 (retry ${loop}) — builder`);
      builderOut = runAgent('builder', `Task: ${task}\n\n${engineOut}`);
    } else {
      sep(`Phase 2 (retry ${loop}) — builder`);
      builderOut = runAgent('builder', `Task: ${task}\n\nFix these reviewer issues:\n${issues}`);
    }
    console.log(builderOut);
  }
} catch (err) {
  console.error('\n✗  Orchestration error:', err.message ?? err);
  process.exit(1);
}
