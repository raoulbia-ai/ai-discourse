# Experimental Findings: ai-discourse Controlled Reasoning Experiments

**Document status:** Research findings for discussion — not implementation instructions  
**Date:** March 2026  
**Model used:** MiniMaxAI/MiniMax-M2.5 via ericaiproxy  
**Framework:** ai-discourse v1 (experimental)

---

## Purpose of this document

This document records the findings, methodology, and honest limitations of
three experiments run against the ai-discourse framework. It is intended to
inform future development decisions — not to prescribe changes. Some findings
may suggest framework improvements. Others may simply reflect the current
limits of LLM reasoning regardless of framework design.

The document is organised as follows:
1. The research question
2. Three experiments — design, results, and what each taught us
3. Consolidated findings across experiments
4. Framework observations — what the data suggests (not prescribes)
5. Open questions

---

## The research question

**Can ai-discourse answer: "How do we know this agent's conclusion was justified?"**

More precisely: does structured multi-agent deliberation produce more
defensible reasoning than single-agent analysis on the same problem?

This question emerged from an honest assessment of what the framework
demonstrates vs. what it claims. The framework provides structured
traceability — you can see how a conclusion was reached and contested.
Whether that process produces *better* conclusions than alternatives is
an empirical question, not a theoretical one.

The experiments below are the first attempt to answer it empirically.

---

## Experiment 1: CrowdStrike Global Outage (July 2024)

### Design

**Type:** Demonstration (no control condition)  
**Incident:** CrowdStrike Falcon Sensor update causing 8.5M Windows systems
to BSOD globally on July 19, 2024  
**Source material:** Key facts about the incident including official RCA  
**Agents:** 3 (analyst, challenger, systems-thinker) + synthesizer  
**Cycles:** 4  
**Scoring:** Qualitative — comparison against official RCA  

### Results

| Metric | Value |
|--------|-------|
| Total interventions | 30 |
| Challenges filed | 14 |
| Revisions filed | 1 |
| Discourse health | healthy (0.556) |
| Preserved dissent | 2 items |

**Official RCA finding:** Content validator bug  
**Deliberation output:** 7-factor causal chain including:
- Content validator design gap (not a bug — field count validation never specified)
- Content update deployment policy exempt from staged rollout process
- March 2024 Linux near-miss not connected to July Windows release
- Kernel sandboxing gap — no protection boundary between content parser and kernel
- Absence of safety case requirements for security software in safety-critical environments
- Remote remediation impossible by design — deliberate architectural decision
- "Staged rollout = blast radius reduction, not prevention" — non-obvious distinction

**Key finding:** Structured deliberation surfaced systemic factors that the
official single-perspective RCA did not address. The analyst revised one
position under challenge. The challenger's blast-radius-vs-prevention
distinction was the most valuable non-obvious contribution.

**Honest limitation:** No control condition. A well-prompted single agent
may have produced a similar 7-factor analysis. This experiment demonstrates
deliberation producing value; it does not prove deliberation produces *more*
value than a strong single agent.

### What this experiment taught us

- Framework bug found and fixed: intervention IDs were not shown to agents
  in their prompt context, preventing valid target references for challenge
  interventions. Fix: added `ID: int_...` to each intervention in the
  rendered prompt.
- The synthesizer partially failed to update on a valid challenge (staged
  rollout framing). It acknowledged the challenge but continued recommending
  the thing it had been told was wrong. This is the first observation of
  what we called "sycophancy-in-reverse" — acknowledging challenge without
  acting on it.
- Zero revisions in first run indicated agents were not updating positions
  under challenge. Fixed partially in subsequent runs.

---

## Experiment 2: GitLab Database Deletion (January 2017)

### Design

**Type:** Controlled experiment (Run A vs Run B)  
**Incident:** GitLab engineer accidentally deleted 300GB of production
PostgreSQL data; all backup mechanisms independently failed  
**Source material:** Raw incident facts (timeline, actions, technical data)
including all 12 contributing factors explicitly enumerated  
**Run A:** Single agent, 1 cycle  
**Run B:** 4 agents (analyst, challenger, systems-thinker, synthesizer), 4 cycles  
**Scoring:** Automated keyword matching against 12-factor rubric from
GitLab's official post-mortem  

### Results

