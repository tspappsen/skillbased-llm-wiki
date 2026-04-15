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

5. **Content is transformed agent-side before storage.** The `kb-global` skill (agent-side) applies prompt templates (like `create-summary-markdown-prompt.md`) to transform raw content — conversation transcripts, unstructured notes, session excerpts — into structured KB pages. The skill has full access to conversation history, workspace metadata (repo name, branch), and local files. The MCP server receives **already-structured summaries** via `kb_add` and handles storage, indexing, cross-referencing, and skill detection. QMD indexes the structured summaries, not the raw input. [from interview — revised: agent owns context the server can’t access]

6. The existing llm-wiki skill continues to work unchanged for per-project wikis. The MCP server is an additive layer, not a replacement. [from interview]

7. **Knowledge compounds into skills.** When post-processing detects that multiple KB pages describe variations of the same actionable, procedural pattern, the server files a **skill proposal** — a lightweight candidate that a human can review and promote into a full agent skill. The KB becomes a breeding ground for skills, not just a static archive. [from interview]

## Goals

- G1: A developer can `kb_query "retry patterns for Service Bus"` from any workspace and get structured results from the global KB
- G2: A developer can `kb_add` a concept, entity, or insight and have it indexed and cross-referenced in the global KB
- G3: A local wiki page can be promoted to the global KB with `kb_promote`, preserving its type, tags, and cross-references
- G4: The global KB reaches 100+ pages without degrading query relevance (tiered reads via hubs, QMD hybrid search)
- G5: Setup requires adding one MCP server entry to VS Code settings — no per-workspace configuration
- G6: All data stays local on disk. LLM inference uses the Copilot API (same trust boundary as normal Copilot Chat usage).
- G7: The `kb-global` skill transforms raw content (conversation excerpts, rough notes, pasted text) into structured KB pages agent-side using prompt templates, then sends the structured result to the MCP server via `kb_add`. QMD indexes the distilled summaries — not raw transcripts — for high-quality retrieval.
- G8: When post-processing detects a recurring, actionable pattern (a technique applied across multiple contexts, a reusable workflow, a codified decision framework), the server files a **skill proposal** — a lightweight candidate that could become a full agent skill. Proposals accumulate in a dedicated folder for periodic human review.

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
| G9 | **`kb-global` skill (agent-side)** — a rich agent skill that owns content transformation. When the user says “save this session as knowledge”, the skill: (a) gathers conversation history and workspace metadata (repo, branch), (b) applies the appropriate prompt template (`create-summary-markdown-prompt.md` or page-type-specific prompts) using the agent’s native LLM capability, (c) produces structured markdown, (d) calls `kb_add` to store it, and optionally (e) calls `kb_archive` to preserve the raw transcript for provenance. This is the primary entry point for new knowledge. The skill has full context the MCP server cannot access. | Desired state 5, G7 — agent-side transformation | Moderate — prompt template application, conversation extraction, routing logic | G1, G4 operational |
| G10 | **Copilot SDK integration layer (server-side)** — `CopilotClient` lifecycle management. Now scoped to **post-processing only**: skill-proposal detection (G13) and cross-reference suggestion during `kb_add`. Not on the critical path for the main “save session” flow. All read/write tools work without it; only skill detection degrades. | G13 — skill proposal detection | Moderate — client lifecycle, prompt construction, error handling for API failures | G1, `@github/copilot-sdk` package |
| G11 | **Prompt template library (agent-side)** — structured prompt templates bundled with the `kb-global` skill. Includes `create-summary-markdown-prompt.md` (session summaries) and page-type-specific prompts (concept, entity, insight). The agent applies these before calling `kb_add`. Templates are plain markdown with interpolation markers (`{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}`). | G9 — the skill needs templates to transform content | Simple — markdown files in the skill’s `templates/` or `prompts/` folder | G9 |
| G12 | **`kb_archive` tool** — accepts raw content (conversation transcript, original article text) and stores it in `raw/sessions/` or `raw/sources/` for provenance. Not indexed by QMD for primary search — preserved so structured pages can be traced back to their source material, and raw content can be re-processed if prompt templates improve. | Provenance, re-processability | Simple — write to `raw/`, update `raw/files.log` | G1, G2 |
| G13 | **Skill proposal detection** — post-processing hook that runs after every `kb_add`. Uses the CopilotClient to evaluate whether the new page (alone or combined with existing KB pages on related topics) represents a **recurring, actionable pattern** that could be codified as an agent skill. If yes, writes a skill proposal file to `~/.agents/global-wiki/skill-proposals/`. Proposals are lightweight: a candidate name, description, trigger phrases, referenced KB pages, and a rationale — not a full SKILL.md. Human reviews and promotes manually. | Goal G8 — emergent skill discovery | Simple to moderate — one additional LLM call per add, writing a small markdown file. The detection prompt is the hard part (false positive rate). | G10 |
| G14 | **`kb_proposals` tool** — list, view, and dismiss skill proposals. Returns the current proposal backlog so the agent can surface them when the user asks "any skill ideas?" or during periodic review. | Goal G8 — observability over proposals | Simple — read from `skill-proposals/` directory | G13 |

