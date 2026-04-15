import { type QmdResult } from "../util/qmd.js";
export interface QueryInput {
    query: string;
    n?: number;
}
export interface QueryResult {
    results?: QmdResult[];
    error?: string;
}
export declare function handleQuery(input: QueryInput): Promise<QueryResult>;
