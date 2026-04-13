# How to test the QMD addition

This guide shows how to test the new optional `qmd` behavior in the `llm-wiki` skill.

The goal is **not** to test `qmd` by itself. The goal is to verify that the skill:

- detects `qmd` correctly
- uses it when appropriate
- falls back cleanly when it is not ready
- re-indexes after wiki writes

## What changed

The QMD addition affects these files:

- `skills/llm-wiki/SKILL.md`
- `skills/llm-wiki/references/qmd.md`
- `skills/llm-wiki/references/ingest.md`

So the right test is a **behavior test** of the skill's routing and execution, not a unit test.

## Important current state

On this machine, `qmd` is installed, but this repo is **not yet bootstrapped** for it.

A recent `qmd status` showed:

- `qmd` command works
- there is no repo-specific `wiki` collection yet
- only the default `notes` collection exists

That means the first useful test is a **fallback test**, followed by an **explicit opt-in bootstrap test**.

## Recommended test setup

This repository contains the skill itself, not a populated wiki. The easiest way to test the QMD addition is to use a small scratch repo or consumer repo.

Recommended setup:

1. Copy `skills/llm-wiki/` into `.github/skills/llm-wiki/` in a scratch repo.
2. Create a tiny wiki root with:
   - `raw/`
   - `wiki/index.md`
   - `wiki/log.md`
   - a few sample pages under `wiki/concepts/` and `wiki/entities/`
3. Add one or two markdown files to `raw/`.

Keep the sample wiki small. You are testing **selection and fallback behavior**, not scale.

## Test 1: fallback when qmd is not ready

Use a prompt that could benefit from `qmd`, but run it before bootstrapping the repo.

Example prompts:

- `Use the wiki to answer what we know about service bus retries. If qmd isn't ready, continue without it and say so.`
- `Ingest all new sources in raw/.`

Expected behavior:

- the agent checks `qmd status`
- it sees that the repo is not bootstrapped for `qmd`
- it does **not** block the task
- it falls back to normal wiki behavior (`scale.md`, index/hub reads, direct reads)
- it does **not** propose installing `qmd` unless the user explicitly asks

Pass criteria:

- the task completes
- the response mentions fallback once, clearly
- the skill still behaves normally without `qmd`

## Test 2: explicit opt-in bootstrap

Use an explicit prompt that opts the repo into `qmd`.

Example prompt:

- `Enable qmd for this wiki and confirm it's ready.`

Expected behavior:

- the agent checks `qmd status`
- it notices `qmd` exists but the `wiki` collection is missing
- it runs the bootstrap flow from `references/qmd.md`
- it verifies readiness with `qmd status`
- on first embed run, `qmd` may show the embedding model, download it into the local cache, and then embed document chunks

Expected bootstrap commands:

- `qmd collection add ./wiki --name wiki --mask "**/*.md"`
- `qmd collection add ./raw --name raw --mask "**/*.md"`
- `qmd embed`
- `qmd status`

Important note:

- `qmd embed` is model-dependent. It uses a **local embedding model** to generate vector embeddings for semantic search.
- That is different from `qmd search`, which is BM25/full-text and does **not** require embeddings.
- It is also different from `qmd query`, which can involve additional reranking and query-expansion models depending on how `qmd` is configured.
- On first run, `qmd embed` may need to download or initialize local model files before embeddings can be generated.
- A successful first run often looks like: model name shown, model download/cache path shown, chunk progress bar, then a final `Embedded <n> chunks from <m> documents` message.

Pass criteria:

- `wiki` appears as a collection in `qmd status`
- `raw` appears as a collection in `qmd status`
- embedding coverage for `wiki` becomes non-zero once wiki pages exist
- `qmd embed` completes without model/runtime errors and reports embedded chunks/documents

## Test 3: query-mode selection

Verify that the skill chooses the right `qmd` command for the task.

Example prompts:

### Exact term lookup

- `Find pages about service-bus.`

Expected command family:

