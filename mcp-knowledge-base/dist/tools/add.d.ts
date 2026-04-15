export interface AddInput {
    title: string;
    content: string;
    tags?: string[];
}
export interface AddResult {
    path: string;
    indexed: boolean;
    warning?: string;
}
export declare function handleAdd(input: AddInput): Promise<AddResult>;
