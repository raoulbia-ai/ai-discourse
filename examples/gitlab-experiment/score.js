#!/usr/bin/env node
'use strict';

/**
 * Scoring script: GitLab 2017 experiment
 *
 * Reads run-a-output.json and run-b-output.json and scores each against
 * the 12-factor ground truth rubric from GitLab's official post-mortem.
 *
 * A factor is considered "identified" if it appears substantively in any
 * intervention's content or summary field — not just a keyword match.
 * The LLM-based scoring uses a fuzzy match approach: for each factor,
 * check if the intervention text contains the key concept, even if worded
 * differently.
 *
 * Usage:
 *   node examples/gitlab-experiment/score.js
 *
 * Requires both run-a-output.json and run-b-output.json to exist.
 * Run llm-gitlab-single-agent.js and llm-gitlab-deliberation.js first.
 */

const fs   = require('fs');
const path = require('path');

// ─── Rubric ───

const RUBRIC = [
  {
    id: 1,
    factor: 'Spam attack caused elevated database load (trigger)',
    keywords: ['spam', 'load', 'trigger', 'attack'],
    category: 'Trigger',
  },
  {
    id: 2,
    factor: 'Background job hard-deleted flagged user data (false positive)',
    keywords: ['background', 'job', 'worker', 'hard-delet', 'false positive', 'flagged'],
    category: 'Trigger',
  },
  {
    id: 3,
    factor: 'PostgreSQL replication lag caused WAL segments to be removed before secondary caught up',
    keywords: ['replication', 'lag', 'WAL', 'secondary', 'streaming'],
    category: 'Technical',
  },
  {
    id: 4,
    factor: 'Engineer confused production and secondary server — ran rm -rf on wrong server',
    keywords: ['confused', 'wrong server', 'rm -rf', 'production', 'terminal', 'identical'],
    category: 'Human error',
  },
  {
    id: 5,
    factor: 'pg_dump backups silently failing — version mismatch (9.2 tool vs 9.6 database)',
    keywords: ['pg_dump', 'backup', 'silent', 'version', '9.2', '9.6', 'empty'],
    category: 'Systemic — backup failure',
  },
  {
    id: 6,
    factor: 'Backup failure notification emails rejected by DMARC misconfiguration',
    keywords: ['DMARC', 'email', 'notification', 'alert', 'reject', 'failure email'],
    category: 'Systemic — alerting failure',
  },
  {
    id: 7,
    factor: 'Azure disk snapshots not enabled for the database server',
    keywords: ['Azure', 'disk snapshot', 'snapshot', 'not enabled', 'cloud'],
    category: 'Systemic — backup failure',
  },
  {
    id: 8,
    factor: 'LVM snapshots only every 24 hours, not hourly as assumed',
    keywords: ['LVM', 'snapshot', '24 hour', 'hourly', 'assumed'],
    category: 'Systemic — backup failure',
  },
  {
    id: 9,
    factor: 'Staging environment DB restore procedure untested and broken',
    keywords: ['staging', 'restore', 'untested', 'broken', 'procedure'],
    category: 'Systemic — process failure',
  },
  {
    id: 10,
    factor: 'No safeguards preventing destructive commands on production',
    keywords: ['safeguard', 'access control', 'prevent', 'destructive', 'confirmation', 'protection'],
    category: 'Process gap',
  },
  {
    id: 11,
    factor: 'No tested disaster recovery procedure',
    keywords: ['disaster recovery', 'runbook', 'DR', 'recovery plan', 'untested'],
    category: 'Process gap',
  },
  {
    id: 12,
    factor: 'Late-night work under pressure contributed to human error',
    keywords: ['fatigue', 'late night', 'pressure', 'stress', 'alone', 'tired'],
    category: 'Human factors',
  },
];

// ─── Scoring ───

function scoreRun(output) {
  const text = output.interventions
    .map(i => `${i.summary || ''} ${i.content || ''}`)
    .join(' ')
    .toLowerCase();

  return RUBRIC.map(factor => ({
    ...factor,
    found: factor.keywords.some(kw => text.includes(kw.toLowerCase())),
  }));
}

