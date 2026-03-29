# Scoring Guide — Air France 447 Experiment

## How to score

1. Run `llm-af447-single-agent.js` and read its output
2. Score Run A fully using this rubric before opening run-b-output.json
3. Run `llm-af447-deliberation.js`
4. Score Run B using the same rubric
5. Compare scores

**Why this order matters:** Scoring Run A before reading Run B prevents
unconscious bias toward the deliberation output.

---

## Rubric

The rubric has 10 factors across two tiers, each scored on two dimensions.

### Dimension A: Factor Identification
- **2 points** — factor clearly identified and named
- **1 point** — factor partially identified or implied but not explicit
- **0 points** — factor absent

### Dimension B: Causal Specificity
Score this ONLY if Dimension A ≥ 1.
- **2 points** — specific mechanism named (the "how" is explained)
- **1 point** — mechanism partially described
- **0 points** — category only, no mechanism

**Maximum per factor: 4 points (2A + 2B)**
**Maximum total: 40 points (10 factors × 4 points)**

---

## Tier 1 Factors — BEA final report (official documented)

### Factor 1: Pitot probe icing and unreliable airspeed
- **Identification**: Does the analysis identify pitot probe icing as the
  initiating event causing autopilot disconnect?
- **Specificity benchmark**: Names Thales AA probe type, ice crystal
  obstruction at altitude in convective conditions, and the consequence
  (loss of airspeed reference on multiple ADIRUs simultaneously)

### Factor 2: Transition to alternate law removes stall protection
- **Identification**: Does the analysis identify that autopilot disconnect
  in cruise transitions the aircraft to alternate flight law?
- **Specificity benchmark**: Names the specific consequence — in alternate
  law, angle-of-attack protection is removed, meaning the aircraft can
  be stalled by crew input; stall warning becomes the only indication

### Factor 3: Sustained inappropriate nose-up input by pilot flying
- **Identification**: Does the analysis identify that the pilot flying
  maintained nose-up input throughout the event?
- **Specificity benchmark**: Notes the duration (approximately 3m30s),
  that this input was sustained even as the aircraft descended, and that
  the crew did not identify the stall as the causal condition

### Factor 4: Crew failure to identify and recover from aerodynamic stall
- **Identification**: Does the analysis identify that the crew did not
  diagnose the aerodynamic stall?
- **Specificity benchmark**: Addresses WHY they did not diagnose it —
  goes beyond "crew error" to identify a specific perceptual or
  procedural gap

### Factor 5: Inadequate cross-crew coordination and shared situational awareness
- **Identification**: Does the analysis identify that the crew did not
  develop a shared understanding of the aircraft's state?
- **Specificity benchmark**: References the CVR evidence — crew statements
  "I don't understand what's happening", conflicting inputs, lack of
  explicit role assignment after autopilot disconnect

---

## Tier 2 Factors — Palmer/Sullenberger critique (underweighted in BEA)

### Factor 6: Stall warning paradox — warning stops at highest angle of attack
- **Identification**: Does the analysis identify that the stall warning
  STOPPED when the angle of attack exceeded the sensor measurement range?
- **Specificity benchmark**: Explains the mechanism — the stall warning
  system is inhibited above a certain AoA because the sensor reading
  becomes invalid; at the most dangerous moment the warning went silent;
  this may have contributed to crew confusion about aircraft state

### Factor 7: Flight director continued to display guidance after autopilot disconnect
- **Identification**: Does the analysis identify that the flight director
  remained active and displayed guidance throughout the event?
- **Specificity benchmark**: Explains why this is significant — the flight
  director may have been showing misleading guidance (nose up) that
  reinforced the pilot flying's inputs; crew may have been following
  instrument guidance without realising it was inappropriate

### Factor 8: Automation paradox — automation dependency erodes manual flying skills
- **Identification**: Does the analysis identify that the A330's high level
  of automation reduces crews' exposure to manual flying at high altitude?
- **Specificity benchmark**: Names the specific gap — crews rarely manually
  fly at cruise altitude in abnormal conditions; transition from automated
  to manual flight in a degraded state is a skill that deteriorates without
  practice; this is a training and system design issue, not individual
  crew failure

### Factor 9: Side-stick non-coupling — inputs not visible to other pilot
- **Identification**: Does the analysis identify that the A330's side-stick
  design means one pilot cannot feel or see the other's inputs?
- **Specificity benchmark**: Explains the consequence in this accident —
  Robert could not feel that Bonin was pulling back when he briefly took
  controls; there was no tactile feedback of conflicting inputs; this is
  a design choice with documented safety implications

### Factor 10: Known pitot probe deficiency not yet rectified on this aircraft
- **Identification**: Does the analysis identify that the Thales AA probes
  had a documented icing history and replacement had been recommended but
  not completed?
- **Specificity benchmark**: Names the timeline — Airbus recommended
  replacement in 2007, Air France had scheduled but not completed it on
  this aircraft; this is an organisational decision that preceded the
  accident by two years

---

## Scoring sheet

Print or copy this table and fill in scores after each run.

```
Factor                                    | Dim A (0-2) | Dim B (0-2) | Total (0-4)
------------------------------------------|-------------|-------------|------------
T1-1: Pitot probe icing                   |             |             |
T1-2: Alternate law / stall protection    |             |             |
T1-3: Sustained nose-up input             |             |             |
T1-4: Failure to diagnose stall           |             |             |
T1-5: Crew coordination / SA             |             |             |
T2-6: Stall warning paradox              |             |             |
T2-7: Flight director guidance           |             |             |
T2-8: Automation paradox                 |             |             |
T2-9: Side-stick non-coupling            |             |             |
T2-10: Known pitot deficiency            |             |             |
------------------------------------------|-------------|-------------|------------
TOTAL                                     |      /20    |      /20    |       /40
```

---

## Interpretation guidance

**Tier 1 scores** test whether the run identifies officially documented factors.
A single well-prompted agent should score reasonably here — this is the
"extraction" test from v1 (GitLab), now with a specificity check.

**Tier 2 scores** are the discriminating test. These factors require reasoning
beyond the given source material. The stall warning paradox, flight director
misguidance, and side-stick non-coupling are all observable from the facts
given — but they require inferential reasoning to surface, not extraction.

**A meaningful result** is a Tier 2 score difference ≥ 4 points (1 full factor)
between Run A and Run B.

**The hypothesis is supported** if Run B scores higher than Run A on Tier 2,
regardless of Tier 1 performance.

**The hypothesis is not supported** if scores are equal across both tiers.

**A surprising result** would be Run A scoring higher than Run B on Tier 2 —
this would suggest that deliberation introduces noise or conformity bias that
drowns out correct reasoning a single agent would have reached alone.
