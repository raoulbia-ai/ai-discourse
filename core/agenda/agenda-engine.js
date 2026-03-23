'use strict';

/**
 * Agenda Engine — manages institutional attention allocation.
 *
 * Controls which proceedings get focus. Agents can watch/unwatch proceedings.
 * Max N proceedings per agent watchlist.
 */

const DEFAULT_MAX_WATCHLIST = 5;

class AgendaEngine {
  /**
   * @param {import('../../storage/file-store')} store
   * @param {{ maxWatchlist?: number }} [opts]
   */
  constructor(store, opts = {}) {
    this.store = store;
    this.maxWatchlist = opts.maxWatchlist || DEFAULT_MAX_WATCHLIST;
  }

  /**
   * Get an agent's watchlist.
   */
  getWatchlist(agentId) {
    const data = this.store.getAgenda();
    return data[agentId] || [];
  }

  /**
   * Add a proceeding to an agent's watchlist.
   */
  watch(agentId, proceedingId) {
    const data = this.store.getAgenda();
    if (!data[agentId]) data[agentId] = [];

    if (data[agentId].find(e => e.proceeding_id === proceedingId)) {
      return { status: 'already_watching', agent_id: agentId, proceeding_id: proceedingId };
    }

    if (data[agentId].length >= this.maxWatchlist) {
      throw new Error(`Watchlist full (max ${this.maxWatchlist}). Unwatch a proceeding first.`);
    }

    data[agentId].push({ proceeding_id: proceedingId, added_at: new Date().toISOString() });
    this.store.saveAgenda(data);
    return { status: 'watching', agent_id: agentId, proceeding_id: proceedingId };
  }

  /**
   * Remove a proceeding from an agent's watchlist.
   */
  unwatch(agentId, proceedingId) {
    const data = this.store.getAgenda();
    if (!data[agentId]) return { status: 'not_watching', agent_id: agentId, proceeding_id: proceedingId };

    const before = data[agentId].length;
    data[agentId] = data[agentId].filter(e => e.proceeding_id !== proceedingId);
    if (data[agentId].length === before) {
      return { status: 'not_watching', agent_id: agentId, proceeding_id: proceedingId };
    }

    this.store.saveAgenda(data);
    return { status: 'unwatched', agent_id: agentId, proceeding_id: proceedingId };
  }

  /**
   * Get all watchlists.
   */
  listAll() {
    return this.store.getAgenda();
  }

  /**
   * Prune resolved/archived proceedings from all watchlists.
   */
  prune() {
    const data = this.store.getAgenda();
    const proceedings = this.store.getProceedings();
    const removableIds = new Set(
      proceedings.filter(p => ['archived', 'retired', 'settled'].includes(p.status)).map(p => p.id)
    );

    let pruned = 0;
    for (const agentId of Object.keys(data)) {
      const before = data[agentId].length;
      data[agentId] = data[agentId].filter(e => !removableIds.has(e.proceeding_id));
      pruned += before - data[agentId].length;
    }

    this.store.saveAgenda(data);
    return { status: 'pruned', removed: pruned };
  }

  /**
   * Get ranked proceedings by attention scores.
   */
  getRankedProceedings() {
    const proceedings = this.store.getProceedings()
      .filter(p => !['archived', 'retired'].includes(p.status));

    return proceedings
      .filter(p => p.attention)
      .sort((a, b) => (b.attention.priority || 0) - (a.attention.priority || 0));
  }
}

module.exports = { AgendaEngine, DEFAULT_MAX_WATCHLIST };
