# A3 — Global Knowledge Base MCP Server

**Story:** N/A — design exploration from skill architecture gap analysis
**PO:** —  |  **Dev:** —
**Date:** 2026-04-15
**Status:** Draft

---

## Background

The llm-wiki skill works well for per-project knowledge — each repo gets its own `wiki/` with summaries, concepts, entities, and insights. But cross-cutting knowledge (patterns, decisions, lessons learned, institutional memory) has no home. It either evaporates between sessions or gets duplicated across repos.

The root cause is an access boundary: Copilot Chat's file tools (`read_file`, `create_file`) are scoped to the open workspace. A global knowledge base directory (e.g. `~/.agents/global-wiki/`) is unreachable by those tools. Terminal commands can reach it, but that's a fragile workaround — not an architecture. [from interview]

The qmd-memory skill proves the terminal workaround is viable for flat notes. But scaling to the richer llm-wiki page structure (index, hubs, cross-references, tiered reads) through terminal string-parsing is impractical. [from interview]

MCP (Model Context Protocol) is how Copilot is designed to integrate with external systems. The user already runs MCP servers for Confluence and Azure DevOps. A self-hosted MCP server for the knowledge base would give any workspace clean, tool-native access to the global KB without workspace boundary hacks. [from interview]

## Current State

### What exists today

Three separate knowledge surfaces, none of them global:

1. **llm-wiki skill** — rich, structured wiki per workspace. Uses `read_file`/`create_file` to manage pages under the project's `wiki/` directory. Optional QMD hybrid search for scale. Bound to the workspace it lives in. [from skill: SKILL.md]

2. **qmd-memory skill** — flat markdown notes in `~/.agents/memory/copilot-memory/`. Accessed entirely via terminal commands (`qmd query`, `qmd search`). Cross-workspace by virtue of the fixed directory. No page types, no index, no hubs, no cross-references. Works, but limited to simple key-value-style memory. [from skill: qmd-memory/SKILL.md]

3. **Copilot built-in memory** (`/memories/`) — persistent across workspaces, auto-loaded into context. Hard cap at 200 lines loaded. Good for routing hints and preferences, not for substantive knowledge. [from interview]

### How knowledge flows today

```
Workspace A                    Workspace B
┌──────────────┐               ┌──────────────┐
│ wiki/        │               │ wiki/        │
│  (local)     │               │  (local)     │
│              │               │              │
│ read_file ✓  │               │ read_file ✓  │
│ create_file ✓│               │ create_file ✓│
└──────────────┘               └──────────────┘

         ┌──────────────────────┐
         │ ~/.agents/memory/    │
         │  (global, flat)      │
         │                      │
         │ terminal only ✓      │
         │ read_file ✗          │
         │ create_file ✗        │
         └──────────────────────┘
```

Knowledge learned in Workspace A that would help in Workspace B must be manually re-stated, stored as a flat qmd-memory note (losing structure), or remembered by the user. [from interview]

### Known limitations

- No way to `promote` a local wiki page to a global knowledge base
- No way to `pull` relevant global knowledge when starting work in a new workspace
- qmd-memory's flat format cannot represent the richer page types (concepts with cross-references, entities with relationship maps, summaries linking to sources)
- Terminal-only access means no file-watcher integration, no syntax highlighting in tool output, and error handling is string-parsing [from interview]

## Desired State

When this work is complete:

1. **Any Copilot Chat session in any workspace** can query, add to, and update a structured global knowledge base — without opening the KB directory as a workspace folder. [from interview]

2. The global KB uses the **same page structure as llm-wiki** (index, log, summaries, concepts, entities, insights, hubs) — not flat notes. Knowledge is typed, cross-referenced, and searchable. [from interview]

3. **Retrieval is fast and relevant.** Hybrid search (BM25 + vector via QMD) is the default query path. The MCP server handles indexing transparently. [from interview]

4. Knowledge can be **promoted from a local wiki to the global KB** and **surfaced from the global KB into a local workspace** with explicit operations, not automatic sync. [from interview]

5. **Content is transformed on ingest, not just stored.** The MCP server uses the Copilot SDK (`@github/copilot-sdk` → `CopilotClient`) to run LLM-powered transformation of incoming content — raw text, conversation excerpts, unstructured notes — into structured KB pages using prompt templates. The server owns the intelligence; the calling agent doesn't need to pre-format content. [from interview]

6. The existing llm-wiki skill continues to work unchanged for per-project wikis. The MCP server is an additive layer, not a replacement. [from interview]

