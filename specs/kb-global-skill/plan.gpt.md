### Summary
Add a new markdown-only skill, `kb-global`, that mirrors the structure and clarity of `skills/llm-wiki/SKILL.md` but only supports two operations: **SAVE** to the global KB via MCP and **QUERY** from the global KB via MCP. The plan keeps `llm-wiki` unchanged, creates exactly two new files, and treats llm-wiki’s page templates as the formatting contract that `kb-global` must target.

### Goal
Produce a compact implementation for the `kb-global` Copilot skill that:
- routes global knowledge-save and global knowledge-query intents,
- transforms conversation transcripts into structured markdown using a bundled prompt template,
- calls `kb_add` / `kb_query` MCP tools,
- and stays clearly separated from local `llm-wiki` behavior.

### Tier
**Tier 1 — markdown-only skill scaffold**

No code, no build, no scripts, no runtime changes. The work is limited to two new markdown files and a documentation-grade verification pass.

### Files

#### Files to create
- `skills/kb-global/SKILL.md` — main skill instructions, routing, workflow steps, validation, and failure handling.
- `skills/kb-global/templates/create-summary-markdown-prompt.md` — prompt template used to turn cleaned conversation content into llm-wiki-compatible markdown for storage via `kb_add`.

#### Read-only context files
- `specs/kb-global-skill/spec.md` — primary requirements and routing boundaries.
- `skills/llm-wiki/SKILL.md` — structural/style reference for the new skill.
- `skills/llm-wiki/templates/summary.md` — closest page-contract reference for frontmatter order, headings, and wikilink conventions.
- `specs/global-kb-mcp-server/create-summary-markdown-prompt.md` — source prompt to adapt for the new template.
- `specs/kb-mcp-simple/spec.md` — MCP tool shapes and operational constraints for `kb_add` and `kb_query`.

### Steps

1. **Create `skills/kb-global/SKILL.md` with matching skill frontmatter and positioning.**  
   - Add YAML frontmatter with `name: kb-global` and a keyword-rich description that includes the requested positive trigger phrases.  
   - Explicitly include negative routing guidance so the skill does **not** claim local wiki work.  
   - Mirror the overall readability of `skills/llm-wiki/SKILL.md` without copying its larger multi-operation complexity.  
   - Constraints/patterns: keep it markdown-only, additive, and simpler than `llm-wiki`.  
   - **Classification:** atomic

2. **Define the top-level operating model in `skills/kb-global/SKILL.md`.**  
   - Add a short “How to work” section that tells the agent to: infer intent, choose SAVE vs QUERY, load the template when saving, and use MCP tools for persistence/retrieval.  
   - Add a two-row routing/operation table for SAVE and QUERY.  
   - Add a routing hint or decision tree that clearly separates `kb-global` from `llm-wiki` using the spec’s wording: `wiki` / `wiki/` folder → `llm-wiki`; `knowledge base` / `globally` / `remember this` → `kb-global`.  
   - Constraints/patterns: keep routing explicit and deterministic; avoid overlap with the existing `llm-wiki` description.  
   - **Classification:** likely compound

3. **Document the SAVE path in `skills/kb-global/SKILL.md`.**  
   - Describe the exact sequence: gather conversation transcript → remove tool-call noise / formatting artifacts → shorten if >3000 words → load `templates/create-summary-markdown-prompt.md` → interpolate `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}` → let the agent produce structured markdown → validate → call `kb_add`.  
   - Spell out how the `kb_add` payload is derived:  
     - `title` from generated frontmatter title,  
     - `content` as the full generated markdown page,  
     - `tags` from generated frontmatter tags when available.  
   - Constraints/patterns: keep transformation agent-side; do not imply server-side formatting or direct filesystem writes.  
   - **Classification:** likely compound

4. **Document the QUERY path in `skills/kb-global/SKILL.md`.**  
   - Describe extracting the actual knowledge question from the user message, calling `kb_query`, and formatting ranked results back to the user with enough context to be useful.  
   - Instruct the skill to present title, path, snippet, and a short synthesis rather than dumping raw results unframed.  
   - Constraints/patterns: treat `kb_query` as retrieval over the global KB only; do not route local-wiki questions here.  
   - **Classification:** atomic

5. **Add interpolation, validation, and error-handling sections to `skills/kb-global/SKILL.md`.**  
   - Include a dedicated interpolation contract section that defines the source of each marker:  
     - `{{content}}` = cleaned transcript or summarized transcript  
     - `{{repo}}` = workspace/repository name if available  
     - `{{branch}}` = current branch if available  
     - `{{date}}` = current date in `YYYY-MM-DD`  
   - Add output validation rules: generated markdown must include frontmatter with `title`, `type`, `tags`, `updated`; retry once if malformed before attempting `kb_add`.  
   - Add error handling for: MCP tool not found / server not registered, QMD unavailable behind the MCP server, transcript too long, and empty/weak query results.  
   - Constraints/patterns: keep failures actionable and user-facing; do not silently continue after malformed output or missing tools.  
   - **Classification:** likely compound

