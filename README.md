# allfeatures

allfeatures is a showroom for the MCP protocol itself. Rather than
doing one job well, it exercises the moving parts a client and server
need to agree on: plain text results, images, annotations, embedded
resources, resource links, structured content, a long-running call,
and the three features that only work when the connected client helps
out — sampling, roots and elicitation. If you are building a client,
point it at allfeatures and watch each feature light up (or fail
honestly, with a clear error, when your client does not offer it).

## Install

```bash
npx @reneturcios/allfeatures echo hello
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/allfeatures
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

Only the two tools that make sense without a client are exposed as
commands:

```bash
allfeatures echo hello there   # hello there
allfeatures add 2 3            # 5
allfeatures add -1.5 0.5       # -1
allfeatures --version          # 0.1.0
```

Exit codes: `0` on success, `1` when the arguments cannot be handled
(for example, `add` given non-numeric input), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio MCP
server:

```bash
npx -y @reneturcios/allfeatures mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "allfeatures": {
      "command": "npx",
      "args": ["-y", "@reneturcios/allfeatures", "mcp"]
    }
  }
}
```

### Tools

| Tool | Input | What it returns |
| --- | --- | --- |
| `echo` | `message` (string, required) | The message, unchanged, as text. |
| `add` | `a`, `b` (numbers, required) | The sum, as text. |
| `longRunningOperation` | `duration` (number, optional, seconds, default 10), `steps` (number, optional, default 5) | Waits the duration split across the steps, then a completion note. |
| `printEnv` | — | The server process environment as JSON text. |
| `sampleLLM` | `prompt` (string, required), `maxTokens` (number, optional) | A completion sampled from the client's model (see below). |
| `getTinyImage` | — | A 1x1 transparent PNG as image content, plus a short text note. |
| `annotatedMessage` | `messageType` (`"error"` / `"success"` / `"debug"`, required), `includeImage` (boolean, optional) | A text message whose annotations (audience and priority) depend on the type; the tiny image is attached when `includeImage` is true. Errors are priority 1 for user and assistant, successes are priority 0.7 for the user, debug notes are priority 0.3 for the assistant. |
| `getResourceReference` | `resourceId` (number, required) | An embedded text resource with URI `demo://resource/<resourceId>`. |
| `getResourceLinks` | `count` (number, required, 1–10) | That many `resource_link` items. Counts outside 1–10 are an error. |
| `structuredContent` | `location` (string, required) | Fixed sample weather (`72°F`, Sunny, 45% humidity) for the location, as `structuredContent` with matching JSON text alongside. |
| `listRoots` | — | The client's roots, as JSON text (see below). |
| `startElicitation` | — | The outcome of asking the user for a short response (see below). |
| `zip` | — | An embedded blob resource (`application/zip`) holding a real, minimal ZIP archive with one stored file, `hello.txt`. The archive is assembled byte by byte — CRC32, local header, central directory — with no archive library. |

### Client-capability tools

`sampleLLM`, `listRoots` and `startElicitation` cannot be answered by
the server alone: they ask the connected client to do something
(sample its model, list its roots, prompt its user). allfeatures only
sends those requests when the client advertised the matching
capability during initialisation. When it did not, the tool returns
an error result saying exactly that — the server never invents a
plausible-looking answer.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
