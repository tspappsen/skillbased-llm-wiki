import { writeFile } from "node:fs/promises";
import { bootstrap, RAW_DIR, slugify, uniqueFilePath } from "../util/paths.js";
import { embedIndex, ensureCollection, isQmdAvailable, updateIndex } from "../util/qmd.js";

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

function validateString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function formatFrontmatter(title: string, tags: string[] | undefined, date: string, content: string): string {
  const lines = ["---", `title: ${title}`, `created: ${date}`];

  if (tags && tags.length > 0) {
    lines.splice(2, 0, `tags: [${tags.map((tag) => JSON.stringify(tag)).join(", ")}]`);
  }

  return `${lines.join("\n")}\n---\n\n${content}`;
}

export async function handleAdd(input: AddInput): Promise<AddResult> {
  const title = validateString(input.title, "title");
  const content = validateString(input.content, "content");
  const tags = input.tags?.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);

  await bootstrap();

  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const filePath = await uniqueFilePath(RAW_DIR, date, slug);
  const markdown = formatFrontmatter(title, tags, date, content);

  await writeFile(filePath, markdown, "utf8");

  if (!(await isQmdAvailable())) {
    return {
      path: filePath,
      indexed: false,
      warning: "QMD not found; file was stored but indexing was skipped.",
    };
  }

  try {
    await ensureCollection(RAW_DIR);
    await updateIndex();
    await embedIndex();
    return { path: filePath, indexed: true };
  } catch (error) {
    const warning = error instanceof Error ? error.message : String(error);
    return {
      path: filePath,
      indexed: false,
      warning: `QMD indexing failed: ${warning}`,
    };
  }
}
