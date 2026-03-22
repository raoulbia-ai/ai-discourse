#!/usr/bin/env node
'use strict';

/**
 * LLM PR Review — multi-agent code review of any GitHub PR.
 *
 * 3 agents review the PR:
 *   security-reviewer   : injection, data exposure, auth, input validation
 *   architecture-reviewer: design patterns, separation of concerns, maintainability
 *   reliability-reviewer : error handling, edge cases, data integrity
 *
 * Uses ONLY the public API surface + LLM adapter.
 *
 * Usage:
 *   node examples/llm-pr-review.js https://github.com/owner/repo/pull/123
 *   node examples/llm-pr-review.js owner/repo 123
 *
 * Environment:
 *   BASE_URL  LLM endpoint (default: http://127.0.0.1:8000/v1)
 *   MODEL     Model name (default: local-vllm)
 *   API_KEY   Optional API key
 *   GITHUB_TOKEN  Optional — for private repos or to avoid rate limits
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const https = require('https');
const { createStore, createInstitution } = require('../index');
const { createLLMAgent } = require('../adapters');

// ─── Config ───

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000/v1';
const MODEL = process.env.MODEL || 'local-vllm';
const API_KEY = process.env.API_KEY || undefined;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || undefined;
const CYCLES = 3;

// ─── Parse PR argument ───

function parsePRArg(args) {
  // Format: https://github.com/owner/repo/pull/123
  const urlMatch = args[0]?.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (urlMatch) {
    return { repo: urlMatch[1], number: parseInt(urlMatch[2]) };
  }

  // Format: owner/repo 123
  if (args[0]?.includes('/') && args[1]) {
    return { repo: args[0], number: parseInt(args[1]) };
  }

  return null;
}

const prArg = parsePRArg(process.argv.slice(2));

if (!prArg) {
  console.error('Usage:');
  console.error('  node examples/llm-pr-review.js https://github.com/owner/repo/pull/123');
  console.error('  node examples/llm-pr-review.js owner/repo 123');
  console.error('');
  console.error('Environment:');
  console.error('  BASE_URL=http://127.0.0.1:8000/v1   LLM endpoint');
  console.error('  MODEL=local-vllm                    Model name');
  console.error('  GITHUB_TOKEN=ghp_...                For private repos');
  process.exit(1);
}

// ─── Fetch PR from GitHub API ───

function githubFetch(urlPath) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: urlPath,
      method: 'GET',
      headers: {
        'User-Agent': 'ai-discourse-pr-review',
        'Accept': 'application/vnd.github.v3+json',
        ...(GITHUB_TOKEN ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` } : {}),
      },
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse GitHub response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub API timeout')); });
    req.end();
  });
}

async function fetchPR(repo, number) {
  console.log(`Fetching PR #${number} from ${repo}...`);

  const pr = await githubFetch(`/repos/${repo}/pulls/${number}`);
  const files = await githubFetch(`/repos/${repo}/pulls/${number}/files`);

  return {
    repo,
    number,
    title: pr.title,
    description: pr.body || '(no description)',
    files: files.map(f => ({
      name: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      diff: f.patch || '(binary or too large)',
    })),
  };
}

// ─── Main ───

async function main() {
  // Fetch PR
  const PR = await fetchPR(prArg.repo, prArg.number);

  // Format diff for prompts
  const DIFF_TEXT = PR.files.map(f =>
    `### ${f.name} (${f.status}, +${f.additions} -${f.deletions})\n\`\`\`diff\n${f.diff}\n\`\`\``
  ).join('\n\n');

  const PR_CONTEXT = `
PULL REQUEST: ${PR.repo}#${PR.number}
Title: ${PR.title}
Description: ${PR.description}

CHANGED FILES (${PR.files.length}):
${DIFF_TEXT}
`;

  // Truncate context if too large (keep first 8000 chars of diff)
  const maxContextLen = 10000;
  const truncatedContext = PR_CONTEXT.length > maxContextLen
    ? PR_CONTEXT.slice(0, maxContextLen) + '\n\n[... diff truncated for context limit ...]'
    : PR_CONTEXT;

  // ─── Setup ───

  const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'pr-review-')));
  const institution = createInstitution({ store });

  // ─── Agents ───

  const securityReviewer = createLLMAgent({
    id: 'security-reviewer',
    baseUrl: BASE_URL,
    model: MODEL,
    apiKey: API_KEY,
    temperature: 0.3,
    systemPrompt: `You are "security-reviewer", a security engineer reviewing a pull request.

You focus on: SQL injection, data exposure, input validation, error messages leaking internals, unsafe type coercion, deletion without authorization checks, hardcoded secrets.

${truncatedContext}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a specific security concern with file/line reference
- Use "interpret" for your overall security assessment
- Use "challenge" if another reviewer dismisses a security concern (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Be specific — cite the exact code pattern that concerns you
- If the code looks safe, say so — don't invent problems

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  });

  const architectureReviewer = createLLMAgent({
    id: 'architecture-reviewer',
    baseUrl: BASE_URL,
    model: MODEL,
    apiKey: API_KEY,
    temperature: 0.3,
    systemPrompt: `You are "architecture-reviewer", a senior engineer reviewing a pull request for design quality.

You focus on: separation of concerns, single responsibility, error handling patterns, API design, maintainability, tech debt.

${truncatedContext}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a design concern with specific code reference
- Use "interpret" for your overall architectural assessment
- Use "challenge" if you disagree with another reviewer's assessment (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Suggest alternatives when you flag problems
- If the design is solid, say so

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  });

  const reliabilityReviewer = createLLMAgent({
    id: 'reliability-reviewer',
    baseUrl: BASE_URL,
    model: MODEL,
    apiKey: API_KEY,
    temperature: 0.3,
    systemPrompt: `You are "reliability-reviewer", an SRE reviewing a pull request for production readiness.

You focus on: error handling completeness, edge cases, data integrity, cascading failures, logging quality, race conditions.

${truncatedContext}

RULES:
- Submit typed INTERVENTIONS, not chat messages
- Use "introduce_evidence" to flag a reliability concern with specific code reference
- Use "interpret" for your overall reliability assessment
- Use "challenge" if another reviewer's suggestion would introduce reliability risk (requires "targets")
- Include "grounds" with evidence_refs (use file names as refs)
- Focus on what could go wrong in production

OUTPUT: Return ONLY valid JSON:
{ "interventions": [{ "proceeding_id": "...", "type": "...", "summary": "...", "content": "...", "grounds": { "evidence_refs": ["..."] }, "targets": ["..."], "confidence": 0.0-1.0 }], "obligations": [] }`,
  });

  // ─── Register ───

  institution.registerAgent(securityReviewer);
  institution.registerAgent(architectureReviewer);
  institution.registerAgent(reliabilityReviewer);

  // ─── Print context ───

  console.log(`\n=== LLM PR Review: ${PR.repo}#${PR.number} ===`);
  console.log(`LLM: ${BASE_URL} / ${MODEL}`);
  console.log(`Cycles: ${CYCLES}`);
  console.log('');
  console.log('--- PR ---');
  console.log(`  Title: ${PR.title}`);
  console.log(`  Files: ${PR.files.length} (${PR.files.reduce((s, f) => s + f.additions, 0)}+ ${PR.files.reduce((s, f) => s + f.deletions, 0)}-)`);
  for (const f of PR.files) console.log(`    ${f.name} (${f.status}, +${f.additions} -${f.deletions})`);
  console.log(`  Description: ${PR.description.split('\n')[0].slice(0, 100)}`);
  console.log('');
  console.log('--- Reviewers ---');
  console.log('  security-reviewer     : injection, data exposure, input validation, auth');
  console.log('  architecture-reviewer : design patterns, separation of concerns, maintainability');
  console.log('  reliability-reviewer  : error handling, edge cases, data integrity');
  console.log('');

  // Ingest PR as signal
  institution.ingestSignal({
    type: 'pull_request',
    source: 'github',
    timestamp: new Date().toISOString(),
    title: `${PR.repo}#${PR.number}: ${PR.title}`,
    summary: PR.description.slice(0, 500),
    tags: ['pr', 'code_review', ...PR.files.map(f => f.name)],
  });

  // Open proceeding
  const proc = institution.openProceeding({
    title: `Review: ${PR.repo}#${PR.number} — ${PR.title}`,
    framing: {
      primary_question: 'Should this PR be approved, and are there concerns that need to be addressed first?',
      posture: 'code_review',
      in_scope: ['security', 'architecture', 'reliability', 'error handling', 'data integrity'],
      out_of_scope: ['performance optimization', 'UI/UX', 'feature scope'],
    },
  });

  // Run cycles
  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    console.log(`${'═'.repeat(50)}`);
    console.log(`  Cycle ${cycle}/${CYCLES}`);
    console.log(`${'═'.repeat(50)}`);

    try {
      const result = await institution.runCycle();
      const agents = Object.entries(result.agents).map(([id, r]) => `${id}:${r}`).join(', ');
      console.log(`  ${agents}`);
      console.log(`  Interventions: ${result.interventions_submitted}`);
      if (result.errors.length > 0) {
        for (const e of result.errors) console.log(`  Error [${e.agent_id}]: ${e.error}`);
      }
    } catch (e) {
      console.log(`  Cycle error: ${e.message}`);
    }
    console.log('');
  }

  // ─── Final Output ───

  const allInts = institution.listInterventions(proc.id);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  REVIEW SUMMARY (${allInts.length} findings)`);
  console.log(`${'═'.repeat(50)}`);

  for (const int of allInts) {
    const targetInfo = int.targets?.length > 0 ? ` [responds to prior]` : '';
    console.log(`\n  [${int.agent_id}] ${int.type}${targetInfo}:`);
    console.log(`  ${int.summary}`);
    console.log(`  ${int.content.slice(0, 300)}${int.content.length > 300 ? '...' : ''}`);
    if (int.confidence) console.log(`  Confidence: ${int.confidence}`);
  }

  // Synthesize
  const concerns = allInts.filter(i => i.type === 'challenge' || i.type === 'introduce_evidence');

  institution.updateSynthesis({
    proceeding_id: proc.id,
    updated_by: 'review-system',
    primary_reading: `${allInts.length} findings from 3 reviewers across ${CYCLES} cycles. ${concerns.length} specific concerns raised.`,
    supporting_points: allInts.map(i => `[${i.agent_id}] ${i.type}: ${i.summary}`),
    uncertainties: concerns.length > 0
      ? concerns.map(c => c.summary.slice(0, 100))
      : ['No significant concerns identified'],
    preserved_dissent: allInts.filter(i => i.type === 'challenge').map(c => ({
      label: c.summary.slice(0, 80),
      summary: c.content.slice(0, 200),
    })),
  });

  const syn = institution.getSynthesis(proc.id);
  console.log(`\n--- Synthesis ---`);
  console.log(syn.primary_reading);
  if (syn.uncertainties.length > 0 && syn.uncertainties[0] !== 'No significant concerns identified') {
    console.log('\nOpen concerns:');
    for (const u of syn.uncertainties) console.log(`  - ${u}`);
  }
  if (syn.preserved_dissent.length > 0) {
    console.log('\nDisagreements:');
    for (const d of syn.preserved_dissent) console.log(`  - ${d.label}`);
  }

  const health = institution.getHealth();
  console.log(`\nHealth: ${health.discourse_health} (ratio: ${health.discourse_ratio})`);
  const types = {};
  for (const i of allInts) types[i.type] = (types[i.type] || 0) + 1;
  console.log(`Types: ${JSON.stringify(types)}`);
}

main().catch(e => {
  console.error(`\nFailed: ${e.message}`);
  if (e.message.includes('ECONNREFUSED')) {
    console.error(`No LLM server at ${BASE_URL}. Start vLLM/Ollama or set BASE_URL.`);
  }
  if (e.message.includes('GitHub API')) {
    console.error('Check the PR URL and ensure the repo is public (or set GITHUB_TOKEN).');
  }
  process.exit(1);
});
