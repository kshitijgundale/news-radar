import assert from "node:assert/strict";
import test from "node:test";

import { extractReadableHtml, fetchSource } from "./source-fetcher.js";
import { canonicalizeUrl } from "./url.js";

const candidate = {
  url: "https://Example.com:443/news//story/?utm_source=test&b=2&a=1#body",
  title: "Fallback title",
  publisher: null,
  publishedAt: null,
  snippet: "A relevant result",
  relevance: "Direct report",
  sourceKind: "news" as const,
};

test("canonicalizes source URLs and removes tracking parameters", () => {
  assert.equal(
    canonicalizeUrl(candidate.url),
    "https://example.com/news/story?a=1&b=2",
  );
});

test("extracts readable metadata and content while removing page chrome", () => {
  const extracted = extractReadableHtml(`
    <html><head>
      <title>Ignored title</title>
      <meta property="og:title" content="Material update">
      <meta property="og:site_name" content="Example News">
      <meta property="article:published_time" content="2026-08-24T10:00:00Z">
      <meta property="article:modified_time" content="2026-08-24T11:30:00Z">
    </head><body><nav>This navigation should not remain</nav><article>
      <h1>Material update</h1><p>The situation changed in a way that matters to followers.</p>
    </article><script>malicious()</script></body></html>
  `);

  assert.equal(extracted.title, "Material update");
  assert.equal(extracted.publisher, "Example News");
  assert.equal(extracted.publishedAt, "2026-08-24T11:30:00.000Z");
  assert.match(extracted.content, /situation changed/);
  assert.doesNotMatch(extracted.content, /navigation|malicious/);
});

test("fetches bounded source text and hashes the cleaned content", async () => {
  const result = await fetchSource(candidate, {
    validateUrl: async () => undefined,
    now: () => new Date("2026-08-24T12:00:00Z"),
    fetchImpl: async () =>
      new Response("<article><p>This material report contains enough readable source text.</p></article>", {
        headers: { "content-type": "text/html" },
      }),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source.contentHash.length, 64);
    assert.equal(result.source.canonicalUrl, "https://example.com/news/story?a=1&b=2");
  }
});

test("rejects responses larger than the configured byte limit", async () => {
  const result = await fetchSource(candidate, {
    validateUrl: async () => undefined,
    maxBytes: 10,
    fetchImpl: async () =>
      new Response("This response is much too large", { headers: { "content-type": "text/plain" } }),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.failure.reason, "too_large");
});
