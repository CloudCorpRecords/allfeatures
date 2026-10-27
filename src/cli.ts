#!/usr/bin/env node
/**
 * allfeatures CLI.
 *
 *   allfeatures echo <message>
 *   allfeatures add <a> <b>
 *   allfeatures mcp
 *
 * Exit codes: 0 success, 1 bad input / runtime error, 2 usage error.
 */
import { add, echo, VERSION } from "./features.js";

function usage(): never {
  console.error(`Usage:
  allfeatures echo <message>
  allfeatures add <a> <b>
  allfeatures mcp
  allfeatures --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd) usage();
  try {
    if (cmd === "echo") {
      if (rest.length === 0) usage();
      console.log(echo(rest.join(" ")));
    } else if (cmd === "add") {
      const [aRaw, bRaw] = rest;
      if (aRaw === undefined || bRaw === undefined) usage();
      const a = Number(aRaw);
      const b = Number(bRaw);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        console.error(`error: add requires two numbers, got '${aRaw}' and '${bRaw}'`);
        process.exit(1);
      }
      console.log(String(add(a, b)));
    } else {
      usage();
    }
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
