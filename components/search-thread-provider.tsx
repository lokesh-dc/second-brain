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
import { askMind } from "@/actions/search";
import {
  Entry,
  RetrievalAnswer,
  RetrievalHistoryTurn,
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
  | { type: "CLEAR" };

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
function toHistory(turns: ThreadTurn[]): RetrievalHistoryTurn[] {
  return turns
    .filter((t) => t.status === "done")
    .slice(-5)
    .map((t) => ({ query: t.query, answer: t.answer }));
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
      history: RetrievalHistoryTurn[],
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
