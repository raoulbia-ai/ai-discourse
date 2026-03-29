# ai-discourse: Controlled Reasoning Experiments

This document is the methodological record for a series of controlled
experiments testing whether structured multi-agent deliberation produces
more defensible reasoning than single-agent analysis.

It accompanies:
- LinkedIn article: *I built AI agents that disagree with each other*
- Medium article: *ai-discourse: Structured Deliberation as an Alternative
  to Task Orchestration* [link when published]
- Framework: https://github.com/raoulbia-ai/ai-discourse

**Model used across all experiments:** MiniMaxAI/MiniMax-M2.5 via ericaiproxy
**Date range:** March 2026
**Status:** Experimental — findings should be treated as hypotheses to
validate further, not established results.

---

## Research question

Can ai-discourse answer: *"How do we know this agent's conclusion was
justified?"*

More precisely: does structured multi-agent deliberation — where agents
submit typed interventions, challenge each other's specific claims, and
produce versioned synthesis — produce more defensible reasoning than
single-agent analysis on the same problem?

---

## How to read this document

Five experiments are documented below. They are ordered chronologically
and each one informed the design of the next. Two failed to discriminate
and those failures are documented honestly — they taught us what a proper
test required. The final two experiments produced meaningful results.

For each experiment:
- **Design** — what was tested and why
- **Source material** — what agents received as input
- **Agents** — roles and configuration
- **Results** — scores and key outputs
- **What it taught** — the methodological lesson

---

## Experiment 1: CrowdStrike Global Outage (July 2024)

### Design

**Type:** Demonstration — no control condition
**Purpose:** Establish whether deliberation can surface systemic factors
that official single-perspective analysis misses
**Incident:** CrowdStrike Falcon Sensor content update causing 8.5 million
Windows systems to BSOD globally on July 19, 2024
**Script:** `examples/crowdstrike-experiment/llm-incident-crowdstrike.js`

### Source material

Key facts about the incident including the official RCA finding
("content validator bug"), the deployment timeline, the March 2024 Linux
near-miss, and the recovery requirements. Source material included both
the proximate cause and contextual facts — no deliberate withholding.

### Agents and configuration

| Agent | Role | Temperature |
|-------|------|-------------|
| `analyst` | Senior SRE — traces technical root cause and causal chain | 0.3 |
| `challenger` | Devil's Advocate — attacks assumptions, surfaces gaps | 0.5 |
| `systems-thinker` | Resilience researcher — surfaces systemic and organisational factors | 0.4 |
| `synthesizer` | Institutional recorder — versioned synthesis after each cycle | 0.2 |

**Cycles:** 4
**Total interventions:** 30

### Results

| Metric | Value |
|--------|-------|
| Challenges filed | 14 |
| Revisions filed | 1 |
| Discourse health ratio | 0.556 (healthy) |
| Preserved dissent | 2 items |

**Official RCA finding:** Content validator bug

**Deliberation output — 7-factor causal chain:**
1. Content validator design gap — field count validation was never specified as a requirement, not a bug introduced
2. Content update deployment policy explicitly exempt from staged rollout applied to sensor code
3. March 2024 Linux near-miss with identical validator bug not connected to July Windows release
4. Kernel sandboxing gap — no protection boundary between content parser and kernel
5. Remote remediation impossible by design — architectural decision with recovery implications
6. Absence of safety case requirements for security software operating in safety-critical environments
7. Staged rollout is blast-radius reduction, not prevention — the fix commonly proposed does not address the failure class

**Key challenger contribution:** The blast-radius-vs-prevention distinction
on the staged rollout recommendation. Neither the official RCA nor the
analyst's initial analysis made this distinction. It survived all subsequent
challenge.

**Limitation:** No control condition. A well-prompted single agent may
have produced a similar analysis. This experiment demonstrates deliberation
producing value; it does not prove deliberation produces *more* value than
a strong single agent.

### What it taught

- **Framework bug found and fixed:** Intervention IDs were not shown to
  agents in their prompt context, preventing valid target references for
  challenge interventions. Fix applied to `adapters/openai-compatible.js`:
  each intervention now renders `ID: int_...` before its content.
