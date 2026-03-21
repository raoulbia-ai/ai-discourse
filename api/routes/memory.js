'use strict';

const express = require('express');

/**
 * Memory routes — precedent links and institutional memory.
 * @param {import('../../core').createInstitution} inst
 */
function memoryRoutes(inst) {
  const router = express.Router();

  // Get precedent links for a proceeding
  router.get('/precedents/:proceeding_id', (req, res) => {
    try {
      res.json(inst.memory.forProceeding(req.params.proceeding_id));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create precedent link
  router.post('/precedents', (req, res) => {
    try {
      const link = inst.memory.createLink(req.body);
      res.status(201).json(link);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = memoryRoutes;