- `qmd search`

### Conceptual synthesis

- `What pages discuss retry tradeoffs across messaging systems?`

Expected command family:

- `qmd query`

### Paraphrase / synonym territory

- `Find anything about handoff or relay-style coordination.`

Expected command family:

- `qmd vsearch`

Pass criteria:

- exact-term requests use precision-oriented search
- concept requests use hybrid query
- paraphrase-style requests can use vector search
- the skill still answers from wiki content rather than general knowledge

Tip: if you want to make this observable, ask the agent to say which `qmd` mode it used and why.

## Test 4: ingest dedup check

This is the most important functional test.

Seed the wiki with an existing page such as:

- `wiki/concepts/service-bus.md`

Then add a raw source that uses a close variant such as:

- `Azure Service Bus`

Prompt:

- `Ingest all new sources in raw/.`

Expected behavior during the **Plan** phase:

- Step 3.2 dedup check runs
- the agent looks for near-matches
- with `qmd` available, it can use `qmd search "<candidate>" -c wiki --json -n 5`
- it proposes merge vs new-page creation
- it does **not** silently create a duplicate page

Pass criteria:

- the plan clearly identifies the near-match
- the plan asks for a merge/disambiguation decision if needed
- no duplicate concept/entity page is created by accident

## Test 5: cascade scope and re-index after writes

Add a raw source that should affect multiple existing pages, then ingest it.

Prompt:

- `Ingest all new sources in raw/ and update affected pages.`

Expected behavior:

- the skill uses normal tag-scoped cascade logic
- with `qmd` available, it can expand recall using `qmd query`
- after all wiki writes complete, it re-indexes

Expected re-index behavior:

- if new pages were created: `qmd update` then `qmd embed`
- if only existing pages changed: `qmd update`

Pass criteria:

- affected pages are broader than obvious direct matches when appropriate
- re-index happens after writing, not mid-stream
- newly created or updated pages are discoverable afterward via `qmd`

## Common gotcha: wiki root path

The bootstrap examples in `references/qmd.md` assume the current working directory is the **wiki root**: the folder that contains both `wiki/` and `raw/`.

That matters.

If the actual wiki lives in a nested path like:

- `wiki/integration-platform/`

then the real collection paths may need to be:

- `./wiki/integration-platform/wiki`
- `./wiki/integration-platform/raw`

Watch for this during testing. It is the most likely integration wrinkle.

## Fast smoke-test sequence

If you want the shortest useful validation run, do this:

1. Run one fallback test before bootstrapping.
2. Opt in to `qmd` and verify status.
3. Run one query test.
4. Run one ingest dedup test.
5. Run one post-write re-index test.

That covers almost all meaningful behavior introduced by the QMD addition.

## Optional manual sanity checks

If you want to verify the search backend directly, run these from the correct wiki root:

```text
qmd status
qmd collection add ./wiki --name wiki --mask "**/*.md"
qmd collection add ./raw --name raw --mask "**/*.md"
qmd embed
qmd status
qmd search "service bus" -c wiki --json -n 5
qmd query "retry tradeoffs across messaging systems" -c wiki --json -n 10
```

Use adjusted paths if the wiki root is nested.

Practical interpretation:

- if `qmd search` works, BM25 indexing is fine
- if `qmd embed` works, the embedding model path/runtime is fine
- if `qmd query` works well, the broader hybrid stack is working, including reranking/query expansion where applicable
- if `qmd collection add` reports `N unique hashes need vectors`, that is the handoff signal telling you BM25 indexing is done but semantic embeddings still need to be built

## Definition of done

The QMD addition is behaving correctly if all of the following are true:

- the skill treats `qmd` as optional
- fallback works when `qmd` is unavailable or unbootstrapped
- explicit opt-in can bootstrap the repo cleanly
- dedup uses `qmd search` when available
- cascade scope can use `qmd query` when available
- re-index happens after wiki writes
- the skill still works correctly without `qmd`
