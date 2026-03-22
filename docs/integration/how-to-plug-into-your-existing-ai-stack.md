# How to Plug Into Your Existing AI Stack

You already have an LLM. You already have data. This page shows how to wrap your existing setup in the AI Discourse Infrastructure so you get multi-cycle, multi-agent reasoning instead of single-shot answers.

Time to integrate: under an hour.

---

## 1. What You Already Have

You probably have something like this:

```javascript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Analyze this incident: ...' }
  ]
})

const answer = response.choices[0].message.content
// Done. One answer. Move on.
```

And you have inputs — log files, bug reports, documents, alerts — that you paste into prompts.

This works fine for quick questions. It doesn't work when the answer needs to evolve.

---

## 2. Where This Framework Fits

The framework wraps your **reasoning step**. It doesn't replace your LLM or your data pipeline. It sits between them:

```
Your data → Framework → Your LLM (via agents) → Structured reasoning output
```

Instead of one LLM call that produces one answer, you get:

- Multiple agents with different perspectives calling your LLM
- Multiple cycles where agents respond to each other
- Typed interventions (interpret, challenge, introduce_evidence)
- Evolving synthesis with preserved uncertainty

Your LLM is still doing the thinking. The framework structures **how** it thinks.

---

## 3. Before vs. After

### Before: single LLM call

```javascript
const answer = await askLLM('What caused this outage?')
// → one answer, one perspective, done
```

### After: proceeding + cycles + synthesis

```javascript
import { createStore, createInstitution } from './infra/index.js'
import { createLLMAgent } from './infra/adapters/index.js'

const store = createStore('./data')
const institution = createInstitution({ store })

// Register agents that use YOUR LLM
institution.registerAgent(createLLMAgent({
  id: 'backend-eng',
  baseUrl: 'https://api.openai.com/v1',  // or your vLLM/Ollama endpoint
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  systemPrompt: 'You are a backend engineer investigating an outage...'
}))

institution.registerAgent(createLLMAgent({
  id: 'qa-eng',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
  systemPrompt: 'You are a QA engineer who challenges assumptions...'
}))

// Open a proceeding (your incident/question/topic)
const proc = institution.openProceeding({
  title: 'Production outage — checkout 500 errors',
  framing: { primary_question: 'What is the root cause?' }
})

// Run 3 cycles — agents investigate, challenge, refine
for (let i = 0; i < 3; i++) {
  await institution.runCycle()
}

// Read the discourse and produce synthesis
const interventions = institution.listInterventions(proc.id)
institution.updateSynthesis({
  proceeding_id: proc.id,
  updated_by: 'system',
  primary_reading: 'Root cause identified as...',
  supporting_points: interventions.map(i => `[${i.agent_id}] ${i.summary}`),
  uncertainties: ['...']
})

const synthesis = institution.getSynthesis(proc.id)
```

Same LLM. Same data. But now you have structured disagreement and evolving understanding.

---

## 4. Agent Adapter Pattern

The framework doesn't care which LLM you use. An agent is just:

```javascript
{
  id: 'your-agent-name',
  async evaluate(context) {
    // What's in context:
    //   context.proceedings           — all active proceedings (array)
    //   context.recent_interventions  — interventions since your last run (array)
    //   context.syntheses             — latest synthesis per proceeding (object: { proc_id: synthesis })
    //   context.obligations           — open obligations assigned to you (array)
    //   context.governance_actions    — active stewardship actions (array)
    //   context.agenda                — your watchlist (array)

    // Example: find proceedings you haven't contributed to yet
    for (const proc of context.proceedings) {
      const mine = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id === 'your-agent-name'
      )
      if (mine.length > 0) continue  // already contributed

      // Check what others have said
      const others = context.recent_interventions.filter(
        i => i.proceeding_id === proc.id && i.agent_id !== 'your-agent-name'
      )
      // ... decide whether to interpret, challenge, or introduce evidence
    }

    return {
      interventions: [{ proceeding_id, type, summary, content, grounds }],
      obligations: []
    }
  }
}
```

### Using the built-in adapter

The adapter handles prompt building, API calls, and response parsing:

```javascript
import { createLLMAgent } from './infra/adapters/index.js'

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: 'http://127.0.0.1:8000/v1',   // vLLM
  model: 'local-vllm',
  systemPrompt: 'You are an analyst who...'
})
```

Works with any OpenAI-compatible endpoint: **OpenAI, Anthropic (via proxy), vLLM, Ollama, LiteLLM, Azure OpenAI**.

### Writing your own adapter

If you have a custom LLM client, wrap it yourself:

```javascript
const agent = {
  id: 'my-agent',
  async evaluate(context) {
    // Use YOUR existing LLM client
    const prompt = buildMyPrompt(context.proceedings, context.recent_interventions)
    const response = await myLLMClient.complete(prompt)

    // Parse into interventions
    return {
      interventions: [{
        proceeding_id: context.proceedings[0].id,
        type: 'interpret',
        summary: extractSummary(response),
        content: response,
        grounds: { evidence_refs: ['my_data_source'] }
      }],
      obligations: []
    }
  }
}
```

The framework doesn't know or care how you called the LLM.

---

## 5. Input Mapping

Turn your data into a **proceeding**:

