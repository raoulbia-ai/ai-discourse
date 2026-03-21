'use strict';

const express = require('express');

/**
 * Interventions routes — submit and query procedural acts.
 * @param {import('../../core').createInstitution} inst
 */
function interventionsRoutes(inst) {
  const router = express.Router();

  // List interventions
  router.get('/', (req, res) => {
    try {
      const filters = {};
      if (req.query.proceeding_id) filters.proceeding_id = req.query.proceeding_id;
      if (req.query.agent_id) filters.agent_id = req.query.agent_id;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.limit) filters.limit = parseInt(req.query.limit);
      if (req.query.offset) filters.offset = parseInt(req.query.offset);
      res.json(inst.interventions.list(filters));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Submit intervention
  router.post('/', (req, res) => {
    try {
      // Check governance rules
      const check = inst.governance.checkIntervention(req.body);
      if (!check.allowed) {
        return res.status(403).json({ error: 'Governance violation', violations: check.violations });
      }
      const intervention = inst.interventions.submit(req.body);
      res.status(201).json(intervention);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = interventionsRoutes;
