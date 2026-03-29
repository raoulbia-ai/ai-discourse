#!/usr/bin/env node
'use strict';

/**
 * Ablation Scoring — AF447
 *
 * Scores all three conditions against the 10-factor rubric and prints
 * a comparison table with cost-benefit metrics.
 *
 * Usage:
 *   node examples/af447-ablation/score-ablation.js
 */

const fs   = require('fs');
const path = require('path');

// ─── Rubric (same as af447-experiment) ───

const RUBRIC = [
  { id: 1, tier: 1, factor: 'Pitot probe icing / unreliable airspeed', keywords: ['pitot', 'icing', 'ice crystal', 'airspeed', 'thales', 'ADIRU'] },
  { id: 2, tier: 1, factor: 'Alternate law removes stall protection', keywords: ['alternate law', 'alternate', 'stall protection', 'envelope protection', 'normal law'] },
  { id: 3, tier: 1, factor: 'Sustained nose-up input by PF', keywords: ['nose-up', 'nose up', 'pull', 'maxi nose', '3 minute', '3m30', 'sustained'] },
  { id: 4, tier: 1, factor: 'Failure to diagnose stall', keywords: ['stall', 'diagnos', 'recogni', 'identify', 'did not recogni', 'failed to'] },
  { id: 5, tier: 1, factor: 'Crew coordination / shared SA', keywords: ['coordination', 'CRM', 'shared', 'situational awareness', 'mental model', 'conflicting', "don't understand"] },
  { id: 6, tier: 2, factor: 'Stall warning stops at extreme AoA', keywords: ['warning stop', 'warning deactivat', 'inhibit', 'sensor range', 'paradox', 'silence', 'stopped when'] },
  { id: 7, tier: 2, factor: 'Flight director displayed guidance throughout', keywords: ['flight director', 'FD', 'guidance', 'display', 'mislead'] },
  { id: 8, tier: 2, factor: 'Automation paradox / manual skill erosion', keywords: ['automation', 'manual', 'skill', 'atrophy', 'erode', 'dependency', 'paradox', 'rarely fly'] },
  { id: 9, tier: 2, factor: 'Side-stick non-coupling', keywords: ['side-stick', 'sidestick', 'tactile', 'feedback', 'coupling', 'feel', 'other pilot'] },
  { id: 10, tier: 2, factor: 'Known pitot deficiency not rectified', keywords: ['replacement', 'scheduled', 'not completed', '2007', 'BA probe', 'recommended', 'deficien'] },
];

// ─── Scoring ───

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