**Dependency order:** G1 → G2 → G7 → G3 → G4 → G5 → G8 → G6 → G12 → G10 → G11 → G13 → G14 → G9

Note: G9 (the skill) and G10 (CopilotClient) are **parallel tracks after G4 is operational**. The core read/write/query tools work without either. G9 makes the UX good; G10 + G13 make it smart over time.

## Constraints

- **Workspace boundary is immovable** — `read_file`/`create_file` will not gain cross-workspace access. The MCP server must fully own its storage I/O; the agent never reads KB files directly. [architectural — Copilot security model]
- **QMD must remain optional** — the server must degrade gracefully if QMD is not installed (fall back to BM25-only via `qmd search`, or to index.md tag scan if QMD is absent entirely). [compatibility — mirrors llm-wiki design]
- **Local-only storage, Copilot API for inference** — all KB data (pages, index, hubs) stays in `~/.agents/global-wiki/`. LLM inference goes through the Copilot API via `@github/copilot-sdk` — the same trust boundary and data handling as normal Copilot Chat usage. No additional cloud services. [privacy — refined from original "no network calls" constraint]
- **Copilot subscription required for post-processing only** — the `CopilotClient` requires an active GitHub Copilot subscription. The server degrades gracefully if unavailable: all core tools (`kb_add`, `kb_archive`, `kb_query`, `kb_list`, `kb_get`, `kb_status`, `kb_update`, `kb_promote`) work without it. Only skill proposal detection (G13) and smart cross-reference suggestions require the SDK. The agent-side skill uses its own LLM capability for transformation — which is always available since the skill runs inside Copilot Chat. [dependency — revised: CopilotClient off critical path]
- **llm-wiki must not change** — the existing per-project wiki skill is unaffected. The MCP server is additive. [compatibility]
- **MCP stdio transport** — use stdio, not HTTP. Stdio servers are started by VS Code automatically and don't require port management. [infrastructure — simplest deployment model]
- **Page templates must match llm-wiki** — concept, entity, insight, summary pages in the global KB use the same frontmatter and heading structure as the llm-wiki templates. This allows `kb_promote` to be a copy, not a transform. [compatibility]

## Out of Scope

