# allfeatures — Build Report

Wave 1, Batch 2, MCP Rebuild 100. Clean-room rebuild of the
"everything" MCP feature-showcase server, built from the public tool
spec supplied for this program only. Local build only — nothing
pushed or published.

Identity: repo `allfeatures`, npm `@reneturcios/allfeatures`,
MCP name `io.github.CloudCorpRecords/allfeatures`, version `0.1.0`.

## ⚠ Tool-count discrepancy — 16 vs 13 (honest gap, flagged prominently)

The workspace audit
(`~/workspace/packages-100/mcp-server-index-external.md`) hand-probed
**16 tools** for the original server at auditor version 0.1.0, while
current public documentation enumerates **13 tools** by name. This
rebuild implements the 13 documented tools, and parity below is
measured against the 13-tool fixture
(`harness/fixtures/everything-tools-original.json`), whose `_source`
field records the discrepancy verbatim. The 16-vs-13 gap is **not**
hidden and **not** resolved here: three tools seen by the auditor are
not in the documented spec available to this program, so they could
not be rebuilt clean-room from a spec. If a per-tool spec for the
missing three surfaces, they are additive work on top of this build.
**Parity claim is therefore: 13/13 against the documented spec,
16-probed discrepancy outstanding.**

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `allfeatures: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "Protocol feature showcase: echo, math,
  resources, images, sampling and elicitation demos." = **89 chars**
  (≤100 ✓); npm entry carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/allfeatures:0.1.0` carries **no**
  `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/allfeatures"`
- `tsconfig.json` (copied from clockport's, 318 bytes), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md` (fresh
  text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-26)
- `src/index.ts`, `src/cli.ts` (`mcp`, `echo <message>`,
  `add <a> <b>`, `--version`; exit 2 usage / 1 bad input),
  `src/mcp.ts`, `src/types.ts`, `src/features.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/features.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (adapted from clockport's; image `ghcr.io/cloudcorprecords/allfeatures`
  and smoke-test server name changed)
- Ground truth (outside the build dir):
  `harness/fixtures/everything-tools-original.json` — 13 tools, exact
  spec inputSchemas, `_source` recording the 16-vs-13 discrepancy.

## Implementation notes

- `src/mcp.ts` registers tools via the SDK low-level `Server` API
  with explicit inputSchema literals exactly as spec'd (no
  per-property descriptions, no extra keys); zod validates every
  `tools/call` argument set internally. This follows the standing
  Wave 1 rule: the McpServer+zod path injects `$schema` /
  `additionalProperties` and caps parity.
- `longRunningOperation` core takes duration/steps plus an optional
  injectable sleep function (defaults 10s / 5 steps in behaviour), so
  tests run with tiny durations or a recording fake sleep.
- `printEnv` core takes an injectable env object (default
  `process.env`) and returns a cleaned copy.
- `getTinyImage` returns a 1x1 transparent PNG (standard base64
  constant) as `image/png` content plus a text item.
- `annotatedMessage` annotation mapping: error →
  `{audience: ["user","assistant"], priority: 1}`; success →
  `{audience: ["user"], priority: 0.7}`; debug →
  `{audience: ["assistant"], priority: 0.3}`; the tiny image is
  attached only when `includeImage` is true.
- `getResourceLinks` enforces count 1..10 with an error outside.
- `structuredContent` returns the deterministic payload
  `{temperature: "72°F", conditions: "Sunny", humidity: "45%"}` both
  as the MCP `structuredContent` field and as matching JSON text.
- `zip` builds a **real** minimal stored (uncompressed) ZIP archive
  by hand in the core — table-driven CRC32, local file header,
  central directory, end-of-central-directory record, pinned DOS
  date 2026-10-26 for deterministic bytes — containing one file,
  `hello.txt` (`Hello from allfeatures!\n`), returned as an embedded
  blob resource (`application/zip`, `demo://zip/allfeatures.zip`).
  No new dependencies.
- **Client-capability tools are honest, never faked.** Core functions
  for `sampleLLM` / `listRoots` / `startElicitation` take injectable
  async handlers and throw a descriptive "not supported" error with
  no handler. In `mcp.ts` the handlers are wired to the low-level
  Server's client-request facilities — `server.createMessage`,
  `server.listRoots`, `server.elicitInput` — **only when**
  `server.getClientCapabilities()` shows the client advertised
  sampling / roots / elicitation; otherwise the core error surfaces
  as an `isError` text result stating the connected client did not
  provide the capability. Tests cover all three tools with injected
  fake handlers (success path) and with no handler (unsupported
  path).

## Verification (exact outputs)

### 1. Build
```
$ ./node_modules/.bin/tsc ; echo exit=$?
tsc exit=0
```
`dist/` produced (cli.js, features.js, mcp.js, index.js, types.js,
plus .d.ts/.js.map).

