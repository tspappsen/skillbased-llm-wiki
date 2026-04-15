# Plan — `mcp-knowledge-base`

## Goal
Create a Routine-tier Node.js/TypeScript MCP server over stdio with exactly two tools: `kb_add` to store markdown in `~/.cache/kb/raw/` and trigger QMD indexing, and `kb_query` to search the `kb` QMD index and return structured results. The implementation must use the actual QMD CLI shape (`qmd --index kb ...`), bootstrap `raw/` and `wiki/` on first use, and keep all data local.

## Tier
Routine

## Files to edit
All files below are new and should be created under `mcp-knowledge-base/`:

- `mcp-knowledge-base/README.md` — setup, build, and VS Code MCP configuration notes.
- `mcp-knowledge-base/package.json` — package metadata, scripts, runtime deps, and build output entry.
- `mcp-knowledge-base/tsconfig.json` — TypeScript compile target and output config.
- `mcp-knowledge-base/src/index.ts` — MCP stdio server entry; registers `kb_add` and `kb_query`.
- `mcp-knowledge-base/src/tools/add.ts` — validates input, writes markdown file, invokes QMD update/embed flow.
- `mcp-knowledge-base/src/tools/query.ts` — validates input, runs QMD query/search, maps JSON into tool results.
- `mcp-knowledge-base/src/util/paths.ts` — resolves `~/.cache/kb/*`, bootstraps directories, slug/date/collision helpers.
- `mcp-knowledge-base/src/util/qmd.ts` — QMD CLI detection and wrappers for collection init, update, embed, search, and hybrid query.

## Read-only context files
- `specs/kb-mcp-simple/spec.md` — authoritative requirements and simplified architecture.

## Implementation steps
1. **Scaffold the package and TypeScript build** (`atomic`)
   - Create `package.json` with `@modelcontextprotocol/sdk` plus TypeScript tooling.
   - Add scripts for `build`, `start`, and a simple dev entry if desired.
   - Configure `tsconfig.json` to compile `src/` to `dist/` for Node execution.
   - Keep dependencies minimal; no LLM or workspace-specific packages.

2. **Add filesystem/path bootstrap utilities** (`atomic`)
   - In `src/util/paths.ts`, resolve the KB root from the user home directory to `~/.cache/kb/`.
   - Expose helpers for `raw/` and `wiki/` creation on first use.
   - Implement filename generation as `YYYY-MM-DD-<slug>.md` with collision suffixes `-2`, `-3`, etc.
   - Keep `wiki/` bootstrap-only; no reads or writes outside initial directory creation.

3. **Wrap QMD CLI with the corrected command flow** (`likely compound`)
   - In `src/util/qmd.ts`, centralize child-process execution and JSON parsing.
   - Implement a lightweight `isQmdAvailable()` check.
   - Implement first-time collection registration with `qmd --index kb collection add <rawDir> --name raw --mask "**/*.md"` only when needed.
   - Implement re-index with `qmd --index kb update`, embedding with `qmd --index kb embed`, BM25 search with `qmd --index kb search "<query>" --json -n <n>`, and hybrid search with `qmd --index kb query "<query>" --json -n <n>`.
   - Prefer idempotent behavior: if collection add has already happened, skip it rather than treating it as an error.

4. **Implement `kb_add` tool handler** (`likely compound`)
   - Validate `title`, `content`, and optional `tags` input.
   - Bootstrap directories, generate a unique filename, and write the markdown to `raw/`.
   - If tags are provided, prepend simple markdown/frontmatter consistently; otherwise store plain markdown content without extra transformation.
   - If QMD is available, ensure the `raw` collection is registered, then run `update` and `embed`.
   - Return `{ path, indexed, warning? }`, where `indexed` is `false` and `warning` explains missing/failed QMD while preserving the stored file path.

5. **Implement `kb_query` tool handler** (`likely compound`)
   - Validate `query` and default `n` sensibly (e.g. 5) while respecting caller input.
   - Fail clearly if QMD is unavailable, since querying without QMD is not useful.
   - Prefer hybrid search via `qmd --index kb query ... --json -n <n>`.
   - Optionally fall back to `search` if hybrid query fails due to missing embeddings or empty vector state, but do not add extra post-processing beyond mapping the CLI JSON.
   - Normalize each result to `{ title, path, snippet, score }`, deriving `title` from result metadata or filename when necessary.

6. **Wire the MCP server entrypoint** (`atomic`)
   - In `src/index.ts`, create the stdio MCP server using `@modelcontextprotocol/sdk`.
   - Register `kb_add` and `kb_query` with `server.tool()` and their input schemas.
   - Connect the server to stdio transport and surface concise tool errors.
   - Keep the entrypoint small; push logic into `tools/` and `util/` modules.

7. **Document local usage and MCP registration** (`atomic`)
   - In `README.md`, document prerequisites (Node, QMD installed), build/start steps, and a sample VS Code MCP `stdio` config.
   - Note that data is stored in `~/.cache/kb/`, QMD index lives under `~/.cache/qmd/kb.sqlite`, and the server only writes to `raw/`.

## Verification steps
- Install dependencies and run the TypeScript build successfully.
- Start the compiled server and confirm it launches without transport/runtime errors.
- Invoke `kb_add` once on a clean machine/profile and verify:
  - `~/.cache/kb/raw/` and `~/.cache/kb/wiki/` are created.
  - A markdown file is written with the expected date/slug naming.
  - Repeated adds with the same title create suffixed filenames instead of overwriting.
- With QMD installed, verify first add performs collection registration, then `update` and `embed`, and returns `indexed: true`.
- Without QMD (or by simulating missing QMD), verify `kb_add` still stores the file and returns `indexed: false` plus a warning.
- Invoke `kb_query` with a known term and verify it returns structured `results` with title/path/snippet/score.
- Verify `kb_query` fails clearly when QMD is unavailable.

## Risks/assumptions
- Assumes the latest `@modelcontextprotocol/sdk` still supports `server.tool()` with stdio transport in the expected shape; pin a known-good version in `package.json`.
- Assumes QMD JSON output is stable enough to map without custom parsing heuristics; if fields differ, adapt mapping in `query.ts` only.
- Assumes collection registration can be detected or retried safely; if QMD lacks a direct “list collections” command, handle “already exists” as a benign condition.
- Assumes markdown storage format can stay simple; if tags need to be queryable later, frontmatter shape should be chosen deliberately during implementation.
- Assumes this repo is only planning the server, not wiring it into user/global VS Code settings as part of the code change.

## Open questions
- **Non-blocking:** Should `kb_add` always wrap `tags` in YAML frontmatter, or should v1 ignore tags beyond accepting them in the API?
- **Non-blocking:** Should `kb_query` always attempt BM25 fallback, or only surface hybrid-query failures directly to keep behavior simpler?
