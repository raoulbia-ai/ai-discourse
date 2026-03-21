'use strict';

const express = require('express');

/**
 * Signals routes — ingest and query raw observations.
 * @param {import('../../storage/file-store')} store
 */
function signalsRoutes(store) {
  const router = express.Router();

  // Query signals
  router.get('/', (req, res) => {
    try {
      const filters = {};
      if (req.query.source) filters.source = req.query.source;
      if (req.query.tag) filters.tag = req.query.tag;
      res.json(store.readSignals(filters));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Create signal
  router.post('/', (req, res) => {
    try {
      const signal = store.appendSignal({
        id: req.body.id || 'sig_' + Date.now(),
        ...req.body,
        ingested_at: new Date().toISOString(),
      });
      res.status(201).json(signal);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  return router;
}

module.exports = signalsRoutes;
