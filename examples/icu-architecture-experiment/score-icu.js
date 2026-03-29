#!/usr/bin/env node
'use strict';

/**
 * ICU Architecture — Keyword Scoring + Cost Metrics
 * First-pass automated scoring. Manual Dimension B+C scoring required separately.
 */

const fs   = require('fs');
const path = require('path');

const RUBRIC = [
  // Tier 1: Kafka failure modes
  { id: 'K1', tier: 1, factor: 'Consumer lag under burst load', keywords: ['consumer lag', 'burst', 'simultaneous alarm', 'queue', 'fall behind', 'overwhelm', 'backlog'] },
  { id: 'K2', tier: 1, factor: 'Message ordering on partition failure', keywords: ['ordering', 'partition', 'out of order', 'temporal', 'sequence'] },
  { id: 'K3', tier: 1, factor: 'Exactly-once semantics complexity', keywords: ['exactly-once', 'exactly once', 'idempoten', 'duplicate', 'offset', 'at-least-once'] },
  { id: 'K4', tier: 1, factor: 'Operational burden on clinical IT', keywords: ['operational', 'zookeeper', 'kraft', 'broker management', 'clinical IT', 'maintain', '3am', 'specialist'] },
  { id: 'K5', tier: 1, factor: 'Broker failure — alarms lost or delayed', keywords: ['broker fail', 'broker down', 'replication factor', 'message loss', 'alarm lost', 'ack'] },
  { id: 'K6', tier: 1, factor: 'Schema evolution on firmware update', keywords: ['schema', 'firmware', 'format change', 'evolution', 'registry', 'backward compat'] },
  // Tier 2: Polling failure modes
  { id: 'P1', tier: 2, factor: 'Polling interval as latency floor', keywords: ['polling interval', 'latency floor', '5 second', 'detection delay', 'lower bound'] },
  { id: 'P2', tier: 2, factor: 'Database bottleneck at scale', keywords: ['database bottleneck', 'writes per second', 'operations per second', 'database load', 'bottleneck'] },
  { id: 'P3', tier: 2, factor: 'Thundering herd on polling wakeup', keywords: ['thundering herd', 'simultaneous', 'polling wakeup', 'burst of queries', 'spike'] },
  { id: 'P4', tier: 2, factor: 'Missed events between polls', keywords: ['missed event', 'between polls', 'buffer overflow', 'transient', 'silently lost', 'never see'] },
  // Tier 3: Contested middle ground
  { id: 'M1', tier: 3, factor: 'Alarm fatigue', keywords: ['alarm fatigue', 'false alarm', 'alert fatigue', 'desensiti', 'suppress'] },
  { id: 'M2', tier: 3, factor: 'Graceful degradation under partial failure', keywords: ['graceful', 'partial failure', 'degrad', 'one component', 'resilien'] },
  { id: 'M3', tier: 3, factor: 'Regulatory auditability (FDA/CE)', keywords: ['FDA', 'CE mark', 'regulat', 'audit', 'medical device', 'traceab', 'certif', 'compliance'] },
  { id: 'M4', tier: 3, factor: 'Silent loss vs delayed alarm — which is safer?', keywords: ['silent', 'loss vs delay', 'which.*safer', 'more dangerous', 'fail silent', 'fail loud'] },
  { id: 'M5', tier: 3, factor: 'Ambiguity surfacing', keywords: ['ambig', 'depend', 'unclear', 'not specified', 'assumption', 'missing information', 'we don\'t know', 'constraint'] },
];

function scoreCondition(output) {
  const text = output.interventions
    .map(i => `${i.summary || ''} ${i.content || ''}`)
    .join(' ')
    .toLowerCase();

  return RUBRIC.map(factor => ({
    ...factor,
    found: factor.keywords.some(kw => text.includes(kw.toLowerCase())),
  }));
}

