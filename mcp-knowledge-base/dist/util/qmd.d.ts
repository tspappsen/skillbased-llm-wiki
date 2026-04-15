export interface QmdResult {
    title: string;
    path: string;
    snippet: string;
    score: number;
}
export declare function isQmdAvailable(): Promise<boolean>;
export declare function ensureCollection(rawDir: string): Promise<void>;
export declare function updateIndex(): Promise<void>;
export declare function embedIndex(): Promise<void>;
export declare function search(query: string, n: number): Promise<QmdResult[]>;
export declare function hybridQuery(query: string, n: number): Promise<QmdResult[]>;
