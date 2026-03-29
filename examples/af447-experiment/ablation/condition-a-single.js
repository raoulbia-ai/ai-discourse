#!/usr/bin/env node
'use strict';

/**
 * Ablation Condition A: Single Agent
 * 1 agent, 1 cycle, no deliberation. Baseline.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../../../index');
const { createLLMAgent } = require('../../../adapters');
const { INCIDENT } = require('./incident');

const BASE_URL    = process.env.BASE_URL || 'http://127.0.0.1:7999';
const MODEL       = process.env.MODEL    || 'MiniMaxAI/MiniMax-M2.5';
const API_KEY     = process.env.API_KEY  || undefined;
const OUTPUT_FILE = path.join(__dirname, 'condition-a-output.json');

const store       = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'af447-abl-a-')));
const institution = createInstitution({ store });

institution.ingestSignal({
  type: 'accident', source: 'bea-final-report', timestamp: '2009-06-01T02:14:28Z',
  title: INCIDENT.title, summary: INCIDENT.proximate_cause_official,
  tags: ['accident', 'aviation', 'AF447'],
});

const proc = institution.openProceeding({
  title: `${INCIDENT.id}: ${INCIDENT.title}`,
  framing: {
    primary_question: 'What are ALL the contributing factors — technical, human, procedural, design, and organisational — that caused this accident and prevented recovery?',
    posture: 'accident_investigation',
    in_scope: ['immediate technical failure chain', 'crew response', 'aircraft design', 'training adequacy', 'organisational factors'],
    out_of_scope: ['criminal liability', 'compensation'],
  },
});

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
  systemPrompt: `You are a senior aviation accident investigator with expertise in human factors, automation systems, and multi-crew operations.

Analyse the Air France 447 accident. Produce the most complete and specific causal analysis you can. Do not stop at the proximate cause. Identify every contributing factor with its specific mechanism.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

Submit a SINGLE "interpret" intervention.

Output ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "interpret", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["bea_report", "cvr", "fdr"] }, "confidence": 0.0-1.0 }], "obligations": [] }`,
});

institution.registerAgent(agent);

async function main() {
  console.log('\n=== Ablation Condition A: Single Agent ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}\n`);

  await institution.runCycle();
  const allInts = institution.listInterventions(proc.id);

  const charCount = allInts.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);

  console.log(`Interventions: ${allInts.length}`);
  console.log(`Total characters: ${charCount}`);
  for (const int of allInts) {
    console.log(`\n[${int.agent_id}] ${int.type}: ${int.summary}`);
    console.log(int.content);
  }

  const output = {
    condition: 'A', mode: 'single-agent', model: MODEL,
    agents: 1, cycles: 1,
    timestamp: new Date().toISOString(),
    interventions: allInts,
    metrics: { intervention_count: allInts.length, total_chars: charCount },
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