## Goals

- G1: A developer can `kb_query "retry patterns for Service Bus"` from any workspace and get structured results from the global KB
- G2: A developer can `kb_add` a concept, entity, or insight and have it indexed and cross-referenced in the global KB
- G3: A local wiki page can be promoted to the global KB with `kb_promote`, preserving its type, tags, and cross-references
- G4: The global KB reaches 100+ pages without degrading query relevance (tiered reads via hubs, QMD hybrid search)
- G5: Setup requires adding one MCP server entry to VS Code settings — no per-workspace configuration
- G6: All data stays local on disk. LLM inference uses the Copilot API (same trust boundary as normal Copilot Chat usage).
- G7: Raw, unstructured content (conversation excerpts, rough notes, pasted text) is transformed into structured KB pages by the server — the caller sends content + intent, not pre-formatted markdown

## Root Cause Analysis

The gap exists because **Copilot Chat's security model intentionally restricts file tools to the open workspace**, and no first-party mechanism exists to register a global directory as a tool-accessible resource.

This is not a bug — it's a reasonable security boundary. The correct response is to use the designated extension point for external system access: MCP servers. MCP servers run as separate processes with their own filesystem access. They expose capabilities as tools that Copilot can call. This is the same pattern used for Confluence and Azure DevOps. [from interview]

The qmd-memory skill's terminal workaround works but doesn't compose — it can't support the richer operations (index maintenance, hub updates, cascade cross-referencing) that the llm-wiki skill requires. The solution is not to work around the boundary but to present the KB through the boundary's sanctioned interface. [from interview]

## Gap Analysis

| Gap | Change needed | Enables | Complexity | Dependencies |
|-----|--------------|---------|------------|--------------|
| G1 | **MCP server scaffold** — stdio transport, Node.js or Python, registers as `knowledge-base` server in VS Code MCP config | All other gaps | Simple — MCP SDK has scaffold generators | MCP SDK (`@modelcontextprotocol/sdk` or `mcp` Python package) |
| G2 | **Storage layer** — global wiki directory at `~/.agents/global-wiki/` using the llm-wiki directory structure (index, log, hubs, page type folders) | G3, G4, G5, G6 | Simple — directory creation + INIT-equivalent bootstrap | G1 |
| G3 | **Core tools: `kb_query`** — accepts natural language query, runs QMD hybrid search against the global wiki collection, returns ranked results with page content | G1 (desired state) | Moderate — needs QMD integration, result formatting, fallback to BM25-only if embeddings unavailable | G1, G2, QMD installed |
| G4 | **Core tools: `kb_add`** — accepts content + page type (concept/entity/insight/summary), creates page using llm-wiki templates, updates index and log, triggers QMD re-index | G2 (desired state) | Moderate — page creation logic, template application, index maintenance | G1, G2 |
| G5 | **Core tools: `kb_update`** — modify existing page, update cross-references, maintain hubs | G2 (desired state) | Moderate — needs page lookup, safe editing, hub refresh | G1, G2, G3 |
| G6 | **Core tools: `kb_promote`** — accepts a local wiki page path, copies to global KB, dedup-checks against global index, updates global cross-references | G3 (desired state) | Moderate — cross-collection dedup, tag reconciliation | G1, G2, G4 |
| G7 | **Core tools: `kb_list` / `kb_status`** — list pages, show index, report collection health | Observability, debugging | Simple — read and return index.md + QMD status | G1, G2 |
| G8 | **Index and hub maintenance** — after writes, update `index.md`, relevant `_hub.md` files, and QMD index. Mirror llm-wiki's housekeeping steps. | G4 (desired state — scale) | Moderate — replicates INGEST Act phase logic | G2, G4 |
| G9 | **Skill wrapper** — a thin agent skill (`kb-global` or similar) that routes natural language KB requests to the MCP tools, similar to how llm-wiki routes to reference playbooks | Usability — the agent knows when to call KB tools | Simple — markdown skill file, routing table | G1 operational |
| G10 | **Copilot SDK integration layer** — `CopilotClient` lifecycle management (start, stop, auto-restart). Provides a `transform(content, promptTemplate) → structuredMarkdown` function that other tool handlers call. Handles token limits, retries, and client health. | G11, G4, G5, G6 — all write paths gain LLM transformation | Moderate — client lifecycle, prompt construction, error handling for API failures | G1, `@github/copilot-sdk` package |
| G11 | **Prompt template system** — structured prompt templates (like `create-summary-markdown-prompt.md`) stored in the server's `prompts/` directory. Each template defines the output structure for a page type or transformation. Templates are parameterized (title, content, page type, existing context) and selected by the tool handler based on operation. | G4, G5, G6 — controls output quality and consistency | Simple — markdown files + string interpolation. No template engine needed. | G10 |
| G12 | **`kb_ingest` tool** — accepts raw unstructured content (conversation excerpt, rough notes, pasted article) + an intent hint. Server uses Copilot SDK to analyze, classify (concept/entity/insight/summary), transform via the appropriate prompt template, dedup-check, and store. This is the "smart add" path — distinct from `kb_add` which takes pre-structured content. | Desired state 5 — server-side intelligence | Complex — combines G10 + G11 + G4's storage + G3's dedup. The most ambitious tool. | G10, G11, G4 |

