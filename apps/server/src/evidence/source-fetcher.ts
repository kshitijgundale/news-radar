import { createHash } from "node:crypto";

import { load } from "cheerio";

import type { SourceCandidate } from "./search-provider.js";
import { assertPublicHttpUrl, canonicalizeUrl } from "./url.js";

export interface RetrievedSource {
  canonicalUrl: string;
  title: string;
  publisher: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  contentHash: string;
  extractedContent: string;
  fetchStatus: "fetched";
}

export interface RetrievalFailure {
  canonicalUrl: string;
  retrievedAt: string;
  reason: "blocked_url" | "timeout" | "http_error" | "too_large" | "unsupported_content" | "empty_content" | "network_error";
  detail: string;
}

export type RetrievalResult =
  | { ok: true; source: RetrievedSource }
  | { ok: false; failure: RetrievalFailure };

export interface SourceFetcherOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetchImpl?: typeof fetch;
  validateUrl?: (url: string) => Promise<void>;
  now?: () => Date;
}

const defaultUserAgent = "RadarBot/0.1 (+https://example.invalid/radar)";

export async function fetchSource(
  candidate: SourceCandidate,
  options: SourceFetcherOptions = {},
): Promise<RetrievalResult> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maxBytes = options.maxBytes ?? 500_000;
  const maxRedirects = options.maxRedirects ?? 3;
  const fetchImpl = options.fetchImpl ?? fetch;
  const validateUrl = options.validateUrl ?? assertPublicHttpUrl;
  const retrievedAt = (options.now?.() ?? new Date()).toISOString();
  let currentUrl: string;

  try {
    currentUrl = canonicalizeUrl(candidate.url);
    await validateUrl(currentUrl);
  } catch (error) {
    return failure(candidate.url, retrievedAt, "blocked_url", error);
  }

  try {
    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      const response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "text/html, text/plain;q=0.9",
          "user-agent": defaultUserAgent,
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === maxRedirects) {
          return failure(currentUrl, retrievedAt, "http_error", `Unusable redirect (${response.status})`);
        }
        currentUrl = canonicalizeUrl(new URL(location, currentUrl).href);
        await validateUrl(currentUrl);
        continue;
      }

      if (!response.ok) {
        return failure(currentUrl, retrievedAt, "http_error", `HTTP ${response.status}`);
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel();
        return failure(currentUrl, retrievedAt, "too_large", `Content length exceeds ${maxBytes} bytes`);
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
        await response.body?.cancel();
        return failure(currentUrl, retrievedAt, "unsupported_content", contentType || "unknown content type");
      }

      const body = await readBoundedBody(response, maxBytes);
      const extracted = contentType.includes("text/html")
        ? extractReadableHtml(body)
        : { content: cleanText(body), title: null, publisher: null, publishedAt: null };
      if (!extracted.content) {
        return failure(currentUrl, retrievedAt, "empty_content", "No readable source text found");
      }

      return {
        ok: true,
        source: {
          canonicalUrl: canonicalizeUrl(currentUrl),
          title: extracted.title ?? candidate.title,
          publisher: extracted.publisher ?? candidate.publisher,
          publishedAt: extracted.publishedAt ?? candidate.publishedAt,
          retrievedAt,
          contentHash: createHash("sha256").update(extracted.content).digest("hex"),
          extractedContent: extracted.content,
          fetchStatus: "fetched",
        },
      };
    }
  } catch (error) {
    const reason = error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "network_error";
    return failure(currentUrl, retrievedAt, reason, error);
  }

  return failure(currentUrl, retrievedAt, "http_error", "Redirect limit exceeded");
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new SourceTooLargeError(`Response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export function extractReadableHtml(html: string): {
  content: string;
  title: string | null;
  publisher: string | null;
  publishedAt: string | null;
} {
  const $ = load(html);
  const meta = (selector: string) => $(selector).first().attr("content")?.trim() || null;
  const title = meta('meta[property="og:title"]') ?? (cleanText($("title").first().text()) || null);
  const publisher = meta('meta[property="og:site_name"]');
  const publishedRaw =
    meta('meta[property="article:published_time"]') ??
    meta('meta[name="date"]') ??
    meta('meta[itemprop="datePublished"]') ??
    $("time[datetime]").first().attr("datetime") ??
    null;
  const updatedRaw =
    meta('meta[property="article:modified_time"]') ??
    meta('meta[name="last-modified"]') ??
    meta('meta[itemprop="dateModified"]') ??
    null;

  $("script, style, noscript, svg, nav, footer, header, aside, form, iframe").remove();
  const root = $("article").first().length
    ? $("article").first()
    : $("main").first().length
      ? $("main").first()
      : $('[role="main"]').first().length
        ? $('[role="main"]').first()
        : $("body");
  const blocks = root
    .find("h1, h2, h3, p, li, blockquote")
    .toArray()
    .map((element) => cleanText($(element).text()))
    .filter((text) => text.length >= 20);
  const content = cleanText(blocks.length > 0 ? blocks.join("\n") : root.text());

  return { content, title, publisher, publishedAt: latestDate(publishedRaw, updatedRaw) };
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function latestDate(...values: Array<string | null>): string | null {
  const dates = values
    .map(normalizeDate)
    .filter((value): value is string => value !== null)
    .sort();
  return dates.at(-1) ?? null;
}

class SourceTooLargeError extends Error {}

function failure(
  canonicalUrl: string,
  retrievedAt: string,
  reason: RetrievalFailure["reason"],
  error: unknown,
): RetrievalResult {
  const actualReason = error instanceof SourceTooLargeError ? "too_large" : reason;
  return {
    ok: false,
    failure: {
      canonicalUrl,
      retrievedAt,
      reason: actualReason,
      detail: error instanceof Error ? error.message : String(error),
    },
  };
}