- **Automatic sync between local wikis and global KB** — promote/pull are explicit, user-initiated operations. Automatic background sync introduces conflict resolution complexity and surprising behavior. Deferred until the explicit model proves insufficient. [complexity management]
- **Multi-user / shared KB** — this is a single-developer, single-machine knowledge base. Sharing would require auth, conflict resolution, and a network transport. Different problem. [scope boundary]
- **Web UI or Obsidian plugin** — the KB is accessed through Copilot Chat via MCP tools. A visual browser would be nice but is a separate project. [scope boundary]
- **Full INGEST pipeline via the MCP server** — the llm-wiki INGEST pipeline (Plan → Do → Check → Act with user checkpoints, multi-source orchestration, raw drift tracking) is too interactive and stateful for a single tool call. Content transformation happens agent-side in the `kb-global` skill, not in the server. The server handles storage, indexing, cross-referencing, and post-processing. [complexity boundary]
- **Migration from qmd-memory** — existing flat memory notes could be upgraded to typed KB pages, but that's a one-time script, not part of the server. [sequencing]

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **MCP SDK churn** — the MCP spec and SDK are relatively young; breaking changes in transport or tool registration could require rework | Medium | Moderate — server needs updating but storage layer unaffected | Pin SDK version. Isolate transport from storage/logic. Keep the server minimal so migration is cheap. |
| **QMD embedding model changes** — QMD may update its default embedding model, invalidating existing vectors | Low | Low — `qmd embed` rebuilds all vectors; one-time cost | Document the re-embed command in server health check output. |
| **Index.md becomes bottleneck at scale** — global KB could grow larger than per-project wikis, making index.md scanning slow in the MCP server process | Low | Low — hub-based tiered reading is already designed for 500+ pages in llm-wiki | Implement tiered reads from the start (G8). Consider SQLite index if >1000 pages. |
| **Tool output size limits** — MCP tool responses have practical size limits; returning full pages for broad queries could exceed them | Medium | Moderate — truncated results degrade query quality | Return summaries by default; full content only on explicit `--full` flag or follow-up `kb_get` call. Paginate results. |
| **Skill routing ambiguity** — agent may confuse local wiki operations with global KB operations | Medium | Low — wrong tool called, user corrects | Clear naming convention: `kb_*` tools for global, `wiki/` file operations for local. The skill wrapper (G9) includes explicit routing hints. |
| **Copilot SDK availability / stability** — `@github/copilot-sdk` is a relatively new package. API surface may change. CopilotClient may fail to start if Copilot is not authenticated or subscription lapses. | Medium | Low (revised down) — CopilotClient is now off the critical write path. Only post-processing (skill detection, cross-ref suggestions) degrades. Core read/write tools are unaffected. | Isolate CopilotClient behind a thin adapter interface. All core tools work without it. Skill detection is a nice-to-have, not a must-have. |
| **LLM transformation quality drift** — prompt templates produce good results today; model updates change output quality unpredictably | Low | Moderate — new pages may not match expected structure | Pin prompt templates to specific output contracts (required sections, frontmatter fields). Validate output structure after transformation; reject and retry if contract is violated. Log template hash in page frontmatter for traceability. |
| **Copilot API rate limits / latency** — post-processing calls the Copilot API for skill detection and cross-reference suggestions; high-volume sessions could hit rate limits | Low (revised down) — post-processing is async and non-blocking | Low — degraded skill detection, not data loss | Post-processing is fire-and-forget. If the API call fails, skip it and log. The page is already stored. |

## Open Questions

