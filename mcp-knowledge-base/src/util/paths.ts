import os from "node:os";
import path from "node:path";
import { mkdir, access } from "node:fs/promises";

export const KB_ROOT = path.join(os.homedir(), ".cache", "kb");
export const RAW_DIR = path.join(KB_ROOT, "raw");
export const WIKI_DIR = path.join(KB_ROOT, "wiki");

export async function bootstrap(): Promise<void> {
  await Promise.all([
    mkdir(RAW_DIR, { recursive: true }),
    mkdir(WIKI_DIR, { recursive: true }),
  ]);
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "") || "note";
}

export async function uniqueFilePath(rawDir: string, date: string, slug: string): Promise<string> {
  const baseName = `${date}-${slug}`;

  for (let index = 1; ; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const candidate = path.join(rawDir, `${baseName}${suffix}.md`);

    try {
      await access(candidate);
    } catch {
      return candidate;
    }
  }
}