| Your data | Maps to |
|-----------|---------|
| Bug report | `openProceeding({ title: 'BUG-123: ...', framing: { primary_question: '...' } })` |
| Incident alert | `ingestSignal({ type: 'alert', ... })` then `openProceeding(...)` |
| Research paper | `ingestSignal({ type: 'publication', ... })` |
| Customer complaint | `ingestSignal({ type: 'report', ... })` |
| Architecture proposal | `openProceeding({ title: '...', framing: { posture: 'evaluation' } })` |

The **signal** is raw input. The **proceeding** is the question you want investigated. Agents read both.

You can also pass data directly in the agent's `systemPrompt`:

```javascript
createLLMAgent({
  id: 'analyst',
  baseUrl: '...',
  model: '...',
  systemPrompt: `You are investigating this bug:
${JSON.stringify(bugReport, null, 2)}

Analyze the root cause...`
})
```

---

## 6. Running Cycles

### On demand (most common)

Run a fixed number of cycles when something needs investigation:

```javascript
for (let i = 0; i < 3; i++) {
  await institution.runCycle()
}
```

### In a loop (continuous monitoring)

Run on a schedule for ongoing topics:

```javascript
setInterval(async () => {
  await institution.runCycle()
}, 30 * 60 * 1000)  // every 30 minutes
```

### How many cycles?

- **1 cycle**: initial perspectives (similar to chat, but multi-agent)
- **2-3 cycles**: agents respond to each other — challenges and refinement emerge
- **4+ cycles**: convergence — agents stop posting when evidence is settled

Most investigations converge in 3-4 cycles.

---

## 7. Reading Outputs

### Synthesis — the institutional reading

Synthesis is an explicit step — it represents the institution's considered reading, not an automatic summary. In the examples, we call `updateSynthesis()` manually for clarity.

In production, you'd typically either:
- have a dedicated **synthesizer agent** that calls `updateSynthesis()` after each cycle
- call it from your application code after reviewing the interventions
- run it on a schedule (e.g., after every N cycles)

```javascript
const syn = institution.getSynthesis(proc.id)

syn.primary_reading      // what we currently believe
syn.supporting_points    // evidence from agents
syn.uncertainties        // what we still don't know
syn.preserved_dissent    // minority views
syn.version              // how many times this evolved
```

### Interventions — the full discourse

```javascript
const interventions = institution.listInterventions(proc.id)

for (const int of interventions) {
  console.log(`[${int.agent_id}] ${int.type}: ${int.summary}`)
  // type is one of: interpret, challenge, introduce_evidence, agreement, revision, ...
}
```

### Discourse health

```javascript
const health = institution.getHealth()

health.discourse_ratio    // 0-1, higher = more engagement
health.discourse_health   // 'healthy', 'weak', 'very_weak'
```

---

## 8. 20-Line Working Template

Copy-paste this. Change the `baseUrl`, `model`, and `systemPrompt`. Run it.

```javascript
import { createStore, createInstitution } from './infra/index.js'
import { createLLMAgent } from './infra/adapters/index.js'
import fs from 'fs'; import os from 'os'; import path from 'path'

const store = createStore(fs.mkdtempSync(path.join(os.tmpdir(), 'ai-discourse-')))
const inst = createInstitution({ store })

inst.registerAgent(createLLMAgent({ id: 'agent-a', baseUrl: 'http://127.0.0.1:8000/v1', model: 'local-vllm', systemPrompt: 'You analyze problems technically.' }))
inst.registerAgent(createLLMAgent({ id: 'agent-b', baseUrl: 'http://127.0.0.1:8000/v1', model: 'local-vllm', systemPrompt: 'You challenge assumptions and check evidence.' }))

async function investigate(question) {
  const proc = inst.openProceeding({ title: question, framing: { primary_question: question } })
  for (let i = 0; i < 3; i++) await inst.runCycle()
  const ints = inst.listInterventions(proc.id)
  inst.updateSynthesis({ proceeding_id: proc.id, updated_by: 'system', primary_reading: `${ints.length} interventions filed.`, supporting_points: ints.map(i => `[${i.agent_id}] ${i.type}: ${i.summary}`) })
  return { interventions: ints, synthesis: inst.getSynthesis(proc.id) }
}

investigate('Why are checkout requests failing for 12% of users?').then(r => {
  console.log(`Interventions: ${r.interventions.length}`)
  console.log(`Synthesis: ${r.synthesis.primary_reading}`)
}).catch(console.error)
```

That's it. Two agents, three cycles, structured reasoning. Swap the `baseUrl` and `model` for your provider.

---

## 9. When NOT to Use This Framework

This framework adds value when understanding needs to evolve. It adds overhead when it doesn't.

**Don't use it for:**

- **Quick factual lookups** — "What's the capital of France?" Chat is faster.
- **Single-step tasks** — "Summarize this document." One LLM call is enough.
- **Workflow automation** — "Extract data, transform, load." Use a pipeline tool.
- **Real-time responses** — Each cycle takes seconds to minutes. Not suitable for chat UIs or request/response APIs.

**Use it when:**

- Multiple perspectives would improve the answer
- The first hypothesis is likely incomplete
- Disagreement between interpretations is valuable
- You need to track how understanding changed over time
- A single LLM call gives you a plausible answer but not a *reliable* one
