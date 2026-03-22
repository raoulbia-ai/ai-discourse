# AI Discourse Infrastructure

An early-stage framework for AI systems that reason over time instead of answering once.

Chat gives answers. This system investigates.

> **Status:** Experimental. Working, tested, and usable — but not production-hardened. Feedback welcome.

---

## Quick Start

```bash
git clone https://github.com/raoulbia-ai/ai-discourse.git
cd ai-discourse
npm install
node examples/quickstart.js
```

```
=== AI Discourse Infrastructure — Quickstart ===
Proceeding: Sample Inquiry
Cycle: 1 | Agents: 1 | Interventions: 1
Synthesis (v1): The analyst identified this as worthy of examination.
```

This confirms the framework works. To see real multi-agent reasoning with an LLM, run:

```bash
node examples/llm-incident-reasoning.js
```

---

## How This Is Different

| | Chat AI | This Framework |
|---|---------|---------------|
| Answers | Once | Evolves over multiple cycles |
| Perspectives | One | Multiple agents, different lenses |
| Disagreement | Not possible | Structured challenges with evidence |
| Memory | Stateless | Persistent proceedings with history |
| Output | First response = final | Versioned synthesis with uncertainty |

---

## What Happens When You Run This

1. Agents analyze the problem from different perspectives
2. They challenge each other's hypotheses with evidence
3. New interpretations emerge from the disagreement
4. The system updates its institutional understanding (synthesis)

This repeats across cycles. Understanding evolves — it doesn't just appear.

The framework includes persistent institutional memory: it retains the state of proceedings, interventions, syntheses, and precedents so reasoning can continue across cycles instead of restarting each time. See [what "memory" means in this framework](docs/concepts/memory.md).

---

## Examples

| Example | Agents | What it demonstrates | Requires LLM? |
|---------|--------|---------------------|---------------|
| `quickstart.js` | 1 | Smoke test — confirms framework runs | No |
| `bug-triage.js` | 3 | Agents disagree on root cause of a bug | No |
| `research-note.js` | 2 | Methodologist challenges domain expert on evidence quality | No |
| `incident-triage.js` | 2 | Two perspectives on a production outage | No |
| `book-review.js` | 3 | Literary critic, historian, and reader advocate deliberate | No |
| `llm-research-note.js` | 2 | Real LLM agents compare two research papers | Yes |
| **`llm-incident-reasoning.js`** | **3** | **Real LLM agents investigate an incident over 4 cycles — the best demo of what this framework does** | **Yes** |

**Start here:** Run `quickstart.js` to verify setup, then `llm-incident-reasoning.js` to see real multi-agent reasoning.

LLM examples need an OpenAI-compatible endpoint (vLLM, Ollama, OpenAI).

---

## LLM Integration

Your existing LLM call goes here:

```javascript
import { createLLMAgent } from './adapters/index.js'

const agent = createLLMAgent({
  id: 'analyst',
  baseUrl: 'http://127.0.0.1:8000/v1',  // vLLM, Ollama, OpenAI, etc.
  model: 'local-vllm',
  systemPrompt: 'You are an analyst who...'
})

institution.registerAgent(agent)
```

The framework doesn't touch your LLM. Your LLM plugs into the agent, not into the framework.

See the [full integration guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) for before/after examples and a 20-line working template.

---

## How It Works

```
store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis
```

```javascript
import { createStore, createInstitution } from './index.js'

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

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [Integration Guide](docs/integration/how-to-plug-into-your-existing-ai-stack.md) | Plug this into your existing AI stack |
| [Demo Narrative](docs/demo/incident-reasoning-demo-narrative.md) | Why this is different from chat — with real LLM output |
| [Demo Script](docs/demo/incident-reasoning-demo-script.md) | Live walkthrough script |
| [Memory Model](docs/concepts/memory.md) | What "memory" means in this framework |

## Tests

```bash
npm test    # 147 tests
```

---

## What This Is Not

- Not a chatbot framework
- Not a workflow engine
- Not a task automation system
- Not AGI

It is a structured reasoning system for problems where understanding evolves over time.
