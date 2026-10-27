import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  add,
  annotatedMessage,
  buildZipArchive,
  crc32,
  echo,
  getResourceLinks,
  getResourceReference,
  getTinyImage,
  listRoots,
  longRunningOperation,
  printEnv,
  sampleLLM,
  startElicitation,
  structuredContent,
  tinyImageContent,
  ZIP_FILE_CONTENT,
  ZIP_FILE_NAME,
  zipContent,
} from "../src/features.js";
import type { TextContentItem } from "../src/types.js";

describe("echo", () => {
  it("returns the message unchanged", () => {
    assert.equal(echo("hello world"), "hello world");
    assert.equal(echo(""), "");
    assert.equal(echo("unicode ✓ 123"), "unicode ✓ 123");
  });
});

describe("add", () => {
  it("adds integers", () => {
    assert.equal(add(2, 3), 5);
    assert.equal(add(0, 0), 0);
  });

  it("adds negatives and floats", () => {
    assert.equal(add(-4, -6), -10);
    assert.equal(add(-1.5, 1.5), 0);
    assert.ok(Math.abs(add(0.1, 0.2) - 0.3) < 1e-9);
    assert.equal(add(1e6, 0.5), 1000000.5);
  });

  it("rejects non-finite inputs", () => {
    assert.throws(() => add(Number.NaN, 1), /finite number/);
    assert.throws(() => add(1, Number.POSITIVE_INFINITY), /finite number/);
  });
});

describe("longRunningOperation", () => {
  it("completes with a tiny duration and reports steps/duration", async () => {
    const text = await longRunningOperation(0.01, 2);
    assert.match(text, /2 steps over 0\.01 seconds/);
  });

  it("calls the injected sleep once per step with the split duration", async () => {
    const calls: number[] = [];
    const text = await longRunningOperation(0.2, 4, async (ms) => {
      calls.push(ms);
    });
    assert.deepEqual(calls, [50, 50, 50, 50]);
    assert.match(text, /4 steps over 0\.2 seconds/);
  });

  it("rejects invalid duration and steps", async () => {
    await assert.rejects(() => longRunningOperation(-1, 2), /duration/);
    await assert.rejects(() => longRunningOperation(0.1, 0), /steps/);
    await assert.rejects(() => longRunningOperation(0.1, 2.5), /steps/);
  });
});

describe("printEnv", () => {
  it("returns the injected environment, dropping undefined values", () => {
    const out = printEnv({ ALPHA: "1", BETA: "two", GONE: undefined });
    assert.deepEqual(out, { ALPHA: "1", BETA: "two" });
  });

  it("returns a copy, not the injected object", () => {
    const env = { X: "y" };
    const out = printEnv(env);
    out.X = "changed";
    assert.equal(env.X, "y");
  });
});

describe("getTinyImage", () => {
  it("returns image/png data with a real PNG signature", () => {
    const img = getTinyImage();
    assert.equal(img.mimeType, "image/png");
    const bytes = Buffer.from(img.data, "base64");
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  });

  it("content pairs the image with a text item", () => {
    const items = tinyImageContent();
    assert.equal(items.length, 2);
    assert.equal(items[0].type, "image");
    assert.equal(items[1].type, "text");
  });
});

describe("annotatedMessage", () => {
  it("maps annotations per message type", () => {
    const expected: Record<string, { audience: string[]; priority: number }> = {
      error: { audience: ["user", "assistant"], priority: 1 },
      success: { audience: ["user"], priority: 0.7 },
      debug: { audience: ["assistant"], priority: 0.3 },
    };
    for (const type of ["error", "success", "debug"] as const) {
      const items = annotatedMessage(type, false);
      assert.equal(items.length, 1, type);
      const first = items[0] as TextContentItem;
      assert.equal(first.type, "text");
      assert.deepEqual(first.annotations, expected[type], type);
    }
  });

  it("includes the tiny image only when asked", () => {
    const withImage = annotatedMessage("success", true);
    assert.equal(withImage.length, 2);
    assert.equal(withImage[1].type, "image");
    const without = annotatedMessage("success", false);
    assert.equal(without.length, 1);
  });

  it("rejects unknown message types", () => {
    assert.throws(
      () => annotatedMessage("nope" as never, false),
      /messageType/,
    );
  });
});

describe("getResourceReference", () => {
  it("embeds a text resource under demo://resource/<id>", () => {
    const item = getResourceReference(42);
    assert.equal(item.type, "resource");
    assert.equal(item.resource.uri, "demo://resource/42");
    assert.equal(item.resource.mimeType, "text/plain");
    assert.match(item.resource.text, /42/);
  });
});