### 2. Tests
```
$ ./node_modules/.bin/tsx --test test/*.test.ts
ℹ tests 30
ℹ suites 13
ℹ pass 30
ℹ fail 0
```
Covers: echo identity; add integers/negatives/floats/non-finite
rejection; longRunningOperation tiny-duration completion, per-step
sleep splitting via injected sleep, invalid duration/steps;
printEnv with injected env (undefined dropped, copy semantics);
getTinyImage content type + PNG signature bytes; annotatedMessage
annotation mapping for all 3 types + includeImage on/off + bad type;
getResourceReference shape/URI; getResourceLinks counts 1/3/10 +
out-of-range errors; structuredContent shape + empty-location error;
zip PK signature, `hello.txt` inside, stored method 0, CRC32 correct
(incl. the standard `123456789` → `0xcbf43926` check value), blob
round-trip; sampleLLM/listRoots/startElicitation with fake handlers
(success, argument/default forwarding) + unsupported-path errors.

### 3. MCP smoke (live stdio, dist/cli.js mcp)
initialize → `serverInfo: {"name":"allfeatures","version":"0.1.0"}`;
tools/call verified live: `echo` → message back; `add` 2+3 → `5`;
`structuredContent` → both the `structuredContent` field and matching
text; `getResourceLinks` count 2 → two `resource_link` items, count
99 → `isError`; `annotatedMessage` error+includeImage → annotated
text (`priority 1`, audience user+assistant) plus image item;
`longRunningOperation` (0.01s, 2 steps) → completion text;
`getTinyImage` → image/png item + text item; `zip` → blob decoded
and opened with Python `zipfile`: namelist `['hello.txt']`, content
`Hello from allfeatures!\n`, `testzip()` → `None` (CRC valid per a
real ZIP reader). Capability tools against a client advertising no
capabilities: `sampleLLM`, `listRoots`, `startElicitation` each
returned `isError` with the "did not provide … capability" message —
no fabricated results. CLI checks: `echo hello there` → exit 0,
`add 2 3` → `5` exit 0, `add x y` → exit 1, `--version` → `0.1.0`,
unknown command → Usage, exit 2.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
Original is tools-file mode, so the harness records
`fixture_results: SKIPPED-TOOLS-FILE-MODE` — expected semantics, not
an error:
```
$ python3 parity.py --original fixtures/everything-tools-original.json \
    --rebuild "stdio:node /home/hatch/workspace/mcp-rebuild-100/builds/allfeatures/dist/cli.js mcp" \
    --out /home/hatch/workspace/mcp-rebuild-100/builds/allfeatures/parity-out
verdict=PASS parity_pct=100.0 original_tools=13 rebuild_tools=13 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
`parity-out/parity.json` on disk: `verdict: PASS`,
`parity_pct: 100.0`, `identical_tools: 13`, `schema_diffs: {}`.
This is parity against the 13 documented tools — see the 16-vs-13
flag at the top of this report.

## Lockfile status

`package-lock.json`: copied from shipcheck with identity fields
edited; clean lockfile regen required before publish. (Edited fields,
via the file edit tool: top-level `name`, root package `name`, and
root package `bin` key `shipcheck` → `allfeatures`; dependency ranges
are identical, so the tree is unchanged. `node_modules` in this build
dir is a `cp -a` copy of shipcheck's — local build only, gitignored.)

## Blockers / honest gaps

- **16-vs-13 tool count** (top of report): parity is 100% against
  the 13 documented tools only; the auditor's 16-tool probe cannot
  be reconciled from any per-tool spec in the workspace.
- **Client-capability tools** (`sampleLLM`, `listRoots`,
  `startElicitation`): behaviour against a real sampling/roots/
  elicitation-capable client is covered by injected-handler unit
  tests and by the honest error path live; no live capable client
  was available in this VM to exercise the success path end to end.
- Live original cannot launch in this VM (documented in
  SCOREBOARD.md), so parity is tools-file mode vs live rebuild, the
  standing Wave 1 pattern.
- Clean lockfile regeneration is deferred to the publish wave (see
  Lockfile status). Container build not exercised locally; the
  publish-container workflow smoke-tests the image at publish time.
- Nothing pushed or published — by design for this phase.

## Publish-gate remediation (2026-10-27)

Recorded under Rene's 2026-10-27 decision ("Remediate the 6: add param
descriptions + capability-class vet policy, then re-gate") and
`publish/GATE-POLICY.md`. This is an authorized deviation from the
parity-faithful state: descriptions were added to every tool parameter
that lacked one, in the `src/mcp.ts` schema literals only — parameter
names, types, required lists and enums are unchanged.

- Descriptions added: 12 (all 12 served parameters now described).
- Rebuild: `npm run build` (tsc) exit 0; `tsc --noEmit` exit 0; full
  test suite 30/30 pass.
- Parity harness re-run, verbatim: **PARTIAL, parity_pct 69.2** — all
  12 schema diffs are description additions (0 structural). Structural
  parity proven independently: stripping `description` keys from the
  post-remediation tools/list deep-equals the pre-remediation
  tools/list. Adjudication: the description-only diffs are the
  authorized remediation itself; structural parity is unchanged.
  Full record: `publish/parity-remediation/allfeatures/parity.json`.
- Re-gate: mcpaudit **PASS 100/100 grade A** (raw:
  `publish/regate/allfeatures-mcpaudit.json`); mcpvet raw **REVIEW,
  risk 25** (raw: `publish/regate/allfeatures-mcpvet.json`), findings
  adjudicated under GATE-POLICY.md — see PUBLISH-WAVES.md.
