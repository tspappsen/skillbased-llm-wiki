# INGEST — Process New Sources

## When to Run

User adds files to raw/, pastes content, provides a URL, or says "ingest" / "add to wiki".

## Pre-condition

Wiki must be initialized (`wiki/index.md` and `wiki/log.md` exist). If not, run **[INIT](init.md)** first.

## Loop

Ingest runs as a four-phase loop: **Plan → Do → Check → Act**. Phases are sequential. **Hard stop after Plan** to present the proposal and wait for user go-ahead before any wiki/ files are written. Do not collapse phases.

| Phase | Steps | Writes to wiki/? |
|-------|-------|------------------|
| **Plan** | 1, 2, 3, 3.1, 3.2, 3.5, 3.9 | No |
| **Do** | 4, 5, 6 | Yes |
| **Check** | 6.5 | Re-reads only |
| **Act** | 7, 8, 9, 9.5, 10 | Yes (housekeeping + log) |

## Plan

### 1. Accept the Source

- **File path** → read directly; copy to `raw/<filename>` if not already there
- **URL** → fetch content; save to `raw/<slug>.md`
- **Pasted text** → save to `raw/<slug>.md`

Slug format is exact: lowercase letters and digits separated by single hyphens, with `.md` extension. Regex: `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$`

Example: "Attention Is All You Need" → `attention-is-all-you-need.md`

### 2. Read in Full

Read all content. For long sources, read in sections. Do not skip.

### 3. Assess