describe("getResourceLinks", () => {
  it("returns exactly count resource_link items", () => {
    const links = getResourceLinks(3);
    assert.equal(links.length, 3);
    assert.ok(links.every((l) => l.type === "resource_link"));
    assert.deepEqual(
      links.map((l) => l.uri),
      ["demo://resource/1", "demo://resource/2", "demo://resource/3"],
    );
    assert.equal(getResourceLinks(1).length, 1);
    assert.equal(getResourceLinks(10).length, 10);
  });

  it("errors outside 1..10", () => {
    assert.throws(() => getResourceLinks(0), /between 1 and 10/);
    assert.throws(() => getResourceLinks(11), /between 1 and 10/);
    assert.throws(() => getResourceLinks(2.5), /between 1 and 10/);
  });
});

describe("structuredContent", () => {
  it("returns the deterministic weather shape", () => {
    assert.deepEqual(structuredContent("San Francisco"), {
      location: "San Francisco",
      temperature: "72°F",
      conditions: "Sunny",
      humidity: "45%",
    });
  });

  it("rejects an empty location", () => {
    assert.throws(() => structuredContent(""), /location/);
    assert.throws(() => structuredContent("   "), /location/);
  });
});

describe("zip", () => {
  it("builds an archive with the PK signature and hello.txt inside", () => {
    const bytes = buildZipArchive();
    assert.equal(bytes[0], 0x50); // P
    assert.equal(bytes[1], 0x4b); // K
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
    const text = Buffer.from(bytes).toString("latin1");
    assert.ok(text.includes(ZIP_FILE_NAME), "archive contains the file name");
    assert.ok(text.includes("PK\x01\x02"), "central directory present");
    assert.ok(text.includes("PK\x05\x06"), "end record present");
  });

  it("stores hello.txt uncompressed with a correct CRC32", () => {
    const bytes = Buffer.from(buildZipArchive());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // Local header: method at offset 8, CRC at 14, sizes at 18/22.
    assert.equal(view.getUint16(8, true), 0, "stored (no compression)");
    const storedCrc = view.getUint32(14, true);
    const contentBytes = new TextEncoder().encode(ZIP_FILE_CONTENT);
    assert.equal(storedCrc, crc32(contentBytes));
    assert.equal(view.getUint32(18, true), contentBytes.length);
    assert.equal(view.getUint32(22, true), contentBytes.length);
    // File data follows the 30-byte header plus the file name.
    const nameLen = view.getUint16(26, true);
    const dataStart = 30 + nameLen;
    const stored = bytes.subarray(dataStart, dataStart + contentBytes.length);
    assert.equal(Buffer.from(stored).toString("utf8"), ZIP_FILE_CONTENT);
  });

  it("crc32 matches the known check value for '123456789'", () => {
    assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  });

  it("zipContent carries the archive as a base64 blob resource", () => {
    const item = zipContent();
    assert.equal(item.type, "resource");
    assert.equal(item.resource.mimeType, "application/zip");
    const decoded = Buffer.from(item.resource.blob, "base64");
    assert.deepEqual([...decoded.subarray(0, 2)], [0x50, 0x4b]);
    assert.equal(decoded.length, buildZipArchive().length);
  });
});

describe("sampleLLM", () => {
  it("delegates to the injected handler with prompt and maxTokens", async () => {
    const seen: Array<[string, number]> = [];
    const out = await sampleLLM("Say hi", 42, async (prompt, maxTokens) => {
      seen.push([prompt, maxTokens]);
      return "hi there";
    });
    assert.equal(out, "hi there");
    assert.deepEqual(seen, [["Say hi", 42]]);
  });

  it("applies the default maxTokens when omitted", async () => {
    let got = -1;
    await sampleLLM("Ping", undefined, async (_prompt, maxTokens) => {
      got = maxTokens;
      return "pong";
    });
    assert.equal(got, 100);
  });

  it("errors clearly when sampling is not supported", async () => {
    await assert.rejects(
      () => sampleLLM("Ping", 10),
      /Sampling is not supported: the connected client did not provide sampling/,
    );
  });
});

describe("listRoots", () => {
  it("delegates to the injected handler", async () => {
    const roots = await listRoots(async () => [
      { uri: "file:///home/user/project", name: "project" },
      { uri: "file:///tmp" },
    ]);
    assert.equal(roots.length, 2);
    assert.equal(roots[0].uri, "file:///home/user/project");
  });

  it("errors clearly when roots are not supported", async () => {
    await assert.rejects(
      () => listRoots(),
      /Roots are not supported: the connected client did not provide roots/,
    );
  });
});

describe("startElicitation", () => {
  it("delegates to the injected handler", async () => {
    const outcome = await startElicitation(async () => ({
      action: "accept",
      content: { response: "blue" },
    }));
    assert.equal(outcome.action, "accept");
    assert.deepEqual(outcome.content, { response: "blue" });
  });

  it("errors clearly when elicitation is not supported", async () => {
    await assert.rejects(
      () => startElicitation(),
      /Elicitation is not supported: the connected client did not provide elicitation/,
    );
  });
});