function main() {
  const files = {
    A: path.join(__dirname, 'condition-a-output.json'),
    B: path.join(__dirname, 'condition-b-output.json'),
    C: path.join(__dirname, 'condition-c-output.json'),
  };

  for (const [key, file] of Object.entries(files)) {
    if (!fs.existsSync(file)) {
      console.error(`${path.basename(file)} not found. Run condition-${key.toLowerCase()}-*.js first.`);
      process.exit(1);
    }
  }

  const results = {};
  for (const [key, file] of Object.entries(files)) {
    const output = JSON.parse(fs.readFileSync(file, 'utf8'));
    results[key] = { output, scores: scoreCondition(output) };
  }

  console.log('\n' + '═'.repeat(90));
  console.log('  ICU ARCHITECTURE EXPERIMENT — SCORING RESULTS');
  console.log('═'.repeat(90));

  // Cost metrics
  console.log('\n  COST METRICS\n');
  const baseChars = results.A.output.metrics.total_chars || 1;
  console.log(`  ${'Condition'.padEnd(35)} ${'Agents'.padEnd(8)} ${'Cycles'.padEnd(8)} ${'Ints'.padEnd(6)} ${'Chars'.padEnd(10)} ${'Cost'.padEnd(8)}`);
  console.log('  ' + '─'.repeat(72));
  for (const [key, r] of Object.entries(results)) {
    const m = r.output.metrics;
    console.log(`  ${('Condition ' + key + ' (' + r.output.mode + ')').padEnd(35)} ${String(r.output.agents).padEnd(8)} ${String(r.output.cycles).padEnd(8)} ${String(m.intervention_count).padEnd(6)} ${String(m.total_chars).padEnd(10)} ${(m.total_chars / baseChars).toFixed(1) + 'x'}`);
  }

  // Factor scoring
  console.log('\n  FACTOR IDENTIFICATION\n');
  console.log(`  ${'ID'.padEnd(4)} ${'T'.padEnd(3)} ${'Factor'.padEnd(42)} A  B  C`);
  console.log('  ' + '─'.repeat(60));

  for (const factor of RUBRIC) {
    const a = results.A.scores.find(f => f.id === factor.id).found ? '✓' : '✗';
    const b = results.B.scores.find(f => f.id === factor.id).found ? '✓' : '✗';
    const c = results.C.scores.find(f => f.id === factor.id).found ? '✓' : '✗';
    let note = '';
    if (a === '✗' && b === '✗' && c === '✓') note = ' ← deliberation only';
    if (a === '✗' && b === '✓' && c === '✓') note = ' ← multi-agent';
    if (b === '✗' && c === '✓') note = ' ← deliberation advantage';
    console.log(`  ${factor.id.padEnd(4)} T${factor.tier}  ${factor.factor.slice(0, 42).padEnd(42)} ${a}  ${b}  ${c}${note}`);
  }

  // Totals by tier
  const tierTotals = {};
  for (const tier of [1, 2, 3]) {
    tierTotals[tier] = {};
    for (const key of ['A', 'B', 'C']) {
      tierTotals[tier][key] = results[key].scores.filter(f => f.tier === tier && f.found).length;
    }
    const max = RUBRIC.filter(f => f.tier === tier).length;
    console.log(`  ${''.padEnd(4)} ${''.padEnd(3)} ${'Tier ' + tier + ' subtotal'.padEnd(42)} ${tierTotals[tier].A}  ${tierTotals[tier].B}  ${tierTotals[tier].C}  /${max}`);
  }
  const totalA = results.A.scores.filter(f => f.found).length;
  const totalB = results.B.scores.filter(f => f.found).length;
  const totalC = results.C.scores.filter(f => f.found).length;
  console.log('  ' + '─'.repeat(60));
  console.log(`  ${''.padEnd(4)} ${''.padEnd(3)} ${'TOTAL'.padEnd(42)} ${totalA}  ${totalB}  ${totalC}  /15`);

  // Key comparisons
  console.log('\n  KEY COMPARISONS\n');

  console.log('  A→B (parallelism):');
  console.log(`    Tier 1: ${tierTotals[1].A} → ${tierTotals[1].B}  |  Tier 2: ${tierTotals[2].A} → ${tierTotals[2].B}  |  Tier 3: ${tierTotals[3].A} → ${tierTotals[3].B}`);

  console.log('  B→C (framework structure):');
  console.log(`    Tier 1: ${tierTotals[1].B} → ${tierTotals[1].C}  |  Tier 2: ${tierTotals[2].B} → ${tierTotals[2].C}  |  Tier 3: ${tierTotals[3].B} → ${tierTotals[3].C}`);

  // Deliberation-only factors
  const cOnly = results.C.scores.filter((f, i) => f.found && !results.A.scores[i].found && !results.B.scores[i].found);
  if (cOnly.length > 0) {
    console.log('\n  Deliberation-only factors (C found, A+B missed):');
    cOnly.forEach(f => console.log(`    → ${f.id}: ${f.factor}`));
  }

  // Cost-benefit
  const costB = results.B.output.metrics.total_chars;
  const costC = results.C.output.metrics.total_chars;
  console.log('\n  COST-BENEFIT\n');
  console.log(`  A: ${totalA}/15 at ${baseChars} chars (baseline)`);
  console.log(`  B: ${totalB}/15 at ${costB} chars (${(costB / baseChars).toFixed(1)}x)`);
  console.log(`  C: ${totalC}/15 at ${costC} chars (${(costC / baseChars).toFixed(1)}x)`);

  if (results.C.output.metrics.challenges !== undefined) {
    console.log(`\n  Deliberation dynamics:`);
    console.log(`    Challenges: ${results.C.output.metrics.challenges}`);
    console.log(`    Revisions:  ${results.C.output.metrics.revisions}`);
    console.log(`    Health:     ${results.C.output.metrics.discourse_health}`);
  }

  // Tier 3 focus (the discriminating test)
  console.log('\n  TIER 3 ANALYSIS (contested middle ground — discriminating test)\n');
  for (const factor of RUBRIC.filter(f => f.tier === 3)) {
    const a = results.A.scores.find(f => f.id === factor.id).found;
    const b = results.B.scores.find(f => f.id === factor.id).found;
    const c = results.C.scores.find(f => f.id === factor.id).found;
    const status = c && !b ? 'DELIBERATION ADVANTAGE' : c && b && !a ? 'MULTI-AGENT ADVANTAGE' : c && b && a ? 'ALL FOUND' : !c ? 'MISSED BY ALL' : 'OTHER';
    console.log(`  ${factor.id}: ${factor.factor}`);
    console.log(`    A=${a ? '✓' : '✗'}  B=${b ? '✓' : '✗'}  C=${c ? '✓' : '✗'}  → ${status}`);
  }

  console.log('\n  Note: keyword scoring is a first pass. Manual Dimension B+C scoring required.');
  console.log('  See scoring-guide.md.\n');
}

main();
