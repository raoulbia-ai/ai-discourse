# Memory in AI Discourse

This framework provides persistent institutional memory for reasoning over time. It does not claim to solve general LLM memory.

---

## 1. Why Use the Word "Memory"

The system retains structured state across deliberation cycles and uses it in future reasoning. Agents can see what was said before, what was challenged, what was settled, and what remains uncertain. Prior proceedings can inform new ones through explicit precedent links.

That is memory — not in the human sense, but in the institutional sense. Courts remember precedent. Research labs remember prior findings. Incident teams remember what was tried. This framework does the same thing for AI reasoning.

---

## 2. What Kind of Memory This Is

This is not general-purpose recall. It is:

- **Institutional memory** — what the institution has examined, concluded, and left unresolved
- **Deliberative memory** — the record of structured reasoning: who said what, who challenged whom, what survived scrutiny
- **Persistent reasoning state** — the ability to resume an investigation instead of restarting it

Think of it as the memory of an investigation, not the memory of a person.

---

## 3. What Is Stored

| Record | What it remembers |
|--------|------------------|
| **Proceedings** | Matters under examination — their framing, status, and lifecycle |
| **Interventions** | Every typed reasoning act: interpretations, challenges, evidence, agreements, revisions |
| **Syntheses** | Versioned institutional readings — what the system currently believes, with uncertainties and dissent |
| **Obligations** | Unresolved investigative work — what still needs to be done |
| **Closure records** | How and why a proceeding was settled, including reopening conditions |
| **Precedent links** | Explicit connections between past and current proceedings |
| **Cycle snapshots** | What happened each cycle — signals ingested, interventions submitted, obligations resolved |

---

## 4. How Memory Affects Future Reasoning

Memory is not passive storage. It shapes what happens next:

- **A proceeding resumes instead of restarting.** Agents see the current synthesis and prior interventions when they evaluate — they don't start from scratch each cycle.
- **Current synthesis carries understanding forward.** Each cycle's synthesis becomes the starting point for the next cycle's reasoning.
- **Prior interventions remain inspectable.** An agent in cycle 4 can see what was challenged in cycle 2 and decide whether the challenge was addressed.
- **Past proceedings can inform new ones.** Precedent links connect related investigations — a new incident can reference how a similar one was diagnosed.
- **Preserved dissent can matter later.** A minority view that was preserved in synthesis may become the majority view when new evidence arrives in a future cycle.

---

## 5. What This Is NOT

This section matters. Be clear about limits:

- **Not a general solution to the LLM memory problem.** LLMs are stateless by design. This framework adds structured persistence around them, but it does not give an LLM itself long-term memory.
- **Not human-like long-term memory.** There is no associative recall, no emotional weighting, no subconscious processing. Memory here is explicit, structured, and inspectable.
- **Not automatic semantic recall of everything.** The system does not "remember" in the way a vector database retrieves semantically similar past content. Memory is organized around proceedings, not free-text similarity.
- **Not a replacement for retrieval systems.** If you need to search unstructured documents, use RAG. This framework remembers the structure of deliberation, not arbitrary content.
- **Not a magical persistent brain.** Memory accumulates. It needs governance. Without curation, it becomes noise.

---

## 6. Memory Layers

The framework's memory operates at three levels:

### Working Memory

What the system is actively reasoning about right now.

- Active proceedings and their current status
- Current synthesis (latest version) for each proceeding
- Open obligations assigned to agents
- Agent watchlists (agenda)
- Recent interventions visible to agents in the current cycle

### Historical Memory

The full record of what happened, available for inspection.

- Complete intervention history per proceeding
- All prior synthesis versions (not just the latest)
- Cycle snapshots recording what happened each cycle
- Resolved obligations and their outcomes
- Closure records for settled proceedings

### Institutional Memory

Durable knowledge that outlives individual proceedings.

- Archived proceedings and their final syntheses
- Precedent links connecting past and present investigations
- Preserved dissent from settled proceedings — minority views worth retaining
- Governance rules that evolved from prior experience

---

## 7. How Memory Stays Manageable

Memory that grows without discipline becomes noise. The framework provides structural mechanisms to keep it manageable:

- **Proceedings close.** Not everything stays active. Proceedings move through a lifecycle — from opened to settled to archived. Settled proceedings leave behind a closure record and final synthesis, not an ever-growing pile of raw interventions.
- **Synthesis is preferred over raw history.** Agents read the current synthesis, not every prior intervention. Synthesis compresses understanding. The raw history is available for inspection but is not the primary interface.
- **Precedent is explicit, not everything.** Not every past proceeding automatically informs every future one. Precedent links must be created deliberately — they represent a judgment that one investigation is relevant to another.
- **Records can be archived.** Proceedings, obligations, and governance actions have lifecycle states that move them out of active consideration.
- **Retention should be governed.** The framework provides the mechanisms. The application decides the policy — how long raw intervention logs are retained, when to archive, what precedent links to create.

The goal is not to remember everything forever. It is to remember the right things in a structured way.

---

## 8. Risks and Tradeoffs

Honesty about limitations:

- **Raw history grows.** Intervention logs are append-only. Over many cycles, they accumulate. Applications should implement retention policies appropriate to their domain.
- **Bad retention creates noise.** If everything is kept at equal importance indefinitely, the signal-to-noise ratio degrades. Synthesis and archiving are the countermeasures.
- **Not every intervention deserves equal weight forever.** A speculative hypothesis that was immediately challenged and abandoned should not carry the same weight as a well-supported interpretation that survived multiple cycles. The framework stores both equally — synthesis is where the weighting happens.
- **Memory quality depends on synthesis and curation.** If synthesis is never updated, or if proceedings are never closed, memory becomes a pile of records rather than institutional knowledge. The framework provides the structure; the application must use it.

---

## 9. Why This Matters

Chat AI is stateless. Every conversation starts fresh. Ask it the same question tomorrow and it has no memory of yesterday's answer, the evidence you provided, or the hypothesis it rejected.

This framework retains the state of proceedings, interventions, syntheses, and precedents. Reasoning can continue across cycles instead of restarting each time. An investigation that ran for 4 cycles yesterday can resume today with its full discourse history, current synthesis, and open obligations intact.

That is the core value: **persistent reasoning, not persistent chat.**

The system doesn't remember everything about everything. It remembers the structure of deliberation — what was examined, what was concluded, what was challenged, what remains uncertain, and what connects to what came before.
