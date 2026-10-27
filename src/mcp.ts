/**
 * allfeatures MCP server. Thirteen tools showcasing protocol features.
 *
 * Why the low-level Server instead of McpServer: the high-level helper
 * converts zod schemas to JSON Schema and injects two keys that are not
 * in this tool's public spec ("$schema" and "additionalProperties"),
 * which breaks exact tool-list/schema parity with the spec. This file
 * therefore serves tools/list with the spec's exact input schemas,
 * while zod still validates every tools/call argument set.
 *
 * The three client-capability tools (sampleLLM, listRoots,
 * startElicitation) are wired to the low-level Server's client-request
 * methods (createMessage / listRoots / elicitInput) only when the
 * connected client actually advertised the matching capability. When
 * it did not, the core is called with no handler and returns an error
 * result — the server never fabricates sampling, roots or elicitation
 * output.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  add,
  annotatedMessage,
  echo,
  getResourceLinks,
  getResourceReference,
  listRoots as coreListRoots,
  longRunningOperation,
  printEnv,
  sampleLLM as coreSampleLLM,
  startElicitation as coreStartElicitation,
  structuredContent,
  tinyImageContent,
  VERSION,
  zipContent,
} from "./features.js";
import type {
  ElicitationHandler,
  RootsHandler,
  SamplingHandler,
} from "./types.js";

const EchoArgs = z.object({ message: z.string() });
const AddArgs = z.object({ a: z.number(), b: z.number() });
const LongRunningArgs = z.object({
  duration: z.number().optional(),
  steps: z.number().optional(),
});
const NoArgs = z.object({});
const SampleLLMArgs = z.object({
  prompt: z.string(),
  maxTokens: z.number().optional(),
});
const AnnotatedMessageArgs = z.object({
  messageType: z.enum(["error", "success", "debug"]),
  includeImage: z.boolean().optional(),
});
const ResourceReferenceArgs = z.object({ resourceId: z.number() });
const ResourceLinksArgs = z.object({ count: z.number() });
const StructuredContentArgs = z.object({ location: z.string() });

const TOOLS = [
  {
    name: "echo",
    description: "Return the supplied message unchanged as a text result.",
    inputSchema: {
      type: "object" as const,
      properties: { message: { description: "Message to return unchanged.", type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "add",
    description: "Add two numbers and return the sum as text.",
    inputSchema: {
      type: "object" as const,
      properties: { a: { description: "First number to add.", type: "number" }, b: { description: "Second number to add.", type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "longRunningOperation",
    description:
      "Run a simulated long operation that waits for a duration split across a number of steps.",
    inputSchema: {
      type: "object" as const,
      properties: { duration: { description: "Total duration of the simulated operation, in seconds.", type: "number" }, steps: { description: "Number of steps the duration is split across.", type: "number" } },
      required: [] as string[],
    },
  },
  {
    name: "printEnv",
    description: "Return the server process environment as a JSON text result.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "sampleLLM",
    description: "Ask the connected client to sample its language model with a prompt.",
    inputSchema: {
      type: "object" as const,
      properties: { prompt: { description: "Prompt to send to the connected client's language model.", type: "string" }, maxTokens: { description: "Maximum number of tokens for the sampled response.", type: "number" } },
      required: ["prompt"],
    },
  },
  {
    name: "getTinyImage",
    description:
      "Return a tiny 1x1 transparent PNG image together with a short text note.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "annotatedMessage",
    description:
      "Return a text message carrying annotations that vary with the requested message type, optionally with the tiny image attached.",
    inputSchema: {
      type: "object" as const,
      properties: {
        messageType: { description: "Kind of message to return: error, success, or debug.", type: "string", enum: ["error", "success", "debug"] },
        includeImage: { description: "When true, attach the tiny image to the message.", type: "boolean" },
      },
      required: ["messageType"],
    },
  },
  {
    name: "getResourceReference",
    description:
      "Return an embedded text resource for the given numeric resource identifier.",
    inputSchema: {
      type: "object" as const,
      properties: { resourceId: { description: "Numeric identifier of the resource to return.", type: "number" } },
      required: ["resourceId"],
    },
  },
  {
    name: "getResourceLinks",
    description: "Return the requested number of resource link items.",
    inputSchema: {
      type: "object" as const,
      properties: { count: { description: "Number of resource links to return.", type: "number" } },
      required: ["count"],
    },
  },
  {
    name: "structuredContent",
    description:
      "Return fixed sample weather data for a location as structured content plus matching text.",
    inputSchema: {
      type: "object" as const,
      properties: { location: { description: "Location the sample weather data is returned for.", type: "string" } },
      required: ["location"],
    },
  },
  {
    name: "listRoots",
    description: "Ask the connected client to list its filesystem roots.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "startElicitation",
    description: "Ask the connected client to elicit a short response from the user.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "zip",
    description:
      "Return a small ZIP archive containing one text file, as an embedded blob resource.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
];

// The core builds MCP-shaped content items with its own types; the SDK
// result type is structurally the same at runtime, so results pass
// through a single narrow cast here rather than per-call-site casts.
function toolResult(value: Record<string, unknown>): never {
  return value as never;
}

function textResult(text: string) {
  return toolResult({ content: [{ type: "text", text }] });
}

function contentResult(content: unknown, extra?: Record<string, unknown>) {
  return toolResult({ content, ...extra });
}

function errorResult(err: unknown) {
  return toolResult({
    content: [
      { type: "text", text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  });
}

const server = new Server(
  { name: "allfeatures", version: VERSION },
  { capabilities: { tools: {} } },
);

/** Sampling handler, present only when the client advertised sampling. */
function samplingHandler(): SamplingHandler | undefined {
  if (!server.getClientCapabilities()?.sampling) return undefined;
  return async (prompt: string, maxTokens: number) => {
    const res = await server.createMessage({
      messages: [{ role: "user", content: { type: "text", text: prompt } }],
      maxTokens,
    });
    const content: unknown = res.content;
    if (Array.isArray(content)) {
      return content
        .map((block) =>
          block && typeof block === "object" && "text" in block
            ? String((block as { text: unknown }).text)
            : "",
        )
        .join("");
    }
    if (content && typeof content === "object" && "text" in content) {
      return String((content as { text: unknown }).text);
    }
    return JSON.stringify(content);
  };
}

