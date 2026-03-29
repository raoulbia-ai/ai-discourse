#!/usr/bin/env node
'use strict';

/**
 * Experiment: Incident Investigator — CrowdStrike Global Outage (July 19, 2024)
 *
 * Three agents with distinct epistemic lenses deliberate on the true
 * contributing factors of the CrowdStrike outage, beyond the official RCA.
 *
 * Agents:
 *   analyst         — SRE; traces technical root cause and causal chain
 *   challenger      — Devil's Advocate; attacks assumptions, surfaces gaps
 *   systems-thinker — Resilience researcher; surfaces organizational/systemic factors
 *
 * Observation dimensions:
 *   1. Does the Challenger surface gaps/errors the Analyst missed?
 *   2. Does synthesis change meaningfully across cycles?
 *   3. Do agents converge or stay in genuine disagreement?
 *   4. What survives scrutiny vs. what gets dropped?
 *
 * Usage:
 *   node examples/crowdstrike-experiment/llm-incident-crowdstrike.js
 *   BASE_URL=http://127.0.0.1:7999 MODEL=Qwen/Qwen3-235B-A22B \
 *     node examples/crowdstrike-experiment/llm-incident-crowdstrike.js
 *
 * Defaults match .env in repo root (ericaiproxy on port 7999).
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../../index');
const { createLLMAgent } = require('../../adapters');

// ─── Config ───

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:7999';
const MODEL    = process.env.MODEL    || 'MiniMaxAI/MiniMax-M2.5';
const API_KEY  = process.env.API_KEY  || undefined;
const CYCLES   = 4;

// ─── Static Incident ───

const INCIDENT = {
  id: 'CS-2024-0719',
  severity: 'P0-GLOBAL',
  title: 'CrowdStrike Falcon Sensor update causes 8.5M Windows systems to BSOD',
  reported_at: '2024-07-19T04:09:00Z',
  symptoms: [
    '8.5 million Windows hosts enter boot loop displaying BSOD simultaneously',
    'Affected systems span airlines, hospitals, banks, broadcasters globally',
    'Root trigger: Channel File 291 — a content configuration update, not a code release',
    'CrowdStrike Falcon sensor reads a null pointer from misconfigured file, crashes kernel',
    'No remote remediation possible — each machine requires manual Safe Mode intervention',
    'Delta Airlines alone reports over $500M in losses',
  ],
  timeline: [
    '04:09 UTC — Channel File 291 pushed to all Falcon sensors globally, simultaneously',
    '04:09 UTC — BSOD reports begin immediately across all regions',
    '05:00 UTC — CrowdStrike identifies the faulty file and reverts it',
    '05:27 UTC — CrowdStrike posts public advisory',
    'Days later — Recovery requires IT teams to manually boot each affected machine into Safe Mode',
  ],
  key_facts: [
    'Channel File 291 is a content configuration file, not compiled sensor code',
    'Content updates were NOT subject to the staged rollout process applied to sensor code releases',
    'The content validator had a bug: it did not verify the number of input fields matched the expected count',
    'The misconfigured file passed validation and was deployed globally in a single push',
    'A nearly identical content validator bug had triggered a Linux sensor outage in March 2024',
    'The March 2024 Linux precedent was NOT reviewed or connected during the July Windows release process',
    'CrowdStrike official RCA attributed failure to "a bug in the content configuration validator"',
  ],
  affected_systems: [
    'CrowdStrike Falcon Sensor (Windows)',
    'Windows kernel (Blue Screen of Death on boot)',
    'Any Windows host running the Falcon sensor globally',
  ],
  official_rca: 'Content validator bug allowed a misconfigured Channel File 291 to pass validation and deploy globally, causing kernel-level crash on all affected Windows hosts.',
};

// ─── Agents ───

const analyst = createLLMAgent({
  id: 'analyst',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "analyst", a senior Site Reliability Engineer with 15 years of experience conducting post-incident analyses at hyperscale infrastructure companies.

Your role: PRIMARY ANALYST. You read the incident framing and produce structured hypotheses about root causes, contributing factors, and causal chains. You are thorough but may anchor on the most visible explanation. You revise your position when challenged with valid logic or evidence.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "interpret" for your technical hypothesis (requires "grounds" with evidence_refs)
- Use "introduce_evidence" to present new technical findings (requires "grounds")
- Use "revision" to update an earlier hypothesis (requires "targets" and "grounds")
- Use "agreement" to support another agent with additional evidence (requires "targets")
- Build on what others have said — do not repeat yourself
- If nothing new has emerged since your last intervention, return empty interventions
- Be specific. Name actual failure mechanisms. Avoid vague generalities.
- When you revise a position, explicitly state what you are dropping and why.

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const challenger = createLLMAgent({
  id: 'challenger',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.5,
  systemPrompt: `You are "challenger", a Principal Engineer and designated Devil's Advocate. You have deep expertise in distributed systems, release engineering, and failure mode analysis.

Your role: CHALLENGER. You read every intervention from the other agents and identify gaps, unsupported assumptions, premature conclusions, and missing causal links. You introduce alternative hypotheses they have not considered. You demand evidence for claims asserted without it. You are not hostile — you are rigorous. Your goal is truth, not winning.

You do NOT simply agree. If you agree with a point, you MUST extend it or find the boundary condition where it breaks down.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "challenge" to question another agent's hypothesis — ALWAYS include "targets" (the IDs of interventions you are challenging) and "grounds"
- Use "introduce_evidence" to present an alternative explanation (requires "grounds")
- Use "revision" to update your own earlier position (requires "targets" and "grounds")
- Quote or paraphrase the SPECIFIC claim you are attacking, then present your counter-argument
- You MUST challenge at least one claim per cycle if you see weak evidence or untested assumptions
- Do not repeat points already made — build on the discourse

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const systemsThinker = createLLMAgent({
  id: 'systems-thinker',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.4,
  systemPrompt: `You are "systems-thinker", an organizational resilience researcher with a background in complex systems theory and safety engineering (Hollnagel, Rasmussen, Dekker).

Your role: SYSTEMS THINKER. You look beyond the technical root cause to the systemic conditions that enabled it. You surface organizational factors: incentive structures, process gaps, governance failures, normalization of deviance. You apply frameworks like the Swiss Cheese Model or Normal Accident Theory where they illuminate something the other agents miss. You challenge purely technical explanations as incomplete.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "introduce_evidence" to surface a systemic factor (requires "grounds")
- Use "challenge" to push back on explanations that ignore organizational context (requires "targets" and "grounds")
- Use "interpret" for your own systemic reading of the incident (requires "grounds")
- When you name a systemic factor, be specific: name the MECHANISM not the category. Example: not "poor process" but "content updates were exempt from the staged rollout policy applied to sensor code, creating an unchecked fast path to global deployment"
- Do not repeat points already made — build on the discourse

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const synthesizer = createLLMAgent({
  id: 'synthesizer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.2,
  systemPrompt: `You are "synthesizer", the institutional recorder for this deliberation.

Your role: after each cycle, produce a structured synthesis of what the
deliberating agents have established, contested, and left open.

You do NOT argue. You do NOT take sides. You report what has emerged
from the discourse with fidelity. Your synthesis must evolve each cycle
as new interventions are filed.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

YOUR TASK each cycle:
Read all interventions filed so far and produce ONE synthesis intervention
of type "synthesize" that covers:

1. PRIMARY READING: The current best institutional understanding of the
   true contributing factors. Integrate the strongest points from all
   agents. Be specific — name mechanisms, not categories.

2. ESTABLISHED: Claims that have survived challenge or been corroborated
   by multiple agents.

3. CONTESTED: Claims that have been challenged but not resolved.
   Name the specific disagreement, not just that disagreement exists.

4. OPEN QUESTIONS: What does the institution still not know?
   What evidence would change the reading?

5. DROPPED: Any claims that were revised away or successfully dismantled.
   If none, say so explicitly.

RULES:
- Submit exactly ONE intervention of type "synthesize"
- "synthesize" does NOT require targets or grounds — omit both fields
- Your content must be substantively different each cycle as discourse evolves
- If the discourse has not changed since last cycle, say so explicitly
- Do not editorialize — report what the agents said, not what you think

OUTPUT: Return ONLY valid JSON:
{
  "interventions": [{
    "proceeding_id": "...",
    "type": "synthesize",
    "summary": "one-line current institutional reading",
    "content": "full structured synthesis covering all 5 points above",
    "confidence": 0.85
  }],
  "obligations": []
}`,
});

// ─── Setup ───

const store       = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'cs-experiment-')));
const institution = createInstitution({ store });

institution.registerAgent(analyst);
institution.registerAgent(challenger);
institution.registerAgent(systemsThinker);
institution.registerAgent(synthesizer);

// ─── Signal & Proceeding ───

institution.ingestSignal({
  type: 'incident',
  source: 'crowdstrike-rca',
  timestamp: INCIDENT.reported_at,
  title: INCIDENT.title,
  summary: INCIDENT.symptoms.join('. '),
  tags: ['incident', INCIDENT.severity, 'crowdstrike', 'windows', 'global-outage'],
});

const proc = institution.openProceeding({
  title: `${INCIDENT.id}: ${INCIDENT.title}`,
  framing: {
    primary_question: 'What are the TRUE contributing factors beyond the official RCA, and what would meaningfully prevent recurrence?',
    posture: 'incident_investigation',
    in_scope: [
      'proximate technical root cause',
      'process and governance failures that enabled the incident',
      'organizational conditions that normalized the risk',
      'prior signals that were not acted upon (March 2024 Linux incident)',
      'architectural decisions that allowed a single push to affect 8.5M hosts',
    ],
    out_of_scope: [
      'vendor selection or competitive analysis',
      'legal liability assessment',
      'long-term platform redesign',
    ],
    time_horizon: '72h post-incident',
  },
});

// ─── Run ───

async function main() {
  console.log(`\n=== Experiment: CrowdStrike Incident Investigator ===`);
  console.log(`LLM:    ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log('');
  console.log('--- Incident ---');
  console.log(`  ${INCIDENT.id}: ${INCIDENT.title}`);
  console.log(`  Severity: ${INCIDENT.severity}`);
  console.log('');
  console.log('--- Agents ---');
  console.log('  analyst         : SRE — traces technical root cause and causal chain');
  console.log('  challenger      : Devil\'s Advocate — attacks assumptions, surfaces gaps');
  console.log('  systems-thinker : Resilience researcher — surfaces systemic and organizational factors');
  console.log('  synthesizer     : Institutional recorder — produces versioned synthesis after each cycle');
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
    const revisionsNow    = allIntsNow.filter(i => i.type === 'revision');

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
      // Fallback if synthesizer produced no intervention this cycle
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

  // OBS 1: Did the Challenger surface gaps the Analyst missed?
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

  // OBS 2: Synthesis drift
  console.log('\n  [OBS 2] Synthesis drift across cycles?');
  console.log(`  → Final synthesis version: v${finalSyn.version}`);
  console.log(`  → Agent revisions filed:   ${revisions.length}`);
  console.log('  → (Compare synthesis lines printed per cycle above)');

  // OBS 3: Convergence vs. disagreement
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

  // Synthesis evolution across cycles
  const allSynthInts = allInts.filter(i => i.type === 'synthesize');
  console.log(`\n  [SYNTHESIS EVOLUTION] ${allSynthInts.length} readings across ${CYCLES} cycles:`);
  for (let i = 0; i < allSynthInts.length; i++) {
    const s = allSynthInts[i];
    console.log(`\n  --- Cycle ${i + 1} reading ---`);
    console.log(`  Summary: ${s.summary}`);
    console.log(`  ${s.content.slice(0, 600)}${s.content.length > 600 ? '...' : ''}`);
  }

  // OBS 4: What survived scrutiny?
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
