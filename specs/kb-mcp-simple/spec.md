# A3 — KB MCP Server (simple)

**Story:** N/A — derived from global-kb-mcp-server spec, simplified
**PO:** —  |  **Dev:** —
**Date:** 2026-04-15
**Status:** Draft

---

## Background

The original global-kb-mcp-server spec (in this repo at `specs/global-kb-mcp-server/`) envisioned a server with 9 tools, CopilotClient integration, skill proposal detection, hub maintenance, and index management. Through design iteration we established that content transformation belongs agent-side (the `kb-global` skill) and the MCP server is just a storage + indexing engine. [from spec: global-kb-mcp-server/spec.md]

This spec takes that insight to its logical end: the simplest possible MCP server that does one thing well. It accepts a markdown file, writes it to `~/.cache/kb/raw/`, and submits it to QMD (`qmd ingest` + `qmd embed`). That's the entire critical path. [from interview]

The `~/.cache/kb/` directory also has a `wiki/` folder (and potentially hubs, index, etc.), but that structure is populated manually at a later stage — possibly by opening `~/.cache/kb/` as a workspace and running the llm-wiki skill's INGEST against the `raw/` folder. The MCP server doesn't touch `wiki/`. [from interview]

This replaces the original grand spec as the implementation target. The original spec remains as an architectural reference for future evolution.

## Current State

### What exists today

1. **No MCP server** — there is no tool-native way to write files to `~/.cache/kb/` from Copilot Chat. The `kb-global` skill (spec in this repo) can transform conversations into structured markdown, but has nowhere to send the result.

2. **QMD is installed** — the user has QMD available locally. It can index and search markdown collections. It stores its index in `~/.cache/qmd/` with per-collection isolation via `--index <name>`.

3. **`~/.cache/kb/` does not exist yet** — needs to be bootstrapped on first use.

### The gap in one sentence

The agent can produce structured markdown but can't write it to a persistent global directory. A process with filesystem access needs to receive it and store it. [from interview]

## Desired State

When this server is running:

1. **The `kb-global` skill can call `kb_add`** and a markdown file appears in `~/.cache/kb/raw/`. Done. [from interview]

2. **QMD indexes `raw/` immediately** after each write. The content is searchable via `kb_query` within seconds. [from interview]

3. **`kb_query` returns search results** from the QMD index. The skill presents them to the user. Cross-workspace knowledge recall works. [from interview]

4. **Setup is one line** in the user's VS Code MCP settings. No per-workspace configuration. [from interview]

5. **`~/.cache/kb/wiki/` exists but is empty.** The user can later open `~/.cache/kb/` in VS Code and use the llm-wiki skill to run INGEST on the `raw/` folder, producing curated wiki pages. The MCP server doesn't touch `wiki/`. [from interview]

## Goals

- G1: `kb_add` accepts markdown content + metadata, writes a file to `~/.cache/kb/raw/`, runs `qmd ingest` + `qmd embed`
- G2: `kb_query` accepts a search string, runs `qmd query` against the `raw` collection, returns ranked results
- G3: First run bootstraps `~/.cache/kb/raw/` and `~/.cache/kb/wiki/` directories if they don't exist
- G4: Setup is a single MCP server entry in VS Code settings — no other configuration

## Root Cause Analysis

Same as the original spec: Copilot Chat's file tools are scoped to the open workspace. MCP is the sanctioned extension point for external filesystem access. The simplest viable MCP server is one that receives content and writes it to disk. [from spec: global-kb-mcp-server/spec.md]

## Gap Analysis

