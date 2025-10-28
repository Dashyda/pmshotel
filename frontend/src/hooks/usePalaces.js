import { useCallback, useEffect, useState } from 'react';
import { alojamientosAPI, handleAPIError } from '../services/api';

const defaultSort = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return [...items].sort((a, b) => (a?.seriesNumber || 0) - (b?.seriesNumber || 0));
};

export const usePalaces = ({
  autoLoad = true,
  transform,
  sort = defaultSort,
  includeSummary = false
} = {}) => {
  const [palaces, setPalaces] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(autoLoad);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await alojamientosAPI.getPalaces();
      const raw = data?.palaces ?? data?.data ?? data ?? [];

      const normalized = Array.isArray(raw)
        ? sort
          ? sort(raw.slice())
          : raw
        : [];

      const transformed = typeof transform === 'function' ? transform(normalized) : normalized;

      setPalaces(transformed);

      if (includeSummary) {
        setSummary(data?.summary ?? data?.data?.summary ?? null);
      }

      setLastUpdated(new Date());

      return {
        palaces: transformed,
        summary: includeSummary ? data?.summary ?? data?.data?.summary ?? null : null
      };
    } catch (err) {
      const friendly = handleAPIError(err);
      setError(friendly);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [includeSummary, sort, transform]);

  useEffect(() => {
    if (!autoLoad) {
      return;
    }

    load().catch(() => {
      /* La gestión del error ya se maneja en el hook */
    });
  }, [autoLoad, load]);

  return {
    palaces,
    setPalaces,
    summary,
    loading,
    error,
    lastUpdated,
    refresh: load
  };
};
