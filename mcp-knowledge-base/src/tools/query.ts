import { hybridQuery, isQmdAvailable, type QmdResult } from "../util/qmd.js";

export interface QueryInput {
  query: string;
  n?: number;
}

export interface QueryResult {
  results?: QmdResult[];
  error?: string;
}

export async function handleQuery(input: QueryInput): Promise<QueryResult> {
  if (typeof input.query !== "string" || input.query.trim().length === 0) {
    throw new Error("query is required");
  }

  const n = typeof input.n === "number" && Number.isFinite(input.n) && input.n > 0 ? Math.floor(input.n) : 5;

  if (!(await isQmdAvailable())) {
    return { error: "QMD not found. Install QMD to use kb_query." };
  }

  return {
    results: await hybridQuery(input.query.trim(), n),
  };
}
