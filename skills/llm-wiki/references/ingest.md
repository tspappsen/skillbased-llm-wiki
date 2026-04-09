# INGEST — Process New Sources

## When to Run

User adds files to raw/, pastes content, provides a URL, or says "ingest" / "add to wiki".

## Pre-condition

Wiki must be initialized (`wiki/index.md` and `wiki/log.md` exist). If not, run **[INIT](init.md)** first.

## Process

### 1. Accept the Source

- **File path** → read directly; copy to `raw/<filename>` if not already there
- **URL** → fetch content; save to `raw/<slug>.md`
- **Pasted text** → save to `raw/<slug>.md`

Slug format: lowercase, hyphens, no special characters. Example: "Attention Is All You Need" → `attention-is-all-you-need.md`

### 2. Read in Full

Read all content. For long sources, read in sections. Do not skip.

### 3. Assess and Proceed

After reading the source:
- Identify key takeaways, entities, and concepts
- Check whether it contradicts anything already in the wiki (read index.md + relevant pages)
- Proceed to write/update pages based on your assessment

### 3.1 Filter Before Writing

Not every piece of knowledge earns a wiki page. Before writing, apply these three tests to each identified takeaway:

| Test | Question | If fails |
|------|----------|----------|
| **Compression** | Would the wiki version be >60% direct restatement of the raw source? | Pointer only — add an index entry linking to the raw file, don't create a summary page |
| **Connection** | Does this create links to ≥2 existing wiki pages? | Fold into the most relevant existing page rather than creating a new one |
| **Decay** | Will this be stale in <3 months with no signal to trigger an update? | Log entry or dated annotation, not a standalone page |

**Scoring:**
- **Passes 0/3** → stays in raw/ with an index pointer. The raw source speaks for itself.
- **Passes 1/3** → merge into the most relevant existing page. Not enough standalone value.
- **Passes 2–3/3** → earns a standalone page.

This step is not optional. Include the filter result per-source in your ingest report (Step 10).

**Only ask the user if something is genuinely unclear** — e.g., ambiguous claims, conflicting information where you can't determine which is correct, or domain-specific terms you don't understand. Do not ask for emphasis/de-emphasis on every ingest.

### 3.5 Optional User Insight Capture

This is a good use of an ask-user tool when it will materially improve curation. Keep it short and optional.

Use it for **1-3 high-signal questions max** when the answers would help with:

- what matters most in this source
- which terms or entities the user wants normalized
- whether the source should answer an existing open question
- whether the user already suspects a contradiction or connection worth checking

Good examples:

- "What is the main thing you want preserved from this source?"
- "Does this source relate to an existing question or page you care about?"
- "Are there terms here you want merged with existing naming in the wiki?"

Do **not** use this step to interview the user on every ingest. Skip it when the source is straightforward.

Treat user answers as **curation signals**, not as source-grounded facts. Use them to prioritize summaries, links, page naming, and open questions.

If the user contributes substantive knowledge that is not present in the raw source, do one of these before treating it as wiki content:

- save it as a separate raw note and ingest that note, or
- record it explicitly as user-provided context, not as if it came from the source

### 4. Compile into Wiki

For each piece of knowledge in the source, determine where it belongs. Apply this decision logic to summaries, concepts, and entities alike:

**Decision logic (not mutually exclusive — a single source may trigger multiple actions):**

- **Same core topic as existing page** → Merge into that page. Add the new raw file to `sources` frontmatter. Update affected sections.
- **New concept/entity** → Create a new page. Name the file after the concept or entity, not the raw file.
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

For each page read (either method):
1. Assess whether the new source changes, contradicts, or supplements its content
2. **Pages are not bound to specific raw files** — a source named "rag.md" may affect pages about fine-tuning, langchain, or any related topic
3. Categorize findings:
   - **Certain updates** → apply directly
   - **Uncertain** → list them and ask the user for guidance

### 7. Update Overview, Index, Log

- **overview.md** → update if the source shifts the big picture, adds key entities/concepts, or raises new open questions
- **index.md** → add entries for new pages, update summaries for modified pages
- **index.md** → use table format per [templates/index.md](../templates/index.md)
- **log.md** → append:
  ```
  ## [YYYY-MM-DD] ingest | <source title>
  Pages created: <list>
  Pages updated: <list>
  - Cascade: <cascade-updated page>
  ```

### 8. Update Hub Summaries

If the wiki has 50+ pages, update the `_hub.md` file for each category where pages were created or substantially changed. See [templates/hub.md](../templates/hub.md) for format and [scale.md](scale.md) for guidelines. Keep each hub under ~2 000 tokens.

### 9. Update raw/files.log

**Required:** read [raw-tracking.md](raw-tracking.md) and refresh `raw/files.log` using that procedure.

### 10. Report to User

- Summary page written/updated
- Concept/entity pages created or updated (list)
- Pages that received backlinks (list)
- Cascade updates applied or flagged
- Filter decisions (pages declined or merged, with rationale)
- User insight applied, if any (list the signals used)
- Total pages touched

A typical 2000-3000 word article touches 5-8 wiki files.
