#!/usr/bin/env node
'use strict';

/**
 * Ablation Condition C: Full Deliberation
 * 4 agents (analyst, challenger, systems-thinker, synthesizer), 4 cycles.
 * Full ai-discourse institutional chain with typed interventions.
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
const CYCLES      = 4;
const OUTPUT_FILE = path.join(__dirname, 'condition-c-output.json');

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'af447-abl-c-')));
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

// ─── Agents (same role prompts as Condition B, but with full interaction rules) ───

const analyst = createLLMAgent({
  id: 'analyst', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.3,
  systemPrompt: `You are a senior accident investigator with expertise in aviation systems, flight data analysis, and crew resource management.

Your role: PRIMARY ANALYST. Trace the technical and human causal chain from the autopilot disconnect to impact. Identify contributing factors with specific mechanisms — not categories. Be prepared to revise your analysis when challenged.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "interpret" for your technical analysis (requires "grounds")
- Use "revision" to update a prior position (requires "targets" and "grounds")
- Use "introduce_evidence" for new findings (requires "grounds")
- Name mechanisms precisely. "Crew error" is not acceptable.

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const challenger = createLLMAgent({
  id: 'challenger', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.5,
  systemPrompt: `You are a principal investigator and Devil's Advocate specialising in automation surprise, human-machine interaction, and accident causation.

Your role: CHALLENGER. Find what is missing, assumed without evidence, or framed too narrowly. Do not accept "crew error" as complete. Push for conditions that made the crew's actions understandable given what they could see and hear.

Key questions to press on:
- What information did the crew actually have vs hindsight?
- What was the flight director showing?
- What does it mean that the stall warning STOPPED at the highest AoA?
- Was there anything about the A330's design that contributed?
- What did training prepare them for?

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "challenge" to attack assumptions (ALWAYS include "targets" and "grounds")
- Use "introduce_evidence" for alternative explanations (requires "grounds")
- You MUST challenge at least one claim per cycle

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const systemsThinker = createLLMAgent({
  id: 'systems-thinker', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.4,
  systemPrompt: `You are an aviation human factors researcher with expertise in automation design, crew training philosophy, and systems safety (Dekker, Hollnagel, Reason).

Your role: SYSTEMS THINKER. Surface the organisational, design, and training conditions that made this outcome possible. Challenge purely technical or purely human explanations as incomplete.

Areas of interest:
- Automation design vs manual flying skills
- How systems presented information to the crew
- What training prepared and did not prepare them for
- Organisational decisions preceding the accident
- Whether crew's actions were "local rationality" given what they could perceive

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

RULES:
- Use "introduce_evidence" for systemic factors (requires "grounds")
- Use "challenge" to push back on narrow explanations (requires "targets" and "grounds")
- Use "interpret" for your systemic reading (requires "grounds")
- Name the mechanism, not the category

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const synthesizer = createLLMAgent({
  id: 'synthesizer', baseUrl: BASE_URL, model: MODEL, apiKey: API_KEY, temperature: 0.2,
  systemPrompt: `You are the institutional recorder for this accident investigation.

Produce a structured synthesis after each cycle: what has been established, contested, and left open. You do NOT argue. You record with fidelity. Your synthesis must evolve each cycle.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id: "${proc.id}"

Produce ONE "synthesize" intervention covering:
1. CURRENT BEST UNDERSTANDING
2. ESTABLISHED claims
3. CONTESTED claims
4. OPEN QUESTIONS
5. FACTORS NEWLY SURFACED THIS CYCLE

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "synthesize", "summary": "...", "content": "...", "confidence": 0.0-1.0 }], "obligations": [] }`,
});

institution.registerAgent(analyst);
institution.registerAgent(challenger);
institution.registerAgent(systemsThinker);
institution.registerAgent(synthesizer);

async function main() {
  console.log('\n=== Ablation Condition C: Full Deliberation ===');
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}\n`);

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  Agents: ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
      continue;
    }

    const allInts = institution.listInterventions(proc.id);
    const recent = allInts.slice(-10);
    for (const int of recent) {
      const t = int.targets?.length > 0 ? ` → targets: ${int.targets.length}` : '';
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}${t}`);
    }

    // Synthesizer-driven synthesis
    const synthInts = allInts.filter(i => i.type === 'synthesize');
    const latestSynth = synthInts[synthInts.length - 1];
    const challenges = allInts.filter(i => i.type === 'challenge');

    if (latestSynth) {
      institution.updateSynthesis({
        proceeding_id: proc.id, updated_by: 'synthesizer',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: latestSynth.summary,
        supporting_points: latestSynth.content.split('\n').filter(l => l.trim()).slice(0, 8),
        uncertainties: challenges.slice(-3).map(c => c.summary),
        preserved_dissent: challenges.slice(-2).map(c => ({ label: c.summary.slice(0, 80), summary: c.content.slice(0, 250) })),
      });
    } else {
      institution.updateSynthesis({
        proceeding_id: proc.id, updated_by: 'fallback',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: `Cycle ${cycle}: synthesizer produced no reading.`,
        supporting_points: [], uncertainties: [], preserved_dissent: [],
      });
    }

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n  Synthesis v${syn.version}: ${syn.primary_reading.slice(0, 150)}`);
  }

  // ─── Final output ───

  const allInts = institution.listInterventions(proc.id);
  const charCount = allInts.reduce((sum, i) => sum + (i.summary || '').length + (i.content || '').length, 0);
  const challenges = allInts.filter(i => i.type === 'challenge');
  const revisions = allInts.filter(i => i.type === 'revision');
  const finalSyn = institution.getSynthesis(proc.id);
  const health = institution.getHealth();

  console.log(`\n${'═'.repeat(50)}`);
  console.log('  FINAL STATE');
  console.log(`${'═'.repeat(50)}`);
  console.log(`\nInterventions: ${allInts.length}`);
  console.log(`Total characters: ${charCount}`);
  console.log(`Challenges: ${challenges.length}`);
  console.log(`Revisions: ${revisions.length}`);
  console.log(`Discourse health: ${health.discourse_health} (${health.discourse_ratio})`);
  console.log(`Synthesis versions: ${finalSyn.version}`);

  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);

  console.log(`\n--- All Interventions ---`);
  for (const int of allInts) {
    const t = int.targets?.length > 0 ? ` [responds to ${int.targets.length}]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${t}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  const output = {
    condition: 'C', mode: 'deliberation', model: MODEL,
    agents: 4, cycles: CYCLES,
    timestamp: new Date().toISOString(),
    interventions: allInts,
    final_synthesis: finalSyn,
    metrics: {
      intervention_count: allInts.length, total_chars: charCount,
      challenges: challenges.length, revisions: revisions.length,
      discourse_health: health.discourse_ratio,
    },
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved: ${OUTPUT_FILE}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) console.error('Start ericaiproxy.');
  process.exit(1);
});