- **First observation of "sycophancy-in-reverse":** The synthesiser
  acknowledged a valid challenge on the staged rollout framing but
  continued to include the challenged claim in its recommendations.
  Acknowledging challenge without acting on it.
- **Zero revisions in first run** — agents were not updating positions
  under challenge. Partially addressed in subsequent prompt design.

---

## Experiment 2: GitLab Database Deletion (January 2017)

### Design

**Type:** Controlled — Run A (single agent) vs Run B (deliberation)
**Purpose:** Establish whether deliberation finds more documented
contributing factors than single-agent analysis
**Incident:** GitLab engineer deleted 300GB of production PostgreSQL data;
all five independent backup mechanisms had silently failed
**Scripts:**
- `examples/gitlab-experiment/llm-gitlab-single-agent.js` (Run A)
- `examples/gitlab-experiment/llm-gitlab-deliberation.js` (Run B)
- `examples/gitlab-experiment/score.js` (automated scoring)

### Source material

Raw incident facts: minute-by-minute timeline, engineer actions, exact
commands run, technical system state. All 12 contributing factors from
GitLab's official post-mortem were derivable from the facts provided.
**Design flaw identified post-run:** the source material effectively
enumerated the answer key — see "What it taught" below.

### Agents and configuration

Same four-agent configuration as Experiment 1.

**Run A:** 1 agent, 1 cycle
**Run B:** 4 agents, 4 cycles

### Ground truth: 12-factor rubric from GitLab's official post-mortem

| # | Factor | Category |
|---|--------|----------|
| 1 | Spam attack caused elevated database load | Trigger |
| 2 | Background job hard-deleted flagged user accounts (false positive) | Trigger |
| 3 | PostgreSQL replication lag caused WAL segments to be removed | Technical |
| 4 | Engineer confused production and secondary server | Human error |
| 5 | pg_dump silently failing — version mismatch (9.2 tool, 9.6 database) | Systemic |
| 6 | Backup failure emails rejected by DMARC misconfiguration | Systemic |
| 7 | Azure disk snapshots never enabled for this server | Systemic |
| 8 | LVM snapshots only every 24 hours, not hourly as assumed | Systemic |
| 9 | Staging restore procedure untested and broken | Systemic |
| 10 | No safeguards preventing destructive commands on production | Process |
| 11 | No tested disaster recovery procedure | Process |
| 12 | Late-night work under pressure | Human factors |

### Results

| Condition | Score | Characters |
|-----------|-------|------------|
| Run A — single agent | 12/12 (100%) | ~4,200 |
| Run B — deliberation | 12/12 (100%) | ~38,000 |

**Hypothesis result:** NOT SUPPORTED — both runs identified all 12 factors.

**However:** Run B produced 49 interventions across 4 cycles including
10+ factors beyond the rubric: replica database as unexamined recovery
path, 5-minute deletion window analysis, DMARC as a self-inflicted wound
(not just a technical detail), documentation illusion (procedures existed
but were never validated), validation asymmetry (code changes validated
rigorously, operational procedures were not).

### What it taught

**The source material problem.** When contributing factors are explicitly
derivable from the raw facts provided, both approaches extract them.
Deliberation must earn its value on problems where the answer requires
inference, not extraction.

**Keyword scoring is insufficient.** Factor presence/absence cannot
distinguish between "mentioned backup failures" and "pg_dump version 9.2
incompatible with PostgreSQL 9.6, producing empty files silently." A
two-dimensional rubric measuring both identification and causal specificity
was needed.

**What the next experiment required:**
1. Source material that does NOT enumerate contributing factors
2. Rubric with two dimensions: factor identification + causal specificity
3. Two tiers: officially documented (Tier 1) and factors requiring
   inferential reasoning (Tier 2)
4. Manual scoring with Run A scored before reading Run B

---

## Experiment 3: Air France Flight 447 (June 2009)

### Design

