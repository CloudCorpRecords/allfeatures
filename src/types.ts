/**
 * allfeatures types.
 *
 * The content item shapes mirror the MCP content model (text, image,
 * resource_link and embedded resource items) closely enough for the
 * core module to build them without depending on the SDK, which keeps
 * every behaviour unit-testable with plain fixtures.
 */

export type MessageType = "error" | "success" | "debug";

/** MCP content annotations: who should see a message and how urgently. */
export interface ContentAnnotations {
  audience: string[];
  priority: number;
}

export interface TextContentItem {
  type: "text";
  text: string;
  annotations?: ContentAnnotations;
}

export interface ImageContentItem {
  type: "image";
  data: string;
  mimeType: string;
}

export interface ResourceLinkContentItem {
  type: "resource_link";
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface EmbeddedTextResourceItem {
  type: "resource";
  resource: {
    uri: string;
    text: string;
    mimeType: string;
  };
}

export interface EmbeddedBlobResourceItem {
  type: "resource";
  resource: {
    uri: string;
    blob: string;
    mimeType: string;
  };
}

export type ContentItem =
  | TextContentItem
  | ImageContentItem
  | ResourceLinkContentItem
  | EmbeddedTextResourceItem
  | EmbeddedBlobResourceItem;

/** Deterministic sample weather payload returned by structuredContent. */
export interface StructuredWeather {
  location: string;
  temperature: string;
  conditions: string;
  humidity: string;
}

export interface RootEntry {
  uri: string;
  name?: string;
}

export interface ElicitationOutcome {
  action: string;
  content?: Record<string, unknown>;
}

/** Injectable client-capability handlers (sampling / roots / elicitation). */
export type SamplingHandler = (prompt: string, maxTokens: number) => Promise<string>;
export type RootsHandler = () => Promise<RootEntry[]>;
export type ElicitationHandler = () => Promise<ElicitationOutcome>;

/** Injectable sleep so long-running work stays instant under test. */
export type SleepFn = (ms: number) => Promise<void>;
