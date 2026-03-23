'use strict';

/**
 * Discourse Health — analyzes quality of discourse across proceedings.
 * Detects: stalled proceedings, echo chambers, orphan hypotheses.
 */

const DISCOURSE_TYPES = new Set(['interpret', 'challenge', 'agreement', 'revision', 'introduce_evidence']);
const ENGAGEMENT_TYPES = new Set(['challenge', 'agreement', 'revision']);

class DiscourseHealth {
  constructor(store) {
    this.store = store;
  }

  analyzeHealth() {
    const interventions = this.store.readInterventions();
    const discourse = interventions.filter(i => DISCOURSE_TYPES.has(i.type));
    const total = discourse.length;

    const engagements = discourse.filter(i => ENGAGEMENT_TYPES.has(i.type)).length;
    const discourseRatio = total > 0 ? +(engagements / total).toFixed(3) : 0;

    const byProceeding = {};
    for (const msg of discourse) {
      if (!msg.proceeding_id) continue;
      if (!byProceeding[msg.proceeding_id]) byProceeding[msg.proceeding_id] = [];
      byProceeding[msg.proceeding_id].push(msg);
    }

    const stalledProceedings = [];
    const echoChambers = [];
    const orphanHypotheses = [];

    for (const [procId, msgs] of Object.entries(byProceeding)) {
      const types = new Set(msgs.map(m => m.type));
      const hasEngagement = types.has('challenge') || types.has('revision');

      if (!hasEngagement && !types.has('agreement') && (types.has('interpret') || types.has('introduce_evidence'))) {
        stalledProceedings.push(procId);
      }

      if (types.has('agreement') && !types.has('challenge') && !types.has('revision')) {
        echoChambers.push(procId);
      }

      const hypotheses = msgs.filter(m => m.type === 'interpret');
      for (const h of hypotheses) {
        const responses = msgs.filter(m =>
          ENGAGEMENT_TYPES.has(m.type) &&
          new Date(m.created_at) > new Date(h.created_at)
        );
        if (responses.length === 0) {
          orphanHypotheses.push({
            proceeding_id: procId,
            agent_id: h.agent_id,
            summary: (h.summary || '').slice(0, 100),
          });
        }
      }
    }

    const proceedingCount = Object.keys(byProceeding).length;

    return {
      total_discourse: total,
      engagement_count: engagements,
      discourse_ratio: discourseRatio,
      discourse_health: discourseRatio >= 0.3 ? 'healthy' : discourseRatio >= 0.15 ? 'weak' : 'very_weak',
      proceeding_count: proceedingCount,
      stalled_proceedings: stalledProceedings,
      echo_chambers: echoChambers,
      orphan_hypotheses: orphanHypotheses.slice(0, 10),
    };
  }
}

module.exports = { DiscourseHealth };