**Dependency order:** G1 → G2 → G7 → G10 → G11 → G3 → G4 → G5 → G8 → G6 → G12 → G9

## Constraints

- **Workspace boundary is immovable** — `read_file`/`create_file` will not gain cross-workspace access. The MCP server must fully own its storage I/O; the agent never reads KB files directly. [architectural — Copilot security model]
- **QMD must remain optional** — the server must degrade gracefully if QMD is not installed (fall back to BM25-only via `qmd search`, or to index.md tag scan if QMD is absent entirely). [compatibility — mirrors llm-wiki design]
- **Local-only storage, Copilot API for inference** — all KB data (pages, index, hubs) stays in `~/.agents/global-wiki/`. LLM inference goes through the Copilot API via `@github/copilot-sdk` — the same trust boundary and data handling as normal Copilot Chat usage. No additional cloud services. [privacy — refined from original "no network calls" constraint]
- **Copilot subscription required** — the `CopilotClient` requires an active GitHub Copilot subscription. The server must degrade gracefully if Copilot is unavailable: `kb_query`, `kb_list`, `kb_get`, `kb_status` work without LLM. `kb_ingest` fails with a clear error. `kb_add` works (takes pre-structured content). [dependency]
- **llm-wiki must not change** — the existing per-project wiki skill is unaffected. The MCP server is additive. [compatibility]
- **MCP stdio transport** — use stdio, not HTTP. Stdio servers are started by VS Code automatically and don't require port management. [infrastructure — simplest deployment model]
- **Page templates must match llm-wiki** — concept, entity, insight, summary pages in the global KB use the same frontmatter and heading structure as the llm-wiki templates. This allows `kb_promote` to be a copy, not a transform. [compatibility]

## Out of Scope

- **Automatic sync between local wikis and global KB** — promote/pull are explicit, user-initiated operations. Automatic background sync introduces conflict resolution complexity and surprising behavior. Deferred until the explicit model proves insufficient. [complexity management]
- **Multi-user / shared KB** — this is a single-developer, single-machine knowledge base. Sharing would require auth, conflict resolution, and a network transport. Different problem. [scope boundary]
- **Web UI or Obsidian plugin** — the KB is accessed through Copilot Chat via MCP tools. A visual browser would be nice but is a separate project. [scope boundary]
- **Full INGEST pipeline via the MCP server** — the llm-wiki INGEST pipeline (Plan → Do → Check → Act with user checkpoints, multi-source orchestration, raw drift tracking) is too interactive and stateful for a single tool call. The MCP server offers `kb_ingest` for **single-item, one-shot transformation** of unstructured content. The full pipeline (multi-source, plan-and-confirm) stays in the local llm-wiki skill. [complexity boundary — refined from original "no raw ingest" exclusion]
- **Migration from qmd-memory** — existing flat memory notes could be upgraded to typed KB pages, but that's a one-time script, not part of the server. [sequencing]

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **MCP SDK churn** — the MCP spec and SDK are relatively young; breaking changes in transport or tool registration could require rework | Medium | Moderate — server needs updating but storage layer unaffected | Pin SDK version. Isolate transport from storage/logic. Keep the server minimal so migration is cheap. |
| **QMD embedding model changes** — QMD may update its default embedding model, invalidating existing vectors | Low | Low — `qmd embed` rebuilds all vectors; one-time cost | Document the re-embed command in server health check output. |
| **Index.md becomes bottleneck at scale** — global KB could grow larger than per-project wikis, making index.md scanning slow in the MCP server process | Low | Low — hub-based tiered reading is already designed for 500+ pages in llm-wiki | Implement tiered reads from the start (G8). Consider SQLite index if >1000 pages. |
| **Tool output size limits** — MCP tool responses have practical size limits; returning full pages for broad queries could exceed them | Medium | Moderate — truncated results degrade query quality | Return summaries by default; full content only on explicit `--full` flag or follow-up `kb_get` call. Paginate results. |
| **Skill routing ambiguity** — agent may confuse local wiki operations with global KB operations | Medium | Low — wrong tool called, user corrects | Clear naming convention: `kb_*` tools for global, `wiki/` file operations for local. The skill wrapper (G9) includes explicit routing hints. |
| **Copilot SDK availability / stability** — `@github/copilot-sdk` is a relatively new package. API surface may change. CopilotClient may fail to start if Copilot is not authenticated or subscription lapses. | Medium | High — `kb_ingest` (the highest-value tool) is non-functional without it | Isolate CopilotClient behind a thin adapter interface. All read-only tools (`kb_query`, `kb_list`, `kb_get`) work without the SDK. `kb_add` works without LLM (takes pre-structured content). Only `kb_ingest` hard-depends on it. Fail clearly, not silently. |
| **LLM transformation quality drift** — prompt templates produce good results today; model updates change output quality unpredictably | Low | Moderate — new pages may not match expected structure | Pin prompt templates to specific output contracts (required sections, frontmatter fields). Validate output structure after transformation; reject and retry if contract is violated. Log template hash in page frontmatter for traceability. |
| **Copilot API rate limits / latency** — `kb_ingest` calls the Copilot API; bulk ingestion of many items could hit rate limits or be slow | Medium | Low — degraded throughput, not data loss | Queue writes. Process one at a time. Surface progress to the caller. Bulk ingest is not the primary use case (single items via conversation is). |

