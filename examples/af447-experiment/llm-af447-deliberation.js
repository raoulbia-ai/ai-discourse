#!/usr/bin/env node
'use strict';

/**
 * Experiment Run B: Multi-Agent Deliberation
 * Air France 447 — Controlled Reasoning Experiment v2
 *
 * Same incident facts as Run A. Four agents, 4 cycles.
 * Output saved to run-b-output.json for manual scoring.
 *
 * Run this AFTER scoring Run A. See scoring-guide.md.
 *
 * Agents:
 *   analyst         — accident investigator; traces technical causal chain
 *   challenger      — Devil's Advocate; attacks assumptions, surfaces gaps
 *   systems-thinker — human factors & design researcher; surfaces systemic conditions
 *   synthesizer     — institutional recorder; versioned synthesis each cycle
 *
 * Usage:
 *   node examples/af447-experiment/llm-af447-deliberation.js
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../../index');
const { createLLMAgent } = require('../../adapters');

// ─── Config ───

const BASE_URL    = process.env.BASE_URL  || 'http://127.0.0.1:7999';
const MODEL       = process.env.MODEL     || 'MiniMaxAI/MiniMax-M2.5';
const API_KEY     = process.env.API_KEY   || undefined;
const CYCLES      = 4;
const OUTPUT_FILE = path.join(__dirname, 'run-b-output.json');

// ─── Incident ───

const INCIDENT = {
  id: 'AF447-2009-0601',
  title: 'Air France Flight 447 — Loss of Control and Impact with Atlantic Ocean, June 1, 2009',
  aircraft: 'Airbus A330-203',
  route: 'Rio de Janeiro (GIG) to Paris (CDG)',
  outcome: '228 fatalities. Aircraft entered Atlantic Ocean at approximately 02:14 UTC.',

  crew: {
    captain: 'Marc Dubois, 58 years old, 11,000 total hours, 1,700 on A330. Not present in cockpit at time of initial event — resting in crew bunk.',
    pilot_flying: 'Pierre-Cédric Bonin, 32 years old, 2,936 total hours, 807 on A330. Occupying right seat.',
    pilot_monitoring: 'David Robert, 37 years old, 6,547 total hours, 4,479 on A330. Occupying left seat (acting captain).',
    captain_return: 'Captain Dubois returned to cockpit at 02:11:43 UTC — approximately 1m40s before impact.',
  },

  proximate_cause_official: 'Temporary obstruction of pitot probes by ice crystals caused autopilot and autothrust to disconnect. The crew did not apply correct procedure for an unreliable airspeed situation. The aircraft entered and sustained an aerodynamic stall from which it did not recover.',

  timeline: [
    '01:51 — Captain leaves cockpit for rest period. Bonin (PF) and Robert (PM) remain.',
    '02:06 — Aircraft enters area of convective activity. Autopilot and autothrust engaged normally.',
    '02:10:05 — Autopilot disconnects. Autothrust disconnects. Unreliable airspeed indications on all three ADIRUs.',
    '02:10:06 — Bonin makes nose-up input on side-stick. Aircraft begins to climb.',
    '02:10:07 — Stall warning activates for the first time (CRICKET sound + "STALL STALL" synthetic voice).',
    '02:10:16 — Aircraft reaches maximum altitude of approximately 38,000 ft. Vertical speed begins to decrease.',
    '02:10:50 — Stall warning stops. (Angle of attack has exceeded the sensor measurement range — warning inhibited at extreme AoA)',
    '02:11:00 — Robert calls for captain. Bonin continues nose-up inputs.',
    '02:11:30 — Robert takes over controls briefly, pushes nose down. Stall warning reactivates.',
    '02:11:37 — Bonin takes controls back, immediately pulls nose up again.',
    '02:11:43 — Captain Dubois enters cockpit.',
    '02:12:00 — Aircraft at approximately 35,000 ft descending. Crew attempts to understand situation.',
    '02:13:32 — Robert says "climb climb climb climb". Captain says "no no no do not climb".',
    '02:13:40 — Bonin says "I\'ve been at maxi nose-up for a while".',
    '02:14:28 — Impact with ocean. Aircraft in near-wings-level attitude, nose pitched 16.2 degrees up.',
  ],

  technical_readings: [
    'At autopilot disconnect: indicated airspeed dropped from 275 kt to near-zero on two ADIRUs (pitot probe icing)',
    'Aircraft was at FL350 (35,000 ft), weight approximately 205 tonnes, outside air temperature -56°C',
    'Angle of attack at time of initial stall warning: approximately 6 degrees',
    'Angle of attack at impact: approximately 16.2 degrees (well above critical AoA of ~8-9 degrees)',
    'Bonin maintained nose-up input for approximately 3 minutes and 30 seconds continuously',
    'Vertical speed at impact: approximately -10,916 ft/min',
    'Aircraft descended approximately 38,000 ft in approximately 3 minutes 30 seconds',
    'Pitot probes: Thales AA type. Known icing issues documented. Airbus had recommended replacement with Thales BA probes.',
    'Stall warning activated and deactivated multiple times. Notably STOPPED when angle of attack was highest.',
    'At 02:10:50 stall warning stopped because AoA exceeded sensor measurement range — this is by design.',
  ],

  crew_statements_cvr: [
    '02:10:06 Bonin: "I have the controls" (takes over from autopilot)',
    '02:10:16 Robert: "What\'s happening?"',
    '02:11:00 Robert: "I don\'t understand at all what\'s happening"',
    '02:11:10 Robert: "Altimeter? [altitude indications vary]"',
    '02:11:43 Captain: "What are you doing?" (on entering cockpit)',
    '02:12:14 Captain: "What speed are you indicating?"',
    '02:13:32 Robert: "Climb, climb, climb, climb"',
    '02:13:40 Bonin: "I\'ve been at maxi nose-up for a while"',
    '02:13:42 Captain: "No no no do not climb... no no"',
    '02:14:23 Robert: "Damn it, we\'re going to crash... this can\'t be happening"',
    '02:14:25 Bonin: "But what\'s happening?"',
  ],

  known_context: [
    'The Thales AA pitot probes had a documented history of icing issues at altitude in convective conditions.',
    'Airbus had recommended replacement of Thales AA probes with Thales BA probes in 2007. Air France had scheduled but not yet completed replacement on this aircraft.',
    'The A330 autopilot disconnects when both pitot probes give unreliable readings.',
    'When the A330 autopilot disconnects in cruise, the aircraft transitions to "alternate law" — stall protection is reduced.',
    'In alternate law, the flight director (instrument guidance) remains active and continued to display guidance throughout the event.',
    'BEA Phase 1 report (July 2009) identified pitot probe icing as the initiating event.',
    'Wreckage and flight recorders were recovered from ocean floor in May 2011 — final BEA report issued July 2012.',
    'Criminal proceedings: Air France and Airbus were acquitted in 2021; appeals court ordered new trial in 2022; retrial ongoing as of 2023.',
  ],
};

// ─── Setup (store, signal, proceeding created before agents so proc.id is available) ───

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'af447-delib-')));
const institution = createInstitution({ store });

institution.ingestSignal({
  type: 'accident',
  source: 'bea-final-report',
  timestamp: '2009-06-01T02:14:28Z',
  title: INCIDENT.title,
  summary: INCIDENT.proximate_cause_official,
  tags: ['accident', 'aviation', 'AF447', 'loss-of-control'],
});

const proc = institution.openProceeding({
  title: `${INCIDENT.id}: ${INCIDENT.title}`,
  framing: {
    primary_question: 'What are ALL the contributing factors — technical, human, procedural, design, and organisational — that caused this accident and prevented recovery?',
    posture: 'accident_investigation',
    in_scope: [
      'immediate technical failure chain',
      'crew response and decision-making',
      'aircraft design and flight law characteristics',
      'training and procedure adequacy',
      'organisational and regulatory factors',
    ],
    out_of_scope: ['criminal liability', 'compensation'],
    time_horizon: 'flight and accident sequence only',
  },
});

// ─── Agents (created after proceeding so proc.id can be embedded in prompts) ───

const analyst = createLLMAgent({
  id: 'analyst',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are a senior accident investigator with expertise in aviation systems, flight data analysis, and crew resource management.

Your role: PRIMARY ANALYST. Trace the technical and human causal chain from the autopilot disconnect to impact. Identify contributing factors with specific mechanisms — not categories. Be prepared to revise your analysis when challenged.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "interpret" for your technical analysis (requires "grounds")
- Use "revision" to update a prior position (requires "targets" and "grounds")
- Use "introduce_evidence" for new technical findings (requires "grounds")
- Name mechanisms precisely. "Crew error" is not acceptable. "Pilot flying maintained sustained nose-up input for 3m30s while stall warning was active, possibly because the stall warning stopped at extreme AoA, creating ambiguity about aircraft state" is acceptable.

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const challenger = createLLMAgent({
  id: 'challenger',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.5,
  systemPrompt: `You are a principal investigator and Devil's Advocate specialising in automation surprise, human-machine interaction, and accident causation.

Your role: CHALLENGER. You read every intervention and find what is missing, assumed without evidence, or framed too narrowly. You do not accept "crew error" or "pilot error" as complete explanations. You push for the conditions that made the crew's actions understandable given what they could see and hear.

Key questions to press on:
- What information did the crew actually have vs what investigators know in hindsight?
- What was the flight director showing during the event?
- What does it mean that the stall warning STOPPED at the highest AoA?
- Was there anything about the A330's design that contributed?
- What did the crew's training prepare them for?

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "challenge" to attack assumptions (ALWAYS include "targets" and "grounds")
- Use "introduce_evidence" to present alternative explanations (requires "grounds")
- Name the specific claim you are challenging before presenting your counter
- You MUST challenge at least one claim per cycle

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const systemsThinker = createLLMAgent({
  id: 'systems-thinker',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.4,
  systemPrompt: `You are an aviation human factors researcher with expertise in automation design, crew training philosophy, and systems safety (Dekker, Hollnagel, Reason).

Your role: SYSTEMS THINKER. You surface the organisational, design, and training conditions that made this outcome possible. You challenge purely technical or purely human explanations as incomplete.

Areas of particular interest:
- The relationship between automation design and manual flying skills
- How the aircraft's systems presented information to the crew
- What the crew's training prepared and did not prepare them for
- Organisational decisions that preceded the accident
- Whether the crew's actions were "local rationality" given what they could perceive

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "introduce_evidence" for systemic factors (requires "grounds")
- Use "challenge" to push back on narrow technical explanations (requires "targets" and "grounds")
- Use "interpret" for your systemic reading (requires "grounds")
- Be specific: name the mechanism, not the category

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const synthesizer = createLLMAgent({
  id: 'synthesizer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.2,
  systemPrompt: `You are the institutional recorder for this accident investigation.

Your role: after each deliberation cycle, produce a structured synthesis that captures what has been established, what remains contested, and what the institution does not yet understand.

You do NOT argue. You record what the investigation has produced with fidelity. Your synthesis must evolve meaningfully each cycle.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

YOUR TASK each cycle — produce ONE "synthesize" intervention covering:
1. CURRENT BEST UNDERSTANDING: The causal chain as currently established
2. ESTABLISHED: Claims corroborated by multiple agents or unchallenged
3. CONTESTED: Specific disagreements still unresolved
4. OPEN QUESTIONS: What the investigation still cannot explain
5. FACTORS NEWLY SURFACED THIS CYCLE: What was added since last synthesis

RULES:
- Submit exactly ONE intervention of type "synthesize"
- "synthesize" does NOT require targets or grounds
- Your content must be substantively different each cycle
- If a prior synthesis was wrong, say so explicitly

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "synthesize", "summary": "one-line current institutional reading", "content": "full structured synthesis", "confidence": 0.0-1.0 }], "obligations": [] }`,
});

// ─── Register Agents ───

institution.registerAgent(analyst);
institution.registerAgent(challenger);
institution.registerAgent(systemsThinker);
institution.registerAgent(synthesizer);

// ─── Run ───

async function main() {
  console.log(`\n=== Run B: Multi-Agent Deliberation — AF447 ===`);
  console.log(`LLM:    ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('');
  console.log('--- Agents ---');
  console.log('  analyst         : Accident investigator — traces technical causal chain');
  console.log('  challenger      : Devil\'s Advocate — attacks assumptions, surfaces gaps');
  console.log('  systems-thinker : Human factors researcher — surfaces systemic conditions');
  console.log('  synthesizer     : Institutional recorder — versioned synthesis each cycle');
  console.log('');
  console.log('--- Observation Dimensions ---');
  console.log('  1. Does the Challenger surface gaps the Analyst missed?');
  console.log('  2. Does synthesis change meaningfully across cycles?');
  console.log('  3. Do agents converge or stay in genuine disagreement?');
  console.log('  4. What survives scrutiny vs. what gets dropped?');
  console.log('');

  // ─── Cycle Loop ───

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(60)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  Agents: ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}, Obligations: ${result.obligations_created}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
      continue;
    }

    // Show interventions from this cycle
    const allInts    = institution.listInterventions(proc.id);
    const cycleInts  = allInts.slice(-12);
    for (const int of cycleInts) {
      const targetInfo = int.targets?.length > 0 ? ` → targets: ${int.targets.length}` : '';
      console.log(`  [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 80)}${targetInfo}`);
    }

    // Synthesis after every cycle — driven by synthesizer agent output
    const allIntsNow      = institution.listInterventions(proc.id);
    const synthInts       = allIntsNow.filter(i => i.type === 'synthesize');
    const latestSynthInt  = synthInts[synthInts.length - 1];
    const challengesNow   = allIntsNow.filter(i => i.type === 'challenge');

    if (latestSynthInt) {
      institution.updateSynthesis({
        proceeding_id: proc.id,
        updated_by: 'synthesizer',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: latestSynthInt.summary,
        supporting_points: latestSynthInt.content
          .split('\n')
          .filter(line => line.trim().length > 0)
          .slice(0, 8),
        uncertainties: challengesNow.slice(-3).map(c => c.summary),
        preserved_dissent: challengesNow.slice(-2).map(c => ({
          label: c.summary.slice(0, 80),
          summary: c.content.slice(0, 250),
        })),
      });
    } else {
      institution.updateSynthesis({
        proceeding_id: proc.id,
        updated_by: 'incident-commander',
        state_basis: cycle < CYCLES ? 'provisional' : 'stable',
        primary_reading: `Cycle ${cycle}: synthesizer produced no reading. ${allIntsNow.length} total interventions filed.`,
        supporting_points: [],
        uncertainties: challengesNow.slice(-3).map(c => c.summary),
        preserved_dissent: [],
      });
    }

    const syn = institution.getSynthesis(proc.id);
    console.log(`\n  Synthesis v${syn.version}: ${syn.primary_reading.slice(0, 200)}`);
  }

  // Save full output for scoring
  const allIntsForOutput = institution.listInterventions(proc.id);
  const finalSynForOutput = institution.getSynthesis(proc.id);
  const output = {
    run: 'B',
    mode: 'deliberation',
    model: MODEL,
    cycles: CYCLES,
    timestamp: new Date().toISOString(),
    interventions: allIntsForOutput,
    final_synthesis: finalSynForOutput,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
  console.log('Now score Run B using scoring-guide.md and compare with Run A scores.');

  // ─── FINAL STATE ───

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  FINAL STATE');
  console.log(`${'═'.repeat(60)}`);

  const allInts = institution.listInterventions(proc.id);
  console.log(`\n--- All Interventions (${allInts.length}) ---`);
  for (const int of allInts) {
    const targetInfo = int.targets?.length > 0 ? ` [responds to ${int.targets.length} prior]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${targetInfo}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  const finalSyn = institution.getSynthesis(proc.id);
  console.log(`\n--- Final Synthesis (v${finalSyn.version}) ---`);
  console.log(`Reading:       ${finalSyn.primary_reading}`);
  console.log(`Supporting:    ${finalSyn.supporting_points.length} points`);
  console.log(`Uncertainties: ${finalSyn.uncertainties.length}`);
  console.log(`Dissent:       ${finalSyn.preserved_dissent.length}`);

  const health = institution.getHealth();
  console.log(`\n--- Discourse Health: ${health.discourse_health} (ratio: ${health.discourse_ratio}) ---`);

  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Intervention types: ${JSON.stringify(types)}`);
  console.log(`Synthesis versions: ${finalSyn.version}`);

  // ─── FINAL OBSERVATIONS ───

  const challenges = allInts.filter(i => i.type === 'challenge');
  const revisions  = allInts.filter(i => i.type === 'revision');

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  FINAL OBSERVATIONS');
  console.log(`${'═'.repeat(60)}`);

  // OBS 1
  console.log('\n  [OBS 1] Did the Challenger surface gaps the Analyst missed?');
  const analystIds          = allInts.filter(i => i.agent_id === 'analyst').map(i => i.id);
  const challengesAtAnalyst = challenges.filter(c =>
    c.agent_id === 'challenger' && c.targets?.some(t => analystIds.includes(t))
  );
  if (challengesAtAnalyst.length === 0) {
    console.log('  → Challenger filed no direct challenges at Analyst interventions.');
  } else {
    for (const c of challengesAtAnalyst) {
      console.log(`  → Challenger challenged: "${c.summary.slice(0, 100)}"`);
    }
  }

  // OBS 2
  console.log('\n  [OBS 2] Synthesis drift across cycles?');
  console.log(`  → Final synthesis version: v${finalSyn.version}`);
  console.log(`  → Agent revisions filed:   ${revisions.length}`);

  // OBS 3
  console.log('\n  [OBS 3] Convergence vs. genuine disagreement?');
  console.log(`  → Total challenges:   ${challenges.length}`);
  console.log(`  → Total revisions:    ${revisions.length}`);
  console.log(`  → Preserved dissent:  ${finalSyn.preserved_dissent?.length || 0} item(s)`);
  console.log(`  → Discourse health:   ${health.discourse_health} (ratio: ${health.discourse_ratio})`);
  if (finalSyn.preserved_dissent?.length > 0) {
    for (const d of finalSyn.preserved_dissent) {
      console.log(`     Dissent: ${d.label}`);
    }
  }

  // Synthesis evolution
  const allSynthInts = allInts.filter(i => i.type === 'synthesize');
  console.log(`\n  [SYNTHESIS EVOLUTION] ${allSynthInts.length} readings across ${CYCLES} cycles:`);
  for (let i = 0; i < allSynthInts.length; i++) {
    const s = allSynthInts[i];
    console.log(`\n  --- Cycle ${i + 1} reading ---`);
    console.log(`  Summary: ${s.summary}`);
    console.log(`  ${s.content.slice(0, 600)}${s.content.length > 600 ? '...' : ''}`);
  }

  // OBS 4
  console.log('\n  [OBS 4] What survived scrutiny vs. what was challenged or revised?');
  console.log('  (synthesizer interventions excluded — institutional records, not claims)');
  const deliberativeInts = allInts.filter(i => i.agent_id !== 'synthesizer');
  for (const int of deliberativeInts) {
    const challenged = challenges.some(c => c.targets?.includes(int.id));
    const revised    = revisions.some(r => r.targets?.includes(int.id));
    const status     = revised    ? '[REVISED]'
                     : challenged ? '[CHALLENGED]'
                     :              '[UNCHALLENGED]';
    console.log(`  ${status.padEnd(14)} [${int.agent_id}] ${int.type}: ${int.summary.slice(0, 70)}`);
  }
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start ericaiproxy or set BASE_URL.`);
  }
  process.exit(1);
});
