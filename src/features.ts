/**
 * allfeatures core: a protocol feature showcase.
 *
 * Every tool's behaviour lives here as a plain function so it can be
 * tested without a transport. Anything that needs the outside world
 * arrives through an injectable dependency: the environment object for
 * printEnv, a sleep function for longRunningOperation, and async
 * handlers for the three client-capability tools (sampling, roots,
 * elicitation). When a capability handler is absent the core throws a
 * descriptive error instead of inventing a result.
 *
 * The ZIP payload is a real minimal archive in the stored (no
 * compression) format, assembled by hand: CRC32, one local file
 * header, one central directory entry and the end-of-central-directory
 * record. No archive library is involved.
 */
import type {
  ContentItem,
  ElicitationHandler,
  ElicitationOutcome,
  EmbeddedBlobResourceItem,
  EmbeddedTextResourceItem,
  MessageType,
  ResourceLinkContentItem,
  RootEntry,
  RootsHandler,
  SamplingHandler,
  SleepFn,
  StructuredWeather,
} from "./types.js";

export const VERSION = "0.1.0";

/** Base64 of a 1x1 fully transparent PNG. */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const ZIP_FILE_NAME = "hello.txt";
export const ZIP_FILE_CONTENT = "Hello from allfeatures!\n";
export const ZIP_RESOURCE_URI = "demo://zip/allfeatures.zip";

/** Return the message unchanged. */
export function echo(message: string): string {
  if (typeof message !== "string") throw new Error("echo requires a string message");
  return message;
}

/** Add two finite numbers. */
export function add(a: number, b: number): number {
  if (typeof a !== "number" || !Number.isFinite(a)) {
    throw new Error("add requires 'a' to be a finite number");
  }
  if (typeof b !== "number" || !Number.isFinite(b)) {
    throw new Error("add requires 'b' to be a finite number");
  }
  return a + b;
}

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Simulate long-running work: wait `duration` seconds in total, split
 * evenly across `steps` sleeps. Both arguments are optional and fall
 * back to the showcase defaults (10 seconds across 5 steps); tests
 * pass tiny durations or their own sleep function to stay fast.
 */
export async function longRunningOperation(
  duration = 10,
  steps = 5,
  sleep: SleepFn = defaultSleep,
): Promise<string> {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) {
    throw new Error("longRunningOperation requires 'duration' to be a finite number >= 0");
  }
  if (typeof steps !== "number" || !Number.isInteger(steps) || steps < 1) {
    throw new Error("longRunningOperation requires 'steps' to be an integer >= 1");
  }
  const perStepMs = (duration * 1000) / steps;
  for (let i = 0; i < steps; i++) {
    await sleep(perStepMs);
  }
  return `Completed long-running operation: ${steps} steps over ${duration} seconds.`;
}