6. **Create `skills/kb-global/templates/create-summary-markdown-prompt.md` by adapting the existing summary prompt into llm-wiki-compatible output.**  
   - Start from `specs/global-kb-mcp-server/create-summary-markdown-prompt.md`, but replace its loose report format with a stronger page-generation contract aligned to llm-wiki conventions.  
   - Preserve the required interpolation markers: `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}`.  
   - Require output frontmatter that includes `title`, `type`, `tags`, `sources`, `updated`, and uses `[[wikilinks]]` in cross-references.  
   - Shape the body so it resembles a reusable wiki page rather than a one-off meeting note; align headings as closely as practical to the existing summary-page conventions.  
   - Constraints/patterns: pure markdown prompt only; no code fences unless the content genuinely needs them; no references to MCP internals in the generated page.  
   - **Classification:** likely compound

7. **Run a spec-to-file review before considering the work complete.**  
   - Cross-check every requirement in `specs/kb-global-skill/spec.md` against the two new files.  
   - Verify the new skill never instructs edits to `llm-wiki`, never claims local wiki operations, and never depends on a build step.  
   - Confirm the prompt template and skill instructions agree on the same frontmatter contract and interpolation markers.  
   - **Classification:** atomic

### Content outline for `skills/kb-global/SKILL.md`
- **Frontmatter** — `name`, discovery-oriented description, optional version metadata if desired.
- **Title + short overview** — one-paragraph explanation of the skill’s scope: global KB save/query only.
- **How to work** — brief operating model: infer intent, choose SAVE or QUERY, load template for SAVE, use MCP tools.
- **Operation routing table** — SAVE and QUERY with their triggers and outcomes.
- **Routing hint / decision tree** — explicit split between `llm-wiki` and `kb-global`; include negative triggers.
- **SAVE workflow** — transcript gathering, cleanup, summarization threshold, template loading, interpolation, transform, validate, `kb_add` call.
- **QUERY workflow** — query extraction, `kb_query` call, result formatting, concise synthesis.
- **Template interpolation contract** — marker list and value provenance.
- **Output validation rules** — required frontmatter fields, malformed output retry-once rule.
- **Error handling / failure modes** — missing MCP tool, QMD/indexing issue surfaced through MCP, overly long transcript, weak or empty query results.
- **Shared markdown/page contract** — point to llm-wiki conventions: frontmatter order, structured headings, `[[wikilinks]]`, workspace-local vs global storage boundary.
- **Key rules** — short numbered rules reinforcing: markdown only, no direct file writes, no local wiki routing, no silent failures.

### Content outline for `skills/kb-global/templates/create-summary-markdown-prompt.md`
- **Prompt objective** — transform cleaned conversation content into a durable, searchable knowledge page.
- **Provided context block** — include `{{repo}}`, `{{branch}}`, `{{date}}`, and `{{content}}` with clear meaning.
- **Authoring instructions** — emphasize synthesis over transcript copy, focus on decisions, root causes, fixes, patterns, and follow-up value.
- **Required frontmatter contract** — `title`, `type`, `tags`, `sources`, `updated` in llm-wiki-friendly order.
- **Body structure guidance** — produce a wiki-style page with a short summary opening, stable section headings, and explicit `## See Also` links using `[[wikilinks]]`.
- **Cross-reference rules** — use plain wikilink filenames/slugs only; no paths in links.
- **Quality guardrails** — avoid tool chatter, avoid raw chat formatting, avoid empty sections, and prefer concise synthesis over exhaustive transcript replay.
- **Output-only instruction** — return only the final markdown page, with no explanation around it.

### Verify
- Confirm the repository now contains exactly these new planned target files under `skills/kb-global/` and no changes to `skills/llm-wiki/`.
- Read `skills/kb-global/SKILL.md` and verify it covers all required items from the spec: frontmatter, activation, save path, query path, interpolation, validation, error handling, routing clarity.
- Read `skills/kb-global/templates/create-summary-markdown-prompt.md` and verify all four interpolation markers are present exactly: `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}`.
- Compare the prompt template output contract against `skills/llm-wiki/templates/summary.md` and confirm compatibility on frontmatter shape/order, wiki-style sections, and `[[wikilinks]]` usage.
- Confirm `kb_add` and `kb_query` are named exactly as in `specs/kb-mcp-simple/spec.md`.
- Manually review that no step implies code, package installation, or a build/test command.

### Risks / assumptions
- **Assumption:** `kb-global` should stay monolithic (single `SKILL.md` + template) rather than adopting a router/reference-file architecture, because the user explicitly wants the same broad pattern as `llm-wiki` but with only two operations.
- **Assumption:** Repository and branch values may occasionally be unavailable; the skill should instruct the agent to use a sensible fallback such as `unknown` or omit detail gracefully rather than block the save.
- **Risk:** Trigger overlap with `llm-wiki` is the highest usability risk; the routing hint must be explicit and repeated near the top of `SKILL.md`.
- **Risk:** The original prompt spec is more note/report shaped than wiki-page shaped; the template rewrite must be opinionated enough to enforce structured KB output.
- **Risk:** If the generated page contract is too loose, malformed content could be sent to `kb_add`; validation and one retry are essential.
- **Risk:** MCP availability and QMD setup are environmental, not file-level; the skill can only detect/report those failures, not fix them.

### Open questions
- **non-blocking:** Should the prompt template target the minimal shared frontmatter contract (`title`, `type`, `tags`, `sources`, `updated`) exactly as written in the spec, or should it also include `extraction_rationale` to mirror `skills/llm-wiki/templates/summary.md` more closely? This plan assumes the minimal five-field contract unless the reviewer wants exact summary-template parity.
