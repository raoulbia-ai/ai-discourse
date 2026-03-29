#!/usr/bin/env node
'use strict';

/**
 * Experiment Run B: Multi-Agent Deliberation
 * GitLab 2017 Database Deletion
 *
 * Three agents with distinct epistemic lenses deliberate over the same
 * incident facts as Run A. Output scored against same 12-factor rubric.
 *
 * This is the EXPERIMENTAL condition. Compare results with Run A (single agent).
 *
 * Agents:
 *   analyst         — SRE; traces technical root cause and causal chain
 *   challenger      — Devil's Advocate; attacks assumptions, surfaces gaps
 *   systems-thinker — Resilience researcher; surfaces systemic and process failures
 *   synthesizer     — Institutional recorder; produces versioned synthesis
 *
 * Usage:
 *   node examples/gitlab-experiment/llm-gitlab-deliberation.js
 *   BASE_URL=http://127.0.0.1:7999 MODEL=MiniMaxAI/MiniMax-M2.5 \
 *     node examples/gitlab-experiment/llm-gitlab-deliberation.js
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
  id: 'GL-2017-0131',
  title: 'GitLab.com database deletion and data loss — January 31, 2017',
  date: '2017-01-31',
  summary: 'A GitLab.com database administrator accidentally deleted 300GB of production PostgreSQL data while attempting to manually fix database replication lag caused by a spam attack. GitLab lost approximately 6 hours of data affecting ~5,000 projects, issues, merge requests, users, comments, and snippets created between 17:20 and 23:25 UTC.',
  timeline: [
    '17:20 UTC — Spam attack begins, causing elevated database load',
    '18:00 UTC — Background worker begins hard-deleting flagged user accounts (false positive from spam filter)',
    '~19:00 UTC — PostgreSQL streaming replication begins to lag; WAL segments accumulate',
    '22:00 UTC — On-call engineer begins investigating replication lag; attempts automated resync which fails',
    '22:30 UTC — Engineer manually stops replication and attempts to resync secondary from primary',
    '23:00 UTC — Replication sync fails again; engineer begins manual investigation',
    '23:20 UTC — Engineer, working on what they believe is the secondary DB server, runs rm -rf to clear data directory',
    '23:25 UTC — Engineer realises the rm -rf was run on the production primary server, not the secondary',
    '23:25 UTC — Engineer immediately kills the rm -rf process; ~300GB of data already deleted',
    '00:00 UTC — Team begins investigating backup options',
    '00:30 UTC — Team discovers pg_dump backups have been silently failing',
    '01:00 UTC — Team discovers Azure disk snapshots were never enabled for this server',
    '01:30 UTC — Team discovers LVM snapshots run every 24h (last snapshot ~24 hours old)',
    '02:00 UTC — Team discovers the staging restore procedure is broken and untested',
    '09:00 UTC — GitLab takes site offline and begins public communication',
    '~17:00 UTC — Database partially restored from a 6-hour-old LVM snapshot; ~6 hours of data lost permanently',
  ],
  raw_facts: [
    'The production database ran PostgreSQL 9.6',
    'The pg_dump backup tool installed was version 9.2 — incompatible with 9.6; backups were silently producing empty files',
    'Backup failure notification emails were being sent but rejected by GitLab\'s own DMARC configuration — nobody received the alerts',
    'Azure disk snapshots had never been enabled for the production database server',
    'LVM snapshots were configured to run every 24 hours, not hourly as the team believed',
    'The staging database restore script had never been tested in a real recovery scenario; it did not work',
    'The two database servers (production and secondary) had near-identical terminal prompts; the engineer was not certain which server they were on',
    'There were no access controls or confirmation steps preventing rm -rf from being run on the production server',
    'GitLab had no tested disaster recovery runbook',
    'The engineer was working alone late at night under significant operational pressure',
    'The replication lag was caused by a combination of the spam attack load AND a background job that was hard-deleting database records (not soft-deleting)',
    'GitLab streamed the recovery attempt live on YouTube — full transparency with ~5,000 concurrent viewers at peak',
    'The data loss was ultimately ~6 hours of production data for approximately 5,000 projects',
  ],
  official_postmortem_url: 'https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/',
  official_findings: 'GitLab\'s post-mortem identified 12 contributing factors spanning the trigger conditions, technical failures, systemic backup failures, process gaps, and human factors. The post-mortem explicitly states: "We had multiple failures of the same class" — meaning the incident was not a single point of failure but a cascade of independent systemic weaknesses.',
};

// ─── Setup (store, signal, proceeding created before agents so proc.id is available) ───

const store       = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'gl-deliberation-')));
const institution = createInstitution({ store });

institution.ingestSignal({
  type: 'incident',
  source: 'gitlab-postmortem',
  timestamp: INCIDENT.date + 'T17:20:00Z',
  title: INCIDENT.title,
  summary: INCIDENT.summary,
  tags: ['incident', 'database', 'data-loss', 'gitlab', 'postgresql'],
});

const proc = institution.openProceeding({
  title: `${INCIDENT.id}: ${INCIDENT.title}`,
  framing: {
    primary_question: 'What are ALL the contributing factors that made this incident possible and made recovery impossible?',
    posture: 'incident_investigation',
    in_scope: [
      'proximate technical cause',
      'systemic backup and monitoring failures',
      'process and procedure gaps',
      'human factors and organisational conditions',
      'factors that prevented recovery',
    ],
    out_of_scope: ['post-incident improvements already implemented', 'vendor blame'],
    time_horizon: 'incident window only',
  },
});

// ─── Agents (created after proceeding so proc.id can be embedded in prompts) ───

const analyst = createLLMAgent({
  id: 'analyst',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are "analyst", a senior Site Reliability Engineer with 15 years of experience conducting post-incident analyses at hyperscale infrastructure companies.

Your role: PRIMARY ANALYST. You read the incident framing and produce structured hypotheses about root causes, contributing factors, and causal chains.

CRITICAL: This incident has TWO parts — (1) why the deletion happened AND (2) why recovery was impossible. You must investigate BOTH. The recovery failure is as important as the deletion itself — multiple independent backup systems all failed simultaneously.

You are thorough but may anchor on the most visible explanation. You revise your position when challenged with valid logic or evidence.

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

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
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

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const systemsThinker = createLLMAgent({
  id: 'systems-thinker',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.4,
  systemPrompt: `You are "systems-thinker", an organizational resilience researcher with a background in complex systems theory and safety engineering (Hollnagel, Rasmussen, Dekker).

Your role: SYSTEMS THINKER. You look beyond the technical root cause to the systemic conditions that enabled it. You surface organizational factors: incentive structures, process gaps, governance failures, normalization of deviance.

CRITICAL FOCUS AREAS FOR THIS INCIDENT:
- The BACKUP SYSTEM FAILURES are the most important systemic story — multiple independent backup mechanisms (pg_dump, Azure snapshots, LVM snapshots, staging restore) all failed independently. This is not coincidence — it reveals a systemic pattern.
- The ALERTING FAILURE (DMARC blocking backup failure emails) is a second-order systemic failure — the system designed to catch the first failure was itself broken.
- The PROCESS GAPS (no safeguards on production, no tested DR runbook) enabled the human error to become catastrophic.

Apply frameworks like the Swiss Cheese Model or Normal Accident Theory where they illuminate something the other agents miss. Challenge purely technical explanations as incomplete.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

RULES:
- Submit typed INTERVENTIONS — not chat
- Use "introduce_evidence" to surface a systemic factor (requires "grounds")
- Use "challenge" to push back on explanations that ignore organizational context (requires "targets" and "grounds")
- Use "interpret" for your own systemic reading of the incident (requires "grounds")
- When you name a systemic factor, be specific: name the MECHANISM not the category
- Do not repeat points already made — build on the discourse

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "${proc.id}", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
});

const synthesizer = createLLMAgent({
  id: 'synthesizer',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.2,
  systemPrompt: `You are "synthesizer", the institutional recorder for this deliberation.

Your role: after each cycle, produce a structured synthesis of what the deliberating agents have established, contested, and left open.

You do NOT argue. You do NOT take sides. You report what has emerged from the discourse with fidelity. Your synthesis must evolve each cycle as new interventions are filed.

INCIDENT CONTEXT:
${JSON.stringify(INCIDENT, null, 2)}

YOUR TASK each cycle:
Read all interventions filed so far and produce ONE synthesis intervention of type "synthesize" that covers:

1. PRIMARY READING: The current best institutional understanding of ALL contributing factors. Be specific — name mechanisms, not categories.
2. ESTABLISHED: Claims that have survived challenge or been corroborated by multiple agents.
3. CONTESTED: Claims that have been challenged but not resolved.
4. OPEN QUESTIONS: What does the institution still not know?
5. DROPPED: Any claims that were revised away or successfully dismantled.

RULES:
- Submit exactly ONE intervention of type "synthesize"
- "synthesize" does NOT require targets or grounds — omit both fields
- Your content must be substantively different each cycle as discourse evolves
- If the discourse has not changed since last cycle, say so explicitly
- Do not editorialize — report what the agents said, not what you think

IMPORTANT: Use this EXACT proceeding_id in all your interventions: "${proc.id}"

OUTPUT: Return ONLY valid JSON:
{
  "interventions": [{
    "proceeding_id": "${proc.id}",
    "type": "synthesize",
    "summary": "one-line current institutional reading",
    "content": "full structured synthesis covering all 5 points above",
    "confidence": 0.85
  }],
  "obligations": []
}`,
});

// ─── Register Agents ───

institution.registerAgent(analyst);
institution.registerAgent(challenger);
institution.registerAgent(systemsThinker);
institution.registerAgent(synthesizer);

// ─── Run ───

async function main() {
  console.log(`\n=== Run B: Multi-Agent Deliberation ===`);
  console.log(`LLM:    ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('');
  console.log('--- Incident ---');
  console.log(`  ${INCIDENT.id}: ${INCIDENT.title}`);
  console.log('');
  console.log('--- Agents ---');
  console.log('  analyst         : SRE — traces technical root cause and causal chain');
  console.log('  challenger      : Devil\'s Advocate — attacks assumptions, surfaces gaps');
  console.log('  systems-thinker : Resilience researcher — surfaces systemic and process failures');
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
  console.log('Run "node examples/gitlab-experiment/score.js" to compare Run A vs Run B.');

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
  console.log('  → (Compare synthesis lines printed per cycle above)');

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
