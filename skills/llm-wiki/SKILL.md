---
name: llm-wiki
description: "Use this skill whenever work is wiki- or knowledge-base-shaped—especially if the user says wiki, knowledge base, vault notes, or raw/ in this project. Trigger on words such as `ingest wiki`, `add to wiki`, `init wiki`, or `lint wiki`, updating or revising wiki pages, and on domain-specific questions that should be answered from the wiki (what we know about X, compare A and B, gaps, contradictions)—not off-wiki trivia. Do not use for generic chat, unrelated code or tooling, or file operations with no wiki intent."
metadata:
  author: hsuanguo
  version: "1.0"
---

# LLM Wiki

An LLM wiki that evolves with you. Based on [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## How to work

Use two phases: **(1) gather context**, **(2) map the request into steps**—each step is one operation with a dedicated reference file. Read that reference *before* executing the step.

### 1. Gather context

Infer **intent** from the user’s message (bootstrap, ingest, answer from the wiki, revise pages, lint, etc.) and **state** from the vault:

- Whether a wiki already exists at the target root (`wiki/index.md` and `wiki/log.md`).
- If it exists: skim `wiki/index.md`, tail `wiki/log.md`, and inspect `raw/` when ingest, drift, or new sources matter.
- If uncertain about the wiki tree or `raw/files.log`, read the dedicated references in this skill before proceeding.

### 2. Map intention to one or more steps

Decompose the request into an **ordered list of steps**. Each step = a single primary operation. **Open the matching reference for every step** you will run; do not rely on memory alone. If a step touches `raw/files.log`, also read the raw tracking reference.

| Operation | Typical trigger | Reference |
|-----------|-----------------|-----------|
| **INIT** | No wiki yet; user wants a new knowledge base | [references/init.md](references/init.md) |
| **INGEST** | New or changed files in `raw/`, pasted content, or URL to add | [references/ingest.md](references/ingest.md) |
| **QUERY** | Question that should be answered **from wiki pages**, not general knowledge | [references/query.md](references/query.md) |
| **UPDATE** | User wants edits, corrections, or merges on existing pages | [references/update.md](references/update.md) |
| **LINT** | “Lint”, health check, gaps, inconsistencies, optional raw vs `files.log` drift | [references/lint.md](references/lint.md) |
| **RAW TRACKING** | Any step that inspects, syncs, or reconciles `raw/files.log` | [references/raw-tracking.md](references/raw-tracking.md) |

One message can imply several steps (e.g. INGEST then LINT). Order them sensibly—often INIT first if missing, then INGEST / UPDATE / QUERY, and LINT when checking health after substantive changes.

### Routing hint

```
wiki/index.md + wiki/log.md present at wiki root?
├─ No → INIT → references/init.md
├─ Yes →
│   ├─ New/changed raw/, or paste/URL to capture? → INGEST → references/ingest.md
│   ├─ Domain question grounded in the wiki? → QUERY → references/query.md
│   ├─ "lint" / health check / find gaps? → LINT → references/lint.md
│   ├─ Need to inspect or reconcile raw drift? → RAW TRACKING → references/raw-tracking.md
│   ├─ Revise or correct existing pages? → UPDATE → references/update.md
│   └─ Paste or URL only? → save under raw/, then INGEST → references/ingest.md
```

## Wiki Structure

**Authoritative layout** is the tree below. Treat this section as the single source of truth for INIT and whenever you need to understand the wiki structure; do not invent alternate directory trees or maintain a parallel diagram elsewhere.

```text
<wiki-root>/
├── AGENTS.md              # Domain schema (editable; shared with non-Claude agents)
├── assets/                # Attachments (images, PDFs) — self-contained
├── raw/                   # Immutable source documents (LLM reads, never modifies)
│   ├── files.log          # Auto-generated file inventory (name + date)
│   └── ...
└── wiki/
  ├── index.md           # Content catalog — every page with link + one-line summary
  ├── log.md             # Append-only chronological operation log
  ├── overview.md        # High-level evolving synthesis across all sources
  ├── summaries/         # Source summaries (can merge multiple raw files on same topic)
  ├── concepts/          # Concept pages
  ├── entities/          # Entity pages (people, tools, orgs, products)
  └── insights/          # Valuable query results and cross-page analyses
```

At a glance: `<wiki-root>/` has **`AGENTS.md`** (editable domain schema), **`CLAUDE.md`** (thin file that imports `@AGENTS.md` for [Claude Code](https://code.claude.com/docs/en/memory#agents-md)), `assets/`, `raw/` (including auto-managed `files.log`), and `wiki/` with `index.md`, `log.md`, `overview.md`, plus `summaries/`, `concepts/`, `entities/`, `insights/`.

## Tooling

No external runtime is required. Use normal file tools to create the tree and maintain `raw/files.log` as a plain file inventory per [references/raw-tracking.md](references/raw-tracking.md).

| Action | Method |
|--------|--------|
| Show canonical tree | Use the **Wiki Structure** section in this skill |
| Bootstrap files + dirs | Create the tree and starter files directly |
| Refresh `raw/files.log` | Follow [references/raw-tracking.md](references/raw-tracking.md) |
| Report drift (no write) | Follow [references/raw-tracking.md](references/raw-tracking.md) |

## Page Conventions

Page templates are in `templates/` — read the relevant template before creating a new page:
- [templates/summary.md](templates/summary.md) — source summaries
- [templates/concept.md](templates/concept.md) — concept pages
- [templates/entity.md](templates/entity.md) — entity pages
- [templates/insight.md](templates/insight.md) — insights (point-in-time snapshots, NOT cascade-updated)
- [templates/index.md](templates/index.md) — index table format

Common rules:
- Use `[[wikilinks]]` with plain filenames — no paths (e.g., `[[rag]]` not `[[concepts/rag]]`)
- Start every page with a 1-2 sentence summary
- Every page ends with a `## See Also` section for cross-references
- Slugs: lowercase, hyphen-separated (e.g., `attention-mechanism.md`)
- Raw files: no date prefix in filename; dates tracked via frontmatter

## Key Rules

1. **LLM writes wiki; human curates sources and asks questions**
2. **raw/ is immutable** — never modify
3. **Log and index only on wiki/ file changes** — no-op queries don't write anything
4. **Ask only when uncertainty or user context matters** — proceed autonomously; escalate when facts are ambiguous, sources conflict, a change would alter meaning, or 1-3 brief user answers would materially improve curation during ingest
5. **Pages are not bound to raw files** — LLM determines relevance across the entire wiki
6. **Backlink audit on every ingest** — scan all pages for missing links to new content
7. **Insights are snapshots** — not cascade-updated; add reverse links in See Also (Obsidian backlinks invisible to LLM)
8. **Schema co-evolves** — suggest AGENTS.md changes; user confirms; log records
9. **Keep `raw/files.log` correct** using [references/raw-tracking.md](references/raw-tracking.md)

## Tips for Users

Surface these to the user when relevant (e.g., during INIT, first ingest, or when they ask for help):

- **Obsidian Web Clipper** browser extension is the best way to capture web articles — bypasses anti-scraping etc.
- Use **Obsidian's graph view** to spot orphan pages and hub pages.
- **Dataview** plugin can query pages by frontmatter fields (type, tags, updated).
- From the second source onward, pay attention to cross-source connections.
