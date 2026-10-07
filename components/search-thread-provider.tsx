"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { askMind, fetchEntriesByIds } from "@/actions/search";
import {
  AskHistoryTurn,
  Entry,
  RetrievalAnswer,
  ThreadTurn,
} from "@/types";

type ThreadAction =
  | { type: "ASK_START"; id: string; query: string; createdAt: number }
  | { type: "RETRY_START"; id: string }
  | {
      type: "ASK_DONE";
      id: string;
      answer: RetrievalAnswer;
      entries: Entry[];
    }
  | { type: "ASK_ERROR"; id: string }
  | { type: "CLEAR" }
  | { type: "REHYDRATE"; turns: ThreadTurn[] }
  | { type: "RECONCILE"; fresh: Entry[]; fetchedIds: Set<string> };

function threadReducer(state: ThreadTurn[], action: ThreadAction): ThreadTurn[] {
  switch (action.type) {
    case "ASK_START":
      return [
        ...state,
        {
          id: action.id,
          query: action.query,
          answer: "",
          entryIds: [],
          entries: [],
          followups: [],
          breakdown: null,
          type: "answer" as const,
          status: "loading" as const,
          createdAt: action.createdAt,
        },
      ];
    case "RETRY_START":
      return state.map((t) =>
        t.id === action.id ? { ...t, status: "loading" as const } : t,
      );
    case "ASK_DONE":
      return state.map((t) =>
        t.id === action.id
          ? {
              ...t,
              status: "done" as const,
              answer: action.answer.answer,
              entryIds: action.answer.entry_ids,
              entries: action.entries,
              followups: action.answer.followups,
              breakdown: action.answer.breakdown ?? null,
              type: action.answer.type,
            }
          : t,
      );
    case "ASK_ERROR":
      return state.map((t) =>
        t.id === action.id ? { ...t, status: "error" as const } : t,
      );
    case "CLEAR":
      return [];
    case "REHYDRATE":
      return action.turns;
    case "RECONCILE": {
      // Ids covered by the re-fetch are authoritative: a cited id missing
      // from fresh rows was deleted since — drop it from sources. Ids the
      // fetch did not cover (e.g. newer turns) keep their resolution.
      const byId = new Map(action.fresh.map((e) => [e.id, e]));
      return state.map((t) => ({
        ...t,
        entries: t.entryIds.flatMap((id) =>
          action.fetchedIds.has(id)
            ? (byId.get(id) ?? [])
            : (t.entries.find((e) => e.id === id) ?? []),
        ),
      }));
    }
  }
}

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Last 5 completed turns as model context, oldest first. */
function toHistory(turns: ThreadTurn[]): AskHistoryTurn[] {
  return turns
    .filter((t) => t.status === "done")
    .slice(-5)
    .map((t) => ({ query: t.query, answer: t.answer, entryIds: t.entryIds }));
}

const STORAGE_KEY = "mindrop:search-thread:v1";
const MAX_STORED_TURNS = 30;

function isValidTurn(t: unknown): t is ThreadTurn {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.query === "string" &&
    typeof o.answer === "string" &&
    Array.isArray(o.entryIds) &&
    Array.isArray(o.entries) &&
    Array.isArray(o.followups) &&
    (o.type === "answer" || o.type === "no_match") &&
    (o.status === "done" || o.status === "error" || o.status === "loading") &&
    typeof o.createdAt === "number"
  );
}

/** Read the persisted thread; never throws (private mode, quota, bad JSON). */
function loadThread(): ThreadTurn[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isValidTurn)
      .slice(-MAX_STORED_TURNS)
      .map((t) =>
        // A turn caught mid-flight by a refresh can never complete —
        // surface it as retryable instead of a stuck skeleton.
        t.status === "loading" ? { ...t, status: "error" as const } : t,
      );
  } catch {
    return [];
  }
}

/** Persist the thread; never throws. */
function saveThread(turns: ThreadTurn[]): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(turns.slice(-MAX_STORED_TURNS)),
    );
  } catch {
    // Storage full or unavailable — the thread just won't survive refresh.
  }
}

function clearStoredThread(): void {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — nothing to clear.
  }
}

interface AskThreadContextValue {
  turns: ThreadTurn[];
  hasTurns: boolean;
  isAsking: boolean;
  ask: (query: string) => Promise<void>;
  retry: (turnId: string) => Promise<void>;
  clear: () => void;
  /** Search screen registers its fresh entries so ids resolve to Entry objects. */
  setEntriesCache: (entries: Entry[]) => void;
}