## Open Questions

- **[blocking] Runtime: Node.js or Python?** — Both have mature MCP SDKs. Node.js aligns with VS Code ecosystem. Python aligns with QMD (Python-based). Decision affects G1 implementation. Recommend: **Node.js** (stdio transport is simpler, no Python environment management needed; QMD is called via CLI subprocess either way).
- **[resolved] Page creation: server-side templates or agent-side?** — **Server-side, with LLM transformation.** The Copilot SDK integration (G10) means the server can do more than apply static templates — it can transform unstructured content into structured pages using prompt templates (G11). `kb_add` takes pre-structured content (simple path). `kb_ingest` takes raw content and transforms it (smart path). Both use server-side templates; the server owns formatting. [resolved by Copilot SDK proposal]
- **[non-blocking] Prompt template versioning** — prompt templates evolve as we learn what produces good KB pages. Should templates be versioned (v1, v2) or just overwritten? Recommend: overwrite + log. Templates are operational config, not user data. Log the template hash in the page's frontmatter so we can trace which version produced a page.
- **[non-blocking] CopilotClient token/context limits** — what are the practical limits of a single `CopilotClient` inference call? Long articles or conversation transcripts may exceed them. Recommend: chunk large inputs, summarize each chunk, then synthesize. The prompt template should handle this gracefully.
- **[non-blocking] `kb_ingest` vs `kb_add` boundary** — when should the calling agent use `kb_ingest` (raw content → server transforms) vs `kb_add` (agent pre-formats)? Recommend: `kb_ingest` is the default for new content. `kb_add` is for programmatic/precise inserts where the agent already has the exact page structure (e.g., `kb_promote` internally uses `kb_add` after adapting the local page).
- **[non-blocking] Hub update strategy** — Should the MCP server update hubs synchronously on every write (consistent but slower) or batch hub updates (faster but stale between batches)? llm-wiki does it synchronously during INGEST. For the MCP server, synchronous is likely fine since writes are less frequent than queries.
- **[non-blocking] Cross-reference format** — llm-wiki uses `[[wikilinks]]`. Should the global KB use the same format (good for Obsidian compatibility) or markdown links (more portable)? Recommend: wikilinks, for consistency with llm-wiki and Obsidian graph view.
- **[non-blocking] `kb_promote` conflict handling** — When promoting a page that has a near-match in the global KB, should the server merge automatically, reject with a diff, or present options? Recommend: reject with diff and let the agent/user decide.

## Implementation Notes

### Dedicated repository

This MCP server lives in its own repo — **not** in the llm-wiki skill repo.

