# A3 — kb-global Skill

**Story:** N/A — derived from global-kb-mcp-server spec (G9, G11)
**PO:** —  |  **Dev:** —
**Date:** 2026-04-15
**Status:** Draft

---

## Background

The global-kb-mcp-server spec established that content transformation must happen **agent-side**, not server-side. The MCP server is a storage + indexing engine. The skill is where intelligence lives — it has access to conversation history, workspace metadata (repo, branch), and local files that the MCP server, running as a separate process, cannot see. [from spec: global-kb-mcp-server/spec.md, Desired State #5]

This skill belongs in the `skillbased-llm-wiki` repo alongside the `llm-wiki` skill. Both are pure markdown — no runtime, no build step, no dependencies. They share the same page template contract and cross-reference conventions. [from interview]

## Current State

### What exists today

1. **llm-wiki skill** — rich per-workspace wiki. Handles INIT, INGEST (with Plan → Do → Check → Act), QUERY, UPDATE, LINT, SCALE. Produces structured pages from raw sources using page templates. Bound to the workspace it lives in. [from skill: llm-wiki/SKILL.md]

2. **qmd-memory skill** — flat markdown notes in `~/.agents/memory/copilot-memory/`. Cross-workspace via terminal commands. No page structure, no transformation, no templates. Works but limited. [from skill: qmd-memory/SKILL.md]

3. **create-summary-markdown-prompt.md** — a prompt template for structured session summaries. Already exists in the MCP server spec folder. Contains `{{repo}}`, `{{branch}}`, `{{content}}`, `{{date}}` interpolation markers. Currently unattached to any skill. [from spec: create-summary-markdown-prompt.md]

4. **Simple KB MCP server** (spec in progress) — accepts a markdown file, stores it in `~/.cache/kb/raw/`, runs `qmd ingest` + `qmd embed`. Stupid-simple storage + indexing. No transformation, no classification, no post-processing. [from interview]

### What's missing

There is no skill that:
- Recognizes "save this session as knowledge" and transforms the conversation into a structured page
- Applies prompt templates with workspace context (repo, branch, date)
- Routes the result to the KB MCP server
- Recognizes "what do I know about X" and queries the KB MCP server
- Bridges between the per-workspace `llm-wiki` and the global KB

The user must manually copy conversation excerpts, format them, and store them. This is the gap the skill fills. [from interview]

## Desired State

When this skill is complete:

1. **"Save this session as knowledge"** triggers the skill. It gathers the conversation transcript and workspace metadata, applies a prompt template, and sends the structured result to the MCP server. One sentence from the user → structured, searchable KB page. [from interview]

2. **"What do I know about X"** triggers the skill. It queries the MCP server (which queries QMD), and presents the results with context. Cross-workspace recall, zero setup. [from interview]

3. **Prompt templates are bundled with the skill.** The primary template is `create-summary-markdown-prompt.md` for session summaries. Page-type templates (concept, insight, entity) can follow. Templates are plain markdown with interpolation markers — no code. [from interview]

4. **The skill is pure markdown.** No scripts, no build step, no runtime dependencies. It follows the same "nothing to install" philosophy as llm-wiki. It relies on the agent's native LLM capability for transformation — which is always available since the skill runs inside Copilot Chat. [from interview]

5. **Routing is unambiguous.** The skill handles global KB operations (`kb_*` MCP tools). The llm-wiki skill handles local wiki operations (`wiki/` file operations). They don't conflict. [from interview]

## Goals

- G1: The skill activates on "save this session", "remember this globally", "add to knowledge base", "what do I know about", or similar intent phrases
- G2: The skill gathers conversation transcript, strips tool calls and formatting noise, extracts the substantive content
- G3: The skill interpolates prompt templates with `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}` and invokes the agent's LLM to produce structured markdown
- G4: The skill calls the MCP server's `kb_add` tool with the structured result
- G5: The skill supports a query path — "what do I know about X" → calls `kb_query` → presents results
- G6: The skill and llm-wiki share the same page template contract (frontmatter, headings, wikilinks) so pages are format-compatible

## Root Cause Analysis

The gap is not technical — the MCP server can store content, QMD can search it. The gap is **usability and context**: someone needs to transform a messy conversation into a structured page, and only the agent can do that because it holds the conversation in context. Without the skill, the user would have to manually copy, format, and call MCP tools directly. That's not a knowledge base — it's a clipboard. [from interview]

## Gap Analysis

| Gap | Change needed | Enables | Complexity | Dependencies |
|-----|--------------|---------|------------|--------------|
| G1 | **SKILL.md with routing logic** — frontmatter with trigger description, intent matching section, routing hints for global KB vs local wiki | G1 (activation) | Simple — markdown only | None |
| G2 | **Conversation gathering instructions** — how the skill tells the agent to extract the transcript, strip tool calls, identify the substantive content | G2, G3 | Simple — instructions in SKILL.md | G1 |
| G3 | **Prompt template: `create-summary-markdown-prompt.md`** — the primary template for session summaries. Already exists, needs to be bundled in the skill's `templates/` folder. Interpolation markers: `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}`. | G3 (transformation) | Simple — copy + validate markers | G1 |
| G4 | **MCP tool call instructions** — how the skill tells the agent to call `kb_add` with the structured result. Includes parameter mapping (content, title, tags). | G4 (storage) | Simple — instructions in SKILL.md | G1, KB MCP server operational |
| G5 | **Query path instructions** — how the skill handles "what do I know about X". Routes to `kb_query`, formats results for the user. | G5 (retrieval) | Simple — instructions in SKILL.md | G1, KB MCP server operational |
| G6 | **Page template alignment** — verify that prompt templates produce output matching llm-wiki's page templates (frontmatter fields, heading structure, wikilink format). Document the shared contract. | G6 (compatibility) | Simple — comparison + documentation | G1, G3 |
| G7 | **Additional prompt templates** — page-type-specific prompts for concept, insight, entity extraction from conversations. Optional — `create-summary-markdown-prompt.md` covers the common case. | Richer page types | Simple per template — but each needs testing | G3 |

**Dependency order:** G1 → G2 → G3 → G4 + G5 (parallel) → G6 → G7

## Constraints

- **Pure markdown, no code** — the skill is a SKILL.md file with optional reference files and templates. No scripts, no package.json, no build step. Same philosophy as llm-wiki. [architectural]
- **Agent LLM does the transformation** — the skill provides instructions and templates; the agent's native LLM capability does the actual transformation. The skill never calls an external API. [architectural]
- **MCP server must be registered** — the skill's write and query paths depend on the KB MCP server being registered in VS Code's MCP settings. If the server isn't registered, the skill should tell the user what's missing — not silently fail. [dependency]
- **llm-wiki must not change** — this skill is additive. The existing per-project wiki skill works exactly as before. [compatibility]
- **Page templates are a shared contract** — if llm-wiki changes its template structure, this skill's prompt templates must be updated to match. The llm-wiki repo owns the template contract. [governance]

## Out of Scope

- **Server-side transformation** — the MCP server stores and indexes. It does not transform content. [boundary — established in MCP spec]
- **Automatic sync between local wiki and global KB** — promote/pull are future work. This skill handles save and query. [sequencing]
- **Skill proposal detection** — that's a server-side post-processing feature if ever needed. Not part of this skill. [boundary]
- **Multi-source INGEST pipeline** — llm-wiki's full Plan → Do → Check → Act pipeline is overkill for a single-session save. This skill does one thing: take a conversation, transform it, store it. [simplicity]

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Routing ambiguity** — agent confuses "save to wiki" (local, llm-wiki) with "save to knowledge base" (global, kb-global) | Medium | Low — wrong store, user corrects | Distinct trigger phrases. SKILL.md includes explicit routing: "If the user says `wiki` or the project has a `wiki/` folder, this is llm-wiki. If the user says `knowledge base`, `globally`, `remember this`, it's kb-global." |
| **Template output drift** — model updates change the LLM's output for the same prompt template, producing pages that don't match the expected structure | Low | Moderate — malformed pages stored | Validate output structure in the skill instructions: "Check that the output has frontmatter with title, type, tags, updated. If not, retry once." |
| **MCP server not registered** — user installs the skill but not the server | Medium | High — skill is useless | First-run check: "Try calling `kb_add` with a test payload. If it fails with 'tool not found', tell the user to register the KB MCP server." |
| **Conversation too long** — session transcript exceeds context window when combined with prompt template | Low | Moderate — truncated output | Instructions: "If the transcript exceeds ~3000 words, summarize the key points before applying the template. Prioritize code changes, decisions, and root causes." |

## Open Questions

- **[non-blocking] Template versioning** — should prompt templates include a version marker? Probably overkill for a v1 skill. Revisit if templates evolve frequently.
- **[non-blocking] Multi-page extraction** — should the skill detect when a conversation contains multiple distinct knowledge threads (e.g., a retry pattern + an idempotency pattern) and produce multiple pages? Desirable but adds complexity. v1: one conversation → one page. v2: multi-page detection.
- **[non-blocking] Tags extraction** — should the skill extract tags from the content automatically, or should the user provide them? Recommend: skill extracts, user can override.

## Implementation Notes

### Skill structure

```
skills/kb-global/
├── SKILL.md                              # Routing, intent matching, instructions
└── templates/
    └── create-summary-markdown-prompt.md  # Primary prompt template (session summaries)
```

Future additions (G7):
```
    └── templates/
        ├── create-summary-markdown-prompt.md
        ├── concept.md                     # Concept extraction prompt
        ├── insight.md                     # Insight extraction prompt
        └── entity.md                      # Entity extraction prompt
```

### SKILL.md outline

```yaml
---
name: kb-global
description: >
  Save conversations and knowledge to a global, cross-workspace knowledge base.
  Use when asked to "save this session", "remember this globally",
  "add to knowledge base", "what do I know about", or when the user
  wants to persist learning across projects. Do not use for local
  wiki operations — that's llm-wiki.
---
```

The body should cover:

1. **When to activate** — trigger phrases + negative triggers (not local wiki)
2. **Save path** — gather transcript → strip noise → load template → interpolate → LLM transform → call `kb_add`
3. **Query path** — extract query → call `kb_query` → format + present results
4. **Template interpolation** — which markers exist, where the values come from
5. **Output validation** — check frontmatter, required sections, retry if malformed
6. **Error handling** — MCP not registered, QMD not installed, etc.

### Relationship to llm-wiki

| Concern | llm-wiki | kb-global |
|---------|----------|-----------|
| Scope | Per-workspace `wiki/` directory | Global `~/.cache/kb/` via MCP |
| Activation | "wiki", "ingest", project has `wiki/` | "knowledge base", "globally", "remember this" |
| Transformation | INGEST pipeline (Plan → Do → Check → Act) | Single-pass: template + LLM |
| Storage | `read_file` / `create_file` (workspace tools) | MCP tools (`kb_add`, `kb_query`) |
| Page templates | Owns the contract (templates/) | Produces output matching the contract |
| Trigger overlap | "add to wiki" → llm-wiki | "save as knowledge" → kb-global |

### Relationship to the MCP server

The skill and the MCP server have a clean boundary:

- **Skill produces** → structured markdown (the page content)
- **MCP receives** → markdown file via `kb_add` → stores in `~/.cache/kb/raw/` → runs `qmd ingest` + `qmd embed`
- **Skill queries** → natural language via `kb_query` → MCP runs `qmd query` → returns results

The skill never touches `~/.cache/kb/` directly. The MCP server never sees the conversation or applies templates.
