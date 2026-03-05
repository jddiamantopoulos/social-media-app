/**
 * Page-level state cache for React Router routes.
 *
 * Provides a usePageState hook that behaves like useState but scopes
 * state to a specific browser history entry (page instance). State is
 * cached in memory and mirrored to sessionStorage so it survives
 * navigation, back/forward actions, and refreshes within the same tab.
 *
 * Also exposes:
 *   - PageStateCacheProvider (in-memory cache context)
 *   - useNewInstanceNav (helper to force a new page instance)
 */
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Cache = Map<string, unknown>;

const Ctx = React.createContext<{
  cache: Cache;
}>({ cache: new Map() });

export const PageStateCacheProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const cacheRef = React.useRef<Cache>(new Map());
  return (
    <Ctx.Provider value={{ cache: cacheRef.current }}>{children}</Ctx.Provider>
  );
};

// Safe JSON sessionStorage helpers
function ssGet<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function ssSet<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
function ssDel(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

// Give each history entry its own stable page-instance id (pid)
function usePageInstanceId() {
  const location = useLocation();
  const navigate = useNavigate();
  // Capture existing pid or mint a new one once
  const initialPid =
    (location.state as any)?.pid ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : Math.random().toString(36).slice(2));
  const pidRef = React.useRef<string>(initialPid);

  // Ensure the current history entry carries the pid
  React.useEffect(() => {
    if (!(location.state as any)?.pid) {
      navigate(".", {
        replace: true,
        state: { ...(location.state || {}), pid: pidRef.current },
      });
    }
    // Run when path/search changes, but not on back/forward since those already have state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return pidRef.current;
}

// Build a fully qualified cache key for this page instance + subkey
function useFullKey(subkey: string) {
  const location = useLocation();
  const pid = usePageInstanceId();
  return React.useMemo(
    () => `psc::${location.pathname}${location.search}::${pid}::${subkey}`,
    [location.pathname, location.search, pid, subkey]
  );
}

// Hook that works like useState scoped to a specific page instance; restores from memory/sessionStorage and persists on change
export function usePageState<T>(
  subkey: string,
  initial: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const { cache } = React.useContext(Ctx);
  const fullKey = useFullKey(subkey);

  const [value, setValue] = React.useState<T>(() => {
    if (cache.has(fullKey)) return cache.get(fullKey) as T;
    const stored = ssGet<T>(fullKey);
    if (stored !== undefined) return stored;
    return typeof initial === "function" ? (initial as any)() : initial;
  });

  React.useEffect(() => {
    cache.set(fullKey, value);
    ssSet(fullKey, value);
  }, [cache, fullKey, value]);

  const clear = React.useCallback(() => {
    cache.delete(fullKey);
    ssDel(fullKey);
  }, [cache, fullKey]);

  return [value, setValue, clear];
}

// Helper for links/buttons to create a new instance
export function useNewInstanceNav() {
  const navigate = useNavigate();
  return React.useCallback(
    (to: string) => {
      navigate(to, {
        // Push a new entry; page will mint a new pid automatically
        replace: false,
        state: {},
      });
    },
    [navigate]
  );
}