Rationale:
- The llm-wiki repo is "nothing to install" — pure markdown instructions. A Node.js server with build steps is a different artifact.
- The MCP server serves any workspace and any skill, not just llm-wiki. Binding it to one consumer creates a false dependency.
- Different lifecycles: skill evolves by editing markdown, server evolves by shipping code.

The spec stays in `skillbased-llm-wiki/specs/global-kb-mcp-server/` during design. Move it to the server repo when that repo is created.

### Repository structure

```
mcp-knowledge-base/                 # dedicated repo
├── README.md
├── package.json
├── tsconfig.json
├── specs/
│   └── spec.md                     # ← this file, moved here
├── src/
│   ├── index.ts                    # MCP server entry point (stdio transport)
│   ├── copilot.ts                  # CopilotClient lifecycle (start, stop, reset, health check)
│   ├── transform.ts                # transform(content, template) → structured markdown
│   ├── tools/                      # Tool handlers: query, add, ingest, update, promote, list, status
│   ├── storage/                    # Wiki directory I/O: read/write pages, index, log, hubs
│   ├── search/                     # QMD integration: query, search, re-index, with fallback
│   ├── prompts/                    # Prompt templates per page type / transformation
│   │   ├── summary.md              # Structured summary (based on create-summary-markdown-prompt.md)
│   │   ├── concept.md              # Concept extraction + cross-referencing
│   │   ├── entity.md               # Entity identification + relationship mapping
│   │   └── insight.md              # Insight synthesis from cross-page analysis
│   └── templates/                  # Page templates (copied from llm-wiki/templates/ at init)
└── dist/                           # compiled output
```

**Runtime data** lives outside the repo at `~/.agents/global-wiki/` (the wiki directory the server manages).

**Installation target:** the built server is either:
- Run directly from the cloned repo (`node dist/index.js`), or
- Symlinked/copied to `~/.agents/mcp-servers/knowledge-base/` for a clean separation of source and runtime

### VS Code configuration

```jsonc
// settings.json → mcp.servers
"knowledge-base": {
    "command": "node",
    "args": ["<path-to-repo>/dist/index.js"],
    "type": "stdio"
}
```

Replace `<path-to-repo>` with the absolute path to the cloned `mcp-knowledge-base` repo or the install location.

### Tool surface (draft)

| Tool | Parameters | Returns |
|------|-----------|---------|
| `kb_query` | `query: string`, `n?: number`, `full?: boolean` | Ranked results: title, summary, relevance score, optionally full content |
| `kb_add` | `type: "concept" \| "entity" \| "insight" \| "summary"`, `title: string`, `content: string`, `tags: string[]`, `sources?: string[]` | Created page path, updated index entry |
| `kb_ingest` | `content: string`, `intent?: string`, `type?: string` | Transformed page(s) created, classification used, dedup report |
| `kb_update` | `slug: string`, `content: string`, `reason: string` | Updated page path, log entry |
| `kb_promote` | `localPath: string`, `type?: string` | Created/merged page path, dedup report |
| `kb_list` | `type?: string`, `tag?: string` | Filtered index entries |
| `kb_status` | — | Page count, QMD health, Copilot SDK health, last update timestamp |
| `kb_get` | `slug: string` | Full page content |

**`kb_add` vs `kb_ingest`:** `kb_add` takes pre-structured markdown and stores it directly (template validation only). `kb_ingest` takes raw unstructured content, uses the Copilot SDK to classify and transform it via prompt templates, then stores the result. `kb_ingest` is the primary entry point for new knowledge; `kb_add` is for programmatic inserts where the caller already has the exact structure.

### Copilot SDK integration

The MCP server embeds a `CopilotClient` from `@github/copilot-sdk` to perform LLM inference server-side. This is the same mechanism as Copilot CLI — the server authenticates via the user's existing Copilot credentials and sends inference requests through the Copilot API.

```typescript
// copilot.ts — lifecycle management
import { CopilotClient } from "@github/copilot-sdk";

let client: CopilotClient | undefined;

export async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient({ autoStart: true, autoRestart: true });
    await client.start();
  }
  return client;
}

export async function resetClient(): Promise<CopilotClient> {
  if (client) {
    try { await client.stop(); } catch { /* best-effort */ }
    client = undefined;
  }
  return getClient();
}

export async function stopClient(): Promise<void> {
  if (client) {
    await client.stop();
    client = undefined;
  }
}
```

**Transform flow for `kb_ingest`:**

