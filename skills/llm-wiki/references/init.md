# INIT — Bootstrap a New Wiki

## When to Run

User says "init wiki", "create a knowledge base", or similar. Also runs automatically if INGEST is triggered but no wiki structure exists.

## Process

### 1. Gather Configuration

Ask one question at a time (or infer from context):

1. **Where should the wiki live?** (path relative to vault, e.g., `wiki/ai-agents`)
2. **What is the domain/purpose?** (one sentence — becomes the Domain section in `AGENTS.md`)
3. *(Optional)* **What types of sources will you add?** If the user does not care, skip this and use the default `articles, URLs, papers` in `AGENTS.md`.

### 2. Create Directory Structure

**Required:** the tree must match the **Wiki Structure** section in [../SKILL.md](../SKILL.md) exactly. Do not improvise folders.

Create these directories under `<wiki-root>`:

```text
assets/
raw/
wiki/
wiki/summaries/
wiki/concepts/
wiki/entities/
wiki/insights/
```

Create empty `_hub.md` stub files in each category folder using [templates/hub.md](../templates/hub.md) (they will be populated during ingest as the wiki grows).

### 3. Starter Files (AGENTS.md, index, log, overview)

Create these files directly:

- **`AGENTS.md`** — content shape:

```md
# <Domain> Wiki Schema

## Domain
<domain>

## Source Types
<source types or "articles, URLs, papers">

## Conventions
- All wiki pages use YAML frontmatter with: title, type, tags, sources, updated
- Cross-references use [[wikilinks]] with plain filenames
- raw/ is immutable — never modify source documents
- log.md is append-only
- This schema co-evolves with use — suggest changes when conventions need updating
```

- **`wiki/index.md`** — create it from [templates/index.md](../templates/index.md). Keep all four category sections even when empty. Within each section, rows are sorted alphabetically by page slug.

- **`wiki/log.md`** — exact starter content:

```md
# Wiki Log

Append-only. Format: `## [YYYY-MM-DD] <operation> | <title>`
Quick view: list the latest headings from this file.

---

## [<today>] init | <domain>
```

- **`wiki/overview.md`** — frontmatter plus starter sections:

```md
---
title: Overview
type: overview
tags: [overview, synthesis]
sources: []
updated: <today>
---

# <Domain> — Overview

> Evolving synthesis across all sources. Updated on each ingest.

## Current Understanding

*No sources ingested yet.*

## Open Questions

*Add questions here as they arise.*

## Key Entities / Concepts

*Populated as pages as they are created.*
```

Edit **AGENTS.md** for schema changes.

Use `YYYY-MM-DD` for every starter date. Do not add optional fields or alternate headings during INIT.

### 4. Initialize raw/files.log

**Required:** read [raw-tracking.md](raw-tracking.md) and create or refresh `raw/files.log` using that procedure.

If `raw/` already has files before sync, report them and ask whether to ingest.
