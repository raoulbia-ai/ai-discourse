'use strict';

const express = require('express');

/**
 * Cycles routes — cycle history and snapshots.
 * @param {import('../../storage/file-store')} store
 */
function cyclesRoutes(store) {
  const router = express.Router();

  // Get all cycle snapshots
  router.get('/', (req, res) => {
    try {
      res.json(store.getCycleSnapshots());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get latest cycle
  router.get('/latest', (req, res) => {
    try {
      const latest = store.getLatestCycle();
      if (!latest) return res.json(null);
      res.json(latest);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = cyclesRoutes;
