# SCALE — Tiered Reading for Large Wikis

## Problem

Full-read works when the wiki has dozens of pages. At 100+ pages, reading everything on every query or cascade exceeds practical context limits. This reference describes a tiered reading strategy that scales to hundreds of pages without embeddings or external search infrastructure.

## When to Apply

Use tiered reading whenever the wiki has **more than ~50 pages** (count rows in `index.md`). Below that threshold, full-read is fine and simpler. References to this document appear in QUERY, INGEST (cascade), and LINT.

## Core Mechanism — Three Tiers

```
Tier 0: index.md          ~1 line per page → always fits, even at 500+ pages
Tier 1: _hub.md per folder  compressed summary per category → ~2 000 tokens each
Tier 2: individual pages     read only the pages matched by Tier 0/1
```

### Tier 0 — Index Scan

`index.md` carries a `Tags` column (see [templates/index.md](../templates/index.md)). Scan the full index to:
- match **tags** against the query or new content's topics
- match **summaries** for keyword overlap
- build a **candidate list** of slugs to read at Tier 2

This is cheap: even 500 rows of `| slug | summary | tags | date |` fit in ~15 000 tokens.

### Tier 1 — Hub Summaries

Each wiki subdirectory has a `_hub.md` file (see [templates/hub.md](../templates/hub.md)):

```
wiki/summaries/_hub.md
wiki/concepts/_hub.md
wiki/entities/_hub.md
wiki/insights/_hub.md
```

A hub is a compressed digest (~1 500–2 000 tokens) of all pages in its category: key facts, notable relationships, and which individual pages to read for depth. Read a hub when:
- Tier 0 matched **many pages** in one category and you need to triage
- The query is broad / thematic ("what do we know about X?")
- You need surrounding context before deciding which pages matter

Hubs are updated during INGEST (step 7.5 in [ingest.md](ingest.md)) whenever a page in their category is created or substantially changed.

### Tier 2 — Targeted Page Reads

Read individual pages only when identified by Tier 0 or Tier 1. Follow one hop of `[[wikilinks]]` only when those links were also in the candidate list or are clearly critical.

## Reading Budgets

Use these as soft limits, not hard rules:

| Operation | Suggested max pages read | Rationale |
|-----------|--------------------------|-----------|
| QUERY | ~15 individual pages | Enough for deep synthesis; if more match, summarize from hubs |
| INGEST cascade | ~20 individual pages | Scope by tag overlap; flag the rest for next LINT |
| LINT (per batch) | ~30 individual pages | Process the wiki in batches; see [lint.md](lint.md) |

If a query genuinely needs more pages, proceed — these are guidelines, not walls.

## Tag Conventions

Tags power the routing. Keep them useful:

- **3–7 tags per page** — enough to match, not so many they're noise
- Use the same vocabulary across pages (prefer existing tags over inventing new ones)
- Check `index.md` for existing tags before creating new ones
- Tags are lowercase, hyphenated: `retrieval-augmented-generation`, `fine-tuning`, `openai`
- Update tags during ingest if a page's scope changes

## Hub Maintenance

Hubs are maintained by the LLM, not the user.

- **Created** during INIT (empty stubs)
- **Updated** during INGEST when a page in the category is created or meaningfully changed
- **Rebuilt** during LINT if a hub looks stale or inaccurate
- Keep hubs under ~2 000 tokens — they're for routing, not exhaustive detail
- Structure: brief intro → bulleted key facts/themes → "Read X for ..." pointers

## Fallback

If the wiki is small (<50 pages), skip hubs and tiered reads. Full-read is simpler and just as effective. The QUERY, INGEST, and LINT references describe both paths.