function printResults(results) {
  console.log('\n' + '═'.repeat(90));
  console.log('  ABLATION RESULTS: AF447 — Framework Structure vs Parallelism');
  console.log('═'.repeat(90));

  // ─── Cost metrics ───
  console.log('\n  COST METRICS\n');
  console.log(`  ${'Condition'.padEnd(25)} ${'Agents'.padEnd(8)} ${'Cycles'.padEnd(8)} ${'Interventions'.padEnd(15)} ${'Characters'.padEnd(12)} ${'Relative Cost'.padEnd(14)}`);
  console.log('  ' + '─'.repeat(80));

  const baseChars = results.A.output.metrics.total_chars || 1;
  for (const [key, r] of Object.entries(results)) {
    const m = r.output.metrics;
    const relCost = (m.total_chars / baseChars).toFixed(1) + 'x';
    console.log(`  ${('Condition ' + key + ' (' + r.output.mode + ')').padEnd(25)} ${String(r.output.agents).padEnd(8)} ${String(r.output.cycles).padEnd(8)} ${String(m.intervention_count).padEnd(15)} ${String(m.total_chars).padEnd(12)} ${relCost}`);
  }

  // ─── Factor scoring ───
  console.log('\n  FACTOR IDENTIFICATION (keyword matching)\n');
  console.log(`  ${'#'.padEnd(3)} ${'Tier'.padEnd(5)} ${'Factor'.padEnd(45)} A  B  C`);
  console.log('  ' + '─'.repeat(65));

  for (const factor of RUBRIC) {
    const a = results.A.scores.find(f => f.id === factor.id).found ? '✓' : '✗';
    const b = results.B.scores.find(f => f.id === factor.id).found ? '✓' : '✗';
    const c = results.C.scores.find(f => f.id === factor.id).found ? '✓' : '✗';

    let note = '';
    if (a === '✗' && b === '✓') note = ' ← parallelism advantage';
    if (b === '✗' && c === '✓') note = ' ← deliberation advantage';
    if (a === '✗' && b === '✗' && c === '✓') note = ' ← deliberation only';

    console.log(`  ${String(factor.id).padEnd(3)} T${factor.tier}   ${factor.factor.slice(0, 45).padEnd(45)} ${a}  ${b}  ${c}${note}`);
  }

  const totalA = results.A.scores.filter(f => f.found).length;
  const totalB = results.B.scores.filter(f => f.found).length;
  const totalC = results.C.scores.filter(f => f.found).length;
  const t1A = results.A.scores.filter(f => f.tier === 1 && f.found).length;
  const t1B = results.B.scores.filter(f => f.tier === 1 && f.found).length;
  const t1C = results.C.scores.filter(f => f.tier === 1 && f.found).length;
  const t2A = results.A.scores.filter(f => f.tier === 2 && f.found).length;
  const t2B = results.B.scores.filter(f => f.tier === 2 && f.found).length;
  const t2C = results.C.scores.filter(f => f.tier === 2 && f.found).length;

  console.log('  ' + '─'.repeat(65));
  console.log(`  ${''.padEnd(3)} ${''.padEnd(5)} ${'Tier 1 (official factors)'.padEnd(45)} ${t1A}  ${t1B}  ${t1C}  /5`);
  console.log(`  ${''.padEnd(3)} ${''.padEnd(5)} ${'Tier 2 (inferential factors)'.padEnd(45)} ${t2A}  ${t2B}  ${t2C}  /5`);
  console.log(`  ${''.padEnd(3)} ${''.padEnd(5)} ${'TOTAL'.padEnd(45)} ${totalA}  ${totalB}  ${totalC}  /10`);

  // ─── Key comparisons ───
  console.log('\n  KEY COMPARISONS\n');

  console.log('  A vs B (does parallelism help?)');
  if (totalB > totalA) {
    console.log(`    YES — B found ${totalB - totalA} more factor(s) than A`);
  } else if (totalB === totalA) {
    console.log('    NO DIFFERENCE on factor count');
  } else {
    console.log(`    SURPRISING — A found ${totalA - totalB} more factor(s) than B`);
  }

  console.log('\n  B vs C (does framework structure help beyond parallelism?)');
  if (totalC > totalB) {
    console.log(`    YES — C found ${totalC - totalB} more factor(s) than B`);
    const bNotC = results.B.scores.filter((f, i) => f.found && !results.C.scores[i].found);
    const cNotB = results.C.scores.filter((f, i) => f.found && !results.B.scores[i].found);
    if (cNotB.length > 0) {
      console.log('    Deliberation-only factors:');
      cNotB.forEach(f => console.log(`      → T${f.tier}-${f.id}: ${f.factor}`));
    }
  } else if (totalC === totalB) {
    console.log('    NO DIFFERENCE on factor count — framework structure may add depth, not coverage');
  } else {
    console.log(`    SURPRISING — B found ${totalB - totalC} more factor(s) than C`);
    console.log('    Deliberation may have introduced noise or conformity');
  }

  // ─── Cost-benefit ───
  console.log('\n  COST-BENEFIT ANALYSIS\n');

  const costB = results.B.output.metrics.total_chars;
  const costC = results.C.output.metrics.total_chars;
  const costRatioBC = (costC / costB).toFixed(1);
  const scoreDiffBC = totalC - totalB;

  console.log(`  Condition B cost: ${costB} chars (${(costB / baseChars).toFixed(1)}x baseline)`);
  console.log(`  Condition C cost: ${costC} chars (${(costC / baseChars).toFixed(1)}x baseline)`);
  console.log(`  C/B cost ratio:   ${costRatioBC}x`);
  console.log(`  C-B score diff:   ${scoreDiffBC >= 0 ? '+' : ''}${scoreDiffBC} factors`);

  if (results.C.output.metrics.challenges) {
    console.log(`  C challenges:     ${results.C.output.metrics.challenges}`);
    console.log(`  C revisions:      ${results.C.output.metrics.revisions}`);
    console.log(`  C health:         ${results.C.output.metrics.discourse_health}`);
  }

  // ─── Verdict ───
  console.log('\n  VERDICT\n');

  if (totalC > totalB) {
    console.log(`  Framework structure adds value beyond parallelism.`);
    console.log(`  Deliberation found ${totalC - totalB} factor(s) that parallel-independent agents missed.`);
    console.log(`  Cost: ${costRatioBC}x more compute than parallel for +${scoreDiffBC} factors.`);
  } else if (totalC === totalB && totalB > totalA) {
    console.log('  Parallelism accounts for the improvement over single-agent.');
    console.log('  Framework structure did NOT add measurable factor coverage beyond parallelism.');
    console.log('  The value of deliberation, if any, is in reasoning depth (not measurable by keyword scoring).');
  } else if (totalC === totalB && totalB === totalA) {
    console.log('  No measurable difference across any condition.');
    console.log('  All conditions identified the same factors.');
    console.log('  Differences, if any, are qualitative (depth, specificity, epistemic honesty).');
  } else {
    console.log('  Unexpected result — review outputs manually.');
  }

  console.log('\n  Note: keyword matching measures factor coverage only.');
  console.log('  Causal specificity (Dimension B from scoring-guide.md) requires manual scoring.');
  console.log('  Review the full outputs for qualitative assessment.\n');
}

// ─── Main ───

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

  console.log(`\n  Condition A: ${results.A.output.mode} — ${results.A.output.timestamp}`);
  console.log(`  Condition B: ${results.B.output.mode} — ${results.B.output.timestamp}`);
  console.log(`  Condition C: ${results.C.output.mode} — ${results.C.output.timestamp}`);
  console.log(`  Model: ${results.A.output.model}`);

  printResults(results);
}

main();
