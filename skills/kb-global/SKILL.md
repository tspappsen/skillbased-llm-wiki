---
name: kb-global
description: >
  Save conversations and knowledge to a global, cross-workspace knowledge base.
  Use when asked to "save this session", "remember this globally",
  "add to knowledge base", "what do I know about", or when the user
  wants to persist learning across projects. Do not use for local
  wiki operations — that's llm-wiki.
metadata:
  version: "1.0"
---

# KB Global

Save conversations as structured knowledge pages in a global, cross-workspace knowledge base, and query that knowledge later from any repository. This skill is pure markdown with no runtime: it routes intent, applies a template for saves, and uses MCP tools for storage and retrieval.

## How to work

Use two phases: **(1) infer intent** — decide whether the user wants **SAVE** or **QUERY** — and **(2) execute the matching workflow**. Before every **SAVE**, read [templates/create-summary-markdown-prompt.md](templates/create-summary-markdown-prompt.md) and use it as the transformation contract.

## Operation table

| Operation | Typical trigger | Template |
|-----------|-----------------|----------|
| **SAVE** | "save this session", "remember this globally", "add to knowledge base", "store this as knowledge" | [templates/create-summary-markdown-prompt.md](templates/create-summary-markdown-prompt.md) |
| **QUERY** | "what do I know about", "search knowledge base", "recall", "find in KB" | — |

## Routing hint

```text
User says "wiki", "ingest", or project has wiki/ folder?
├─ Yes → llm-wiki skill (local, per-workspace)
├─ No →
│   ├─ "knowledge base", "globally", "remember this", "save this session"? → SAVE
│   └─ "what do I know about", "search KB", "recall"? → QUERY
```

## SAVE workflow

1. Gather the conversation transcript from the current session.
2. Strip tool calls, formatting noise, and system messages; keep the substantive content such as decisions, code changes, root causes, patterns, and solutions.
3. If the cleaned transcript exceeds about 3000 words, summarize the key points first, prioritizing code changes, decisions, and root causes.
4. Collect workspace metadata:
   - `{{repo}}` — repository or workspace name; use `unknown` if unavailable
   - `{{branch}}` — current git branch; use `unknown` if unavailable
   - `{{date}}` — current date in `YYYY-MM-DD`
5. Read [templates/create-summary-markdown-prompt.md](templates/create-summary-markdown-prompt.md).
6. Interpolate the four markers: `{{content}}`, `{{repo}}`, `{{branch}}`, `{{date}}`.
7. Use the interpolated prompt to generate a structured markdown page.
8. **Validate output:** confirm the generated page includes frontmatter with `title`, `type`, `tags`, and `updated`. If any are missing, retry the generation once.
9. Call the MCP tool `kb_add` with:
   - `title`: the generated frontmatter `title`
   - `content`: the full generated markdown page
   - `tags`: the generated frontmatter `tags` array, if present
10. Confirm to the user which page title was saved, that it was stored successfully, and the key tags that were applied.

## QUERY workflow

1. Extract the actual knowledge question from the user's message and strip conversational filler.
2. Call the MCP tool `kb_query` with:
   - `query`: the extracted question
   - `n`: `5` by default, unless the user explicitly asks for more
3. Format results for the user with title, snippet or summary, and relevance.
4. If results are sparse, say so and suggest refining the query or saving related sessions first.
5. If the request is clearly about the local project wiki, redirect with: "This sounds like a local wiki question — try the llm-wiki skill instead."

## Template interpolation contract

| Marker | Source | Fallback |
|--------|--------|----------|
| `{{content}}` | Cleaned or summarized conversation transcript | Required — do not save without content |
| `{{repo}}` | Workspace or repository name | `unknown` |
| `{{branch}}` | Current git branch | `unknown` |
| `{{date}}` | Current date | Always available (`YYYY-MM-DD`) |

## Output validation

- Generated pages must have YAML frontmatter with these fields, in order: `title`, `type`, `tags`, `sources`, `updated`.
- `type` should be `summary` for session saves; other page types such as concept or insight may be added later.
- `tags` must be an array.
- Cross-references use `[[wikilinks]]` with plain slugs and no paths.
- If validation fails, retry the generation once. If it fails again, present the issue to the user.

## Error handling

| Error | Detection | Action |
|-------|-----------|--------|
| MCP server not registered | `kb_add` or `kb_query` returns "tool not found" | Tell the user: "The KB MCP server is not registered. Add it to your VS Code MCP settings. See the kb-mcp-simple setup instructions." |
| QMD not installed (behind MCP) | `kb_add` succeeds but warns about skipped indexing, or `kb_query` fails | Tell the user: "QMD is not installed or not configured. The file was stored but won't be searchable until QMD is set up." |
| Transcript too long | Cleaned transcript exceeds about 3000 words | Summarize key points before applying the template. Prioritize code changes, decisions, root causes, and patterns. |
| Empty or weak query results | `kb_query` returns 0 results or low-confidence matches | Tell the user the KB does not contain relevant knowledge yet and suggest saving related sessions first. |
| Malformed LLM output | Validation fails because required frontmatter fields are missing or malformed | Retry once. If it fails again, show the user what is wrong and ask how to proceed. |

## Page contract (shared with llm-wiki)

- Frontmatter order is `title`, `type`, `tags`, `sources`, `updated`.
- Dates use `YYYY-MM-DD`.
- Cross-references use `[[wikilinks]]` with plain filenames or slugs.
- Pages end with `## See Also` for cross-references.
- Slugs are lowercase and hyphen-separated.

## Key rules

1. This skill is markdown-only — no scripts, no builds, no runtime.
2. Never write files directly — always use the `kb_add` MCP tool for storage.
3. Never claim local wiki operations — those belong to `llm-wiki`.
4. The agent LLM performs the transformation; the skill provides instructions and templates.
5. Do not silently fail — if MCP tools are missing or output is malformed, tell the user.
6. One conversation maps to one page in v1; multi-page extraction is future work.
7. Tags are auto-extracted from content, but the user can override them.