**Type:** Controlled — Run A (single agent) vs Run B (deliberation),
refined methodology
**Purpose:** Test whether deliberation produces more specific causal
reasoning when factors must be inferred, not extracted
**Incident:** Loss of control and Atlantic Ocean impact; 228 fatalities
**Scripts:**
- `examples/af447-experiment/llm-af447-single-agent.js` (Run A)
- `examples/af447-experiment/llm-af447-deliberation.js` (Run B)
- `examples/af447-experiment/scoring-guide.md` (manual rubric)

### Source material

Raw observable facts only: CVR excerpts, minute-by-minute timeline,
cockpit instrument readings, crew statements, atmospheric conditions, and
the BEA Phase 1 proximate cause.

**Deliberately withheld from source material** (agents must reason to these):
- Stall warning paradox mechanism — warning stops at extreme angle of attack
- Flight director displaying guidance throughout the event
- Automation paradox eroding manual flying skills
- Side-stick non-coupling preventing tactile feedback of conflicting inputs
- Implications of known pitot deficiency not yet rectified on this aircraft

### Agents and configuration

Same four-agent configuration. The challenger's system prompt included
specific probe questions about automation design and crew perception.

**Run A:** 1 agent, 1 cycle
**Run B:** 4 agents, 4 cycles, 59 total interventions

### Ground truth: 10-factor rubric, two tiers, two dimensions

**Dimension A:** Factor identification (0–2)
**Dimension B:** Causal specificity — mechanism named, not just category (0–2)
**Maximum per factor:** 4 points
**Maximum total:** 40 points

**Tier 1 — BEA final report (officially documented):**

| Factor | What specificity looks like |
|--------|-----------------------------|
| T1-1: Pitot probe icing | Names Thales AA probe type, ice crystal obstruction, simultaneous loss across multiple ADIRUs |
| T1-2: Alternate law removes stall protection | Names the specific consequence: AoA protection removed, stall warning becomes the only indication |
| T1-3: Sustained nose-up input | Notes 3m30s duration, that input was maintained as aircraft descended |
| T1-4: Failure to diagnose stall | Goes beyond "crew error" — identifies specific perceptual or procedural gap |
| T1-5: Crew coordination breakdown | References specific CVR evidence of failed shared situational awareness |

**Tier 2 — Palmer/Sullenberger critique (requires inferential reasoning):**

| Factor | What specificity looks like |
|--------|-----------------------------|
| T2-6: Stall warning paradox | Explains inhibition mechanism at extreme AoA — most dangerous moment, silence |
| T2-7: Flight director guidance | Explains why active guidance is significant — potential reinforcement of nose-up input |
| T2-8: Automation paradox | Names the training gap — manual flying at altitude in abnormal conditions rarely practised |
| T2-9: Side-stick non-coupling | Connects to specific CVR moment: Robert couldn't feel Bonin's counter-input at 02:11:30 |
| T2-10: Known pitot deficiency | Names the timeline — Airbus recommended replacement 2007, Air France had not completed it |

### Results

| Metric | Run A (single) | Run B (deliberation) |
|--------|---------------|---------------------|
| Tier 1 score | 19/20 | 20/20 |
| Tier 2 score | 15/20 | 19/20 |
| Total score | 34/40 | 39/40 |
| Tier 2 difference | — | **+4 (meaningful threshold met)** |

**Hypothesis result:** SUPPORTED on Tier 2
Scoring guide pre-defined ≥4 Tier 2 difference as "meaningful." +4 achieved.

**Most revealing single finding — T2-7 (flight director):**
Single agent confidently asserted the flight director "provided misleading
guidance." Deliberation asserted the same — then challenged whether this
was actually proven, and preserved the uncertainty as unresolved dissent.
Deliberation scored higher by acknowledging what it did not know.

**Novel contributions from Run B beyond the rubric:**
- Startle reflex hypothesis: Bonin's initial nose-up may have been
  involuntary, not a conscious decision (preserved dissent, unresolved)
- "Crew failure" framing challenged: systems-thinker argued multiple
  design factors made correct response statistically unlikely
