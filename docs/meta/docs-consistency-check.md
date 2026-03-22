# Documentation Consistency Check

A repeatable manual check to ensure all public-facing docs describe the same system, terminology, and behavior. Run this after any doc change.

**Docs in scope:**
- `README.md`
- `docs/demo/incident-reasoning-demo-narrative.md`
- `docs/demo/incident-reasoning-demo-script.md`
- `docs/integration/how-to-plug-into-your-existing-ai-stack.md`
- `docs/concepts/memory.md`

---

## 1. Core Concepts Alignment

Verify these terms are used consistently across all docs — same names, same meaning, no conflicting definitions.

| Term | Correct usage |
|------|--------------|
| Proceeding | A matter under collective examination (not "task", "ticket", "thread") |
| Intervention | A typed procedural act (not "message", "response", "output") |
| Synthesis | The institution's versioned reading (not "summary", "answer", "result") |
| Cycle | One round of agent evaluation (not "turn", "step", "iteration") |
| Agent | Implements `evaluate(context)` returning `{ interventions, obligations }` |
| Memory | Persistent institutional memory (not "LLM memory", "context window", "recall") |

- [ ] No doc uses conflicting terms for the same concept
- [ ] No doc introduces synonyms that create ambiguity

---

## 2. Canonical Loop Consistency

All docs must describe the same minimal flow:

```
store → institution → registerAgent → openProceeding → runCycle → updateSynthesis → getSynthesis
```

Check each doc:

- [ ] README shows this loop
- [ ] Integration guide shows this loop
- [ ] Quickstart example follows this loop
- [ ] Memory doc references this flow (indirectly)
- [ ] No doc shows an alternative or outdated loop

---

## 3. Positioning Consistency

All docs must communicate the same contrast:

| Chat AI | This Framework |
|---------|---------------|
| One-shot | Multi-cycle |
| Stateless | Stateful |
| No disagreement | Structured challenges |
| First answer = final | Evolving synthesis |

Check:

- [ ] README states this contrast
- [ ] Demo narrative shows this contrast with evidence
- [ ] Integration doc frames the before/after this way
- [ ] No doc drifts into "task automation", "workflow engine", or "chat replacement"

---

## 4. Memory Claim Consistency

All references to memory must align with:

> "persistent institutional memory for reasoning"

Check:

- [ ] No doc claims the framework "solves LLM memory"
- [ ] No anthropomorphic language ("the system remembers", "the system knows")
- [ ] All memory references match the framing in `docs/concepts/memory.md`
- [ ] README memory sentence is consistent with the memory doc

---

## 5. Example Consistency

Verify that code examples across docs reflect the current API:

- [ ] Method names match (`runCycle`, `updateSynthesis`, `listInterventions`, etc.)
- [ ] Import style is consistent (ESM `import` in docs, CommonJS `require` in runnable examples)
- [ ] `createInstitution({ store })` — single-object form used
- [ ] `runCycle()` return shape matches documented `{ cycle_id, agents, interventions_submitted, ... }`
- [ ] No outdated snippets (e.g., `runCycle(institution)`, `institution.engines.*`)

---

## 6. Integration Story Consistency

README and integration doc must agree on:

- [ ] Where the LLM goes (inside `evaluate(context)`, not in the framework)
- [ ] How input becomes a proceeding (`openProceeding` + optional `ingestSignal`)
- [ ] How cycles run (`institution.runCycle()`)
- [ ] What output is (synthesis + interventions via public API)
- [ ] "Your existing LLM call goes here" framing is present

---

## 7. Terminology Drift Check

Scan all docs for:

- [ ] No legacy WorldLens terms (`topic` instead of `proceeding`, `comm` instead of `intervention`)
- [ ] No internal engine names exposed (`ProceedingEngine`, `InterventionEngine`, etc.)
- [ ] No references to `institution.engines` or `institution.store`
- [ ] Consistent use of `proceeding` (not `case`, `matter`, `inquiry` interchangeably)

---

## 8. "What It Is Not" Consistency

All docs that make positioning claims should align on:

- [ ] Not a chatbot framework
- [ ] Not a workflow engine
- [ ] Not task automation
- [ ] Not AGI
- [ ] Not a general LLM memory solution

Check: README, demo narrative, memory doc. No doc should contradict another.

---

## 9. First-Time User Path

Simulate a new user reading docs in order:

1. **README** → understand what it is, run quickstart
2. **Demo narrative** → see why it's different from chat
3. **Integration doc** → understand how to plug in their LLM
4. **Memory doc** → understand persistence model

Check:

- [ ] No gaps — each doc leads naturally to the next
- [ ] No contradictions between docs
- [ ] No missing steps (e.g., `npm install` mentioned before `node examples/...`)
- [ ] Links between docs are not broken

---

## 10. Output

After running this check, record:

```
Date: YYYY-MM-DD
Result: PASS / NEEDS UPDATE
Issues found:
  - (list any inconsistencies)
Fixes applied:
  - (list any corrections made)
```

---

## When to Run

- After any doc edit
- Before tagging a release
- After adding a new public-facing doc
- After changing the public API surface
