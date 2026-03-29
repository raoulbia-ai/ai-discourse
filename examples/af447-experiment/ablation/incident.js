'use strict';

/**
 * Shared AF447 incident object — used by all three ablation conditions.
 * Identical to the incident object in ../af447-experiment/.
 */

const INCIDENT = {
  id: 'AF447-2009-0601',
  title: 'Air France Flight 447 — Loss of Control and Impact with Atlantic Ocean, June 1, 2009',
  aircraft: 'Airbus A330-203',
  route: 'Rio de Janeiro (GIG) to Paris (CDG)',
  outcome: '228 fatalities. Aircraft entered Atlantic Ocean at approximately 02:14 UTC.',

  crew: {
    captain: 'Marc Dubois, 58 years old, 11,000 total hours, 1,700 on A330. Not present in cockpit at time of initial event — resting in crew bunk.',
    pilot_flying: 'Pierre-Cédric Bonin, 32 years old, 2,936 total hours, 807 on A330. Occupying right seat.',
    pilot_monitoring: 'David Robert, 37 years old, 6,547 total hours, 4,479 on A330. Occupying left seat (acting captain).',
    captain_return: 'Captain Dubois returned to cockpit at 02:11:43 UTC — approximately 1m40s before impact.',
  },

  proximate_cause_official: 'Temporary obstruction of pitot probes by ice crystals caused autopilot and autothrust to disconnect. The crew did not apply correct procedure for an unreliable airspeed situation. The aircraft entered and sustained an aerodynamic stall from which it did not recover.',

  timeline: [
    '01:51 — Captain leaves cockpit for rest period. Bonin (PF) and Robert (PM) remain.',
    '02:06 — Aircraft enters area of convective activity. Autopilot and autothrust engaged normally.',
    '02:10:05 — Autopilot disconnects. Autothrust disconnects. Unreliable airspeed indications on all three ADIRUs.',
    '02:10:06 — Bonin makes nose-up input on side-stick. Aircraft begins to climb.',
    '02:10:07 — Stall warning activates for the first time (CRICKET sound + "STALL STALL" synthetic voice).',
    '02:10:16 — Aircraft reaches maximum altitude of approximately 38,000 ft. Vertical speed begins to decrease.',
    '02:10:50 — Stall warning stops. (Angle of attack has exceeded the sensor measurement range — warning inhibited at extreme AoA)',
    '02:11:00 — Robert calls for captain. Bonin continues nose-up inputs.',
    '02:11:30 — Robert takes over controls briefly, pushes nose down. Stall warning reactivates.',
    '02:11:37 — Bonin takes controls back, immediately pulls nose up again.',
    '02:11:43 — Captain Dubois enters cockpit.',
    '02:12:00 — Aircraft at approximately 35,000 ft descending. Crew attempts to understand situation.',
    '02:13:32 — Robert says "climb climb climb climb". Captain says "no no no do not climb".',
    '02:13:40 — Bonin says "I\'ve been at maxi nose-up for a while".',
    '02:14:28 — Impact with ocean. Aircraft in near-wings-level attitude, nose pitched 16.2 degrees up.',
  ],

  technical_readings: [
    'At autopilot disconnect: indicated airspeed dropped from 275 kt to near-zero on two ADIRUs (pitot probe icing)',
    'Aircraft was at FL350 (35,000 ft), weight approximately 205 tonnes, outside air temperature -56°C',
    'Angle of attack at time of initial stall warning: approximately 6 degrees',
    'Angle of attack at impact: approximately 16.2 degrees (well above critical AoA of ~8-9 degrees)',
    'Bonin maintained nose-up input for approximately 3 minutes and 30 seconds continuously',
    'Vertical speed at impact: approximately -10,916 ft/min',
    'Aircraft descended approximately 38,000 ft in approximately 3 minutes 30 seconds',
    'Pitot probes: Thales AA type. Known icing issues documented. Airbus had recommended replacement with Thales BA probes.',
    'Stall warning activated and deactivated multiple times. Notably STOPPED when angle of attack was highest.',
    'At 02:10:50 stall warning stopped because AoA exceeded sensor measurement range — this is by design.',
  ],

  crew_statements_cvr: [
    '02:10:06 Bonin: "I have the controls" (takes over from autopilot)',
    '02:10:16 Robert: "What\'s happening?"',
    '02:11:00 Robert: "I don\'t understand at all what\'s happening"',
    '02:11:10 Robert: "Altimeter? [altitude indications vary]"',
    '02:11:43 Captain: "What are you doing?" (on entering cockpit)',
    '02:12:14 Captain: "What speed are you indicating?"',
    '02:13:32 Robert: "Climb, climb, climb, climb"',
    '02:13:40 Bonin: "I\'ve been at maxi nose-up for a while"',
    '02:13:42 Captain: "No no no do not climb... no no"',
    '02:14:23 Robert: "Damn it, we\'re going to crash... this can\'t be happening"',
    '02:14:25 Bonin: "But what\'s happening?"',
  ],

  known_context: [
    'The Thales AA pitot probes had a documented history of icing issues at altitude in convective conditions.',
    'Airbus had recommended replacement of Thales AA probes with Thales BA probes in 2007. Air France had scheduled but not yet completed replacement on this aircraft.',
    'The A330 autopilot disconnects when both pitot probes give unreliable readings.',
    'When the A330 autopilot disconnects in cruise, the aircraft transitions to "alternate law" — stall protection is reduced.',
    'In alternate law, the flight director (instrument guidance) remains active and continued to display guidance throughout the event.',
    'BEA Phase 1 report (July 2009) identified pitot probe icing as the initiating event.',
    'Wreckage and flight recorders were recovered from ocean floor in May 2011 — final BEA report issued July 2012.',
    'Criminal proceedings: Air France and Airbus were acquitted in 2021; appeals court ordered new trial in 2022; retrial ongoing as of 2023.',
  ],
};

module.exports = { INCIDENT };