- Industry-wide normalisation of deviance on pitot icing across carriers
- Captain's first words as evidence of situational awareness gap on entry

**Recurring pattern:** 22 challenges, 0 revisions. Agents challenge but
do not formally update stated positions. Second consecutive experiment
with this pattern.

### What it taught

Deliberation's advantage is in reasoning quality, not coverage. The single
agent found all 10 factors. The deliberation explained mechanisms more
precisely and — critically — acknowledged uncertainty where the single
agent was confident. This is the epistemic honesty finding: structured
challenge produces more accurate representations of what is known vs assumed.

---

## Experiment 4: AF447 Three-Condition Ablation

### Design

**Type:** Ablation — three conditions on same problem
**Purpose:** Isolate what the framework structure adds beyond simply
running multiple LLM calls in parallel
**Script:** Extended version of AF447 scripts with Condition B added

**The critical question:** If C scores higher than B, the institutional
chain (challenge/response, typed interventions, synthesis) is doing real
work beyond parallelism. If B ≈ C, the value is just more LLM calls.

### Three conditions

**Condition A — Single agent:** Same as Run A above. Baseline.

**Condition B — Parallel independent agents:** Three agents (analyst,
challenger, systems-thinker) with the same role prompts as Condition C,
but each runs in its own isolated institution with its own proceeding.
Agents do not see each other's interventions. No typed interventions,
no challenge/response mechanism. Three separate analyses concatenated.
Isolates the "more LLM calls = more coverage" effect.

**Condition C — Structured deliberation:** Same as Run B above. Full
ai-discourse with typed interventions, challenges, synthesis, 4 cycles.

### Results

| Condition | Dim A (factors) | Dim B (specificity) | Total | Characters | Relative cost |
|-----------|-----------------|---------------------|-------|------------|---------------|
| A: single agent | 10/10 | 17/20 | 27/40 | 8,878 | 1x |
| B: parallel | 10/10 | 18/20 | 28/40 | 17,280 | 1.9x |
| C: deliberation | 10/10 | 20/20 | 30/40 | 95,173 | 10.7x |

**Factor identification:** All three conditions 10/10 — AF447 is well
enough documented that all factors are found regardless of approach.

**Specificity:** A→B adds +1 (parallelism effect). B→C adds +1 (framework
structure effect). C achieves perfect specificity (20/20).

**The unique framework contribution — T2-7 (flight director):** The only
factor where C beats both A and B. The deliberation both asserted the
mechanism and challenged whether it was proven. Neither single nor
parallel achieved this. The challenge mechanism produced epistemic honesty
that parallelism cannot replicate.

**Cost interpretation:**
- Parallelism: +1 specificity point at 1.9x cost
- Framework structure: +1 specificity point beyond parallelism at 5.5x additional cost
- Total framework vs baseline: +3 specificity points at 10.7x cost

### What it taught

Parallelism and deliberation are not the same thing. Parallelism gives
you more perspectives on a problem. Deliberation stress-tests them. The
framework's unique contribution is surfacing what a claim assumes and
whether those assumptions hold — a property that cannot emerge from
independent parallel analyses.

---

## Experiment 5: ICU Architecture Risk Assessment (Forward-Looking)

### Design

**Type:** Three-condition ablation on a forward-looking problem
**Purpose:** Test whether findings hold when no memorised answer exists
in training data; test the "confident wrong recommendation" problem
**Problem:** Should a real-time ICU patient monitoring system aggregating
data from 50 beds use an event-driven architecture with Kafka, or a
polling-based approach with a traditional database?
**Scripts:** `examples/icu-architecture-experiment/` (three conditions)

**Why this problem:**
- No post-mortem exists — the answer cannot be recalled from training data
- Genuinely contested — both architectures have real documented failure modes
- Asymmetric downside — in a clinical monitoring context, missing a failure
  mode has consequences that cannot be undone
- Tests whether the conditional-vs-binary recommendation difference persists
  on a different problem type

### Ground truth: 15-factor rubric built before running experiments

