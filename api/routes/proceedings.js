'use strict';

const express = require('express');

/**
 * Proceedings routes — CRUD and lifecycle for proceedings.
 * @param {import('../../core').createInstitution} inst
 */
function proceedingsRoutes(inst) {
  const router = express.Router();

  // List proceedings
  router.get('/', (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.exclude_status) filters.exclude_status = req.query.exclude_status;
      res.json(inst.proceedings.list(filters));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get single proceeding
  router.get('/:id', (req, res) => {
    try {
      res.json(inst.proceedings.get(req.params.id));
    } catch (e) {
      res.status(404).json({ error: e.message });
    }
  });

  // Open new proceeding
  router.post('/', (req, res) => {
    try {
      const proc = inst.proceedings.open(req.body);
      res.status(201).json(proc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Transition state
  router.post('/:id/transition', (req, res) => {
    try {
      const proc = inst.proceedings.transition(req.params.id, req.body.status);
      res.json(proc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update framing
  router.post('/:id/framing', (req, res) => {
    try {
      const proc = inst.proceedings.updateFraming(req.params.id, req.body);
      res.json(proc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Update attention
  router.post('/:id/attention', (req, res) => {
    try {
      const proc = inst.proceedings.updateAttention(req.params.id, req.body);
      res.json(proc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Add signal
  router.post('/:id/signals', (req, res) => {
    try {
      const proc = inst.proceedings.addSignal(req.params.id, req.body.signal_id);
      res.json(proc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Get interventions for proceeding
  router.get('/:id/interventions', (req, res) => {
    try {
      res.json(inst.interventions.forProceeding(req.params.id));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get synthesis for proceeding
  router.get('/:id/synthesis', (req, res) => {
    try {
      const latest = inst.synthesis.latest(req.params.id);
      if (!latest) return res.json(null);
      res.json(latest);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get synthesis history for proceeding
  router.get('/:id/synthesis/history', (req, res) => {
    try {
      res.json(inst.synthesis.history(req.params.id));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = proceedingsRoutes;