- **[blocking] Runtime: Node.js or Python?** — Both have mature MCP SDKs. Node.js aligns with VS Code ecosystem. Python aligns with QMD (Python-based). Decision affects G1 implementation. Recommend: **Node.js** (stdio transport is simpler, no Python environment management needed; QMD is called via CLI subprocess either way).
- **[resolved] Page creation: server-side templates or agent-side?** — **Agent-side.** The `kb-global` skill applies prompt templates using the agent’s native LLM capability. The agent has context the server can’t access: conversation history, workspace metadata (repo name, branch), local files. The server receives pre-structured markdown via `kb_add` and handles storage, indexing, cross-referencing, and post-processing. Prompt templates live in the skill, not the server. [resolved — revised: agent-side transformation is the better pattern]
- **[resolved] `kb_ingest` vs `kb_add` boundary** — **Replaced `kb_ingest` with `kb_archive`.** There is no server-side transformation tool. The skill transforms content agent-side and calls `kb_add` (structured page) + optionally `kb_archive` (raw transcript for provenance). This cleanly separates concerns: agent owns intelligence, server owns persistence. [resolved — revised: no server-side LLM on critical path]
- **[non-blocking] Prompt template versioning** — prompt templates evolve as we learn what produces good KB pages. Should templates be versioned (v1, v2) or just overwritten? Recommend: overwrite + log. Templates are operational config, not user data. Log the template hash in the page's frontmatter so we can trace which version produced a page.
- **[non-blocking] CopilotClient token/context limits** — what are the practical limits of a single `CopilotClient` inference call? Relevant for post-processing (skill detection prompt with multiple page contents). Recommend: keep prompts under 4K tokens by using hub summaries rather than full page content when evaluating skill patterns.
- **[resolved] `kb_ingest` vs `kb_add` boundary** — See resolved question above. `kb_ingest` removed. `kb_add` is the write path, `kb_archive` preserves raw sources. [resolved]
- **[non-blocking] Hub update strategy** — Should the MCP server update hubs synchronously on every write (consistent but slower) or batch hub updates (faster but stale between batches)? llm-wiki does it synchronously during INGEST. For the MCP server, synchronous is likely fine since writes are less frequent than queries.
- **[non-blocking] Cross-reference format** — llm-wiki uses `[[wikilinks]]`. Should the global KB use the same format (good for Obsidian compatibility) or markdown links (more portable)? Recommend: wikilinks, for consistency with llm-wiki and Obsidian graph view.
- **[non-blocking] `kb_promote` conflict handling** — When promoting a page that has a near-match in the global KB, should the server merge automatically, reject with a diff, or present options? Recommend: reject with diff and let the agent/user decide.
- **[non-blocking] Skill proposal detection threshold** — How aggressive should the detector be? A low threshold means more proposals (noise). A high threshold means missed opportunities. Recommend: start conservative (require ≥3 KB pages on related topics before proposing a skill). Tune based on false-positive rate in practice. The detection prompt should look for: (a) a pattern applied in ≥2 different contexts, (b) step-by-step procedural knowledge that an agent could follow, (c) trigger phrases a user would naturally say. If only (a), it stays a concept page. If (a) + (b) + (c), it's a skill candidate.
- **[non-blocking] Skill proposal → actual skill pipeline** — The MCP server files proposals; it does not create skills. The `make-skill-template` skill (already in the user's skill library) handles skill creation. The pipeline is: proposal filed → human reviews → human says "make this a skill" → `make-skill-template` generates the SKILL.md. Should the proposal include enough structure for `make-skill-template` to consume directly? Recommend: yes — include a draft `name`, `description`, and `trigger phrases` in the proposal so the handoff is smooth.

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
│   ├── copilot.ts                  # CopilotClient lifecycle (post-processing only)
│   ├── detect-skill.ts             # Post-add skill proposal detection
│   ├── tools/                      # Tool handlers: query, add, archive, update, promote, list, status, proposals
│   ├── storage/                    # Wiki directory I/O: read/write pages, index, log, hubs
│   ├── search/                     # QMD integration: query, search, re-index, with fallback
│   ├── prompts/                    # Server-side prompts (post-processing only)
│   │   └── skill-detect.md         # "Does this pattern warrant a skill?" evaluation prompt
│   └── templates/                  # Page templates (copied from llm-wiki/templates/ at init)
└── dist/                           # compiled output
```

**Runtime data** lives outside the repo at `~/.agents/global-wiki/` (the wiki directory the server manages).

The runtime directory includes a `skill-proposals/` folder:

```
~/.agents/global-wiki/
├── wiki/                           # the knowledge base (index, log, pages, hubs)
├── raw/                            # immutable sources, NOT the primary QMD search surface
│   ├── sessions/                   # archived conversation transcripts (via kb_archive)
│   ├── sources/                    # archived articles, notes, pastes (via kb_archive)
│   └── files.log                   # auto-managed file inventory
└── skill-proposals/                # filed by the server, reviewed by the human
    ├── 2026-04-15-retry-orchestration.md
    ├── 2026-04-18-crm-idempotency-guard.md
    └── ...
```

**QMD indexes `wiki/` only** — the structured, tagged, cross-referenced summaries. `raw/` is preserved for provenance and re-processing, not for primary retrieval. This means search hits are always the distilled, high-quality pages — not noisy conversation transcripts.
```

### Skill proposal format

A proposal is a lightweight markdown file — enough for a human to evaluate and for `make-skill-template` to consume:

```markdown
---
proposed: 2026-04-15
status: candidate              # candidate | dismissed | promoted
confidence: 0.78
trigger: kb_ingest             # which operation detected this
---

# Retry Orchestration Guard

## Why this could be a skill

Three KB pages describe variations of the same pattern: preventing
duplicate processing when multiple retry layers interact. The pattern
is procedural (step-by-step), context-independent (applies to Service
Bus, Event Grid, Logic Apps), and has clear trigger phrases.

## Draft skill description

Detect and resolve overlapping retry layers in Azure integration
flows. Use when asked about retry storms, duplicate message
processing, delivery count tuning, or idempotency guards.

## Trigger phrases

- "retry storm"
- "duplicate messages"
- "maxDeliveryCount"
- "idempotent writes"
- "overlapping retries"

## Referenced KB pages

- [[dual-retry-storm-service-bus-logic-apps]] (insight)
- [[idempotent-crm-writes-via-if-match]] (concept)
- [[exponential-backoff]] (concept)

## Rationale

Pattern detected across 3 pages spanning 2 page types. Procedural
knowledge present (step-by-step resolution). Multiple natural trigger
phrases identified. Confidence: 0.78.
```

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
| `kb_archive` | `content: string`, `slug: string`, `type?: "session" \| "source"` | Archived raw path (`raw/sessions/` or `raw/sources/`) |
| `kb_update` | `slug: string`, `content: string`, `reason: string` | Updated page path, log entry |
| `kb_promote` | `localPath: string`, `type?: string` | Created/merged page path, dedup report |
| `kb_list` | `type?: string`, `tag?: string` | Filtered index entries |
| `kb_status` | — | Page count, QMD health, Copilot SDK health, last update timestamp, proposal count |
| `kb_get` | `slug: string` | Full page content |
| `kb_proposals` | `action: "list" \| "view" \| "dismiss"`, `id?: string` | Proposal listing, single proposal content, or confirmation of dismissal |

**`kb_add` is the primary write path.** The `kb-global` skill (agent-side) transforms raw content into structured markdown using prompt templates, then calls `kb_add`. The server validates the page structure, dedup-checks, stores it, updates index/log/hubs, and triggers QMD re-indexing. Optionally, the skill also calls `kb_archive` to preserve the raw conversation transcript for provenance.

**`kb_archive` preserves raw sources.** Stored in `raw/sessions/` (conversation transcripts) or `raw/sources/` (articles, notes). Not the primary QMD search surface — QMD indexes `wiki/` (the structured summaries). Raw content is preserved for traceability and re-processing if prompt templates improve.

### Copilot SDK integration

The MCP server embeds a `CopilotClient` from `@github/copilot-sdk` for **post-processing tasks only** — not on the critical write path. The agent-side skill handles content transformation using its native LLM capability.

The server uses CopilotClient for:
- **Skill proposal detection** (G13) — evaluating whether a new page, combined with related pages, represents a pattern worth codifying as a skill
- **Cross-reference suggestions** — optionally suggesting additional `[[wikilinks]]` when a new page is stored, based on semantic similarity to existing pages
- **Hub regeneration** — when hubs grow stale, using LLM to re-summarize a category

All of these are **optional enhancements**. The core `kb_add` → store → index flow works without the CopilotClient. If the SDK is unavailable (no subscription, auth failure), read/write tools operate normally; only skill detection and smart cross-referencing degrade.

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

**Post-processing flow (runs asynchronously after `kb_add` responds):**

```
kb_add completes → page stored + indexed
       │
       ▼
┌─────────────────────┐
│ 1. Cross-ref suggest  │  CopilotClient: “Given this new page and
│    (optional)          │   these existing pages, suggest wikilinks”
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2. Skill detection    │  CopilotClient: “Do related pages form
│    (optional)          │   a skill-worthy pattern?”
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 3. File proposal      │  If skill detected: write to
│    (if detected)       │   skill-proposals/<slug>.md
└─────────────────────┘
```

### Prompt template design (agent-side)

Prompt templates are bundled with the `kb-global` skill (not the MCP server). They're plain markdown files with interpolation markers. The agent applies them using its native LLM capability before calling `kb_add`.

The `create-summary-markdown-prompt.md` is the primary template for session summaries. Page-type-specific prompts derive from it:

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

The prompt template includes interpolation markers that only the agent can fill:
- `{{content}}` — the conversation transcript or raw content
- `{{repo}}` — current workspace/repository name (from workspace metadata)
- `{{branch}}` — current branch name
- `{{date}}` — current date
- `{{kb_context}}` — existing KB context for cross-referencing (fetched via `kb_query` before transformation)

This is why transformation must happen agent-side: the MCP server has no access to `{{repo}}`, `{{branch}}`, or the full conversation history.

### Relationship to llm-wiki

The server and the llm-wiki skill are **separate projects with a shared contract:**

| Concern | Owned by | Notes |
|---------|----------|-------|
| Page templates (frontmatter, headings) | llm-wiki defines, server + skill copy | Server's `src/templates/` validates structure. Skill's prompt templates produce content matching this structure. |
| Prompt templates (transformation) | `kb-global` skill owns | `create-summary-markdown-prompt.md` and page-type prompts. Applied agent-side. Server never sees them. |
| Wiki directory structure | llm-wiki defines, server implements | `index.md`, `log.md`, hubs, page type folders — same layout. |
| Wikilink format (`[[slug]]`) | Shared convention | Both use plain-filename wikilinks. |
| QMD integration patterns | llm-wiki documents (`references/qmd.md`), server implements in code | Per-collection isolation, command selection, re-index-after-writes. |
| Tiered reading at scale | llm-wiki documents (`references/scale.md`), server implements internally | Hub summaries, index tag routing, reading budgets. |
| Content transformation | `kb-global` skill owns | Agent applies prompt templates with full context (conversation, repo, branch). Server receives structured markdown. |
| `kb_promote` bridge | Server implements | Reads a local wiki page (passed as content by the agent, since the server can't access workspace files), dedup-checks against global index, stores in global KB. |
| Post-processing intelligence | Server owns (via CopilotClient) | Skill detection, cross-reference suggestions. Optional — degrades gracefully. |

The llm-wiki README should note that the global KB MCP server exists and link to its repo. The server README should note its design lineage from llm-wiki.

### Relevant prior art (cross-repo)

- **[llm-wiki] SKILL.md** — page structure, routing logic, deterministic markdown contract. The shared contract.
- **[llm-wiki] references/qmd.md** — QMD integration patterns the server mirrors in code.
- **[llm-wiki] references/scale.md** — tiered reading strategy the server implements internally.
- **[llm-wiki] references/ingest.md** — page creation flow (template application, dedup, index update, hub refresh). The `kb_add` tool replicates the Act phase.
- **[qmd-memory skill]** — proves the cross-workspace pattern works via terminal. The MCP server replaces the terminal workaround with proper tool semantics.
