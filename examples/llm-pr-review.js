#!/usr/bin/env node
'use strict';

/**
 * LLM PR Review — multi-agent code review of a real GitHub PR.
 *
 * 3 agents review PR #6 from raoulbia-ai/claude-recall:
 *   security-reviewer   : injection, data exposure, auth, input validation
 *   architecture-reviewer: design patterns, separation of concerns, maintainability
 *   reliability-reviewer : error handling, edge cases, data integrity, test coverage
 *
 * Uses ONLY the public API surface + LLM adapter.
 *
 * Usage:
 *   node examples/llm-pr-review.js
 *   BASE_URL=https://api.openai.com/v1 MODEL=gpt-4o API_KEY=sk-... node examples/llm-pr-review.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../index');
const { createLLMAgent } = require('../adapters');

// ─── Config ───

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/v1';
const MODEL = process.env.MODEL || 'local-vllm';
const API_KEY = process.env.API_KEY || undefined;
const CYCLES = 3;

// ─── PR Data (static snapshot — no GitHub API calls at runtime) ───

const PR = {
  repo: 'raoulbia-ai/claude-recall',
  number: 6,
  title: 'fix: Code review — [object Object] display, retention limits, error handling',
  description: `Addresses code review findings from v0.18.x:
- Fixes [object Object] rendering in Rule Health output by properly extracting .content or .value from objects
- New pruneOldData() method that automatically removes episodes/events older than 90 days and rejected lessons older than 14 days
- Added error handling with try-catch wrappers around the promotion loop and demotion sweep
- Enhanced null/undefined guards in computeStrength() for the shouldArchive() function`,
  files: [
    {
      name: 'src/hooks/memory-stop-hook.ts',
      additions: 11, deletions: 0,
      diff: `+ // Prune old data (non-fatal)
+ try {
+   const pruned = outcomeStorage.pruneOldData();
+   if (pruned.episodes > 0 || pruned.events > 0 || pruned.lessons > 0 || pruned.orphanedStats > 0) {
+     console.error(\`[memory-stop] Pruned: \${pruned.episodes} episodes, \${pruned.events} events, \${pruned.lessons} lessons, \${pruned.orphanedStats} orphaned stats\`);
+   }
+ } catch (err) {
+   console.error('[memory-stop] Prune failed:', err instanceof Error ? err.message : err);
+ }`,
    },
    {
      name: 'src/mcp/tools/memory-tools.ts',
      additions: 14, deletions: 2,
      diff: `- const value = rule.value;
+ let value: string;
+ if (typeof rule === 'string') {
+   value = rule;
+ } else if (typeof rule === 'object' && rule !== null) {
+   // Try to extract meaningful content from object
+   try {
+     value = JSON.stringify(rule);
+   } catch {
+     value = String(rule);
+   }
+   // Prefer .content or .value if available
+   if (rule.content) value = String(rule.content);
+   else if (rule.value) value = String(rule.value);
+ } else {
+   value = String(rule ?? '');
+ }`,
    },
    {
      name: 'src/services/outcome-storage.ts',
      additions: 29, deletions: 0,
      diff: `+ pruneOldData(): { episodes: number; events: number; lessons: number; orphanedStats: number } {
+   const now = Date.now();
+   const EPISODE_MAX_AGE = 90 * 24 * 60 * 60 * 1000;  // 90 days
+   const EVENT_MAX_AGE = 90 * 24 * 60 * 60 * 1000;     // 90 days
+   const LESSON_MAX_AGE = 14 * 24 * 60 * 60 * 1000;    // 14 days
+
+   let episodes = 0, events = 0, lessons = 0, orphanedStats = 0;
+
+   // Remove old episodes
+   const allEpisodes = this.db.prepare('SELECT id, created_at FROM episodes').all();
+   for (const ep of allEpisodes) {
+     if (now - new Date(ep.created_at).getTime() > EPISODE_MAX_AGE) {
+       this.db.prepare('DELETE FROM episodes WHERE id = ?').run(ep.id);
+       episodes++;
+     }
+   }
+
+   // Remove old events
+   const allEvents = this.db.prepare('SELECT id, timestamp FROM outcome_events').all();
+   for (const ev of allEvents) {
+     if (now - new Date(ev.timestamp).getTime() > EVENT_MAX_AGE) {
+       this.db.prepare('DELETE FROM outcome_events WHERE id = ?').run(ev.id);
+       events++;
+     }
+   }
+
+   // Remove old rejected/archived lessons
+   const oldLessons = this.db.prepare(
+     "SELECT id, updated_at FROM candidate_lessons WHERE status IN ('rejected','archived')"
+   ).all();
+   for (const l of oldLessons) {
+     if (now - new Date(l.updated_at).getTime() > LESSON_MAX_AGE) {
+       this.db.prepare('DELETE FROM candidate_lessons WHERE id = ?').run(l.id);
+       lessons++;
+     }
+   }
+
+   // Remove orphaned stats
+   const orphaned = this.db.prepare(
+     'SELECT id FROM memory_stats WHERE memory_id NOT IN (SELECT id FROM memories)'
+   ).all();
+   for (const o of orphaned) {
+     this.db.prepare('DELETE FROM memory_stats WHERE id = ?').run(o.id);
+     orphanedStats++;
+   }
+
+   return { episodes, events, lessons, orphanedStats };
+ }`,
    },
    {
      name: 'src/services/promotion-engine.ts',
      additions: 14, deletions: 9,
      diff: `  for (const candidate of candidates) {
-   const strength = computeStrength(candidate);
-   if (strength >= PROMOTION_THRESHOLD) {
-     promote(candidate);
-   } else if (strength <= REJECTION_THRESHOLD) {
-     reject(candidate);
+   try {
+     let strength = 0;
+     try {
+       strength = computeStrength(candidate);
+     } catch (err) {
+       console.error(\`[promotion] Strength computation failed for \${candidate.id}:\`, err instanceof Error ? err.message : err);
+       continue;
+     }
+     if (strength >= PROMOTION_THRESHOLD) {
+       promote(candidate);
+     } else if (strength <= REJECTION_THRESHOLD) {
+       reject(candidate);
+     }
+   } catch (err) {
+     console.error(\`[promotion] Failed processing candidate \${candidate.id}:\`, err instanceof Error ? err.message : err);
    }
  }`,
    },
  ],
};

// ─── Format diff for prompts ───

const DIFF_TEXT = PR.files.map(f =>
  `### ${f.name} (+${f.additions} -${f.deletions})\n\`\`\`diff\n${f.diff}\n\`\`\``
).join('\n\n');

const PR_CONTEXT = `
PULL REQUEST: ${PR.repo}#${PR.number}
Title: ${PR.title}
Description: ${PR.description}

CHANGED FILES (${PR.files.length}):
${DIFF_TEXT}
`;

// ─── Setup ───

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-review-')));
const institution = createInstitution({ store });

// ─── Agents ───

const securityReviewer = createLLMAgent({
  id: 'security-reviewer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "security-reviewer", a security engineer reviewing a pull request.

You focus on: SQL injection, data exposure, input validation, error messages leaking internals, unsafe type coercion, deletion without authorization checks.

${PR_CONTEXT}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a specific security concern with file/line reference
- Use "interpret" for your overall security assessment
- Use "challenge" if another reviewer dismisses a security concern (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Be specific — cite the exact code pattern that concerns you
- If the code looks safe, say so with confidence — don't invent problems

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const architectureReviewer = createLLMAgent({
  id: 'architecture-reviewer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "architecture-reviewer", a senior engineer reviewing a pull request for design quality.

You focus on: separation of concerns, single responsibility, error handling patterns, API design, maintainability, whether the approach will scale or create tech debt.

${PR_CONTEXT}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a design concern with specific code reference
- Use "interpret" for your overall architectural assessment
- Use "challenge" if you disagree with another reviewer's assessment (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Be concrete — suggest alternatives when you flag problems
- If the design is solid, say so

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const reliabilityReviewer = createLLMAgent({
  id: 'reliability-reviewer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "reliability-reviewer", an SRE/reliability engineer reviewing a pull request.

You focus on: error handling completeness, edge cases, data integrity during deletion, cascading failures, logging quality, whether errors are silently swallowed, race conditions.

${PR_CONTEXT}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a reliability concern with specific code reference
- Use "interpret" for your overall reliability assessment
- Use "challenge" if another reviewer's suggestion would introduce reliability risk (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Focus on what could go wrong in production, not style

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

// ─── Register ───

institution.registerAgent(securityReviewer);
institution.registerAgent(architectureReviewer);
institution.registerAgent(reliabilityReviewer);

// ─── Run ───

async function main() {
  console.log(`=== LLM PR Review: ${PR.repo}#${PR.number} ===`);
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log('');
  console.log('--- PR Input ---');
  console.log(`  Title: ${PR.title}`);
  console.log(`  Files changed: ${PR.files.length} (${PR.files.reduce((s, f) => s + f.additions, 0)} additions, ${PR.files.reduce((s, f) => s + f.deletions, 0)} deletions)`);
  for (const f of PR.files) console.log(`    ${f.name} (+${f.additions} -${f.deletions})`);
  console.log(`  Description: ${PR.description.split('\n')[0]}`);
  console.log('');
  console.log('--- Reviewers ---');
  console.log('  security-reviewer     : injection, data exposure, input validation, auth');
  console.log('  architecture-reviewer : design patterns, separation of concerns, maintainability');
  console.log('  reliability-reviewer  : error handling, edge cases, data integrity, logging');
  console.log('');

  // Ingest PR as signal
  institution.ingestSignal({
    type: 'pull_request',
    source: 'github',
    timestamp: new Date().toISOString(),
    title: `${PR.repo}#${PR.number}: ${PR.title}`,
    summary: PR.description,
    tags: ['pr', 'code_review', ...PR.files.map(f => f.name)],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: `Review: ${PR.repo}#${PR.number} — ${PR.title}`,
    framing: {
      primary_question: 'Should this PR be approved, and are there concerns that need to be addressed first?',
      posture: 'code_review',
      in_scope: ['security', 'architecture', 'reliability', 'error handling', 'data integrity'],
      out_of_scope: ['performance optimization', 'UI/UX', 'feature scope'],
    },
  });

  // Run cycles
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
    }

    // Show interventions from this cycle
    const allInts = institution.listInterventions(proc.id);
    for (const int of allInts.slice(-5)) {
      const targetInfo = int.targets?.length > 0 ? ` → responds to ${int.targets.length} prior` : '';
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}${targetInfo}`);
    }
  }

  // ─── Final Output ───

  console.log(`\n${'═'.repeat(50)}`);
  console.log('  REVIEW SUMMARY');
  console.log(`${'═'.repeat(50)}`);

  const allInts = institution.listInterventions(proc.id);
  console.log(`\n--- All Findings (${allInts.length}) ---`);
  for (const int of allInts) {
    const targetInfo = int.targets?.length > 0 ? ` [responds to ${int.targets.length} prior]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${targetInfo}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Synthesize review
  const concerns = allInts.filter(i => i.type === 'challenge' || i.type === 'introduce_evidence');
  const interpretations = allInts.filter(i => i.type === 'interpret');

  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'review-system',
    primary_reading: `${allInts.length} review findings from 3 reviewers across ${CYCLES} cycles. ${concerns.length} specific concerns raised.`,
    supporting_points: allInts.map(i => `[${i.agent_id}] ${i.type}: ${i.summary}`),
    uncertainties: concerns.length > 0
      ? concerns.map(c => c.summary.slice(0, 100))
      : ['No significant concerns identified'],
    preserved_dissent: allInts.filter(i => i.type === 'challenge').map(c => ({
      label: c.summary.slice(0, 80),
      summary: c.content.slice(0, 200),
    })),
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n--- Review Synthesis ---`);
  console.log(syn.primary_reading);
  if (syn.uncertainties.length > 0) {
    console.log('\nOpen concerns:');
    for (const u of syn.uncertainties) console.log(`  - ${u}`);
  }
  if (syn.preserved_dissent.length > 0) {
    console.log('\nDisagreements:');
    for (const d of syn.preserved_dissent) console.log(`  - ${d.label}`);
  }

  // Health
  const health = institution.getHealth();
  console.log(`\n--- Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);

  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
