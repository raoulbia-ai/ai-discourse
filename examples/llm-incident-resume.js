#!/usr/bin/env node
'use strict';

/**
 * Incident Resume Demo — proves reasoning persists across runs.
 *
 * This demo shows that the framework is not just multi-cycle looping.
 * State persists to disk. The second run resumes the same proceeding
 * and updates the synthesis with new evidence instead of restarting.
 *
 * Usage:
 *   node examples/llm-incident-resume.js             # Run 1: initial investigation
 *   node examples/llm-incident-resume.js --resume     # Run 2: resume with new evidence
 *
 * Both runs use the same data directory (~/.ai-discourse-resume-demo/).
 * Run 1 creates the proceeding. Run 2 finds and resumes it.
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

// Persistent data dir — survives across runs
const DATA_DIR = path.join(os.homedir(), '.ai-discourse-resume-demo');
const RESUME = process.argv.includes('--resume');

// ─── Incident Data ───

const INITIAL_INCIDENT = {
  title: 'Checkout API returning 500 errors for 12% of users',
  symptoms: [
    'HTTP 500 on POST /api/checkout/confirm',
    'Only affects users with saved payment methods',
    'Error rate jumped at 09:08 UTC',
    'Payment provider rotated encryption key at 09:00 UTC',
  ],
};

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

// ─── Create agents ───

function createAgents() {
  const basePrompt = RESUME
    ? `You are investigating a RESUMED incident proceeding. New evidence has been added since the last session. Focus on how the new evidence changes the diagnosis. Build on what was already established — do not repeat the initial hypothesis.`
    : `You are investigating a new production incident. Form your initial hypothesis based on the available evidence.`;

  return [
    createLLMAgent({
      id: 'backend-eng',
      baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
      systemPrompt: `You are "backend-eng", a backend engineer. ${basePrompt}

RULES:
- Use "interpret" for your hypothesis (requires "grounds")
- Use "challenge" to dispute another agent (requires "targets")
- Use "revision" to update your own earlier position (requires "targets" and "grounds")
- Include "grounds" with evidence_refs
- If resuming: acknowledge prior findings and focus on what the new evidence changes

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
    }),
    createLLMAgent({
      id: 'qa-eng',
      baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.4,
      systemPrompt: `You are "qa-eng", a QA engineer who challenges assumptions. ${basePrompt}

RULES:
- Use "challenge" to question hypotheses (requires "targets")
- Use "introduce_evidence" to present findings (requires "grounds")
- You MUST challenge at least one hypothesis if you see weak evidence
- If resuming: focus on whether the new evidence resolves or complicates the prior diagnosis

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
    }),
  ];
}

// ─── Main ───

async function main() {
  // Always point to the same persistent data dir
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const store = createStore(DATA_DIR);
  const institution = createInstitution({ store });

  // Register agents
  for (const agent of createAgents()) {
    institution.registerAgent(agent);
  }

  if (!RESUME) {
    // ═══════════════════════════════════════
    //  RUN 1: Initial Investigation
    // ═══════════════════════════════════════

    console.log('═══════════════════════════════════════');
    console.log('  RUN 1: Initial Investigation');
    console.log('═══════════════════════════════════════');
    console.log(`LLM: ${BASE_URL} / ${MODEL}`);
    console.log('');
    console.log('--- Incident ---');
    console.log(`  ${INITIAL_INCIDENT.title}`);
    for (const s of INITIAL_INCIDENT.symptoms) console.log(`  - ${s}`);
    console.log('');

    // Check for existing proceedings (clean start)
    const existing = institution.listProceedings();
    if (existing.length > 0) {
      console.log(`WARNING: Data dir already has ${existing.length} proceeding(s).`);
      console.log(`  Delete ${DATA_DIR} for a clean start, or use --resume to continue.`);
      process.exit(1);
    }

    // Ingest incident
    institution.ingestSignal({
      type: 'incident',
      source: 'pagerduty',
      timestamp: new Date().toISOString(),
      title: INITIAL_INCIDENT.title,
      summary: INITIAL_INCIDENT.symptoms.join('. '),
      tags: ['incident', 'P1', 'checkout'],
    });

    // Open proceeding
    const proc = institution.openProceeding({
      title: INITIAL_INCIDENT.title,
      framing: {
        primary_question: 'What is the root cause of the checkout 500 errors?',
        posture: 'incident_investigation',
        in_scope: ['root cause', 'blast radius', 'remediation'],
        out_of_scope: ['architecture redesign'],
      },
    });

    console.log(`Proceeding created: ${proc.id}`);
    console.log('');

    // Run 2 cycles
    for (let i = 1; i <= 2; i++) {
      console.log(`--- Cycle ${i} ---`);
      const result = await institution.runCycle();
      console.log(`  Interventions: ${result.interventions_submitted}`);
    }

    // Show interventions
    const ints = institution.listInterventions(proc.id);
    console.log(`\n--- Interventions (${ints.length}) ---`);
    for (const int of ints) {
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}`);
    }

    // Create initial synthesis
    institution.updateSynthesis({
      proceeding_id: proc.id,
      updated_by: 'incident-commander',
      primary_reading: 'Initial diagnosis: payment provider key rotation is the suspected cause. Investigation ongoing.',
      supporting_points: ints.map(i => `[${i.agent_id}] ${i.summary}`),
      uncertainties: ['Whether the key rotation alone explains the failure pattern'],
    });

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n╔══════════════════════════════════════╗`);
    console.log(`║  SYNTHESIS v${syn.version}`);
    console.log(`╚══════════════════════════════════════╝`);
    console.log(syn.primary_reading);

    console.log(`\n--- State persisted to: ${DATA_DIR} ---`);
    console.log(`\nTo resume with new evidence, run:`);
    console.log(`  node examples/llm-incident-resume.js --resume`);

  } else {
    // ═══════════════════════════════════════
    //  RUN 2: Resume with New Evidence
    // ═══════════════════════════════════════

    console.log('═══════════════════════════════════════');
    console.log('  RUN 2: Resuming with New Evidence');
    console.log('═══════════════════════════════════════');
    console.log(`LLM: ${BASE_URL} / ${MODEL}`);
    console.log(`Data dir: ${DATA_DIR}`);
    console.log('');

    // Find existing proceeding
    const proceedings = institution.listProceedings();
    if (proceedings.length === 0) {
      console.error('No existing proceedings found. Run without --resume first.');
      process.exit(1);
    }

    const proc = proceedings[0];
    console.log(`Resuming proceeding: ${proc.id}`);
    console.log(`  Title: ${proc.title}`);
    console.log(`  Status: ${proc.status}`);
    console.log('');

    // Show previous synthesis
    const prevSyn = institution.getSynthesis(proc.id);
    if (prevSyn) {
      console.log(`--- Previous Synthesis (v${prevSyn.version}) ---`);
      console.log(`  ${prevSyn.primary_reading}`);
      console.log('');
    }

    // Show previous interventions
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

    institution.ingestSignal({
      type: 'investigation_update',
      source: 'manual',
      timestamp: new Date().toISOString(),
      title: NEW_EVIDENCE.title,
      summary: NEW_EVIDENCE.details.join('. '),
      tags: ['incident', 'new_evidence', 'kms'],
    });

    // Also submit the new evidence as an intervention so agents see it
    institution.submitIntervention({
      proceeding_id: proc.id,
      type: 'introduce_evidence',
      agent_id: 'incident-commander',
      summary: NEW_EVIDENCE.title,
      content: NEW_EVIDENCE.details.join('\n'),
      grounds: { evidence_refs: ['kms_registry_dump_0915', 'sync_script_audit_log'] },
    });

    // Run 2 more cycles — agents respond to new evidence
    for (let i = 1; i <= 2; i++) {
      console.log(`--- Cycle ${i} (resumed) ---`);
      const result = await institution.runCycle();
      console.log(`  Interventions: ${result.interventions_submitted}`);
    }

    // Show all interventions (old + new)
    const allInts = institution.listInterventions(proc.id);
    const newInts = allInts.slice(prevInts.length);
    console.log(`\n--- New Interventions (${newInts.length}) ---`);
    for (const int of newInts) {
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}`);
    }

    // Update synthesis
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

    console.log(`\nTotal interventions: ${allInts.length} (${prevInts.length} from run 1 + ${newInts.length + 1} from run 2)`);
    console.log(`Synthesis versions: ${newSyn.version}`);
    console.log(`\nThis proceeding was NOT restarted. Prior state was loaded from: ${DATA_DIR}`);
  }
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  process.exit(1);
});
