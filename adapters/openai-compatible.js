'use strict';

const http = require('http');
const https = require('https');

// Valid intervention types — must match InterventionEngine
const VALID_TYPES = new Set([
  'interpret', 'challenge', 'introduce_evidence', 'request_verification',
  'propose_framing', 'narrow_scope', 'widen_scope', 'split_proceeding',
  'merge_proceedings', 'escalate', 'defer', 'synthesize',
  'propose_settlement', 'reopen', 'agreement', 'revision',
]);

/**
 * OpenAI-Compatible LLM Adapter
 *
 * Creates agents that use any OpenAI-compatible API (vLLM, Ollama, OpenAI, etc.)
 * to evaluate institution state and produce typed interventions.
 *
 * The LLM plugs into the agent, not into the framework.
 * The framework remains LLM-agnostic.
 *
 * Usage:
 *   const { createLLMAgent } = require('./adapters/openai-compatible')
 *   const agent = createLLMAgent({
 *     id: 'analyst',
 *     baseUrl: 'http://127.0.0.1:8000/v1',
 *     model: 'local-vllm',
 *     systemPrompt: 'You are an analyst...',
 *   })
 *   institution.registerAgent(agent)
 */

/**
 * @param {{ id: string, baseUrl: string, model: string, apiKey?: string, systemPrompt?: string, temperature?: number, maxTokens?: number }} opts
 * @returns {{ id: string, evaluate: Function }}
 */
function createLLMAgent(opts) {
  if (!opts.id) throw new Error('LLM agent requires id');
  if (!opts.baseUrl) throw new Error('LLM agent requires baseUrl');
  if (!opts.model) throw new Error('LLM agent requires model');

  const {
    id,
    baseUrl,
    model,
    apiKey,
    systemPrompt,
    temperature = 0.3,
    maxTokens = 4096,
  } = opts;

  return {
    id,
    async evaluate(context) {
      const prompt = buildPrompt(id, context, systemPrompt);
      const response = await callLLM(baseUrl, model, apiKey, prompt, temperature, maxTokens);
      const result = parseResponse(id, context, response);

      // Single retry on parse failure (empty result from non-empty response)
      if (result.interventions.length === 0 && response && response.trim().length > 20 && result._diagnostics?.parse_failed) {
        const retryResponse = await callLLM(baseUrl, model, apiKey, prompt, temperature, maxTokens);
        const retryResult = parseResponse(id, context, retryResponse);
        retryResult._diagnostics = retryResult._diagnostics || {};
        retryResult._diagnostics.retried = true;
        return retryResult;
      }

      return result;
    },
  };
}

/**
 * Build a prompt from institution context.
 */