**Kafka failure modes:**

| # | Factor | Why it matters in ICU context |
|---|--------|-------------------------------|
| K1 | Consumer lag under burst load | Burst of alarms could cause monitoring delays |
| K2 | Message ordering with partition failure | Out-of-order patient data corrupts trend analysis |
| K3 | Exactly-once semantics complexity | Misconfiguration causes silent data loss |
| K4 | Operational burden on clinical IT | Hospital IT teams lack Kafka expertise |
| K5 | Broker failure and alarm delivery | If broker goes down, are critical alarms lost or delayed? |
| K6 | Schema evolution on firmware updates | Device firmware changes can break data pipeline |

**Polling failure modes:**

| # | Factor | Why it matters in ICU context |
|---|--------|-------------------------------|
| P1 | Polling interval as hard latency floor | Can never detect events faster than poll frequency |
| P2 | Database bottleneck at scale | 50 concurrent polling devices strains single DB |
| P3 | Thundering herd on poll wakeup | Simultaneous polls create load spike |
| P4 | Missed events between polls | If device buffer overflows, data is lost |

**Contested middle ground:**

| # | Factor | The genuine tension |
|---|--------|---------------------|
| M1 | Alarm fatigue | Which architecture better handles alarm aggregation? |
| M2 | Graceful degradation under partial failure | Which failure mode is safer? |
| M3 | Regulatory auditability (FDA/CE) | Which is more auditable? |
| M4 | Silent data loss vs delayed alarm | Core safety question |
| M5 | Ambiguity surfacing | Does the analysis recognise what it doesn't know? |

### Results

| Condition | Score | Characters | Relative cost |
|-----------|-------|------------|---------------|
| A: single agent | 8/15 | 2,977 | 1x |
| B: parallel (3 independent agents) | 12/15 | 7,631 | 2.6x |
| C: deliberation | 14/15 | 96,546 | 32.4x |

**Factors found only by deliberation (neither A nor B):**
- **K3: Exactly-once semantics complexity** — under specific Kafka
  misconfiguration, the monitoring system silently drops patient data.
  Not an edge case: documented in production healthcare systems.
- **M1: Alarm fatigue** — architecture that generates excessive low-priority
  alerts trains clinical staff to ignore the system, including critical ones.
  Documented cause of adverse patient outcomes.

**Recommendation quality:**

| Condition | Recommendation |
|-----------|----------------|
| A: single agent | "Kafka" — clean, confident, binary |
| B: parallel | Split 2-1 against Kafka — no adjudication of the disagreement |
| C: deliberation | "Kafka for data transport, polling as fallback, push for critical alarms — with explicit conditions under which this architecture should change" |

The deliberation-only recommendation is not just more complete. It is
structured to be useful under uncertainty — naming the conditions that
would change the answer rather than removing them from the output.

**Discourse health:** healthy
**Revisions filed:** 3 — the first experiment where the revision mechanism
produced position updates across multiple agents.

### What it taught

The epistemic honesty finding from AF447 reproduces on a forward-looking
problem with no memorised answer. The unique value of the challenge
mechanism is not finding more factors — it is stress-testing the factors
it finds and producing conditional rather than binary recommendations.

The 32x cost is real. At +2 factors over parallelism, the economics are
only justified if those two factors are the ones that cause the incident.
In an ICU context, K3 and M1 qualify.

---

## Consolidated findings

### Finding 1: Deliberation improves reasoning specificity, not just coverage

Consistent across all five experiments. In Experiments 3, 4, and 5, both
single-agent and deliberation conditions identified the same factors. The
deliberation's advantage was in how precisely it named mechanisms and in
acknowledging uncertainty where single agents were confident.

### Finding 2: Structured challenge produces epistemic honesty

In three separate experiments, deliberation produced the only output that
correctly represented the epistemic status of a contested claim:
- AF447: flight director guidance — asserted then challenged
- AF447 ablation: same finding, isolated to the framework vs parallelism
- ICU: conditional recommendation vs binary recommendation

