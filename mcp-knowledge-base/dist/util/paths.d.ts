export declare const KB_ROOT: string;
export declare const RAW_DIR: string;
export declare const WIKI_DIR: string;
export declare function bootstrap(): Promise<void>;
export declare function slugify(title: string): string;
export declare function uniqueFilePath(rawDir: string, date: string, slug: string): Promise<string>;