function buildPrompt(agentId, context, systemPrompt) {
  const system = systemPrompt || `You are "${agentId}", a participant in a structured institutional deliberation.

You will receive the current state of active proceedings and recent interventions.

Your task: evaluate the proceedings and return typed interventions.

RULES:
- You submit INTERVENTIONS, not chat messages
- Each intervention must have: proceeding_id, type, summary, content
- Valid types: interpret, challenge, introduce_evidence, request_verification, agreement, revision
- "interpret" and "challenge" require "grounds" (evidence_refs, signal_ids, or precedent_ids)
- "challenge" and "agreement" require "targets" (IDs of prior interventions you're responding to)
- Only contribute if you have something substantive to add
- Respond to existing interventions before posting new ones

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "interventions": [
    {
      "proceeding_id": "proc_...",
      "type": "interpret",
      "summary": "one-line summary",
      "content": "detailed reasoning",
      "grounds": { "evidence_refs": ["..."] },
      "confidence": 0.7
    }
  ],
  "obligations": []
}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`;

  // Build the user message from context
  const parts = [];

  // Active proceedings
  if (context.proceedings && context.proceedings.length > 0) {
    parts.push('## Active Proceedings\n');
    for (const proc of context.proceedings) {
      parts.push(`### ${proc.title} (${proc.id})`);
      parts.push(`Status: ${proc.status}`);
      if (proc.framing) {
        parts.push(`Question: ${proc.framing.primary_question || 'not framed'}`);
        if (proc.framing.in_scope) parts.push(`In scope: ${proc.framing.in_scope.join(', ')}`);
      }
      parts.push('');
    }
  }

  // Recent interventions
  if (context.recent_interventions && context.recent_interventions.length > 0) {
    parts.push('## Recent Interventions\n');
    parts.push('IMPORTANT: When submitting challenge, agreement, or revision interventions,');
    parts.push('use the exact intervention ID shown below (e.g. int_...) in the "targets" array.\n');
    for (const int of context.recent_interventions) {
      parts.push(`ID: ${int.id}`);
      parts.push(`[${int.agent_id}] ${int.type} on ${int.proceeding_id}: ${int.summary}`);
      parts.push(`  ${int.content}`);
      if (int.confidence) parts.push(`  Confidence: ${int.confidence}`);
      parts.push('');
    }

    // Pending challenges: identify challenges targeting THIS agent's interventions
    // that have not yet received a revision or agreement response
    const myInterventionIds = new Set(
      context.recent_interventions
        .filter(i => i.agent_id === agentId)
        .map(i => i.id)
    );
    const challengesAtMe = context.recent_interventions.filter(i =>
      i.type === 'challenge' &&
      i.agent_id !== agentId &&
      i.targets?.some(t => myInterventionIds.has(t))
    );
    // Check which challenges have already been addressed (revision or agreement targeting the challenge)
    const myResponses = context.recent_interventions.filter(i =>
      i.agent_id === agentId &&
      (i.type === 'revision' || i.type === 'agreement')
    );
    const addressedChallengeIds = new Set();
    for (const resp of myResponses) {
      for (const t of (resp.targets || [])) {
        // A response addresses a challenge if it targets the challenge itself
        // or targets the same intervention the challenge targeted
        if (challengesAtMe.some(c => c.id === t)) addressedChallengeIds.add(t);
      }
    }
    const pendingChallenges = challengesAtMe.filter(c => !addressedChallengeIds.has(c.id));

    if (pendingChallenges.length > 0) {
      parts.push('## PENDING CHALLENGES AGAINST YOUR CLAIMS\n');
      parts.push('The following challenges target YOUR prior interventions and have NOT been addressed.');
      parts.push('You MUST respond to each one. For each challenge, do ONE of:');
      parts.push('  1. FILE A REVISION (type: "revision") — update your position, stating what you are changing and why.');
      parts.push('     Your revision must contain NEW reasoning, not just restate the challenge.');
      parts.push('     Include a revised confidence score.');
      parts.push('  2. FILE A REBUTTAL (type: "interpret") — defend your original claim with additional evidence or reasoning.');
      parts.push('     Explain specifically why the challenge does not change your position.');
      parts.push('  3. FILE A CONCESSION (type: "agreement") — agree that the challenger is correct.');
      parts.push('Do NOT ignore these challenges. Do NOT simply repeat what the challenger said.\n');
      for (const c of pendingChallenges) {
        const targetedClaim = context.recent_interventions.find(i => c.targets?.includes(i.id) && i.agent_id === agentId);
        parts.push(`CHALLENGE ${c.id} from [${c.agent_id}]:`);
        parts.push(`  Challenges your claim: "${targetedClaim?.summary || 'unknown claim'}"`);
        parts.push(`  Challenge: ${c.summary}`);
        parts.push(`  ${c.content.slice(0, 300)}`);
        parts.push('');
      }
    }
  }

  // Syntheses
  if (context.syntheses && Object.keys(context.syntheses).length > 0) {
    parts.push('## Current Syntheses\n');
    for (const [procId, syn] of Object.entries(context.syntheses)) {
      parts.push(`### ${procId} (v${syn.version})`);
      parts.push(syn.primary_reading);
      if (syn.uncertainties && syn.uncertainties.length > 0) {
        parts.push(`Uncertainties: ${syn.uncertainties.join('; ')}`);
      }
      parts.push('');
    }
  }

  // Obligations
  if (context.obligations && context.obligations.length > 0) {
    parts.push('## Your Open Obligations\n');
    for (const obl of context.obligations) {
      parts.push(`- [${obl.id}] ${obl.description} (proceeding: ${obl.proceeding_id})`);
    }
    parts.push('');
  }

  const userMessage = parts.length > 0
    ? parts.join('\n')
    : 'No active proceedings or interventions. Nothing to evaluate.';

  return { system, user: userMessage };
}