const AskThreadContext = createContext<AskThreadContextValue | null>(null);

/**
 * Owns the Search thread. Mounted in (app)/layout so navigating to another
 * tab does not unmount it; turns also survive refresh via sessionStorage
 * (Task 8). Follow-ups stack as new turns — nothing is ever replaced.
 */
export function SearchThreadProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [turns, dispatch] = useReducer(threadReducer, []);

  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const rehydratedRef = useRef(false);
  const skipFirstSaveRef = useRef(true);

  // Rehydrate once on mount (client-only effect: no SSR/hydration mismatch).
  // Then re-fetch every cited id so sources resolve against fresh rows and
  // entries deleted since simply disappear from sources.
  useEffect(() => {
    const stored = loadThread();
    if (stored.length === 0) {
      rehydratedRef.current = true;
      return;
    }
    dispatch({ type: "REHYDRATE", turns: stored });
    rehydratedRef.current = true;
    const ids = [...new Set(stored.flatMap((t) => t.entryIds))].slice(0, 200);
    if (ids.length === 0) return;
    const fetchedIds = new Set(ids);
    void fetchEntriesByIds(ids)
      .then((fresh) => dispatch({ type: "RECONCILE", fresh, fetchedIds }))
      .catch((err) => console.error("[search] thread reconcile failed:", err));
  }, []);

  // Persist on every change, except the initial mount render (which would
  // overwrite the stored thread with [] before rehydration runs).
  useEffect(() => {
    if (!rehydratedRef.current) return;
    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }
    saveThread(turns);
  }, [turns]);

  const cacheRef = useRef(new Map<string, Entry>());

  const setEntriesCache = useCallback((entries: Entry[]) => {
    for (const e of entries) cacheRef.current.set(e.id, e);
  }, []);

  const resolveIds = useCallback((ids: string[]): Entry[] => {
    const out: Entry[] = [];
    for (const id of ids) {
      const hit = cacheRef.current.get(id);
      if (hit) out.push(hit);
    }
    return out;
  }, []);

  const runAsk = useCallback(
    async (
      id: string,
      query: string,
      history: AskHistoryTurn[],
    ): Promise<void> => {
      try {
        const response = await askMind(query, history);
        if (!response) {
          dispatch({ type: "ASK_ERROR", id });
          return;
        }
        dispatch({
          type: "ASK_DONE",
          id,
          answer: response,
          entries: resolveIds(response.entry_ids),
        });
      } catch (err) {
        console.error("[search] ask failed:", err);
        dispatch({ type: "ASK_ERROR", id });
      }
    },
    [resolveIds],
  );

  const ask = useCallback(
    async (query: string): Promise<void> => {
      const q = query.trim();
      if (!q) return;
      // One in-flight turn at a time keeps history + ordering sane.
      if (turnsRef.current.some((t) => t.status === "loading")) return;
      const id = makeId();
      const history = toHistory(turnsRef.current);
      dispatch({ type: "ASK_START", id, query: q, createdAt: Date.now() });
      await runAsk(id, q, history);
    },
    [runAsk],
  );

  const retry = useCallback(
    async (turnId: string): Promise<void> => {
      const all = turnsRef.current;
      const idx = all.findIndex((t) => t.id === turnId);
      if (idx === -1 || all[idx].status === "loading") return;
      const history = toHistory(all.slice(0, idx));
      dispatch({ type: "RETRY_START", id: turnId });
      await runAsk(turnId, all[idx].query, history);
    },
    [runAsk],
  );

  const clear = useCallback(() => {
    dispatch({ type: "CLEAR" });
    clearStoredThread();
    // TODO(phase-2): also delete persisted Supabase thread history once it exists.
  }, []);

  const value = useMemo<AskThreadContextValue>(
    () => ({
      turns,
      hasTurns: turns.length > 0,
      isAsking: turns.some((t) => t.status === "loading"),
      ask,
      retry,
      clear,
      setEntriesCache,
    }),
    [turns, ask, retry, clear, setEntriesCache],
  );

  return (
    <AskThreadContext.Provider value={value}>
      {children}
    </AskThreadContext.Provider>
  );
}

export function useAskThread(): AskThreadContextValue {
  const ctx = useContext(AskThreadContext);
  if (!ctx) throw new Error("useAskThread must be used inside SearchThreadProvider");
  return ctx;
}
