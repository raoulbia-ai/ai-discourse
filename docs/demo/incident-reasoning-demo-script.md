# Incident Reasoning Demo — Walkthrough Script

> For live demo or screen recording. ~10 minutes.

---

## 1. Opening Setup (1 min)

**Say:**

> "I want to show you something different from chat-based AI. We're going to watch three AI agents investigate a production incident — not by chatting, but by submitting structured reasoning into an institutional process. They'll disagree with each other, introduce evidence, and the system's understanding will evolve over four cycles."

**Show** the incident definition briefly (either in the code or on a slide):

> - Checkout API returning 500 errors for 12% of users
> - Only affects saved payment methods
> - Payment provider rotated encryption keys at 09:00
> - No recent deployments

**Say:**

> "Three agents will investigate this: a backend engineer, a QA engineer, and a product manager. Each has a different lens. None of them can see the full picture alone."

---

## 2. Baseline Chat Comparison (1 min)

**Say:**

> "First, let's see what happens if you just ask a chatbot."

Open ChatGPT or any chat interface. Paste:

> "Our checkout API is returning 500 errors for 12% of users. Only users with saved payment methods are affected. The payment provider rotated their encryption key at 09:00. What's causing this?"

**Point out:**

> "You get one answer, immediately. It's probably right at surface level — 'the key rotation broke decryption.' But there's no follow-up. No investigation. No competing hypotheses. If you ask again, you get the same answer rephrased. It answered. It's done thinking."

---

## 3. Run the Example (1 min)

**Say:**

> "Now let's run the same scenario through the AI Discourse Infrastructure."

Run:

```bash
cd infra
node examples/llm-incident-reasoning.js
```

**Say while it's running:**

> "This takes a few minutes because we're running four deliberation cycles. Each cycle, all three agents evaluate the current state — including what the other agents have said — and submit typed interventions: interpretations, challenges, evidence."

---

## 4. Cycle 1 — Point Out (2 min)

When cycle 1 output appears:

**Say:**

> "Look at cycle 1. The backend engineer posts a hypothesis — 'payment provider key rotation broke decryption.' That's the same answer chat gave us."

**Then point to the QA engineer's output:**

> "But the QA engineer doesn't just agree. They introduce log evidence — 11,000 decryption exceptions — and then challenge the backend engineer's hypothesis. They're saying: 'the error trace points to our *internal* key management system, not the provider. The provider rotation might be a trigger, not the cause.'"

**Say:**

> "We're one cycle in and we already have two competing hypotheses. Chat gave us one."

---

## 5. Cycle 2 — Point Out (2 min)

When cycle 2 output appears:

**Point out the new evidence:**

> "The QA engineer found something new — a KMS registry dump showing that our internal key version KV42 was *disabled*. Not by the provider, but by an internal sync script that ran after the provider's rotation."

**Point out the second challenge:**

> "And they challenge the backend engineer again — 'your JWKS cache theory doesn't hold. The exception comes from our internal KMS, not the provider's JWKS endpoint.'"

**Say:**

> "The understanding has shifted. The root cause isn't 'provider rotated keys.' It's 'provider rotation triggered our internal sync script to disable the wrong key version.' That's a fundamentally different diagnosis — and it emerged from structured disagreement, not from asking a better prompt."

---

## 6. Cycles 3–4 — Point Out (1 min)

**Say:**

> "In cycles 3 and 4, the agents slow down. The evidence has converged. There's less to add. But notice — the synthesis keeps updating. It's not just accumulating information. It's *revising the institutional reading* based on what was challenged and what survived."

---

## 7. Final Synthesis — Highlight (2 min)

Scroll to the final synthesis output.

**Point out the structure:**

> "The final synthesis has four parts. First, the primary reading — what the institution currently believes. Second, supporting points — evidence from each agent. Third, uncertainties — what we still don't know. And fourth, preserved dissent — minority views that haven't been resolved."

**Say:**

> "This is not a summary. It's a versioned institutional assessment. It changed four times across four cycles. Chat gives you version 1 and stops."

**Point out the intervention type counts:**

> "Seven interventions total: three interpretations, two challenges, two pieces of evidence. The challenges are what made the difference — they're what moved the system from the obvious answer to the correct one."

---

## 8. Closing (1 min)

**Say:**

> "What you just saw is not chat. It's not an agent workflow. It's structured deliberation — multiple AI agents reasoning over time, disagreeing with evidence, and producing an evolving understanding."

> "Chat answers. This system *investigates*."

> "For problems that have instant answers, chat is fine. For problems where understanding evolves — incidents, research, strategic decisions — you need something that keeps thinking."

**If asked "how does it work":**

> "Seven lines of setup code. You create an institution, register agents, open a proceeding, and run cycles. The framework handles the rest — typed interventions, governance rules, versioned synthesis. The agents plug in via a simple interface. They can be deterministic or LLM-powered."

**If asked "what's different from CrewAI / AutoGen / LangGraph":**

> "Those are task execution frameworks — they optimize for completing a workflow. This is an institutional reasoning system — it optimizes for evolving understanding. The core unit is a *proceeding*, not a task. The output is *synthesis*, not a deliverable. And disagreement is a feature, not a failure mode."