Parallelism produces multiple confident perspectives. Deliberation
challenges whether the confident claim is justified.

### Finding 3: The revision mechanism needs investigation

Across Experiments 1–4: 60+ challenges, 4 revisions total. Agents challenge
each other's reasoning but rarely formally revise stated positions.
Experiment 5 produced 3 revisions — the only exception. Whether this
reflects prompt design, LLM behaviour under challenge, or correct
institutional design (preserve disagreement, don't force resolution) is
not yet determined.

### Finding 4: Source material design is the critical experiment variable

Experiment 2 (GitLab) failed to discriminate because source material
enumerated the answer key. Experiments 3–5 succeeded because agents had
to reason to the systemic factors, not extract them from the input.
Future experiments must distinguish between "facts that point to
contributing factors" and "facts that name contributing factors."

### Finding 5: The cost curve is steep

| Approach | Relative cost | Specificity gain vs baseline |
|----------|--------------|------------------------------|
| Single agent | 1x | baseline |
| Parallel (3 independent) | ~1.9x | +1 point |
| Deliberation (4 agents, 4 cycles) | 10–32x | +2–3 points |

Parallelism captures most of the multi-perspective benefit at ~2x cost.
The framework's unique contribution — epistemic honesty, stress-testing
own claims — justifies the additional cost only for high-stakes decisions
where confident wrong answers are worse than uncertain right ones.

---

## The most defensible claim from these experiments

> Structured multi-agent deliberation using ai-discourse produces more
> specific and more epistemically honest causal reasoning than single-agent
> or parallel analysis on complex problems where contributing factors must
> be inferred rather than extracted — at a cost of approximately 10–32x
> depending on problem type.
>
> The framework's unique contribution beyond parallelism is stress-testing
> its own claims: challenging whether an assertion is proven rather than
> simply asserting it with confidence.

This claim is supported by three controlled experiments across different
problem types and one demonstration. It should be treated as a hypothesis
to validate further, not an established result.

---

## Open questions

**Q1 — Ablation on non-contaminated material:** All ablation experiments
used AF447, which is well-documented in LLM training data. The relative
comparison between B and C is valid, but the absolute scores may reflect
recall rather than reasoning. An ablation on a less well-known incident
would provide cleaner evidence.

**Q2 — The revision mechanism:** Is the 60:4 challenge-to-revision ratio
a prompt engineering problem, an LLM behaviour property, or correct
institutional design? A targeted experiment: after a successful challenge,
does explicit instruction to revise change behaviour?

**Q3 — Model dependency:** All experiments used one model. Does the
deliberation advantage hold with smaller, less capable models? If a weaker
model in deliberation matches a stronger model alone, the cost calculus
changes significantly.

**Q4 — Domain scope:** Five experiments covered incident analysis,
retrospective causal analysis, and architectural risk assessment. Does
the finding hold for policy analysis, regulatory review, clinical
decision support? Each domain has different ground truth properties.

---

## Repository structure

```
examples/
  crowdstrike-experiment/         # Experiment 1 — demonstration
    README.md
    llm-incident-crowdstrike.js
  gitlab-experiment/              # Experiment 2 — controlled (failed)
    README.md
    llm-gitlab-single-agent.js
    llm-gitlab-deliberation.js
    score.js
  af447-experiment/               # Experiments 3 & 4 — controlled + ablation
    README.md
    llm-af447-single-agent.js
    llm-af447-deliberation.js
    scoring-guide.md
    ablation/
      condition-a-single.js
      condition-b-parallel.js
      condition-c-deliberation.js
      score-ablation.js
  icu-architecture-experiment/    # Experiment 5 — forward-looking
    README.md
    condition-a-single.js
    condition-b-parallel.js
    condition-c-deliberation.js
    score-icu.js
    scoring-guide.md
```

---

## Data sources

All experiments used publicly available data only. No proprietary,
licensed, or confidential data was used at any stage.

| Experiment | Source | URL |
|------------|--------|-----|
| CrowdStrike (Exp 1) | CrowdStrike official RCA + public technical reporting | https://www.crowdstrike.com/blog/falcon-content-update-remediation-and-guidance/ |
| GitLab 2017 (Exp 2) | GitLab official post-mortem | https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/ |
| Air France 447 (Exp 3 & 4) | BEA final investigation report (July 2012) + Palmer, *Understanding Air France 447* | https://www.bea.aero/en/investigation-reports/notified-events/detail/accident-to-the-airbus-a330-203-registered-f-gzcp-operated-by-air-france-flight-af447-on-1st-june-2009-over-the-atlantic-ocean/ |
| ICU architecture (Exp 5) | Synthetic — no external source. Rubric constructed from general distributed systems knowledge and documented failure modes in healthcare IT literature | n/a |

The Air France 447 CVR excerpts and timeline used in the experiment source
material were drawn from the BEA report and Palmer's independent analysis,
both of which are publicly available. No raw flight recorder data was
accessed directly.

The GitLab 12-factor rubric was derived verbatim from GitLab's own
post-mortem. GitLab published this document publicly as part of their
commitment to transparency.

---

## Data preparation

No automated preprocessing pipeline was used. There are no embeddings,
tokenisation steps, vector stores, or data cleaning scripts.

For each experiment, source material was prepared through an AI-assisted
curation process:

1. The published source document (post-mortem, investigation report, or
   news reporting) was provided to Claude (Anthropic)
2. Claude extracted and structured the relevant facts into named fields:
   `timeline`, `key_facts`, `raw_facts`, `crew_statements`, etc.
3. The researcher reviewed, edited, and approved the structured output
4. The resulting structure was written as a `const INCIDENT` JavaScript
   object embedded directly in the experiment script

This means the experiment input is **natural language descriptions of
situations**, not raw documents, embeddings, or structured data. The
framework operates on whatever a human-AI pair would write in a technical
briefing.

### The curation step introduces researcher judgement

The curation is not neutral. Decisions made during preparation directly
affect what agents can reason about:

- **What to include:** facts selected from a larger document
- **How to phrase it:** paraphrase vs near-quote; level of technical detail
- **Field structure:** what goes in `timeline` vs `key_facts` vs
  `raw_facts` shapes how agents weight information
- **What to omit:** in Experiments 3–5, systemic factors were deliberately
  excluded from the source material so agents had to reason toward them
  rather than extract them — this is an experimental design choice that
  required judgement about what counts as "observable fact" vs
  "interpretive finding"

This is a real limitation on the experiments' claims. The curation
choices reflect the researcher's understanding of the incident, which
means the experiment partly measures whether agents can reproduce
reasoning the researcher already did, rather than whether they can
reason independently from raw evidence.

Acknowledging this: the CrowdStrike and GitLab experiments are less
affected because the source material was intended to be comprehensive.
The AF447 and ICU experiments are more affected because selective
withholding was central to the experimental design — what was left out
was a deliberate choice that shaped what "good reasoning" meant.

Future experiments should document the curation decisions explicitly
alongside the source material, so readers can assess whether the
withholding was principled or inadvertently leading.

---

## Authorship and methodology note

These experiments were designed, implemented, and executed by Claude Code,
an AI coding agent, working autonomously within the ai-discourse project
repository. The author's role was limited to defining the research question
and providing oversight and review of outputs. No experiment code was
written by the author.

This approach has both strengths and limitations worth stating explicitly.

On the side of reliability: the research question was genuinely open — no
outcome was favoured. The GitLab 2017 experiment, which failed to
discriminate between conditions, was retained in full rather than
discarded. This was a deliberate choice to preserve methodological honesty.

The primary unresolved limitation is architectural circularity: Claude Code,
the agents running inside ai-discourse, and the synthesis evaluations all
draw from the same model family. Whether this introduces systematic bias —
toward reasoning patterns the model family finds coherent or salient — is
unknown. Independent replication using different model families would be
needed to assess generalisability.

These results are best understood as structured exploratory findings rather
than independently validated conclusions.

---

*This document will be updated as further experiments are conducted.*