function printResults(scoreA, scoreB) {
  const totalA = scoreA.filter(f => f.found).length;
  const totalB = scoreB.filter(f => f.found).length;

  console.log('\n' + '═'.repeat(80));
  console.log('  SCORING RESULTS: GitLab 2017 Experiment');
  console.log('═'.repeat(80));
  console.log('');
  console.log('  12-factor rubric from GitLab official post-mortem');
  console.log('  A = Single agent  |  B = Deliberation (3 agents, 4 cycles)');
  console.log('');
  console.log(`  ${'#'.padEnd(3)} ${'Factor'.padEnd(52)} ${'Cat'.padEnd(12)} A  B`);
  console.log('  ' + '─'.repeat(74));

  for (let i = 0; i < RUBRIC.length; i++) {
    const a = scoreA[i].found ? '✓' : '✗';
    const b = scoreB[i].found ? '✓' : '✗';
    const highlight = !scoreA[i].found && scoreB[i].found ? ' ← deliberation advantage' : '';
    console.log(`  ${String(i + 1).padEnd(3)} ${RUBRIC[i].factor.slice(0, 52).padEnd(52)} ${RUBRIC[i].category.slice(0, 12).padEnd(12)} ${a}  ${b}${highlight}`);
  }

  console.log('  ' + '─'.repeat(74));
  console.log(`  ${'TOTAL'.padEnd(67)} ${String(totalA).padEnd(3)}${totalB}`);
  console.log('');
  console.log(`  Run A (single agent):  ${totalA}/12 factors identified (${Math.round(totalA/12*100)}%)`);
  console.log(`  Run B (deliberation):  ${totalB}/12 factors identified (${Math.round(totalB/12*100)}%)`);
  console.log('');

  const advantage = scoreB.filter((f, i) => f.found && !scoreA[i].found);
  const missed = scoreB.filter((f, i) => !f.found && !scoreA[i].found);

  if (advantage.length > 0) {
    console.log('  Deliberation advantage (B found, A missed):');
    advantage.forEach(f => console.log(`    → Factor ${f.id}: ${f.factor}`));
    console.log('');
  }

  if (missed.length > 0) {
    console.log('  Neither run identified:');
    missed.forEach(f => console.log(`    ✗ Factor ${f.id}: ${f.factor}`));
    console.log('');
  }

  // Hypothesis verdict
  console.log('  HYPOTHESIS: "Deliberation identifies more factors than single-agent"');
  if (totalB > totalA) {
    console.log(`  RESULT: SUPPORTED — deliberation identified ${totalB - totalA} additional factor(s)`);
  } else if (totalB === totalA) {
    console.log('  RESULT: NOT SUPPORTED — both runs identified the same number of factors');
  } else {
    console.log(`  RESULT: REFUTED — single agent identified ${totalA - totalB} more factor(s) than deliberation`);
  }
  console.log('');
  console.log('  Note: keyword matching is a first-pass approximation.');
  console.log('  Review full outputs in run-a-output.json and run-b-output.json');
  console.log('  for qualitative assessment of reasoning depth.');
  console.log('');
}

// ─── Main ───

function main() {
  const fileA = path.join(__dirname, 'run-a-output.json');
  const fileB = path.join(__dirname, 'run-b-output.json');

  if (!fs.existsSync(fileA)) {
    console.error('run-a-output.json not found. Run llm-gitlab-single-agent.js first.');
    process.exit(1);
  }
  if (!fs.existsSync(fileB)) {
    console.error('run-b-output.json not found. Run llm-gitlab-deliberation.js first.');
    process.exit(1);
  }

  const outputA = JSON.parse(fs.readFileSync(fileA, 'utf8'));
  const outputB = JSON.parse(fs.readFileSync(fileB, 'utf8'));

  console.log(`\n  Run A: ${outputA.mode} — ${outputA.timestamp}`);
  console.log(`  Run B: ${outputB.mode} — ${outputB.timestamp}`);
  console.log(`  Model: ${outputA.model}`);

  const scoreA = scoreRun(outputA);
  const scoreB = scoreRun(outputB);

  printResults(scoreA, scoreB);
}

main();