/**
 * Call an OpenAI-compatible chat completions endpoint.
 */
function callLLM(baseUrl, model, apiKey, prompt, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const transport = isHttps ? https : http;

    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    const reqOpts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
    };

    const req = transport.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`LLM API error ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error(`Failed to parse LLM response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('LLM request timed out after 120s'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * Parse LLM response into interventions and obligations.
 * Returns { interventions, obligations, _diagnostics }.
 * _diagnostics is lightweight parse metadata for debugging — not part of the public contract.
 */
function parseResponse(agentId, context, rawResponse) {
  const diagnostics = { raw_length: 0, parse_failed: false, dropped: [] };
  const empty = { interventions: [], obligations: [], _diagnostics: diagnostics };

  if (!rawResponse || !rawResponse.trim()) {
    diagnostics.parse_failed = true;
    diagnostics.reason = 'empty_response';
    return empty;
  }

  diagnostics.raw_length = rawResponse.length;

  // Extract JSON from response (may be wrapped in markdown code blocks)
  let jsonStr = rawResponse.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    // Try to find JSON object in the response
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try {
        parsed = JSON.parse(objMatch[0]);
      } catch {
        diagnostics.parse_failed = true;
        diagnostics.reason = 'json_extraction_failed';
        return empty;
      }
    } else {
      diagnostics.parse_failed = true;
      diagnostics.reason = 'no_json_found';
      return empty;
    }
  }

  const interventions = [];
  const obligations = [];

  // Validate and clean interventions
  if (Array.isArray(parsed.interventions)) {
    for (const int of parsed.interventions) {
      // Required fields
      if (!int.proceeding_id || !int.type || !int.summary || !int.content) {
        diagnostics.dropped.push({ reason: 'missing_fields', type: int.type || 'unknown' });
        continue;
      }

      // Type must be valid
      if (!VALID_TYPES.has(int.type)) {
        diagnostics.dropped.push({ reason: 'invalid_type', type: int.type });
        continue;
      }

      // Proceeding must exist in context
      const procExists = context.proceedings?.some(p => p.id === int.proceeding_id);
      if (!procExists) {
        diagnostics.dropped.push({ reason: 'unknown_proceeding', type: int.type, proceeding_id: int.proceeding_id });
        continue;
      }

      interventions.push({
        proceeding_id: int.proceeding_id,
        type: int.type,
        summary: String(int.summary).slice(0, 200),
        content: String(int.content),
        targets: Array.isArray(int.targets) ? int.targets : [],
        grounds: int.grounds || null,
        confidence: typeof int.confidence === 'number' ? int.confidence : null,
      });
    }
  }

  // Validate and clean obligations
  if (Array.isArray(parsed.obligations)) {
    for (const obl of parsed.obligations) {
      if (!obl.proceeding_id || !obl.assigned_agent_id || !obl.description) {
        diagnostics.dropped.push({ reason: 'missing_obligation_fields' });
        continue;
      }
      obligations.push({
        proceeding_id: obl.proceeding_id,
        assigned_agent_id: obl.assigned_agent_id,
        description: String(obl.description),
      });
    }
  }

  diagnostics.accepted = interventions.length;
  return { interventions, obligations, _diagnostics: diagnostics };
}

module.exports = { createLLMAgent, buildPrompt, parseResponse };
