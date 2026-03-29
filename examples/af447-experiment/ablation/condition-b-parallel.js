#!/usr/bin/env node
'use strict';

/**
 * Ablation Condition B: Three Independent Agents (Parallel)
 *
 * Three agents with the SAME role prompts as Condition C, but each runs
 * in its own isolated institution. They cannot see each other's work.
 * No typed interventions, no challenge mechanism, no synthesis.
 *
 * This isolates the "more LLM calls = more coverage" effect from the
 * framework's institutional structure.
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
const OUTPUT_FILE = path.join(__dirname, 'condition-b-output.json');

// Each agent gets its own isolated institution — they cannot interact
const AGENT_CONFIGS = [
  {
    id: 'analyst',
    temperature: 0.3,
    prompt: `You are a senior accident investigator with expertise in aviation systems, flight data analysis, and crew resource management.

Trace the technical and human causal chain from the autopilot disconnect to impact. Identify contributing factors with specific mechanisms — not categories.

Name mechanisms precisely. "Crew error" is not acceptable. "Pilot flying maintained sustained nose-up input for 3m30s while stall warning was active" is acceptable.`,
  },
  {
    id: 'challenger',
    temperature: 0.5,
    prompt: `You are a principal investigator specialising in automation surprise, human-machine interaction, and accident causation.

Find what is missing, assumed without evidence, or framed too narrowly in the standard narrative. Do not accept "crew error" as a complete explanation. Push for the conditions that made the crew's actions understandable given what they could see and hear.

Key questions:
- What information did the crew actually have vs what investigators know in hindsight?
- What was the flight director showing during the event?
- What does it mean that the stall warning STOPPED at the highest AoA?
- Was there anything about the A330's design that contributed?
- What did the crew's training prepare them for?`,
  },
  {
    id: 'systems-thinker',
    temperature: 0.4,
    prompt: `You are an aviation human factors researcher with expertise in automation design, crew training philosophy, and systems safety (Dekker, Hollnagel, Reason).

Surface the organisational, design, and training conditions that made this outcome possible. Challenge purely technical or purely human explanations as incomplete.

Areas of particular interest:
- The relationship between automation design and manual flying skills
- How the aircraft's systems presented information to the crew
- What the crew's training prepared and did not prepare them for
- Organisational decisions that preceded the accident
- Whether the crew's actions were "local rationality" given what they could perceive`,
  },
];

async function main() {
  console.log('\n=== Ablation Condition B: Three Independent Agents ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log('Mode: 3 agents, each isolated, no interaction\n');

  const allInterventions = [];

  for (const config of AGENT_CONFIGS) {
    console.log(`--- Running ${config.id} (isolated) ---`);

    // Each agent gets its own store/institution/proceeding
    const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), `af447-abl-b-${config.id}-`)));
    const inst = createInstitution({ store });

    inst.ingestSignal({
      type: 'accident', source: 'bea-final-report', timestamp: '2009-06-01T02:14:28Z',
      title: INCIDENT.title, summary: INCIDENT.proximate_cause_official,
      tags: ['accident', 'aviation', 'AF447'],
    });

    const proc = inst.openProceeding({
      title: `${INCIDENT.id}: ${INCIDENT.title}`,
      framing: {
        primary_question: 'What are ALL the contributing factors — technical, human, procedural, design, and organisational — that caused this accident and prevented recovery?',
        posture: 'accident_investigation',
        in_scope: ['immediate technical failure chain', 'crew response', 'aircraft design', 'training adequacy', 'organisational factors'],
        out_of_scope: ['criminal liability', 'compensation'],
      },
    });

    const agent = createLLMAgent({
      id: config.id,
      baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY,
      temperature: config.temperature,
      systemPrompt: `${config.prompt}

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

Submit a SINGLE "interpret" intervention with your complete analysis.

Output ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "interpret", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["bea_report", "cvr", "fdr"] }, "confidence": 0.0-1.0 }], "obligations": [] }`,
    });

    inst.registerAgent(agent);

    try {
      await inst.runCycle();
      const ints = inst.listInterventions(proc.id);
      for (const int of ints) {
        // Normalize agent_id to track origin
        allInterventions.push({ ...int, condition_agent: config.id });
        console.log(`  [${config.id}] ${int.type}: ${int.summary.slice(0, 100)}`);
      }
      if (ints.length === 0) {
        console.log(`  [${config.id}] No interventions produced`);
      }
    } catch (e) {
      console.log(`  [${config.id}] Error: ${e.message}`);
    }
    console.log('');
  }

  const charCount = allInterventions.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);

  console.log(`Total interventions: ${allInterventions.length}`);
  console.log(`Total characters: ${charCount}`);

  // Print all analyses
  for (const int of allInterventions) {
    console.log(`\n[${int.condition_agent}] ${int.type}: ${int.summary}`);
    console.log(int.content);
  }

  const output = {
    condition: 'B', mode: 'parallel-independent', model: MODEL,
    agents: 3, cycles: 1,
    timestamp: new Date().toISOString(),
    interventions: allInterventions,
    metrics: { intervention_count: allInterventions.length, total_chars: charCount },
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