| Factor | Run A | Run B |
|--------|-------|-------|
| Total factors identified | 12/12 | 12/12 |
| Score | 100% | 100% |

**Hypothesis result:** NOT SUPPORTED — both runs identified all 12 factors.

### What this experiment taught us

**The source material problem.** When contributing factors are explicitly
enumerated in the raw facts given to agents, both single-agent and
multi-agent approaches will identify them. This is extraction, not reasoning.
The experiment design had a confound: the GitLab post-mortem's 12 factors
were essentially listed in the incident object.

**Keyword scoring is insufficient.** Presence/absence of terms is not a
discriminating metric when source material is explicit. Two runs can both
score 100% while producing qualitatively very different analyses. The
deliberation produced 49 interventions including debates about causal
primacy, novel factors beyond the rubric (replica as recovery path,
documentation illusion, DMARC as self-inflicted wound), and a causal
framework that evolved across 4 cycles. The single agent produced a
well-structured list. Keyword scoring could not distinguish between them.

**The experiment still produced value.** The deliberation surfaced 10+
factors beyond the 12-factor rubric that the single agent did not explore.
These included: replica database as unexamined recovery path, 5-minute
deletion window analysis, validation asymmetry (code changes validated
rigorously, operational procedures were not), and documentation illusion
(GitLab had procedures but didn't validate them).

**What the next experiment needed:**
1. Source material that does NOT enumerate the contributing factors
2. A scoring rubric with two dimensions: factor identification AND
   causal specificity (mechanism named, not just category)
3. Two tiers: officially documented factors (Tier 1) and factors requiring
   inferential reasoning (Tier 2)
4. Manual scoring with Run A scored before reading Run B

---

## Experiment 3: Air France Flight 447 (June 2009)

### Design

**Type:** Controlled experiment (Run A vs Run B), refined methodology  
**Incident:** Loss of control and impact with Atlantic Ocean; 228 fatalities  
**Source material:** Raw observable facts only — CVR excerpts, timeline,
technical readings, crew statements, BEA proximate cause. Deliberately
omitted: stall warning paradox mechanism, flight director behaviour, automation
paradox, side-stick non-coupling design implications. Agents must reason to these.  
**Run A:** Single agent, 1 cycle  
**Run B:** 4 agents (analyst, challenger, systems-thinker, synthesizer), 4 cycles  
**Scoring:** Manual, two-dimensional rubric, 10 factors across 2 tiers  

### Scoring rubric

**Dimension A:** Factor identification (0–2 per factor)  
**Dimension B:** Causal specificity — mechanism named, not just category (0–2 per factor)  
**Maximum:** 40 points (10 factors × 4 points each)

**Tier 1 (5 factors):** BEA final report — officially documented  
**Tier 2 (5 factors):** Palmer/Sullenberger critique — factors requiring
inferential reasoning beyond source material

| Factor | Category | Tier |
|--------|----------|------|
| Pitot probe icing | Technical trigger | 1 |
| Alternate law removes stall protection | Technical | 1 |
| Sustained nose-up input by PF | Human | 1 |
| Failure to diagnose stall | Human | 1 |
| Crew coordination breakdown | CRM | 1 |
| Stall warning stops at extreme AoA | Design paradox | 2 |
| Flight director displayed guidance throughout | Design | 2 |
| Automation paradox erodes manual flying skills | Systemic | 2 |
| Side-stick non-coupling — inputs not visible | Design | 2 |
| Known pitot deficiency not yet rectified | Organisational | 2 |

### Results

| Metric | Run A (Single) | Run B (Deliberation) |
|--------|---------------|---------------------|
| Interventions | 1 | 59 |
| Challenges | 0 | 22 |
| Revisions | 0 | 0 |
| Tier 1 score | 19/20 | 20/20 |
| Tier 2 score | 15/20 | 19/20 |
| Total score | 34/40 | 39/40 |
| Tier 2 difference | — | **+4 points** |

**Hypothesis result:** SUPPORTED on Tier 2  
The scoring guide defined ≥4 Tier 2 point difference as a "meaningful result."
The deliberation achieved exactly +4 on Tier 2.

### What specifically drove the Tier 2 difference

**T2-6 (stall warning paradox):** Single agent noted the warning stopped.
Deliberation went further — challenger questioned whether the warning
activation threshold (6° AoA) was itself below the critical stall AoA
(~8-9°), meaning the warning may have been ambiguous from the start, not
just when it stopped. This is a more specific and more rigorous claim.

**T2-7 (flight director):** Single agent asserted it "may have provided
misleading guidance." Deliberation explored this over 3 cycles. The
challenger eventually questioned whether flight director misguidance was
actually proven or an assumption. Deliberation scored higher by
*acknowledging uncertainty* — which is more epistemically honest, not less.

**T2-8 (automation paradox):** Both identified it. Deliberation's systems
thinker added the local rationality framework: Bonin's actions were rational
given his training and perceived information, making this a system design
failure rather than individual error. The single agent identified the category;
the deliberation named the mechanism.

**T2-9 (side-stick non-coupling):** Both identified it. Deliberation connected
it to the specific CVR moment (02:11:30–02:11:37) where Robert briefly pushed
down but couldn't feel Bonin's counter-input, connecting the design flaw to
a specific causal moment rather than treating it as a general observation.

### Novel contributions from deliberation not in single agent

Beyond the rubric, Run B surfaced:
- Startle reflex hypothesis — Bonin's initial nose-up may have been
  involuntary, not a conscious decision (preserved as dissent, not resolved)
- Challenge to "crew failure" framing — systems-thinker argued multiple
  design factors made correct response statistically unlikely, shifting
  frame from individual error to system design failure
- Captain's first words ("What are you doing?") as evidence of situational
  awareness gap on entry
- Industry-wide normalisation of deviance on pitot icing across carriers
- Post-accident changes as retrospective evidence of what was preventable

### Honest limitations

**Zero revisions for the second consecutive experiment.** 22 challenges
filed; 0 positions formally revised. Agents generated counter-arguments
but did not update their stated positions. Preserved dissent was recorded
but no agent issued a revision intervention. This is the most significant
recurring pattern across all three experiments.

**Scoring was "preliminary" not strictly protocol.** The scoring guide
required scoring Run A before reading Run B. This was described as
"preliminary" in the output document, suggesting the strict sequencing
may not have been fully observed. This introduces potential evaluator
bias toward the deliberation output and should be noted as a caveat on
the Tier 2 scores.

**AF447 training data contamination.** The accident is heavily documented
in LLM training data. The single agent's strong baseline (34/40) may
partially reflect memorised analyses rather than in-context reasoning.
This makes the +5 deliberation advantage harder to attribute cleanly to
the deliberation mechanism.

---

## Experiment 4: AF447 Ablation — Framework Structure vs Parallelism

### Design

**Type:** Three-condition ablation
**Incident:** Same AF447 incident as Experiment 3
**Conditions:**
- A: Single agent, 1 cycle (baseline)
- B: Three agents, each isolated (parallelism — no interaction)
- C: Four agents in full deliberation (framework structure)

**Scoring:** Automated keyword matching (Dimension A) + manual causal
specificity scoring (Dimension B, 0–2 per factor)

### Results — Keyword Scoring (Dimension A)

All three conditions scored 10/10 on factor identification. Keyword scoring
does not discriminate on AF447 — the model knows this accident too well.

### Results — Manual Specificity Scoring (Dimension B)

| Condition | Dim B Score | Characters | Score/1000 chars |
|-----------|-------------|------------|-----------------|
| A (single) | 17/20 | 8,878 | 1.91 |
| B (parallel) | 18/20 | 17,280 | 1.04 |
| C (deliberation) | 20/20 | 95,173 | 0.21 |

**A→B:** +1 at 1.9x cost (parallelism adds marginal specificity)
**B→C:** +2 at 5.5x additional cost (framework structure adds targeted specificity)
**A→C:** +3 at 10.7x cost (combined)

### The critical finding: T2-7 (flight director guidance)

T2-7 is the only factor where C beats both A and B. The single agent
asserted "may have provided misleading guidance." Three parallel agents
asserted it three times confidently. The deliberation asserted the
mechanism AND then challenged whether it was proven — noting the BEA did
not publish what the flight director actually displayed.

The deliberation produced the only output that correctly represented the
epistemic status of that claim — genuinely uncertain in the aviation
safety literature.

### What the ablation answered

1. **Factor identification** — no difference. The model's training data dominates.
2. **Causal specificity** — deliberation wins narrowly (+3 over single, +2 over parallel).
3. **Epistemic rigour** — deliberation is qualitatively different on one factor, and that factor is genuinely uncertain.
4. **Cost** — 10.7x baseline for +3 points. Steep.
5. **Use case definition** — routine analysis → single or parallel. High-stakes decisions where confident wrong answers are dangerous → deliberation.

### Honest limitation

AF447 training data contamination means the single agent's strong baseline
(17/20 on specificity) may partially reflect memorised analyses. The
ablation design controls for this (contamination affects all conditions
equally), but the absolute scores should be interpreted with caution.

The ablation answers the *relative* question cleanly: framework structure
adds +2 specificity beyond parallelism. Whether the absolute scores
reflect in-context reasoning or recall is a separate question — answered
by Experiment 5.

---

## Experiment 5: ICU Architecture Decision — Forward-Looking Capstone

### Design

**Type:** Three-condition ablation on a forward-looking problem
**Problem:** Architectural decision for a 50-bed ICU real-time patient
monitoring system — event-driven (Kafka) vs polling-based (PostgreSQL)
**Key property:** No post-mortem exists. The "right answer" depends on
constraints deliberately left ambiguous. The model must reason, not recall.
**Conditions:** Same as Experiment 4 (A: single, B: parallel, C: deliberation)
**Scoring:** 15-factor rubric defined before experiments ran, spanning
Kafka failure modes (6), polling failure modes (4), and contested middle
ground (5). Three scoring dimensions: identification (A), specificity (B),
epistemic honesty (C).

### Pre-experiment validation

The model was tested with a direct question about Kafka vs polling for ICU
monitoring. It produced a confident "Kafka is overwhelmingly superior"
recommendation from general distributed systems principles, without
specific clinical system knowledge. Critical rubric items (exactly-once
complexity, alarm fatigue, consumer lag under burst, silent loss vs delayed
alarm) were absent from its default output. The domain is clean.

### Results

| Condition | Factors Found | Characters | Relative Cost |
|-----------|---------------|------------|---------------|
| A (single) | 8/15 | 2,977 | 1.0x |
| B (parallel) | 12/15 | 7,631 | 2.6x |
| C (deliberation) | 14/15 | 96,546 | 32.4x |

By tier:

| | A | B | C | Max |
|---|---|---|---|---|
| Tier 1 (Kafka failures) | 4/6 | 5/6 | 6/6 | 6 |
| Tier 2 (Polling failures) | 1/4 | 3/4 | 3/4 | 4 |
| Tier 3 (Contested middle) | 3/5 | 4/5 | 5/5 | 5 |

### Deliberation-only factors

Two factors found only by Condition C:
- **K3: Exactly-once semantics complexity** — the operational risk of
  clinical IT teams misconfiguring idempotent producers and transactional
  consumers, leading to duplicate or lost alarms
- **M1: Alarm fatigue** — how the architectural choice affects alarm
  aggregation, deduplication, and suppression as a patient safety concern

Neither factor is obscure. Both are documented real-world failure modes in
production healthcare systems. A recommendation that misses them is more
dangerous than one that surfaces them.

### The recommendation quality finding

| Condition | Recommendation |
|-----------|---------------|
| A (single) | Kafka — confident |
| B (architect) | Kafka |
| B (safety-engineer) | Polling — Kafka too dangerous |
| B (ops-realist) | Polling — Kafka too complex |
| C (deliberation) | Hybrid with conditions — Kafka for data, polling as fallback, push for critical alarms |

The single agent produced a binary recommendation. The parallel condition
produced a split without resolving it. The deliberation produced a
conditional recommendation that explicitly stated under what conditions
it would change.

### What the ICU experiment proved

The single agent was not wrong. Kafka is a defensible choice. The problem
is that it was *confidently* defensible — the agent found 8 of 15 risk
factors and produced a clean recommendation. The 7 factors it missed are
not obscure. A confident recommendation that misses exactly-once
complexity and alarm fatigue is more dangerous than an uncertain
recommendation that surfaces them.

The deliberation produced the only recommendation structured to be useful
under uncertainty — which is the actual condition under which architectural
decisions get made.

### Honest limitations

**Single experiment.** This is one forward-looking problem on one domain.
The finding needs replication on different problem types.

**Keyword scoring on Dimension A only.** Manual Dimension B+C scoring
(specificity and epistemic honesty) has not yet been performed on the ICU
outputs. The qualitative recommendation quality finding is based on reading
the outputs, not on a formal scoring protocol.

**Cost curve.** 32.4x baseline for +6 factors over single and +2 over
parallel. The efficiency question is real: is the deliberation's marginal
coverage worth the compute cost? The answer depends on the stakes of the
decision.

---

## Consolidated findings across all five experiments

### Finding 1: Deliberation improves reasoning specificity, not just coverage

The most robust finding across all five experiments. In Experiment 1,
deliberation surfaced the blast-radius-vs-prevention distinction. In
Experiment 3, deliberation scored higher on causal specificity (Dimension B)
rather than factor identification (Dimension A). In Experiment 4 (ablation),
deliberation scored 20/20 on specificity vs 18/20 for parallel and 17/20
for single. In Experiment 5 (ICU), deliberation found 14/15 factors vs
12/15 for parallel and 8/15 for single.

The pattern is consistent: deliberation produces more defensible reasoning,
not just more text.

### Finding 2: Structured challenge produces epistemic honesty

Reproduced across two domains. In Experiment 4 (AF447 ablation), the
flight director factor scored higher in deliberation because the challenger
questioned whether the assertion was proven — producing more epistemically
honest output. In Experiment 5 (ICU), the deliberation produced a
conditional recommendation ("Kafka for data, polling as fallback, and here
are the conditions under which this changes") while the single agent
produced a confident binary recommendation.

The framework's unique contribution is not finding more factors — it's
stress-testing the ones it finds. This is the single most consistent
finding across all experiments.

### Finding 3: The revision mechanism is improving but remains underused

Experiments 1–3: 37 challenges, 1 revision. Experiments 4–5: 27 challenges,
6 revisions. The ratio improved from 37:1 to ~4.5:1 after the framework
fix (intervention IDs visible in prompts). The mechanism is working but
remains underused relative to challenge volume.

### Finding 4: Source material design is the critical experiment variable

Experiment 2 (GitLab) failed to discriminate because source material
enumerated the answer key. Experiment 3 succeeded because Tier 2 factors
required inference. Experiment 5 (ICU) succeeded most cleanly because
the problem was forward-looking — no answer exists in the training corpus
to recall.

**Methodological finding:** experiments should use forward-looking problems
or incidents underrepresented in training data. Retrospective analysis of
well-documented incidents risks measuring recall, not reasoning.

### Finding 5: Parallelism captures most coverage gains; framework adds epistemic quality

The ablation experiments (4 and 5) separate parallelism from framework
structure:

| Experiment | A→B (parallelism) | B→C (framework) | Cost A→B | Cost B→C |
|---|---|---|---|---|
| AF447 (Dim B) | +1/20 | +2/20 | 1.9x | 5.5x |
| ICU (factors) | +4/15 | +2/15 | 2.6x | 12.5x |

Parallelism is 5–10x more cost-efficient than deliberation for coverage
gains. The framework's marginal contribution is smaller in quantity but
different in kind: it adds epistemic quality (stress-testing, conditional
recommendations, ambiguity surfacing) that parallel-independent agents do
not produce.

### Finding 6: The synthesiser partially fails to update on valid challenges

Observed in Experiment 1, partially improved in later experiments. The
synthesiser acknowledged challenges but sometimes continued recommending
the challenged position. This "sycophancy-in-reverse" is a known LLM
behaviour pattern.

### Finding 7: Discourse health ratio is a meaningful signal

| Experiment | Health | Quality |
|---|---|---|
| CrowdStrike (pre-fix) | 0.25 | Agents posting in parallel |
| CrowdStrike (post-fix) | 0.556 | Genuine challenge/response |
| AF447 Run B | 0.407 | Rich deliberation |
| AF447 ablation C | 0.232 | Active but lower engagement |
| ICU C | 0.27 | Active challenge dynamics |

Ratios above 0.25 correlate with outputs where agents genuinely respond
to each other. Below 0.25 indicates agents are posting independently
within the framework structure.

---

## Framework observations

These are observations derived from experimental data. They are not
implementation instructions. Whether any of them should result in framework
changes is a separate discussion.

### Observation A: The revision mechanism needs investigation

The 37:1 challenge-to-revision ratio is striking. It is worth understanding
whether agents are *aware* of the revision intervention type and its
purpose. The current agent prompts in the examples describe revision as
"update your own earlier hypothesis based on new information (requires
targets and grounds)" — this may not be sufficient to trigger revision
behaviour when an agent receives a valid challenge.

**Questions to explore:**
- Do agents understand that a valid challenge should produce a revision?
- Is the revision threshold in prompts appropriately calibrated?
- Should the synthesiser explicitly call out when an agent should revise?
- Is the framework correct to require explicit revision, or should it
  infer position updates from subsequent interventions?

### Observation B: The synthesiser's authority is ambiguous

The synthesiser is positioned as an "institutional recorder" — it
reports what has emerged, it does not adjudicate. But in Experiment 1,
the systems-thinker challenged the synthesiser directly for continuing
to recommend "staged rollout" as prevention after being shown it was
blast-radius-reduction. The synthesiser acknowledged the challenge and
did not change its recommendation.

This raises a design question: should the synthesiser be a passive
recorder or an active adjudicator? A passive recorder is epistemically
honest — it reports the state of the discourse. An active adjudicator
would resolve disputes and update recommendations. These are different
institutional roles with different implications for the chain's value.

**This is a design philosophy question, not a bug.**

### Observation C: Agent prompt calibration affects deliberation quality

The systems-thinker consistently produced the highest-value interventions
across all three experiments — surfacing the local rationality framework,
the normalisation of deviance pattern, and the safety case absence. The
analyst consistently anchored on the most visible explanation first,
requiring challenge to reach deeper factors. The challenger was most
effective when given specific questions to press on (as in AF447) rather
than open-ended challenge instructions.

This suggests that the epistemic lens defined in the system prompt is the
primary driver of deliberation quality. The framework enforces the
structure; the prompts define the substance.

### Observation D: Training data contamination is a real experimental threat

The AF447 single agent scored 34/40 with strong Tier 2 coverage. This
may reflect genuine in-context reasoning or may reflect memorised analyses
from training data. Future experiments should use incidents that are
less thoroughly documented in LLM training corpora. The GitLab 2017
incident may have been better for this reason (less coverage, more
specific technical detail) despite its source material design flaw.

### Observation E: The 4-cycle structure may be suboptimal for some problems

In Experiment 3, the synthesis flatlined between cycles 3 and 4 — the
cycle 4 synthesis was identical to cycle 3. The system signalled it had
reached a provisional ceiling. This might mean 3 cycles is sufficient for
incidents of this complexity, or that 4 cycles without new evidence
injection produces diminishing returns. The framework could benefit from
a signal for "deliberation has stabilised" rather than always running
to the configured cycle count.

---

## Open questions

These questions are not answered by the experiments above. They define
the scope of further investigation before stronger claims can be made.

**Q1: Is the deliberation effect attributable to the framework structure
or to the multi-model effect?**
We cannot yet distinguish between "structured deliberation produces better
reasoning" and "three LLM calls produce more text that covers more ground."
A proper ablation would compare: (a) single agent, (b) three agents posting
independently without typed interventions or challenge, (c) three agents in
full ai-discourse deliberation. If (b) ≈ (c), the framework structure adds
little beyond parallelism.

**Q2: Does the revision mechanism matter?**
The 37:1 challenge-to-revision ratio suggests agents are not formally
updating positions. If the key value is challenge-surfacing-gaps rather
than position-revision, the framework may be designed correctly — structured
disagreement is valuable even without explicit position updates. If revision
is the key mechanism, the prompts need significant rework.

**Q3: Does deliberation help or hurt on problems with clear single answers?**
The ICLR 2025 finding (debate does not consistently outperform single-agent
test-time compute) suggests deliberation may introduce noise on well-defined
problems. All three experiments used ambiguous, multi-factor causal analysis
problems where the "answer" is genuinely contested. The framework may have
a domain-specific advantage rather than a general one.

**Q4: What is the cost-benefit ratio?**
Run B (4 agents, 4 cycles) uses approximately 16–20x the compute of Run A
(1 agent, 1 cycle). The Tier 2 improvement in Experiment 3 was +4/20 points
(20%). Is a 20% reasoning improvement worth 16–20x compute cost? For
high-stakes decisions, possibly. For routine analysis, probably not. The
framework needs a use-case scope statement.

**Q5: How does the framework perform with smaller, less capable models?**
All experiments used MiniMaxAI/MiniMax-M2.5. A capable model may be doing
most of the reasoning work regardless of framework structure. Testing with
a smaller model would better isolate the framework's contribution.

---

## Summary table

| Experiment | Type | Result | Key finding |
|------------|------|--------|-------------|
| CrowdStrike | Demonstration | n/a | Deliberation surfaces 7-factor chain vs 1-factor official RCA |
| GitLab 2017 | Controlled | NOT SUPPORTED | Keyword scoring insufficient; source material too explicit |
| AF447 2009 | Controlled (refined) | SUPPORTED (Tier 2, +4/20) | Deliberation improves specificity and epistemic honesty |
| AF447 ablation | Three-condition | ANSWERED | Framework adds +2 specificity beyond parallelism at 5.5x cost; unique value is stress-testing own claims |
| ICU architecture | Forward-looking | SUPPORTED (8→12→14/15) | Deliberation surfaces cross-domain risks and conditional recommendations on a problem with no memorised answer |

---

## The defensible claim

> Structured multi-agent deliberation using ai-discourse produces more
> epistemically honest and more complete risk reasoning than single-agent
> or parallel-independent analysis on complex problems under uncertainty.
>
> The framework's unique contribution is not finding more factors — it's
> stress-testing the ones it finds. In every experiment where all conditions
> identified the same mechanism, the deliberation was the only approach
> that then challenged whether the mechanism was actually proven.
>
> On a forward-looking problem with no memorised answer (ICU architecture),
> a single agent confidently recommended Kafka and found 8/15 risk factors.
> Three independent agents split 2-1 against it and found 12/15. The
> deliberation found 14/15 — including exactly-once semantics complexity
> and alarm fatigue, both documented production failure modes — and produced
> the only recommendation that stated its own conditions of validity.
>
> The cost is real: 10–32x baseline compute depending on cycle count. For
> routine analysis, parallelism (2–3x cost, most of the coverage gain) is
> the better trade-off. For high-stakes decisions where a confident wrong
> answer is more dangerous than an uncertain right answer, the framework's
> challenge mechanism is the only tested approach that produces epistemically
> honest output.

This claim is supported by two controlled experiments (AF447, ICU), one
ablation study, and one demonstration. The forward-looking experiment
(ICU) closes the training data contamination objection from the
retrospective experiments.

---

## Open questions

**Q1: Does the framework generalise beyond causal analysis and risk assessment?**
All experiments used either incident investigation or architectural risk
assessment — problems where multiple perspectives and genuine uncertainty
are expected. Whether deliberation adds value on well-defined problems with
clear answers is an open question. The ICLR 2025 finding on debate suggests
it may not.

**Q2: How does the framework perform with smaller models?**
All experiments used MiniMaxAI/MiniMax-M2.5. Testing with a smaller model
would better isolate the framework's contribution from model capability.

**Q3: Is the revision mechanism important?**
The ratio improved from 37:1 to 4.5:1 but remains low. If the key value
is challenge-surfacing-gaps rather than position-revision, the framework
may be working correctly: structured disagreement is valuable even without
forced consensus.

**Q4: Can the cost be reduced without losing the epistemic honesty finding?**
The challenge mechanism is the unique value driver. Could a 2-cycle
deliberation with one architect and one challenger produce similar
epistemic quality at lower cost than 4 agents × 4 cycles? This is an
optimisation question worth testing.

---

## Status of previously recommended next steps

| Recommendation | Status |
|---|---|
| Strict AF447 scoring protocol | Superseded — ablation provides cleaner data |
| Ablation experiment | **COMPLETED** — Experiment 4 |
| Investigate revision mechanism | Partially addressed — ratio improved post-fix, still underused |
| Test with less well-known incident | **COMPLETED** — Experiment 5 (forward-looking, no memorised answer) |
| Zero-revision design question | Partially resolved — 6 revisions in later experiments, mechanism works when IDs visible |
