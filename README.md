# AI Discourse Infrastructure

Open infrastructure for persistent machine deliberation.

AI agents that **keep thinking over time**, not just answer once. Multiple perspectives, structured disagreement, evolving synthesis.

## Quick Start

```bash
cd infra
npm install
node examples/quickstart.js
```

Output:

```
Proceeding: Sample Inquiry
Cycle: 1 | Agents: 1 | Interventions: 1
Synthesis (v1): The analyst identified this as worthy of examination.
```

## How It Works

```
store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis
```

```javascript
import { createStore, createInstitution } from './infra/index.js'

const store = createStore('./data')
const institution = createInstitution({ store })

institution.registerAgent({
  id: 'analyst',
  async evaluate(context) {
    return {
      interventions: [{
        proceeding_id: context.proceedings[0].id,
        type: 'interpret',
        summary: 'Initial assessment',
        content: 'This warrants further examination.',
        grounds: { evidence_refs: ['review_v1'] }
      }],
      obligations: []
    }
  }
})

const proc = institution.openProceeding({ title: 'Investigate X' })
await institution.runCycle()

institution.updateSynthesis({
  proceeding_id: proc.id,
  updated_by: 'system',
  primary_reading: 'The analyst flagged this for examination.'
})

const synthesis = institution.getSynthesis(proc.id)
```

## Examples

| Example | Agents | What it demonstrates |
|---------|--------|---------------------|
| `quickstart.js` | 1 | Minimal loop — **start here** |
| `book-review.js` | 3 | Literary deliberation with challenge |
| `bug-triage.js` | 3 | Software bug diagnosis |
| `research-note.js` | 2 | Paper comparison with challenge |
| `incident-triage.js` | 2 | Ops incident response |
| `llm-research-note.js` | 2 | LLM-powered paper comparison |
| `llm-incident-reasoning.js` | 3 | LLM-powered incident investigation |

Deterministic examples require no LLM. LLM examples require an OpenAI-compatible endpoint (vLLM, Ollama, OpenAI).

## LLM Integration

Plug in any OpenAI-compatible API:

```javascript
import { createLLMAgent } from './infra/adapters/index.js'

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: 'http://127.0.0.1:8000/v1',  // vLLM, Ollama, OpenAI, etc.
  model: 'local-vllm',
  systemPrompt: 'You are an analyst who...'
})

institution.registerAgent(agent)
```

See [docs/integration/how-to-plug-into-your-existing-ai-stack.md](../docs/integration/how-to-plug-into-your-existing-ai-stack.md) for the full integration guide.

## Why Not Just Chat?

Chat gives you one answer, once. This system gives you:

- **Multiple agents** with different perspectives
- **Multiple cycles** where agents respond to each other
- **Structured disagreement** (typed challenges with evidence)
- **Evolving synthesis** with preserved uncertainty

See [docs/demo/incident-reasoning-demo-narrative.md](../docs/demo/incident-reasoning-demo-narrative.md) for a concrete comparison.

## Documentation

| Doc | Purpose |
|-----|---------|
| [Integration Guide](../docs/integration/how-to-plug-into-your-existing-ai-stack.md) | How to plug this into your existing AI stack |
| [Demo Narrative](../docs/demo/incident-reasoning-demo-narrative.md) | Why this is different from chat — with real output |
| [Demo Script](../docs/demo/incident-reasoning-demo-script.md) | Live walkthrough script |
| [Public Surface](../docs/ai-discourse-framework/implementation/20260321_ai-discourse-infrastructure-public-framework-surface-v0.1.md) | Full public API reference |
| [Surface Classification](../docs/ai-discourse-framework/implementation/20260321_surface-classification.md) | What's core vs. extended vs. internal |

## Tests

```bash
npm test    # 147 tests
```

## What This Is Not

- Not a chatbot framework
- Not a workflow engine
- Not a task automation system

It is: **a structured multi-agent reasoning system for problems where understanding evolves over time.**
