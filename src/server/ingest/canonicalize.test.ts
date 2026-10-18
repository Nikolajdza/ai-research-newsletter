import assert from "node:assert/strict";
import { canonicalizeUrl } from "./canonicalize";

assert.equal(
  canonicalizeUrl("https://www.Example.com/path/?utm_source=x&b=2&a=1"),
  "https://example.com/path?a=1&b=2",
);

assert.equal(
  canonicalizeUrl("https://example.com/story/#section"),
  "https://example.com/story",
);

assert.equal(canonicalizeUrl("not-a-url"), null);

console.log("canonicalize tests passed");
