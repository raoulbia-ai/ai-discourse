#!/usr/bin/env node
'use strict';

/**
 * Experiment Run A: Single-Agent Baseline
 * GitLab 2017 Database Deletion
 *
 * Single agent asked to produce a root cause analysis.
 * Output is saved and scored against the 12-factor ground truth rubric.
 *
 * This is the CONTROL condition. Compare results with Run B (deliberation).
 *
 * Usage:
 *   node examples/gitlab-experiment/llm-gitlab-single-agent.js
 *   BASE_URL=http://127.0.0.1:7999 MODEL=MiniMaxAI/MiniMax-M2.5 \
 *     node examples/gitlab-experiment/llm-gitlab-single-agent.js
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { createStore, createInstitution } = require('../../index');
const { createLLMAgent } = require('../../adapters');

// ─── Config ───

const BASE_URL  = process.env.BASE_URL  || 'http://127.0.0.1:7999';
const MODEL     = process.env.MODEL     || 'MiniMaxAI/MiniMax-M2.5';
const API_KEY   = process.env.API_KEY   || undefined;
const OUTPUT_FILE = path.join(__dirname, 'run-a-output.json');

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

// ─── Setup ───

const store       = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'gl-single-')));
const institution = createInstitution({ store });

// ─── Proceeding (created before agents so we can embed the real proc ID) ───

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

// ─── Agent (created after proceeding so we can embed the real proceeding ID) ───

const singleAgent = createLLMAgent({
  id: 'analyst',
  baseUrl: BASE_URL,
  model: MODEL,
  apiKey: API_KEY,
  temperature: 0.3,
  systemPrompt: `You are a senior Site Reliability Engineer conducting a
post-incident root cause analysis.

Your task: analyse the GitLab database deletion incident and produce a
COMPLETE root cause analysis identifying ALL contributing factors.

Do not anchor on the most obvious explanation. Go beyond the proximate cause.
Identify the systemic failures, process gaps, and organisational conditions
that made this incident possible AND made recovery impossible.

INCIDENT FACTS:
${JSON.stringify(INCIDENT, null, 2)}

Submit a SINGLE "interpret" intervention with your complete analysis.
Your content should be structured as:

1. PROXIMATE CAUSE: What directly triggered the data loss
2. CONTRIBUTING FACTORS: List every factor you identify (be exhaustive)
3. SYSTEMIC CONDITIONS: What organisational/process conditions enabled this
4. WHY RECOVERY FAILED: What made the situation unrecoverable
5. WHAT WOULD HAVE PREVENTED THIS: Most important preventive measures

IMPORTANT: Use this EXACT proceeding_id in your response: "${proc.id}"

Output ONLY valid JSON:
{
  "interventions": [{
    "proceeding_id": "${proc.id}",
    "type": "interpret",
    "summary": "one-line summary of root cause",
    "content": "your complete structured analysis",
    "grounds": { "evidence_refs": ["official_postmortem", "incident_facts"] },
    "confidence": 0.0-1.0
  }],
  "obligations": []
}`,
});

institution.registerAgent(singleAgent);

// ─── Run ───

async function main() {
  console.log('\n=== Run A: Single-Agent Baseline ===');
  console.log(`LLM:    ${BASE_URL} / ${MODEL}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log('');
  console.log('Incident: GitLab 2017 Database Deletion');
  console.log('Mode:     Single agent, one cycle, no deliberation');
  console.log('');

  await institution.runCycle();

  const allInts = institution.listInterventions(proc.id);

  console.log(`Interventions filed: ${allInts.length}`);
  for (const int of allInts) {
    console.log(`\n[${int.agent_id}] ${int.type}: ${int.summary}`);
    console.log(int.content);
  }

  // Save output for scoring
  const output = {
    run: 'A',
    mode: 'single-agent',
    model: MODEL,
    timestamp: new Date().toISOString(),
    interventions: allInts,
  };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nOutput saved to: ${OUTPUT_FILE}`);
  console.log('Run "node examples/gitlab-experiment/score.js" after completing Run B.');
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start ericaiproxy or set BASE_URL.`);
  }
  process.exit(1);
});
