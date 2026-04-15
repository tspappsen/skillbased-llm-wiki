Create a structured, wiki-compatible markdown page from the conversation content below.

## Context

- Repository: `{{repo}}`
- Branch: `{{branch}}`
- Date: `{{date}}`

## Source Content

{{content}}

## Authoring Instructions

- Synthesize the conversation into durable knowledge rather than copying the transcript.
- Focus on decisions, rationale, root causes, patterns, solutions, and meaningful code changes.
- Remove tool-call noise, formatting artifacts, repeated chatter, and system-message text.
- Prefer concise, high-signal summaries over exhaustive replay.
- Preserve technical precision. Include short code blocks only when they materially capture a reusable pattern or fix.
- Infer a clear, specific page title and a small set of useful tags.
- Use `[[wikilinks]]` for related concepts, entities, or techniques when they are identifiable from the content.
- Keep the writing grounded in what the conversation actually established; do not invent outcomes.

## Required Output Format

Return a single markdown page with this exact frontmatter field order:

```yaml
---
title: <concise page title>
type: summary
tags: [<extracted-tag-1>, <extracted-tag-2>]
sources: [{{repo}}/{{branch}}]
updated: {{date}}
---
```

Then produce the page body in this structure:

~~~markdown
# <Page Title>

<1-2 sentence summary of what was learned, decided, or fixed>

## Context
- Repository: `{{repo}}`
- Branch: `{{branch}}`
- Work: <what the session was trying to achieve>

## Key Decisions
- <decision and rationale>

## Solutions & Patterns
- <reusable implementation pattern, fix, or technique>

```language
<include code only if it clarifies a reusable pattern>
```

## Root Causes
- <problem and underlying cause>

## Open Threads
- <unresolved question, follow-up, or caveat>

## See Also
- [[related-slug]]
- [[another-related-slug]]
~~~

## Quality Rules

- No tool-call artifacts, terminal transcripts, or system-message remnants in the final page.
- Omit any section that would otherwise be empty, except `## See Also`, which must always be present.
- If there are no confident cross-references, use `## See Also` with `- None yet`.
- Prefer synthesis over chronology.
- Use plain-slug `[[wikilinks]]` only; never include paths inside wikilinks.
- Keep sections concrete and evidence-based.

Return only the final markdown page and nothing else.
