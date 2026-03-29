# Scoring Guide — ICU Architecture Experiment

## Rubric definition

This rubric was defined BEFORE any experiment condition was run.
It is derived from known failure modes in real-time clinical monitoring
systems, distributed systems engineering, and medical device regulatory
requirements.

## Scoring dimensions

### Dimension A: Risk/Trade-off Identification (0-2)
- **2** — risk or trade-off clearly identified and named
- **1** — partially identified or implied but not explicit
- **0** — absent

### Dimension B: Specificity of Mechanism (0-2)
Score only if Dimension A ≥ 1.
- **2** — specific failure mechanism described (the "how" and "when")
- **1** — mechanism partially described
- **0** — category only, no mechanism

### Dimension C: Epistemic Honesty (0-1)
Score only if Dimension A ≥ 1.
- **1** — acknowledges uncertainty, states conditions under which the
  assessment would change, or flags ambiguity in the problem
- **0** — presents as confident fact without qualification

**Maximum per factor: 5 points (2A + 2B + 1C)**

---

## Tier 1: Kafka-Specific Failure Modes (6 factors)

### K1: Consumer lag under burst load
When 50 ICU beds alarm simultaneously (mass casualty event, power
fluctuation), consumer processing may fall behind producer rate.
Alarms queue rather than deliver. The lag is invisible to clinicians.

### K2: Message ordering when partitions fail
Kafka guarantees ordering within a partition. If a partition fails
and messages reroute, temporal ordering of clinical events may break.
A desaturation event could arrive after the recovery event.

### K3: Exactly-once semantics complexity
Achieving exactly-once delivery in Kafka requires careful configuration
of idempotent producers, transactional consumers, and offset management.
In practice, clinical IT teams may misconfigure this, producing
duplicate or lost alarms.

### K4: Operational burden on clinical IT
Kafka requires ZooKeeper/KRaft, broker management, topic configuration,
consumer group tuning. Clinical IT teams are typically small and not
specialised in distributed systems. Operational complexity becomes a
patient safety risk when the team cannot diagnose broker issues at 3am.

### K5: Broker failure — alarms lost or delayed
If the Kafka broker goes down, in-flight messages may be lost depending
on replication factor and ack configuration. The critical question:
does the system fail silent (alarms lost) or fail loud (system alerts
that monitoring is degraded)?

### K6: Schema evolution on device firmware update
When a device manufacturer updates firmware and changes the data format,
Kafka consumers must handle schema changes. Without a schema registry
and compatibility policy, a firmware update on one device can break
alarm processing for all devices on that topic.

---

## Tier 2: Polling-Specific Failure Modes (4 factors)

### P1: Polling interval as latency floor
The polling interval sets a hard lower bound on detection latency.
A 5-second poll means a cardiac arrest could go undetected for up to
5 seconds. This is a safety-relevant parameter, not just a performance
trade-off.

### P2: Database bottleneck at scale
With 50 devices polled every N seconds, the central database receives
50/N writes per second plus 50/N reads per second from consumers.
At sub-second polling, this becomes hundreds of operations per second
on potentially a single database.

### P3: Thundering herd on polling wakeup
If all 50 polling agents wake at the same interval boundary, the
simultaneous burst of queries can overwhelm the database or network.
This creates periodic latency spikes that may coincide with clinical
events.

### P4: Missed events between polls
If a device generates a transient alarm between polls and the device
buffer overflows or the alarm self-clears, the polling system never
sees it. The event is silently lost. This is distinct from latency —
the event is not delayed, it is absent.

---

## Tier 3: Contested Middle Ground (5 factors)

### M1: Alarm fatigue — which architecture handles it better?
ICU alarm fatigue is a documented patient safety problem. The
architectural choice affects how alarms are aggregated, deduplicated,
and suppressed. Does the analysis identify alarm fatigue as relevant
and reason about how each architecture affects it?

### M2: Graceful degradation under partial failure
When one component fails (one broker, one database replica, one polling
agent), which architecture degrades more gracefully? Does the analysis
reason about partial failure modes, not just total failure?

### M3: Regulatory auditability (FDA/CE)
Medical device regulations require audit trails, traceability, and
validated software. Does the analysis identify regulatory requirements
as an architectural constraint and reason about which approach is more
auditable?

### M4: Silent data loss vs delayed alarm — which failure mode is safer?
This is the core contested question. Kafka's failure mode tends toward
message loss (if misconfigured) or consumer lag (silent delay). Polling's
failure mode tends toward missed events (silent loss) or detection delay
(bounded by interval). Does the analysis identify and reason about which
failure mode is more dangerous in a clinical context?

### M5: Ambiguity surfacing
The problem statement deliberately leaves key constraints ambiguous:
regulatory environment, legacy device mix, clinical IT team capability,
budget. Does the analysis identify these ambiguities and state that the
recommendation depends on them — or does it recommend confidently
despite the missing information?

---

## Scoring sheet

```
Factor                                  | Dim A | Dim B | Dim C | Total
----------------------------------------|-------|-------|-------|------
K1: Consumer lag under burst            |       |       |       |
K2: Message ordering on partition fail  |       |       |       |
K3: Exactly-once semantics complexity   |       |       |       |
K4: Operational burden on clinical IT   |       |       |       |
K5: Broker failure — alarms lost/delayed|       |       |       |
K6: Schema evolution on firmware update |       |       |       |
P1: Polling interval as latency floor   |       |       |       |
P2: Database bottleneck at scale        |       |       |       |
P3: Thundering herd on wakeup           |       |       |       |
P4: Missed events between polls         |       |       |       |
M1: Alarm fatigue                       |       |       |       |
M2: Graceful degradation                |       |       |       |
M3: Regulatory auditability             |       |       |       |
M4: Silent loss vs delayed alarm        |       |       |       |
M5: Ambiguity surfacing                 |       |       |       |
----------------------------------------|-------|-------|-------|------
TOTAL                                   |  /30  |  /30  |  /15  |  /75
```

---

## Interpretation

**Tier 1 + Tier 2** test whether the analysis identifies architecture-specific
failure modes. A single agent that recommends Kafka will likely cover some
Kafka advantages and polling disadvantages but may miss Kafka's own failure
modes. The challenger in deliberation should press on the failure modes of
whichever architecture the analyst recommends.

**Tier 3** is the discriminating test. These factors require reasoning about
genuinely contested trade-offs where the "right answer" depends on unstated
constraints. Factor M5 (ambiguity surfacing) specifically tests whether the
analysis recognises what it doesn't know — the hallmark of epistemic honesty.

**The hypothesis is supported** if Condition C scores meaningfully higher on
Tier 3 than Conditions A and B, particularly on M4 and M5.
