'use strict';

const express = require('express');

/**
 * Agenda routes — institutional attention allocation.
 * @param {import('../../core').createInstitution} inst
 */
function agendaRoutes(inst) {
  const router = express.Router();

  // Get ranked proceedings
  router.get('/', (req, res) => {
    try {
      res.json(inst.agenda.getRankedProceedings());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get all watchlists
  router.get('/watchlists', (req, res) => {
    try {
      res.json(inst.agenda.listAll());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get agent watchlist
  router.get('/watchlists/:agent_id', (req, res) => {
    try {
      res.json(inst.agenda.getWatchlist(req.params.agent_id));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Watch a proceeding
  router.post('/watch', (req, res) => {
    try {
      const result = inst.agenda.watch(req.body.agent_id, req.body.proceeding_id);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Unwatch a proceeding
  router.post('/unwatch', (req, res) => {
    try {
      const result = inst.agenda.unwatch(req.body.agent_id, req.body.proceeding_id);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Prune resolved proceedings
  router.post('/prune', (req, res) => {
    try {
      res.json(inst.agenda.prune());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = agendaRoutes;
