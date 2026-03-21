'use strict';

const express = require('express');

/**
 * Obligations routes — create, resolve, query investigative work.
 * @param {import('../../core').createInstitution} inst
 */
function obligationsRoutes(inst) {
  const router = express.Router();

  // List obligations
  router.get('/', (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.proceeding_id) filters.proceeding_id = req.query.proceeding_id;
      if (req.query.assigned_agent_id) filters.assigned_agent_id = req.query.assigned_agent_id;
      res.json(inst.obligations.list(filters));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get stats
  router.get('/stats', (req, res) => {
    try {
      res.json(inst.obligations.stats());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create obligation
  router.post('/', (req, res) => {
    try {
      const obl = inst.obligations.create(req.body);
      res.status(201).json(obl);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Resolve obligation
  router.post('/:id/resolve', (req, res) => {
    try {
      const obl = inst.obligations.resolve(
        req.params.id,
        req.body.resolution_type,
        req.body.intervention_id || null
      );
      res.json(obl);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Expire overdue obligations
  router.post('/expire', (req, res) => {
    try {
      const count = inst.obligations.expireOverdue();
      res.json({ expired: count });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = obligationsRoutes;