After reading the source:
- Identify key takeaways, candidate entities, and candidate concepts
- Read `wiki/index.md` to understand the current shape of the wiki
- Check whether the source contradicts anything already in the wiki by reading the most relevant existing pages
- When contradictions are found, note the specific claim in the existing page and the specific claim in the new source. Use the structured format from [templates/summary.md](../templates/summary.md#tensions) — do not write vague "this contradicts X" statements

### 3.1 Filter Before Writing

Not every piece of knowledge earns a wiki page. Apply these three tests to each identified takeaway:

| Test | Question | If fails |
|------|----------|----------|
| **Compression** | Would the wiki version be >60% direct restatement of the raw source? | Pointer only — add an index entry linking to the raw file, don't create a summary page |
| **Connection** | Does this create links to ≥2 existing wiki pages? | Fold into the most relevant existing page rather than creating a new one |
| **Decay** | Will this be stale in <3 months with no signal to trigger an update? | Log entry or dated annotation, not a standalone page |

**Scoring:**
- **Passes 0/3** → stays in raw/ with an index pointer. The raw source speaks for itself.
- **Passes 1/3** → merge into the most relevant existing page. Not enough standalone value.
- **Passes 2–3/3** → earns a standalone page.

This step is not optional. Filter results are reported in the Plan output (Step 3.9) and again in the final ingest report (Step 10).

### 3.2 Dedup Check

**Required before proposing any new entity or concept page.** Silent duplicate pages with name variants (`[[Service Bus]]` vs `[[Azure Service Bus]]` vs `[[ServiceBus]]`) are the dominant failure mode for compounding wikis.

For each candidate entity or concept name from Step 3:

1. Scan `wiki/index.md` for matches in the page slug, title, or Tags column. Match on substring and on simple variants (singular/plural, hyphenated/spaced, with/without prefix words like "Azure" or "Microsoft").
2. **Large wiki (50+ pages):** also scan the relevant `_hub.md` files (`wiki/entities/_hub.md`, `wiki/concepts/_hub.md`) for the candidate name and its variants. See [scale.md](scale.md).
3. **With qmd available:** run `qmd --index $IDX search "<candidate>" -c wiki --json -n 5` for higher precision. See [qmd.md](qmd.md).
4. Classify each candidate as:
   - **Exact existing page** → merge new info into it; no new page
   - **Near-match** → flag for user decision in the Plan output (merge into existing or create new with a disambiguating name)
   - **No match** → safe to propose as a new page

Do not skip this step even when the source feels "clearly new". The check is cheap and the failure mode is silent.

### 3.5 Optional User Insight Capture

This is a good use of an ask-user tool when it will materially improve curation. Keep it short and optional.

Use it for **1-3 high-signal questions max** when the answers would help with:

- what matters most in this source
- which terms or entities the user wants normalized (often surfaced by Step 3.2)
- whether the source should answer an existing open question
- whether the user already suspects a contradiction or connection worth checking

Good examples:

- "What is the main thing you want preserved from this source?"
- "Does this source relate to an existing question or page you care about?"
- "Step 3.2 found `[[service-bus]]` and `[[azure-service-bus]]` — should these be merged?"

Do **not** use this step to interview the user on every ingest. Skip it when the source is straightforward.

Treat user answers as **curation signals**, not as source-grounded facts. Use them to prioritize summaries, links, page naming, and open questions.

If the user contributes substantive knowledge that is not present in the raw source, do one of these before treating it as wiki content:

- save it as a separate raw note and ingest that note, or
- record it explicitly as user-provided context, not as if it came from the source

### 3.9 Present Plan and Stop

**Hard stop. Do not write any wiki/ files yet.** Present a structured proposal to the user and wait for go-ahead.

Use this exact shape:

```text
Ingest plan: <source title>

Filter results:
- <takeaway> → 3/3 → new page concepts/<slug>.md
- <takeaway> → 1/3 → merge into [[existing-page]]
- <takeaway> → 0/3 → raw pointer only

Dedup decisions needed:
- "<candidate name>" near-matches [[existing-slug]] — merge or create new?
- "<candidate name>" — no match, safe to create

Pages to create:
- summaries/<slug>.md
- concepts/<slug>.md
- entities/<slug>.md

Pages to update (cascade scope):
- [[existing-slug]] — reason
- [[existing-slug]] — reason

Open questions:
- <any user-decision questions from Step 3.5 or dedup>

Proceed?
```

Wait for explicit go-ahead. The user may correct page names, reject dedup proposals, or reduce the cascade scope. Apply corrections, then proceed to Do.

## Do

### 4. Compile into Wiki

For each piece of knowledge in the source, determine where it belongs. Apply this decision logic to summaries, concepts, and entities alike:

**Decision logic (not mutually exclusive — a single source may trigger multiple actions):**

- **Same core topic as existing page** → Merge into that page. Add the new raw file to `sources` frontmatter. Update affected sections.
- **New concept/entity (passed dedup check in Step 3.2)** → Create a new page. Name the file after the concept or entity, not the raw file.
- **Spans multiple pages** → Place primary content in the most relevant page. Add `[[wikilinks]]` and See Also cross-references to related pages.

**Handling contradictions:**
- If the new source contradicts existing content, **annotate the disagreement with source attribution** — do not silently overwrite.
- When merging into an existing page, note the conflict within that page (e.g., "Source A claims X; Source B claims Y").
- When conflicting content lives in separate pages, note it in both and cross-link them.

**Page creation by type:**
- Summaries → `summaries/<slug>.md` using [templates/summary.md](../templates/summary.md)
- Concepts → `concepts/<slug>.md` using [templates/concept.md](../templates/concept.md)
- Entities → `entities/<slug>.md` using [templates/entity.md](../templates/entity.md)

**Summary page structure:** When creating a summary page, follow the five-section body format in [templates/summary.md](../templates/summary.md): Essence → Delta → Tensions → Implications → Open Threads. This is not a compression of the source — it is a comparison against what the wiki already knows. Read relevant existing wiki pages before writing.

### 5. Backlink Audit — Do Not Skip

Scan ALL existing pages in wiki/ for mentions that should link to newly created or updated pages but don't. Add `[[slug]]` references where appropriate.

This is the most commonly skipped step. A compounding wiki's value comes from bidirectional links.

### 6. Cascade Update

After direct operations, identify and update existing pages affected by the new information.

**Small wiki (<50 pages):** scan all pages in summaries/, concepts/, entities/, insights/.

**Large wiki (50+ pages):** use **scoped cascade** per [scale.md](scale.md):
1. Extract the key tags and entities from the new source
2. Scan `index.md` Tags columns — select pages whose tags overlap with the new content
3. Add pages that are directly `[[wikilinked]]` from newly created/updated pages
4. Read only those matched pages (~20 page budget)
5. If more pages potentially match than the budget allows, flag the remainder: "These pages may also be affected — consider running LINT to catch anything missed"

**With qmd available:** run `qmd --index $IDX query "<source thesis in 5-10 words>" -c wiki --json -n 20` to discover affected pages with higher recall than tag overlap alone. Merge results with the tag-scoped list above. See [qmd.md](qmd.md).

For each page read (either method):
1. Assess whether the new source changes, contradicts, or supplements its content
2. **Pages are not bound to specific raw files** — a source named "rag.md" may affect pages about fine-tuning, langchain, or any related topic
3. Categorize findings:
   - **Certain updates** → apply directly
   - **Uncertain** → list them and ask the user for guidance

**Open Thread resolution:** If any existing wiki page has an Open Thread that this source resolves, do not just update the page — promote the resolution to a new insight page in `insights/`. An insight page captures synthesis that only exists because multiple sources were read together. Use [templates/insight.md](../templates/insight.md) for format.

## Check

### 6.5 Re-read and Validate

Re-read every page touched in Steps 4, 5, and 6. Do not skip. The cost of re-reading is small; the cost of a silent broken page compounds.

For each touched page, verify:

- **Frontmatter is valid YAML** and includes all required fields per [templates/](../templates/) for that page type
- **Field order matches** the canonical order in `SKILL.md` (`title`, `type`, `tags`, `sources`, `updated`, then type-specific fields)
- **`updated:` was bumped** to today
- **All `[[wikilinks]]`** in the page resolve to existing files in wiki/
- **Required headings** for the page type are present
- **No claim was silently overwritten** — contradictions are filed in the Tensions section using the structured format from [templates/summary.md](../templates/summary.md#tensions)
- **No orphaned new pages** — every newly created page has at least one inbound `[[wikilink]]` from another wiki page

If any check fails, fix it now and re-validate. **Do not proceed to Act with broken pages.** If a fix is non-trivial or requires a user decision, stop and surface it.

## Act

### 7. Update Overview, Index, Log

- **overview.md** → update if the source shifts the big picture, adds key entities/concepts, or raises new open questions
- **index.md** → add entries for new pages, update summaries for changed pages
- **index.md** → use table format per [templates/index.md](../templates/index.md)
- **index.md** → keep exactly one row per page and sort rows alphabetically by page slug within each category section
- **index.md** → tags are lowercase and comma-separated inside the Tags column; if a page has no one-line summary yet, use `(no summary)`
- **log.md** → append:
  ```
  ## [YYYY-MM-DD] ingest | <source title>
  Pages created: <list>
  Pages updated: <list>
  - Cascade: <cascade-updated page>
  ```

If a list is empty, write `none` rather than omitting the line.

### 8. Update Hub Summaries

If the wiki has 50+ pages, update the `_hub.md` file for each category where pages were created or substantially changed. See [templates/hub.md](../templates/hub.md) for format and [scale.md](scale.md) for guidelines. Keep each hub under ~2 000 tokens.

### 9. Update raw/files.log

**Required:** read [raw-tracking.md](raw-tracking.md) and refresh `raw/files.log` using that procedure. This tracks filename inventory only; do not infer or report modified files.

### 9.5 Re-index Search Backend (if qmd in use)

If qmd is the active search backend for this repo (see [qmd.md](qmd.md)), re-index now:

- New pages created → `qmd --index $IDX update && qmd --index $IDX embed`
- Only existing pages modified → `qmd --index $IDX update`

Skip this step entirely if qmd is not installed. The skill works without it.

### 10. Report to User

Use this exact report shape:

- Plan deviations applied (if any)
- Summary page written/updated
- Concept/entity pages created or updated (list)
- Dedup decisions applied (which candidates merged vs new)
- Pages that received backlinks (list)
- Cascade updates applied or flagged
- Filter decisions (pages declined or merged, with rationale)
- Check phase: any issues found and corrected
- User insight applied, if any (list the signals used)
- Total pages touched

A typical 2000-3000 word article touches 5-8 wiki files.