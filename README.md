# LLM Wiki

A skill that turns an AI coding agent into a wiki curator. You supply sources; the agent reads, summarizes, cross-references, and maintains a structured knowledge base. Based on [Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## How to Use

There is nothing to install. This repo is a single agent skill — a set of markdown instructions the agent reads at runtime.

### 1. Copy the skill into your project

```bash
# Copilot
cp -r skills/llm-wiki /path/to/project/.github/skills/
```

### 2. Talk to the agent

**Create a wiki:**
```
Init a wiki at wiki/integration-platform for Azure integration services, D365 CRM, and agentic workflows
```

**Add a source** (file, paste, or URL):
```
Ingest all new sources in raw/
```
```
Add this to the wiki:
<paste article text or URL>
```

**Ask a question** (answered from wiki content, not general knowledge):
```
What are the retry differences between Service Bus and Logic Apps?
```

**Fix things:**
```
Lint the wiki
```

That's it. The agent reads `SKILL.md`, figures out which operation to run (INIT, INGEST, QUERY, UPDATE, LINT), opens the matching reference file, and executes.

### 3. What gets created

After INIT, your project looks like this:

```
wiki/integration-platform/
├── AGENTS.md           # Domain schema (editable)
├── assets/             # Images, PDFs
├── raw/                # Your source documents (never modified by the agent)
│   └── files.log       # Auto-managed file inventory
└── wiki/
    ├── index.md        # Catalog of every page (with tags for routing)
    ├── log.md          # Append-only operation log
    ├── overview.md     # Evolving high-level synthesis
    ├── summaries/      # Per-source summaries
    │   └── _hub.md     # Category digest (scaling aid)
    ├── concepts/       # Concept pages
    │   └── _hub.md
    ├── entities/       # People, tools, orgs
    │   └── _hub.md
    └── insights/       # Saved query results and analyses
        └── _hub.md
```

Sources go in `raw/`. The agent writes everything under `wiki/`. You curate sources and ask questions; the agent does the rest.

## Why It Works

The skill is a set of markdown files the agent reads before acting. No code runs.

```
skills/llm-wiki/
├── SKILL.md              # Entry point: gather context → route to operation → execute
├── references/           # One playbook per operation
│   ├── init.md
│   ├── ingest.md
│   ├── query.md
│   ├── update.md
│   ├── lint.md
│   ├── raw-tracking.md
│   └── scale.md          # Tiered reading strategy for large wikis
└── templates/            # Starter page shapes
    ├── index.md
    ├── hub.md             # Category hub digest template
    ├── concept.md
    ├── entity.md
    ├── insight.md
    └── summary.md
```

`SKILL.md` tells the agent: read the user's message, check if a wiki exists, then open the right reference file and follow it step by step. The reference files are detailed enough that the agent produces consistent output without improvising structure.

Key design choices:
- **`raw/` is immutable** — the agent never modifies source documents
- **Queries are wiki-grounded** — the agent answers from wiki pages, not training data
- **Pages cross-reference with `[[wikilinks]]`** — designed for Obsidian but works with anything that renders markdown
- **The schema co-evolves** — `AGENTS.md` updates as the domain grows

#### What happens during ingest

AI will:
1. Read each source in full
2. Create or update pages in `summaries/`, `concepts/`, `entities/`
3. Run a backlink audit — add `[[wikilinks]]` across existing pages
4. Cascade update — scan for affected pages (scoped by tag overlap in large wikis)
5. Update `index.md`, `overview.md`, `log.md`, and category hub summaries
6. Sync `raw/files.log` directly using the skill's raw-tracking rules

**Note:** AI Agent proceeds autonomously. It only asks you when something is genuinely unclear or when 1-3 brief questions would materially improve curation during ingest. Those answers are treated as curation guidance, not as source facts.

### 3. Ask Questions (QUERY)

```
What are the retry differences between Service Bus and Logic Apps?
```

```
Compare dual-write vs virtual entities for D365-to-Dataverse sync
```

```
What patterns do we have for agent-to-agent handoff in durable orchestrations?
```

AI answers strictly from wiki content, citing pages with `[[wikilinks]]`. After answering, it may:
- **Offer to save** the analysis as an insight page (if the answer has standalone value)
- **Report issues** found in existing pages (outdated info, contradictions) and ask if you want to fix them

### 4. Update Pages (UPDATE)

#### User-triggered (you ask for changes)

```
Update concepts/dual-write.md — the latest source says X
```

```
Fix the contradiction between concepts/service-bus.md and concepts/event-grid.md on message ordering
```

Agent shows a diff for each page and waits for your confirmation before writing.

#### LLM-triggered (during ingest)

When new sources affect existing pages, AI Agent updates them automatically if the change is straightforward. It asks you only for uncertain or meaning-altering changes.

### 5. Health Check (LINT)

```
Lint the wiki
```

AI checks for:

| Category | Auto-fixed? | Examples |
|----------|-------------|---------|
| **Deterministic** | Yes | Broken links, missing frontmatter, index inconsistencies |
| **Heuristic** | No — reports only | Contradictions, stale claims, orphan pages, missing cross-references, stale insights |

Writes a lint report to `insights/lint-<date>.md` and offers fixes for heuristic issues.

### 6. Check for New Sources (Drift Detection)

```
Any new files in raw/?
```

Agent inspects this directly from `raw/` and `raw/files.log`. When native hashing is available, use it; for example in PowerShell:

```powershell
Get-FileHash .\raw\karpathy-llm-wiki.md -Algorithm SHA256 | Select-Object -ExpandProperty Hash
```

If no hash tool is available, the skill falls back to `new` and `deleted` detection and may skip `modified` detection.

## Daily Workflow

| You do | AI does |
|--------|-------------|
| Clip articles → drop in `raw/` | Ingest, summarize, cross-reference |
| Ask questions | Answer from wiki, offer to save insights |
| Say "lint" occasionally | Health check, fix issues, suggest gaps |
| Review and guide | Everything else |

## Tips

- **Obsidian Web Clipper** is the fastest way to get articles into `raw/`
- **Graph view** in Obsidian shows wiki structure — hubs, orphans, clusters
- **Dataview** plugin lets you query pages by type, tags, or date
- You never write wiki pages yourself — AI handles all the maintenance
- **One wiki per repo.** If you need multiple knowledge bases, use separate git repos. Each gets its own skill copy, schema, and history.

## Scaling

The skill works by full-read at small sizes and switches to **tiered reading** at ~50+ pages — no embeddings or external search infrastructure needed.

| Tier | What it reads | Cost |
|------|--------------|------|
| **0 — Index scan** | `index.md` tags + summaries | ~15K tokens at 500 pages |
| **1 — Hub summaries** | `_hub.md` per category folder | ~2K tokens each |
| **2 — Targeted pages** | Only pages matched by Tier 0/1 | ≤15–20 pages per operation |

This keeps token usage bounded even as the wiki grows to hundreds of pages. Cascade updates during ingest are scoped by tag overlap instead of full scans, and lint processes pages in batches.