| Gap | Change needed | Enables | Complexity | Dependencies |
|-----|--------------|---------|------------|--------------|
| G1 | **`kb_add` tool** — accepts `{ title: string, content: string, tags?: string[] }`. Generates filename as `YYYY-MM-DD-<slugified-title>.md`. Writes to `~/.cache/kb/raw/`. Runs `qmd ingest --index kb ~/.cache/kb/raw` then `qmd embed --index kb`. Returns the created file path. | Desired state 1, 2 | Simple — file write + two shell commands | QMD installed |
| G2 | **`kb_query` tool** — accepts `{ query: string, n?: number }`. Runs `qmd query --index kb "<query>"` (or `qmd search --index kb "<query>"` as BM25 fallback if embeddings aren't ready). Parses output, returns ranked results with title, path, and snippet. | Desired state 3 | Simple — one shell command + output parsing | G1 (collection must exist), QMD installed |
| G3 | **Bootstrap on first use** — when `kb_add` is called and `~/.cache/kb/raw/` doesn't exist, create the directory tree: `~/.cache/kb/raw/`, `~/.cache/kb/wiki/`. No index.md, no hubs, no log — just the directories. | Desired state 5 | Trivial — `mkdir -p` equivalent | None |
| G4 | **MCP server scaffold** — stdio transport, Node.js. Registers two tools (`kb_add`, `kb_query`). Entry point: `node dist/index.js` or `npx` invocation. | All goals | Simple — MCP SDK scaffold | `@modelcontextprotocol/sdk` |

**Dependency order:** G4 → G3 → G1 → G2

## Constraints

- **Stupid-simple** — two tools, no LLM calls, no CopilotClient, no post-processing, no hubs, no index maintenance. If a feature doesn't serve "write markdown + index it + query it", it doesn't belong here. [architectural — from interview]
- **QMD must be installed** — unlike the original spec's "QMD is optional" stance, this server assumes QMD. Without QMD there's no indexing and no search — just file storage, which isn't useful enough to warrant an MCP server. If QMD is missing, `kb_add` should still store the file but warn that indexing was skipped. `kb_query` should fail clearly. [dependency]
- **Local-only** — all data in `~/.cache/kb/`. No network calls. No API keys. No cloud services. [privacy]
- **stdio transport** — same as every other MCP server the user runs. Started by VS Code, no port management. [infrastructure]
- **QMD index name: `kb`** — the collection is named `kb`. All QMD commands use `--index kb`. This gives isolation from per-workspace wiki indexes. [convention]
- **The server does not touch `wiki/`** — that folder is a placeholder for future manual curation. The server reads and writes only `raw/`. [boundary]

## Out of Scope

- **Content transformation** — the `kb-global` skill does this agent-side. The server receives pre-formatted markdown.
- **Hub maintenance, index.md, log.md** — these are wiki-level housekeeping. The server stores files in `raw/` and lets QMD handle discoverability.
- **Page type enforcement** — the server doesn't validate frontmatter structure. It stores whatever markdown it receives. Garbage in → garbage stored (but at least it's stored and searchable).
- **CopilotClient / skill detection / cross-referencing** — deferred to a future iteration if ever needed.
- **`kb_update`, `kb_promote`, `kb_archive`, `kb_list`, `kb_status`, `kb_get`, `kb_proposals`** — all from the original grand spec. Not in v1. If querying by slug is needed, add `kb_get` later. For now, `kb_query` covers discovery.
- **`wiki/` curation** — the user opens `~/.cache/kb/` in VS Code and runs llm-wiki INGEST manually when ready.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **QMD not installed** | Low — user already uses it | High — no search | `kb_add` stores the file anyway + returns a warning. `kb_query` returns a clear error: "QMD not found. Install from https://github.com/tobi/qmd". |
| **QMD `ingest` + `embed` slow on large collections** | Medium — grows over time | Moderate — `kb_add` response time degrades | Run `qmd ingest` + `qmd embed` after every write for now. If it gets slow (>5s), switch to batched re-indexing on a timer or on `kb_query`. |
| **Filename collisions** | Low — date prefix + slug | Low — file overwritten | Use `YYYY-MM-DD-<slug>.md`. If collision detected, append `-2`, `-3`. |
| **MCP SDK churn** | Medium | Moderate | Pin SDK version. The server is ~100 lines of code — easy to migrate. |

## Open Questions

- **[non-blocking] Should `kb_add` return the QMD search score of the closest existing match?** This would let the skill warn about near-duplicates before storing. Adds one `qmd search` call before the write. Probably worth it but not v1-blocking.
- **[non-blocking] Should `qmd embed` run on every `kb_add` or be deferred?** `qmd ingest` is fast (BM25 indexing). `qmd embed` can be slow (generates vectors). Options: (a) always run both, (b) run `ingest` always + `embed` on query if stale, (c) run `embed` asynchronously. Recommend: (a) for v1 simplicity, revisit if latency becomes a problem.
- **[non-blocking] Should `kb_query` support filtering by tags?** QMD supports metadata filtering. Could be useful but adds parameter complexity. v1: just full-text + vector search.