```
raw content + intent
       │
       ▼
┌─────────────────────┐
│ 1. Classify          │  CopilotClient: "What type of knowledge is this?
│    (concept/entity/  │   concept, entity, insight, or summary?"
│     insight/summary) │  → returns type + confidence
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Select prompt     │  Load prompts/<type>.md template
│    template          │  Interpolate: title, content, existing KB context
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. Transform         │  CopilotClient: prompt template + raw content
│                      │  → structured markdown page
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 4. Validate          │  Check output matches page template contract
│                      │  (required frontmatter, heading structure)
│                      │  Retry once if validation fails
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 5. Dedup + Store     │  Check index for near-matches (same as kb_add)
│                      │  Write page, update index, log, hubs
│                      │  QMD re-index
└─────────────────────┘
```

### Prompt template design (indicative)

Prompt templates live in `src/prompts/` and are plain markdown files with interpolation markers. The `create-summary-markdown-prompt.md` pattern is the reference — adapted per page type:

```markdown
# prompts/summary.md
Transform the following content into a structured knowledge base summary page.

## Output format
The output MUST follow this exact structure:

\`\`\`markdown
---
title: {{title}}
type: summary
tags: [identify 3-7 relevant tags from the content]
sources: [{{source}}]
updated: {{date}}
---

# {{title}}

[1-2 sentence summary of the key insight]

## Key Points
- [3-8 primary takeaways, each 1-2 sentences]

## Details
[Expanded discussion of the most important points]

## Connections
- [[related-concept]] — [how it relates]
- [[related-entity]] — [how it relates]

## See Also
- [[other-relevant-pages]]
\`\`\`

## Content to transform
{{content}}

## Existing KB context (for cross-referencing)
{{kb_context}}
```

Each page type (concept, entity, insight) gets its own prompt template aligned with the corresponding llm-wiki page template structure.

### Federated architecture target

```
Workspace A (local wiki)          Global KB (MCP server)
┌──────────────────────┐          ┌──────────────────────┐
│ wiki/                │          │ ~/.agents/global-wiki │
│  concepts/           │ promote  │  wiki/               │
│  entities/    ──────────────►   │   concepts/          │
│  summaries/          │          │   entities/          │
│  insights/           │          │   summaries/         │
│                      │  pull    │   insights/          │
│  (read_file) ◄──────────────   │   index.md           │
│                      │          │   log.md             │
└──────────────────────┘          │   _hub.md files      │
                                  │                      │
Workspace B (no local wiki)       │  QMD hybrid search   │
┌──────────────────────┐          │  (BM25 + vector)     │
│                      │  query   │                      │
│  agent  ─────────────────────►  │  stdio MCP transport │
│         ◄─────────────────────  │                      │
│                      │  results └──────────────────────┘
└──────────────────────┘
```

### Relationship to llm-wiki

The server and the llm-wiki skill are **separate projects with a shared contract:**

| Concern | Owned by | Notes |
|---------|----------|-------|
| Page templates (frontmatter, headings) | llm-wiki defines, server copies | Server's `src/templates/` is a snapshot of llm-wiki's `templates/`. Kept in sync manually — template changes are infrequent. |
| Wiki directory structure | llm-wiki defines, server implements | `index.md`, `log.md`, hubs, page type folders — same layout. |
| Wikilink format (`[[slug]]`) | Shared convention | Both use plain-filename wikilinks. |
| QMD integration patterns | llm-wiki documents (`references/qmd.md`), server implements in code | Per-collection isolation, command selection, re-index-after-writes. |
| Tiered reading at scale | llm-wiki documents (`references/scale.md`), server implements internally | Hub summaries, index tag routing, reading budgets. |
| `kb_promote` bridge | Server implements | Reads a local wiki page (passed as content by the agent, since the server can't access workspace files), dedup-checks against global index, stores in global KB. |

The llm-wiki README should note that the global KB MCP server exists and link to its repo. The server README should note its design lineage from llm-wiki.

### Relevant prior art (cross-repo)

- **[llm-wiki] SKILL.md** — page structure, routing logic, deterministic markdown contract. The shared contract.
- **[llm-wiki] references/qmd.md** — QMD integration patterns the server mirrors in code.
- **[llm-wiki] references/scale.md** — tiered reading strategy the server implements internally.
- **[llm-wiki] references/ingest.md** — page creation flow (template application, dedup, index update, hub refresh). The `kb_add` tool replicates the Act phase.
- **[qmd-memory skill]** — proves the cross-workspace pattern works via terminal. The MCP server replaces the terminal workaround with proper tool semantics.
