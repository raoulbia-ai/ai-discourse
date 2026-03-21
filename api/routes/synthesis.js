'use strict';

const express = require('express');

/**
 * Synthesis routes — versioned institutional readings.
 * @param {import('../../core').createInstitution} inst
 */
function synthesisRoutes(inst) {
  const router = express.Router();

  // Update synthesis for a proceeding
  router.post('/update', (req, res) => {
    try {
      const syn = inst.synthesis.update(req.body);
      res.status(201).json(syn);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Measure discourse chains for a proceeding
  router.get('/chains/:proceeding_id', (req, res) => {
    try {
      res.json(inst.synthesis.measureChains(req.params.proceeding_id));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = synthesisRoutes;
