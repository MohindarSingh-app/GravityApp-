import { useCallback, useEffect, useState } from 'react';
import { catalogApi } from '../api/resources';
import { getErrorMessage } from '../utils/errors';

const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export function cachedCatalog(group) {
  const entry = cache.get(group);
  return entry ? entry.items : null;
}

function fresh(groups) {
  const now = Date.now();
  return groups.every((group) => {
    const entry = cache.get(group);
    return entry && now - entry.at < TTL_MS;
  });
}

function snapshot(groups) {
  const result = {};
  groups.forEach((group) => { result[group] = cachedCatalog(group) || []; });
  return result;
}

export async function loadCatalog(groups, force = false) {
  if (!force && fresh(groups)) return snapshot(groups);
  const data = await catalogApi.groups(groups);
  const loaded = (data && data.groups) || {};
  const at = Date.now();
  groups.forEach((group) => cache.set(group, { items: loaded[group] || [], at }));
  return snapshot(groups);
}

export function useCatalog(...groups) {
  const key = groups.join(',');
  const [state, setState] = useState(() => ({
    groups: snapshot(groups),
    loading: !fresh(groups),
    error: '',
  }));

  const reload = useCallback(async (force = true) => {
    const list = key.split(',');
    setState((current) => ({ ...current, loading: !fresh(list) || force, error: '' }));
    try {
      const next = await loadCatalog(list, force);
      setState({ groups: next, loading: false, error: '' });
    } catch (err) {
      setState((current) => ({ ...current, loading: false, error: getErrorMessage(err) }));
    }
  }, [key]);

  useEffect(() => {
    reload(false);
  }, [reload]);

  return { ...state, reload };
}
