import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLeadSources } from "../services/hubspotLeadSources.js";

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Loads lead-source data (live HubSpot pull, or the labeled demo set while no
 * VITE_HUBSPOT_API_TOKEN is configured) and exposes it to widgets.
 *
 * The hook keeps polling every minute while its consumer is mounted, so a
 * chart fed from `sources` re-renders itself whenever a fresh HubSpot pull
 * lands — including data changed by the manual "Refresh" action.
 *
 * Options:
 *   fetchImpl — fetch-like function (tests inject HubSpot pages here)
 *   token     — explicit HubSpot private-app token; overrides env lookup
 */
export function useLeadSourceData({ fetchImpl, token } = {}) {
  const [state, setState] = useState({
    sources: [],
    origin: null,
    lastUpdated: null,
    isLoading: true,
    error: null,
  });
  // Guards against a stale async response overwriting a newer one
  // (e.g. the periodic pull racing the manual refresh).
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const result = await fetchLeadSources({ fetchImpl, token });
      if (requestIdRef.current !== requestId) return; // stale response
      setState({
        sources: result.sources,
        origin: result.origin,
        lastUpdated: result.lastUpdated,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return; // stale failure
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load lead source data",
      }));
    }
  }, [fetchImpl]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { ...state, refresh: load };
}
