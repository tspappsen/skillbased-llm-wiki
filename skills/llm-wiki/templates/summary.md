---
title: <topic>
type: summary
tags: [<relevant tags>]
sources: [raw/<file1>.md, raw/<file2>.md]
updated: <today>
extraction_rationale: "<1-line: why this earns a page — which filter tests it passed>"
---

<!-- Required frontmatter order: title, type, tags, sources, updated, extraction_rationale -->
<!-- Required headings: ## Essence, ## Delta, ## Tensions, ## Implications, ## Open Threads, ## See Also -->

# <Topic>

> <1-2 sentence essence: what this is, in the wiki's own language — not the source's words>

## Essence
What this is, stated in terms of what the wiki already knows. Reframe using existing wiki concepts where possible. If it introduces a genuinely new concept, name it explicitly.

## Delta
What this source adds that the wiki did not already know. Be specific. If delta is thin, reconsider whether this page should exist (see extraction_rationale). Do not restate content already in existing wiki pages — link to them instead.

## Tensions
Where this contradicts, complicates, or nuances existing wiki content. Each tension must be structured as:

> `[[page-slug]]` claims **X**. This source claims **Y**. [Source: `raw/filename.md`, §Section heading]

"None identified" is valid but should be rare for non-trivial sources. Do not silently overwrite conflicting content — annotate with attribution. These entries enable LINT to verify the cited claims haven't gone stale.

## Implications
What changes downstream as a result of this knowledge. Which decisions, mental models, or other wiki pages are affected. Pages that may need updating should be listed here and cascade-updated per INGEST Step 6.

## Open Threads
Unresolved questions raised by this source. Gaps it exposes. Things to watch for. These are explicit retrieval hooks — future ingest or query operations should check here first.

## See Also
- [[<related-concept>]]
- [[<related-entity>]]
