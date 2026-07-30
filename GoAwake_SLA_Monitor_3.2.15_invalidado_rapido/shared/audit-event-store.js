(function (global) {
  'use strict';

  var storageConfig = global.GoAwakeProductivityConfig.liveCollection;
  var KEY = storageConfig.storageKey;
  var MAX_EVENTS = storageConfig.maxEvents;

  function serialize(record) {
    var copy = Object.assign({}, record);
    ['treatedAt', 'availableAt', 'startedAt', 'collectedAt'].forEach(function (field) {
      copy[field] = copy[field] instanceof Date ? copy[field].toISOString() : (copy[field] || null);
    });
    delete copy._inputIndex;
    return copy;
  }

  function deserialize(record) {
    var copy = Object.assign({}, record);
    ['treatedAt', 'availableAt', 'startedAt', 'collectedAt'].forEach(function (field) {
      copy[field] = copy[field] ? new Date(copy[field]) : null;
    });
    return copy;
  }

  async function load() {
    var result = await chrome.storage.local.get(KEY);
    return (result[KEY] || []).map(deserialize);
  }

  function fingerprint(record) {
    return record.eventFingerprint ||
      global.GoAwakeAuditNormalizer.eventFingerprint(record);
  }

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function mergeRecord(existing, incoming) {
    var merged = Object.assign({}, existing);
    [
      'auditId', 'author', 'plate', 'driver', 'treatment', 'classification',
      'originalAlert', 'treatedAtText', 'availableAtText', 'startedAtText',
      'source'
    ].forEach(function (field) {
      if (hasValue(incoming[field])) merged[field] = incoming[field];
    });

    ['treatedAt', 'startedAt'].forEach(function (field) {
      if (incoming[field] instanceof Date && !Number.isNaN(incoming[field].getTime())) {
        merged[field] = incoming[field];
      }
    });

    if (Number.isFinite(incoming.durationMinutes) && incoming.durationMinutes >= 0) {
      merged.durationMinutes = incoming.durationMinutes;
      if (incoming.availableAt instanceof Date && !Number.isNaN(incoming.availableAt.getTime())) {
        merged.availableAt = incoming.availableAt;
      }
    }

    var existingCollected = existing.collectedAt instanceof Date ? existing.collectedAt.getTime() : 0;
    var incomingCollected = incoming.collectedAt instanceof Date ? incoming.collectedAt.getTime() : 0;
    merged.collectedAt = incomingCollected >= existingCollected
      ? (incoming.collectedAt || existing.collectedAt)
      : existing.collectedAt;
    merged.eventFingerprint = fingerprint(incoming);
    return merged;
  }

  async function append(records) {
    if (!records || !records.length) return { added: 0, total: (await load()).length };

    var current = await load();
    var byFingerprint = new Map();
    current.forEach(function (record) {
      var key = fingerprint(record);
      record.eventFingerprint = key;
      byFingerprint.set(key, record);
    });

    var added = 0;
    var updated = 0;
    records.forEach(function (record) {
      var key = fingerprint(record);
      record.eventFingerprint = key;
      if (byFingerprint.has(key)) {
        byFingerprint.set(key, mergeRecord(byFingerprint.get(key), record));
        updated += 1;
      } else {
        byFingerprint.set(key, record);
        added += 1;
      }
    });

    var merged = Array.from(byFingerprint.values()).sort(function (a, b) {
      var aTime = a.treatedAt instanceof Date ? a.treatedAt.getTime() :
        (a.collectedAt instanceof Date ? a.collectedAt.getTime() : 0);
      var bTime = b.treatedAt instanceof Date ? b.treatedAt.getTime() :
        (b.collectedAt instanceof Date ? b.collectedAt.getTime() : 0);
      return aTime - bTime;
    });
    if (merged.length > MAX_EVENTS) merged = merged.slice(merged.length - MAX_EVENTS);

    await chrome.storage.local.set({ [KEY]: merged.map(serialize) });
    return { added: added, updated: updated, total: merged.length };
  }

  async function loadPeriod(start, end) {
    var all = await load();
    return all.filter(function (record) {
      return record.treatedAt instanceof Date && record.treatedAt >= start && record.treatedAt <= end;
    });
  }

  async function clear() {
    await chrome.storage.local.remove(KEY);
  }

  global.GoAwakeAuditEventStore = {
    load: load,
    append: append,
    loadPeriod: loadPeriod,
    clear: clear
  };
})(window);
