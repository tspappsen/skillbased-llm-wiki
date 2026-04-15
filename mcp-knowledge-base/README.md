# mcp-knowledge-base

`mcp-knowledge-base` is a tiny MCP server that stores markdown notes in a persistent local knowledge base and refreshes a QMD index for retrieval. It writes files into `~/.cache/kb/raw/` and exposes exactly two tools over stdio: `kb_add` and `kb_query`.

## Prerequisites

- Node.js 18+
- QMD installed and available on `PATH`

## Build

```bash
npm install
npm run build
```

## VS Code MCP configuration

Add this to your user-level `settings.json`:

```jsonc
"mcp": {
  "servers": {
    "knowledge-base": {
      "command": "node",
      "args": ["<path-to>/mcp-knowledge-base/dist/index.js"],
      "type": "stdio"
    }
  }
}
```

## Data locations

- Markdown files: `~/.cache/kb/raw/`
- Reserved wiki directory: `~/.cache/kb/wiki/`
- QMD index: `~/.cache/qmd/kb.sqlite`

## Tools

### `kb_add`

Stores a markdown document and attempts to update the QMD index.

Parameters:
- `title: string`
- `content: string`
- `tags?: string[]`

### `kb_query`

Queries the QMD index and returns structured results.

Parameters:
- `query: string`
- `n?: number`