## Implementation Notes

### Repository structure

```
mcp-knowledge-base/
├── README.md
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # MCP server entry (stdio), registers kb_add + kb_query
│   ├── tools/
│   │   ├── add.ts        # kb_add handler: write file, run qmd ingest + embed
│   │   └── query.ts      # kb_query handler: run qmd query, parse output
│   └── util/
│       ├── paths.ts       # ~/.cache/kb/ path resolution, bootstrap
│       └── qmd.ts         # qmd CLI wrapper: ingest, embed, query, search
└── dist/
```

That's it. No `copilot.ts`, no `detect-skill.ts`, no `prompts/`, no `templates/`, no `storage/` abstraction. ~100-200 lines of TypeScript.

### VS Code configuration

```jsonc
// settings.json → mcp.servers (user-level, not workspace)
"knowledge-base": {
    "command": "node",
    "args": ["<path-to-repo>/dist/index.js"],
    "type": "stdio"
}
```

### Tool surface

| Tool | Parameters | Returns |
|------|-----------|---------|
| `kb_add` | `title: string`, `content: string`, `tags?: string[]` | `{ path: string, indexed: boolean, warning?: string }` |
| `kb_query` | `query: string`, `n?: number` | `{ results: [{ title, path, snippet, score }] }` |

Two tools. That's the whole API.

### Runtime data layout

```
~/.cache/kb/
├── raw/                    # MCP writes here, QMD indexes this
│   ├── 2026-04-15-dual-retry-storm.md
│   ├── 2026-04-15-idempotent-crm-writes.md
│   └── ...
└── wiki/                   # Empty initially. Curated manually later.
```

QMD index lives at `~/.cache/qmd/kb.sqlite` (derived from `--index kb`).

### Pseudocode: `kb_add`

```typescript
async function kbAdd({ title, content, tags }: KbAddParams) {
  const kbRoot = resolve(homedir(), ".cache", "kb");
  const rawDir = join(kbRoot, "raw");
  const wikiDir = join(kbRoot, "wiki");

  // Bootstrap
  await mkdir(rawDir, { recursive: true });
  await mkdir(wikiDir, { recursive: true });

  // Write file
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(title);
  const filename = `${date}-${slug}.md`;
  const filepath = join(rawDir, filename);
  await writeFile(filepath, content, "utf-8");

  // Index
  let indexed = false;
  try {
    await exec(`qmd ingest --index kb "${rawDir}"`);
    await exec(`qmd embed --index kb`);
    indexed = true;
  } catch {
    // QMD not installed or failed — file is stored, just not indexed
  }

  return { path: filepath, indexed };
}
```

### Pseudocode: `kb_query`

```typescript
async function kbQuery({ query, n = 5 }: KbQueryParams) {
  try {
    const { stdout } = await exec(
      `qmd query --index kb --top ${n} "${escapeShell(query)}"`
    );
    return { results: parseQmdOutput(stdout) };
  } catch {
    return { results: [], error: "QMD not available or index empty" };
  }
}
```

### Relationship to the original grand spec

This spec is a **subset** of the original `specs/global-kb-mcp-server/spec.md`. The mapping:

| Original gap | This spec | Status |
|-------------|-----------|--------|
| G1 MCP scaffold | G4 | Included, simplified |
| G2 Storage layer | G3 | Included, minimal (`raw/` + `wiki/` dirs only) |
| G3 `kb_query` | G2 | Included |
| G4 `kb_add` | G1 | Included, simplified (no index/hub maintenance) |
| G5 `kb_update` | — | Deferred |
| G6 `kb_promote` | — | Deferred |
| G7 `kb_list`/`kb_status` | — | Deferred |
| G8 Index/hub maintenance | — | Deferred (manual via llm-wiki) |
| G9 `kb-global` skill | — | Separate spec: `specs/kb-global-skill/` |
| G10 CopilotClient | — | Removed |
| G11 Prompt templates | — | In skill spec |
| G12 `kb_archive` | — | Merged into `kb_add` (all content goes to `raw/`) |
| G13 Skill detection | — | Removed |
| G14 `kb_proposals` | — | Removed |

The grand spec remains as the architectural north star. This spec is what gets built first.
