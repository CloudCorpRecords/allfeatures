# Changelog

## 0.1.0 (2026-10-26)

- Initial release.
- CLI: `allfeatures echo <message>` prints a message back;
  `allfeatures add <a> <b>` prints the sum of two numbers.
  Both exit 1 on bad input and 2 on usage errors.
- MCP server (`allfeatures mcp`, stdio) with thirteen tools:
  `echo`, `add`, `longRunningOperation`, `printEnv`, `sampleLLM`,
  `getTinyImage`, `annotatedMessage`, `getResourceReference`,
  `getResourceLinks`, `structuredContent`, `listRoots`,
  `startElicitation` and `zip`.
- The `zip` tool returns a real minimal stored ZIP archive holding
  one file, built by hand (CRC32, local header, central directory)
  with no archive dependency.
- Client-capability tools (`sampleLLM`, `listRoots`,
  `startElicitation`) delegate to the connected client and report an
  error when the client does not offer the capability; they never
  fabricate a result.