/** Roots handler, present only when the client advertised roots. */
function rootsHandler(): RootsHandler | undefined {
  if (!server.getClientCapabilities()?.roots) return undefined;
  return async () => {
    const res = await server.listRoots();
    return res.roots.map((r) => ({ uri: r.uri, name: r.name }));
  };
}

/** Elicitation handler, present only when the client advertised it. */
function elicitationHandler(): ElicitationHandler | undefined {
  if (!server.getClientCapabilities()?.elicitation) return undefined;
  return async () => {
    const res = await server.elicitInput({
      mode: "form",
      message: "Please provide a short response.",
      requestedSchema: {
        type: "object",
        properties: {
          response: { type: "string", title: "Response" },
        },
        required: ["response"],
      },
    });
    return {
      action: res.action,
      content: res.content as Record<string, unknown> | undefined,
    };
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case "echo": {
        const parsed = EchoArgs.parse(args ?? {});
        return textResult(echo(parsed.message));
      }
      case "add": {
        const parsed = AddArgs.parse(args ?? {});
        return textResult(String(add(parsed.a, parsed.b)));
      }
      case "longRunningOperation": {
        const parsed = LongRunningArgs.parse(args ?? {});
        return textResult(
          await longRunningOperation(parsed.duration, parsed.steps),
        );
      }
      case "printEnv": {
        NoArgs.parse(args ?? {});
        return textResult(JSON.stringify(printEnv(), null, 2));
      }
      case "sampleLLM": {
        const parsed = SampleLLMArgs.parse(args ?? {});
        const text = await coreSampleLLM(
          parsed.prompt,
          parsed.maxTokens,
          samplingHandler(),
        );
        return textResult(text);
      }
      case "getTinyImage": {
        NoArgs.parse(args ?? {});
        return contentResult(tinyImageContent());
      }
      case "annotatedMessage": {
        const parsed = AnnotatedMessageArgs.parse(args ?? {});
        return contentResult(
          annotatedMessage(parsed.messageType, parsed.includeImage ?? false),
        );
      }
      case "getResourceReference": {
        const parsed = ResourceReferenceArgs.parse(args ?? {});
        return contentResult([getResourceReference(parsed.resourceId)]);
      }
      case "getResourceLinks": {
        const parsed = ResourceLinksArgs.parse(args ?? {});
        return contentResult(getResourceLinks(parsed.count));
      }
      case "structuredContent": {
        const parsed = StructuredContentArgs.parse(args ?? {});
        const data = structuredContent(parsed.location);
        return contentResult(
          [{ type: "text", text: JSON.stringify(data, null, 2) }],
          { structuredContent: data },
        );
      }
      case "listRoots": {
        NoArgs.parse(args ?? {});
        const roots = await coreListRoots(rootsHandler());
        return textResult(JSON.stringify(roots, null, 2));
      }
      case "startElicitation": {
        NoArgs.parse(args ?? {});
        const outcome = await coreStartElicitation(elicitationHandler());
        return textResult(JSON.stringify(outcome, null, 2));
      }
      case "zip": {
        NoArgs.parse(args ?? {});
        return contentResult([zipContent()]);
      }
      default:
        break;
    }
  } catch (err) {
    return errorResult(err);
  }
  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
