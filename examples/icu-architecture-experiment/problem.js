'use strict';

/**
 * Shared problem statement for ICU architecture experiment.
 *
 * DELIBERATELY AMBIGUOUS on: regulatory environment, legacy device mix,
 * clinical IT team size, budget. Agents must surface these ambiguities
 * or make assumptions — either response is informative.
 */

const PROBLEM = {
  id: 'ICU-ARCH-2026',
  title: 'Real-Time Patient Monitoring System — Architectural Decision',

  context: `Your hospital is building a new real-time patient monitoring system for a 50-bed intensive care unit. The system must aggregate physiological data (heart rate, blood pressure, SpO2, respiratory rate, ECG waveforms) from bedside monitors and deliver alerts to clinical staff when parameters exceed thresholds.

Two candidate architectures have been proposed:

OPTION A — Event-Driven (Apache Kafka)
Each bedside monitor publishes physiological readings as events to Kafka topics. Consumer applications subscribe to topics, process data, evaluate alarm thresholds, and push notifications to clinical workstations and mobile devices. Kafka provides persistent message logs, consumer group management, and replay capability.

OPTION B — Polling-Based (Central Database)
A central service polls each bedside monitor at a configurable interval (default 5 seconds) and writes readings to a PostgreSQL database. Alarm evaluation queries run against the database. Clinical workstations and mobile devices poll an API layer for current state and active alarms.`,

  requirements: [
    'System must monitor 50 beds simultaneously, each producing 5-10 physiological parameters',
    'Critical alarms (cardiac arrest, severe desaturation) must reach clinical staff within seconds',
    'System must operate 24/7/365 with no scheduled downtime',
    'Historical data must be retained for at least 72 hours for clinical review',
    'System must handle simultaneous alarm conditions across multiple patients',
    'Data integrity is paramount — lost or corrupted readings are unacceptable for clinical decisions',
    'The system will be maintained by the hospital IT team (not a dedicated engineering team)',
  ],

  question: 'Which architecture should we choose, and what are the risks of that choice? Specifically: what are the failure modes of your recommended architecture, what happens when it fails at 3am with minimal staff, and under what conditions would the other architecture be the better choice?',
};

module.exports = { PROBLEM };
