import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function resolveQmdArgs(args: string[]): { command: string; args: string[] } {
  if (process.platform === "win32") {
    // The npm global qmd.cmd shim uses /bin/sh and won't work via execFile on Windows.
    // Invoke node directly with the actual qmd CLI entry point.
    const qmdJs = path.join(
      os.homedir(), "AppData", "Roaming", "npm",
      "node_modules", "@tobilu", "qmd", "dist", "cli", "qmd.js",
    );
    return { command: process.execPath, args: [qmdJs, ...args] };
  }
  return { command: "qmd", args };
}

export interface QmdResult {
  title: string;
  path: string;
  snippet: string;
  score: number;
}

type RawQmdResult = {
  file?: string;
  path?: string;
  score?: number;
  snippet?: string;
  content?: string;
  title?: string;
};

async function runQmd(args: string[]): Promise<string> {
  const resolved = resolveQmdArgs(args);
  const { stdout } = await execFileAsync(resolved.command, resolved.args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

function mapResult(result: RawQmdResult): QmdResult {
  const filePath = result.file ?? result.path ?? "";
  const derivedTitle = path.basename(filePath, path.extname(filePath)) || "untitled";

  return {
    title: result.title ?? derivedTitle,
    path: filePath,
    snippet: result.snippet ?? result.content ?? "",
    score: typeof result.score === "number" ? result.score : 0,
  };
}

function parseResults(stdout: string): QmdResult[] {
  const parsed = JSON.parse(stdout) as RawQmdResult[] | { results?: RawQmdResult[] };
  const results = Array.isArray(parsed) ? parsed : parsed.results ?? [];
  return results.map(mapResult);
}

export async function isQmdAvailable(): Promise<boolean> {
  try {
    await runQmd(["--help"]);
    return true;
  } catch {
    return false;
  }
}

export async function ensureCollection(rawDir: string): Promise<void> {
  try {
    await runQmd(["--index", "kb", "collection", "add", rawDir, "--name", "raw", "--mask", "**/*.md"]);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (!message.includes("already exists")) {
      throw error;
    }
  }
}

export async function updateIndex(): Promise<void> {
  await runQmd(["--index", "kb", "update"]);
}

export async function embedIndex(): Promise<void> {
  await runQmd(["--index", "kb", "embed"]);
}

export async function search(query: string, n: number): Promise<QmdResult[]> {
  const stdout = await runQmd(["--index", "kb", "search", query, "--json", "-n", String(n)]);
  return parseResults(stdout);
}

export async function hybridQuery(query: string, n: number): Promise<QmdResult[]> {
  try {
    const stdout = await runQmd(["--index", "kb", "query", query, "--json", "-n", String(n)]);
    return parseResults(stdout);
  } catch {
    return search(query, n);
  }
}