/** Copy of an environment map with undefined values dropped. */
export function printEnv(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** The tiny image payload on its own. */
export function getTinyImage(): { data: string; mimeType: string } {
  return { data: TINY_PNG_BASE64, mimeType: "image/png" };
}

/** Tiny image as MCP content: the image plus a short text note. */
export function tinyImageContent(): ContentItem[] {
  const img = getTinyImage();
  return [
    { type: "image", data: img.data, mimeType: img.mimeType },
    { type: "text", text: "A 1x1 transparent PNG." },
  ];
}

const ANNOTATIONS: Record<MessageType, { audience: string[]; priority: number }> = {
  error: { audience: ["user", "assistant"], priority: 1 },
  success: { audience: ["user"], priority: 0.7 },
  debug: { audience: ["assistant"], priority: 0.3 },
};

const MESSAGE_TEXT: Record<MessageType, string> = {
  error: "Error: something went wrong while demonstrating annotated messages.",
  success: "Success: the annotated message demonstration completed.",
  debug: "Debug: annotated message demonstration diagnostic detail.",
};

/**
 * A text message whose annotations depend on the message type: errors
 * are urgent and addressed to everyone, successes are for the user,
 * and debug notes are low-priority and assistant-facing. The tiny
 * image is attached when includeImage is true.
 */
export function annotatedMessage(
  messageType: MessageType,
  includeImage = false,
): ContentItem[] {
  if (messageType !== "error" && messageType !== "success" && messageType !== "debug") {
    throw new Error(
      `annotatedMessage requires messageType to be one of "error", "success", "debug"; got '${String(messageType)}'`,
    );
  }
  const ann = ANNOTATIONS[messageType];
  const items: ContentItem[] = [
    {
      type: "text",
      text: MESSAGE_TEXT[messageType],
      annotations: { audience: [...ann.audience], priority: ann.priority },
    },
  ];
  if (includeImage) {
    const img = getTinyImage();
    items.push({ type: "image", data: img.data, mimeType: img.mimeType });
  }
  return items;
}

/** An embedded text resource addressed by a numeric identifier. */
export function getResourceReference(resourceId: number): EmbeddedTextResourceItem {
  if (typeof resourceId !== "number" || !Number.isFinite(resourceId)) {
    throw new Error("getResourceReference requires 'resourceId' to be a finite number");
  }
  return {
    type: "resource",
    resource: {
      uri: `demo://resource/${resourceId}`,
      text: `Contents of resource ${resourceId}.`,
      mimeType: "text/plain",
    },
  };
}

/** `count` resource links, numbered from 1. Count must be 1..10. */
export function getResourceLinks(count: number): ResourceLinkContentItem[] {
  if (
    typeof count !== "number" ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 10
  ) {
    throw new Error("getResourceLinks requires 'count' to be an integer between 1 and 10");
  }
  const links: ResourceLinkContentItem[] = [];
  for (let i = 1; i <= count; i++) {
    links.push({
      type: "resource_link",
      uri: `demo://resource/${i}`,
      name: `Resource ${i}`,
      description: `Demo resource number ${i}.`,
      mimeType: "text/plain",
    });
  }
  return links;
}

/** Fixed sample weather for a location, as structured data. */
export function structuredContent(location: string): StructuredWeather {
  if (typeof location !== "string" || !location.trim()) {
    throw new Error("structuredContent requires a non-empty 'location'");
  }
  return {
    location,
    temperature: "72°F",
    conditions: "Sunny",
    humidity: "45%",
  };
}

/**
 * Ask the client's model for a completion. Without a sampling handler
 * this is an error: the server cannot sample on its own and will not
 * pretend otherwise.
 */
export async function sampleLLM(
  prompt: string,
  maxTokens = 100,
  handler?: SamplingHandler,
): Promise<string> {
  if (typeof prompt !== "string" || !prompt) {
    throw new Error("sampleLLM requires a non-empty 'prompt'");
  }
  if (typeof maxTokens !== "number" || !Number.isFinite(maxTokens) || maxTokens < 1) {
    throw new Error("sampleLLM requires 'maxTokens' to be a finite number >= 1");
  }
  if (!handler) {
    throw new Error(
      "Sampling is not supported: the connected client did not provide sampling capability.",
    );
  }
  return handler(prompt, maxTokens);
}

/** List the client's roots via its handler; error when unsupported. */
export async function listRoots(handler?: RootsHandler): Promise<RootEntry[]> {
  if (!handler) {
    throw new Error(
      "Roots are not supported: the connected client did not provide roots capability.",
    );
  }
  return handler();
}

/** Run an elicitation via the client's handler; error when unsupported. */
export async function startElicitation(
  handler?: ElicitationHandler,
): Promise<ElicitationOutcome> {
  if (!handler) {
    throw new Error(
      "Elicitation is not supported: the connected client did not provide elicitation capability.",
    );
  }
  return handler();
}

// ---------------------------------------------------------------------------
// Minimal stored ZIP archive, built by hand.
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

/** Standard CRC-32 (IEEE 802.3 polynomial) of a byte string. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}

function u32le(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

/**
 * Build a valid ZIP archive holding exactly one stored file
 * (hello.txt). Layout: local file header + name + data, then the
 * central directory entry, then the end-of-central-directory record.
 * Timestamps are pinned (DOS date 2026-10-26, midnight) so the bytes
 * are deterministic.
 */
export function buildZipArchive(): Uint8Array {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(ZIP_FILE_NAME);
  const dataBytes = encoder.encode(ZIP_FILE_CONTENT);
  const crc = crc32(dataBytes);
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (10 << 5) | 26;

  const localHeader: number[] = [
    ...u32le(0x04034b50), // local file header signature "PK\x03\x04"
    ...u16le(20), // version needed to extract
    ...u16le(0), // general purpose flags
    ...u16le(0), // compression method 0 = stored
    ...u16le(dosTime),
    ...u16le(dosDate),
    ...u32le(crc),
    ...u32le(dataBytes.length), // compressed size
    ...u32le(dataBytes.length), // uncompressed size
    ...u16le(nameBytes.length),
    ...u16le(0), // extra field length
  ];
  const localRecordLength = localHeader.length + nameBytes.length + dataBytes.length;

  const centralHeader: number[] = [
    ...u32le(0x02014b50), // central directory signature "PK\x01\x02"
    ...u16le(20), // version made by
    ...u16le(20), // version needed to extract
    ...u16le(0), // flags
    ...u16le(0), // method: stored
    ...u16le(dosTime),
    ...u16le(dosDate),
    ...u32le(crc),
    ...u32le(dataBytes.length),
    ...u32le(dataBytes.length),
    ...u16le(nameBytes.length),
    ...u16le(0), // extra field length
    ...u16le(0), // comment length
    ...u16le(0), // disk number start
    ...u16le(0), // internal attributes
    ...u32le(0), // external attributes
    ...u32le(0), // offset of local header
  ];
  const centralLength = centralHeader.length + nameBytes.length;

  const endRecord: number[] = [
    ...u32le(0x06054b50), // end of central directory "PK\x05\x06"
    ...u16le(0), // disk number
    ...u16le(0), // disk with central directory
    ...u16le(1), // entries on this disk
    ...u16le(1), // total entries
    ...u32le(centralLength),
    ...u32le(localRecordLength), // central directory offset
    ...u16le(0), // comment length
  ];

  const out = new Uint8Array(localRecordLength + centralLength + endRecord.length);
  let offset = 0;
  const put = (bytes: ArrayLike<number>) => {
    out.set(bytes, offset);
    offset += bytes.length;
  };
  put(localHeader);
  put(nameBytes);
  put(dataBytes);
  put(centralHeader);
  put(nameBytes);
  put(endRecord);
  return out;
}

/** Base64 form of the archive, for transport inside MCP content. */
export function buildZipBase64(): string {
  return Buffer.from(buildZipArchive()).toString("base64");
}

/** The archive as an embedded blob resource content item. */
export function zipContent(): EmbeddedBlobResourceItem {
  return {
    type: "resource",
    resource: {
      uri: ZIP_RESOURCE_URI,
      blob: buildZipBase64(),
      mimeType: "application/zip",
    },
  };
}
