#!/usr/bin/env node
'use strict';

/**
 * Incident Investigation — Part 2: Resume with new evidence.
 *
 * This demo shows framework-level persistence. No CLI or application
 * logic is required — resuming is simply reusing the same proceeding
 * and store.
 *
 * Run llm-incident-initial.js first to create the proceeding,
 * then run this to continue the investigation.
 *
 * Usage: node examples/llm-incident-resume.js
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

// Same data dir as llm-incident-initial.js
const DATA_DIR = path.join(os.homedir(), '.ai-discourse-resume-demo');

// ─── New evidence discovered since Part 1 ───

const NEW_EVIDENCE = {
  title: 'New finding: internal KMS key version was disabled by sync script',
  details: [
    'KMS registry dump at 09:15 shows key version KV42 marked DISABLED',
    'KV42 was used to encrypt all existing payment tokens',
    'An internal hourly sync script disabled KV42 after detecting the provider rotation',
    'The sync script was not supposed to disable active key versions — this is a bug in the sync logic',
    'Tokens encrypted with KV42 cannot be decrypted until KV42 is re-enabled',
  ],
};

// ─── Agents (prompted to build on prior findings) ───

const agents = [
  createLLMAgent({
    id: 'backend-eng',
    baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
    systemPrompt: `You are "backend-eng", a backend engineer investigating a RESUMED incident proceeding. New evidence has been added since the last session. Focus on how the new evidence changes the diagnosis. Build on what was already established — do not repeat the initial hypothesis.

RULES:
- Use "revision" to update your own earlier position (requires "targets" and "grounds")
- Use "interpret" for new analysis (requires "grounds")
- Use "challenge" to dispute another agent (requires "targets")
- Acknowledge prior findings and focus on what the new evidence changes

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  }),
  createLLMAgent({
    id: 'qa-eng',
    baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.4,
    systemPrompt: `You are "qa-eng", a QA engineer who challenges assumptions. This is a RESUMED incident proceeding with new evidence. Focus on whether the new evidence resolves or complicates the prior diagnosis.

RULES:
- Use "challenge" to question hypotheses (requires "targets")
- Use "introduce_evidence" to present findings (requires "grounds")
- You MUST challenge at least one hypothesis if you see weak evidence

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  }),
];

// ─── Main ───

async function main() {
  // Reuse the same store — this is all that's needed to resume
  if (!fs.existsSync(DATA_DIR)) {
    console.error('No existing data found. Run llm-incident-initial.js first.');
    process.exit(1);
  }

  const store = createStore(DATA_DIR);
  const institution = createInstitution({ store });
  for (const agent of agents) institution.registerAgent(agent);

  // Find existing proceeding
  const proceedings = institution.listProceedings();
  if (proceedings.length === 0) {
    console.error('No existing proceedings found. Run llm-incident-initial.js first.');
    process.exit(1);
  }

  const proc = proceedings[0];

  console.log('═══════════════════════════════════════');
  console.log('  Part 2: Resuming with New Evidence');
  console.log('═══════════════════════════════════════');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Data dir: ${DATA_DIR}`);
  console.log('');
  console.log(`Resuming proceeding: ${proc.id}`);
  console.log(`  Title: ${proc.title}`);
  console.log(`  Status: ${proc.status}`);
  console.log('');

  // Show what was established in Part 1
  const prevSyn = institution.getSynthesis(proc.id);
  if (prevSyn) {
    console.log(`--- Previous Synthesis (v${prevSyn.version}) ---`);
    console.log(`  ${prevSyn.primary_reading}`);
    console.log('');
  }

  const prevInts = institution.listInterventions(proc.id);
  console.log(`--- Prior Interventions (${prevInts.length}) ---`);
  for (const int of prevInts) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}`);
  }
  console.log('');

  // Inject new evidence
  console.log('--- New Evidence ---');
  console.log(`  ${NEW_EVIDENCE.title}`);
  for (const d of NEW_EVIDENCE.details) console.log(`  - ${d}`);
  console.log('');

  institution.submitIntervention({
    proceeding_id: proc.id,
    type: 'introduce_evidence',
    agent_id: 'incident-commander',
    summary: NEW_EVIDENCE.title,
    content: NEW_EVIDENCE.details.join('\n'),
    grounds: { evidence_refs: ['kms_registry_dump_0915', 'sync_script_audit_log'] },
  });

  // Run 2 more cycles
  for (let i = 1; i <= 2; i++) {
    console.log(`--- Cycle ${i} (resumed) ---`);
    const result = await institution.runCycle();
    console.log(`  Interventions: ${result.interventions_submitted}`);
  }

  // Show new interventions
  const allInts = institution.listInterventions(proc.id);
  const newInts = allInts.slice(prevInts.length);
  console.log(`\n--- New Interventions (${newInts.length}) ---`);
  for (const int of newInts) {
    console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}`);
  }

  // Synthesis v2
  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'incident-commander',
    primary_reading: 'Revised diagnosis: the provider key rotation triggered an internal KMS sync script bug that disabled the active key version (KV42). Root cause is the sync script, not the provider.',
    supporting_points: [
      ...(prevSyn?.supporting_points || []),
      ...newInts.map(i => `[${i.agent_id}] ${i.summary}`),
    ],
    uncertainties: [
      'Whether re-enabling KV42 is safe or whether tokens need re-encryption',
      'Whether the sync script bug affects other key versions',
    ],
    preserved_dissent: [{
      label: 'Provider rotation as primary cause',
      summary: 'Initial hypothesis attributed the failure to the provider key rotation alone — now superseded by sync script evidence',
    }],
  });

  const newSyn = institution.getSynthesis(proc.id);
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  SYNTHESIS v${newSyn.version} (updated)`);
  console.log(`╚══════════════════════════════════════╝`);
  console.log(newSyn.primary_reading);

  if (prevSyn) {
    console.log(`\n--- Evolution ---`);
    console.log(`  v${prevSyn.version}: ${prevSyn.primary_reading.slice(0, 100)}`);
    console.log(`  v${newSyn.version}: ${newSyn.primary_reading.slice(0, 100)}`);
  }

  console.log(`\nTotal interventions: ${allInts.length} (${prevInts.length} from part 1 + ${newInts.length + 1} from part 2)`);
  console.log(`\nThis proceeding was NOT restarted. Prior state was loaded from: ${DATA_DIR}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
