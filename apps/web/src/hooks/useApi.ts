import { useEffect, useState } from "react";
import { errorMessage } from "../lib/errors.js";

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Small fetch-on-mount/on-deps-change hook shared by every page — avoids
 * repeating the same loading/error/cancelled-request boilerplate six times.
 * `deps` should list everything the fetcher's result depends on (filters,
 * page number, ...); the fetcher itself is intentionally NOT a dependency,
 * so callers can pass a fresh inline arrow function each render.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[]): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `fetcher` is intentionally excluded from deps — see the doc comment above.
  }, [...deps, reloadToken]);

  return { data, loading, error, reload: () => setReloadToken((t) => t + 1) };
}
