# QMD — Optional Hybrid Search Capability

## When to Read

Read this reference when:

- Operating on a wiki with **200+ pages**, where tag-scoped scans during INGEST cascade or QUERY tiered reads start missing relevant pages
- The user explicitly asks for qmd-backed search
- Any other reference (INGEST Step 3.2, INGEST Step 6, QUERY) suggests "with qmd available"

This reference is **opt-in**. The skill works without qmd. If qmd is not installed in the current repo, fall back to [scale.md](scale.md) tiered reading.

## Scope

[qmd](https://github.com/tobi/qmd) is a local CLI search engine for markdown collections. It provides:

- **BM25** full-text search (lexical, exact terms)
- **Vector** search (semantic, paraphrase tolerant)
- **Hybrid** search with LLM rerank (highest recall, slowest)

qmd runs entirely on-device. No data leaves the machine. The skill remains markdown-only-by-default; qmd is an enhancement layer for repos where the wiki has outgrown tag-scoped scanning.

Important distinction:

- `qmd search` is BM25/full-text and does **not** require embeddings or an LLM.
- `qmd embed` **does** require a local embedding model, because it generates vector representations for semantic retrieval.
- `qmd query` may additionally use local reranking and query-expansion/generation models, depending on qmd's configuration.
- In normal usage this is still on-device: model inference runs locally rather than sending content to a hosted service.

## Detection

Before using any qmd command, verify it is installed and the wiki collections are registered:

```text
qmd status
```

Interpret the output:

- **Command not found** → qmd is not installed in this repo. Fall back to [scale.md](scale.md). Do not propose installing qmd unless the user asks.
- **Command runs, no `wiki` collection** → qmd is installed but not bootstrapped for this repo. Run the Bootstrap procedure below.
- **Command runs, `wiki` collection present, embedding coverage shown** → ready to use.

Do not assume qmd is available based on prior turns. Detect on each operation that touches qmd.

## Bootstrap (one-time per repo)

Run this once when the user opts in to qmd for a repo:

```text
qmd collection add ./wiki --name wiki --mask "**/*.md"
qmd collection add ./raw  --name raw  --mask "**/*.md"
qmd embed
qmd status
```

Notes:

- `wiki` is embedded for hybrid search. `raw` is BM25 only by default — embeddings on raw are usually wasteful since the wiki layer is what answers queries.
- If the user asks for semantic search over `raw`, run `qmd embed` again after enabling embedding for the raw collection.
- Verify with `qmd status` that both collections appear and `wiki` shows embedding coverage > 0% after the first wiki page exists.
- On first run, `qmd embed` may print the embedding model name, download the model into the local qmd cache, and then process document chunks. This is expected.
- After `qmd collection add`, qmd may report that some number of unique hashes still need vectors. That means lexical indexing succeeded and embedding is the remaining step.

## Command Selection

Pick the right command for the operation:

| Goal | Command |
|------|---------|
| Exact term, page slug, or known phrase | `qmd search "<term>" -c wiki --json -n 10` |
| Conceptual / multi-page synthesis | `qmd query "<question>" -c wiki --json -n 10` |
| Synonym or paraphrase territory | `qmd vsearch "<phrase>" -c wiki --json -n 10` |
| Same against raw sources | swap `-c wiki` for `-c raw` |

Defaults by operation:

- **INGEST Step 3.2 dedup check** → `qmd search` (fast, exact, high precision)
- **INGEST Step 6 cascade scope** → `qmd query` (hybrid, high recall — you want to catch every affected page)
- **QUERY** → `qmd query` (hybrid) unless the user gives an exact term
- **LINT orphan and missing-cross-reference checks** → `qmd search` per slug

Always pass `-c wiki` or `-c raw` explicitly. Never search both blind — the noise floor doubles.

## Read Commands

```text
qmd get wiki/concepts/<slug>.md --full
qmd get wiki/sources/<slug>.md:50 -l 100
qmd multi-get "wiki/sources/*.md" -l 200
qmd multi-get "#abc123,#def456" --full
```

Use `qmd get` instead of direct file reads when you want line-bounded reads or docid-based retrieval. For full-page reads of a known path, direct file read is also acceptable.

## Re-index After Writes

**Required after any write to wiki/.**

```text
qmd update     # rebuild BM25 index
qmd embed      # rebuild vector embeddings using the local embedding model (only when new files were created)
```

Order: write all files first, then `qmd update`, then `qmd embed`. Re-indexing mid-stream wastes work.

This is wired into INGEST as Step 9.5 and into UPDATE at the end of the write phase. Skip if qmd is not installed.

## Output Flags

| Flag | Use |
|------|-----|
| `--json` | structured, parseable. **Use whenever you need to act on results.** |
| `--md` | markdown, good for surfacing snippets to the human |
| `--full` | full document content instead of snippets |
| `--line-numbers` | adds line numbers, useful before editing |
| `--min-score 0.3` | filter low-confidence results |
| `-n <num>` | number of results (default 5) |
| `--all` | return everything matching, use with `--min-score` |

## Fallback

If at any point qmd fails (command errors, stale index, missing collection), do not block. Fall back to:

- [scale.md](scale.md) for tiered reading via `index.md` and `_hub.md`
- direct file reads for single-page lookups
- the existing tag-scoped cascade in INGEST Step 6

Report the qmd failure to the user once, then continue. Do not retry on every operation.

## Rules

- qmd is **never required**. The skill must work in repos without it.
- Detect with `qmd status` on each operation that touches qmd. Do not cache availability across turns.
- After any write to `wiki/`, re-index. After creating new files, also re-embed.
- Always pass `-c wiki` or `-c raw` explicitly.
- For dedup checks (Step 3.2), prefer `qmd search` (precision). For cascade scope (Step 6), prefer `qmd query` (recall).
- Do not propose installing qmd unless the user asks. The skill's default contract is markdown-only.