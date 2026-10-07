export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon?: string;
  is_default: boolean;
};

export type EntityType = string; // Dynamic string to allow any AI-generated type

export type Entity = {
  id: string;
  user_id: string;
  name: string;
  type: EntityType;
};

export type Entry = {
  id: string;
  user_id: string;
  raw_text: string;
  category_id?: string;
  summary?: string;
  amount?: number;
  currency?: string;
  timestamp: string;
  embedding?: number[];
  category?: Category;
  entities?: Entity[];
  tags?: string[];
  embedding_doc?: string;
  retrieval_count?: number;
  last_retrieved_at?: string | null;
};

export type EntryEntity = {
  entry_id: string;
  entity_id: string;
};

/**
 * One row of the `match_documents_filtered` RPC result.
 * Mirrors supabase/migrations/0002_match_documents_filtered.sql — keep in sync.
 * Reconstruct Entry via category_id/category_name and the entities jsonb array.
 */
export type MatchDocumentsRow = {
  id: string;
  user_id: string;
  raw_text: string;
  category_id: string | null;
  category_name: string | null;
  category_user_id: string | null;
  category_icon: string | null;
  category_is_default: boolean | null;
  summary: string | null;
  amount: number | null;
  currency: string | null;
  timestamp: string;
  tags: string[] | null;
  embedding_doc: string | null;
  entities:
    | Array<{
        id: string;
        user_id: string;
        name: string;
        type: string | null;
      }>
    | null;
  similarity: number;
};

export type EntityInput = {
  name: string;
  type: EntityType;
};

export type EntryEditData = {
  raw_text: string;
  category: string;
  summary: string;
  amount: number | null;
  currency: string | null;
  tags: string[];
  entities: EntityInput[];
};

export type ClassifierItem = {
  category:
    | "expense"
    | "reading"
    | "idea"
    | "travel"
    | "shopping"
    | "health"
    | "media"
    | "misc";
  entities: EntityInput[];
  amount: number | null;
  currency: string | null;
  summary: string;
  tags: string[];
  embedding_doc: string;
};

export type ClassifierResult = {
  items: ClassifierItem[];
};

export type TimeFilter = {
  type: "relative" | "absolute" | null;
  range:
    | "today"
    | "yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month"
    | null;
  from: string | null;
  to: string | null;
};

export type ParsedQuery = {
  intent: "retrieve" | "log";
  rewritten_query: string;
  category_filter:
    | "expense"
    | "reading"
    | "idea"
    | "travel"
    | "shopping"
    | "health"
    | "media"
    | "misc"
    | null;
  time_filter: TimeFilter;
  entity_filter: string | null;
  aggregation: "sum" | "count" | "list" | null;
};

export type RetrievalAnswer = {
  answer: string;
  entry_ids: string[];
  followups: string[];
  type: "answer" | "no_match";
};

/** Minimal prior-turn context sent back to the retrieval route on follow-ups. */
export type RetrievalHistoryTurn = {
  query: string;
  answer: string;
};

/** Thread history as passed from the client: answers plus cited entry ids. */
export type AskHistoryTurn = RetrievalHistoryTurn & {
  entryIds: string[];
};

export type ThreadTurnStatus = "loading" | "done" | "error";

/** One question in a Search thread: its answer plus its own sources. */
export type ThreadTurn = {
  id: string;
  query: string;
  answer: string;
  entryIds: string[];
  /** Resolved entries for rendering (snapshot; reconciled with fresh data). */
  entries: Entry[];
  followups: string[];
  type: "answer" | "no_match";
  status: ThreadTurnStatus;
  createdAt: number;
};

export type DigestPeriod = "today" | "week" | "month";

export type DigestRawData = {
  entryCountByCategory: Record<string, number>;
  totalAmountByCategory: Record<string, number>;
  biggestExpense?: {
    amount: number;
    currency: string;
    summary: string;
    timestamp: string;
  };
  topEntity?: {
    name: string;
    count: number;
  };
};

export type Digest = {
  id: string;
  user_id: string;
  period: DigestPeriod;
  generated_at: string;
  narrative: string;
  raw_data: DigestRawData;
};
