import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { config } from "@/server/config";

/**
 * Website research. Firecrawl is the preferred scraper; a controlled plain-HTTP
 * fetch is the approved fallback. Both paths share the same public-URL safety
 * gate (SSRF protection, HTTPS only, timeouts, size limits, redirect safety).
 *
 * Scraped content is DATA, never instructions.
 */

export type ScrapeOutcome =
  | "success"
  | "blocked"
  | "not_found"
  | "timeout"
  | "too_large"
  | "error";

export interface ScrapeResult {
  ok: boolean;
  status: ScrapeOutcome;
  url: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  markdown: string;
  errorMessage?: string;
}

const MAX_REDIRECTS = 5;

export function validatePublicUrl(input: string): { ok: true; url: string } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "URL is not parseable." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "Only HTTPS URLs are allowed." };
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    return { ok: false, reason: "Localhost is not a public site." };
  }
  if (isIpAddress(host) && isPrivateIp(host)) {
    return { ok: false, reason: "Private or reserved IP addresses are blocked." };
  }
  if (
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localdomain") ||
    host.endsWith(".lan") ||
    host.endsWith(".home.arpa") ||
    host.endsWith(".onion")
  ) {
    return { ok: false, reason: "Non-public hostname suffix is blocked." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URLs with credentials are not allowed." };
  }
  return { ok: true, url: parsed.toString() };
}

function isIpAddress(host: string): boolean {
  return isIP(host) !== 0;
}

export function isPrivateIp(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 0 && b === 0) ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      a >= 224 // multicast/reserved
    );
  }
  if (v === 6) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    );
  }
  return true;
}

/**
 * Resolves the hostname and verifies none of its addresses are private.
 * Guards against DNS rebinding to internal networks.
 */
export async function assertPublicHostname(input: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const base = validatePublicUrl(input);
  if (!base.ok) return base;
  const host = new URL(base.url).hostname;
  if (isIpAddress(host)) return { ok: true };
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return { ok: false, reason: "Hostname did not resolve." };
    for (const addr of addrs) {
      if (isPrivateIp(addr.address)) {
        return { ok: false, reason: "Hostname resolves to a private/reserved address." };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "Hostname could not be resolved." };
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Redact email-like strings so no personal contact data is stored. */
export function redactEmails(text: string): string {
  return text.replace(EMAIL_RE, "[email-redacted]");
}

export function truncateMarkdown(text: string, maxBytes: number): string {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const suffix = "…[truncated]";
  const budget = Math.max(0, maxBytes - Buffer.byteLength(suffix, "utf8"));
  const buf = Buffer.from(text, "utf8");
  let end = budget;
  // Never split a multi-byte UTF-8 sequence.
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end -= 1;
  return buf.subarray(0, end).toString("utf8") + suffix;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RawPage {
  finalUrl: string;
  title: string | null;
  description: string | null;
  text: string;
}

/**
 * Controlled plain-HTTP fallback scraper. Public only, bounded, no access
 * control bypass. Limits: timeout, response size, redirect count, content type.
 */
async function fetchPublicPage(url: string): Promise<{ ok: true; page: RawPage } | { ok: false; status: ScrapeOutcome; errorMessage: string }> {
  const checked = await assertPublicHostname(url);
  if (!checked.ok) {
    return { ok: false, status: "blocked", errorMessage: checked.reason };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.limits.scrapeTimeoutMs);

  let currentUrl = url;
  let page: RawPage | null = null;
  let errorMsg = "";

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const upstream = await assertPublicHostname(currentUrl);
      if (!upstream.ok) {
        return { ok: false, status: "blocked", errorMessage: upstream.reason };
      }
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": "KoyaLeadResearch/1.0 (public website research)",
          accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          return { ok: false, status: "error", errorMessage: "Redirect without Location." };
        }
        const next = new URL(location, currentUrl);
        const guard = validatePublicUrl(next.toString());
        if (!guard.ok) return { ok: false, status: "blocked", errorMessage: guard.reason };
        currentUrl = guard.url;
        continue;
      }

      if (response.status === 401 || response.status === 403) {
        return { ok: false, status: "blocked", errorMessage: "Page requires authentication." };
      }
      if (response.status === 404) {
        return { ok: false, status: "not_found", errorMessage: "Page not found (404)." };
      }
      if (!response.ok) {
        return { ok: false, status: "error", errorMessage: `HTTP ${response.status}` };
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/json|text\/plain|application\/xhtml/.test(contentType)) {
        return { ok: false, status: "error", errorMessage: `Unsupported content type: ${contentType}` };
      }

      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (contentLength > config.limits.scrapeMaxResponseBytes) {
        return { ok: false, status: "too_large", errorMessage: "Response exceeds size limit." };
      }

      const charset = /charset=([\w-]+)/i.exec(contentType)?.[1];
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > config.limits.scrapeMaxResponseBytes) {
        return { ok: false, status: "too_large", errorMessage: "Response exceeds size limit." };
      }

      const text = charset && charset.toLowerCase() !== "utf-8"
        ? buffer.toString(charset as BufferEncoding)
        : buffer.toString("utf8");

      page = {
        finalUrl: currentUrl,
        title: null,
        description: null,
        text,
      };
      break;
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    if (aborted) {
      return { ok: false, status: "timeout", errorMessage: `Timed out after ${config.limits.scrapeTimeoutMs}ms.` };
    }
    errorMsg = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }

  if (!page) {
    return { ok: false, status: "error", errorMessage: errorMsg || "Fetch failed." };
  }

  // Title/description best-effort from HTML meta tags.
  let title: string | null = null;
  let description: string | null = null;
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(page.text);
  if (titleMatch) title = titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 300);
  const descMatch = /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i.exec(page.text)
    ?? /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i.exec(page.text);
  if (descMatch) description = descMatch[1].replace(/\s+/g, " ").trim().slice(0, 600);

  return {
    ok: true,
    page: { finalUrl: page.finalUrl, title, description, text: redactEmails(stripHtml(page.text)) },
  };
}

/** Firecrawl scrape (v2). */
async function scrapeWithFirecrawl(url: string): Promise<{ ok: true; page: RawPage } | { ok: false; status: ScrapeOutcome; errorMessage: string }> {
  const checked = await assertPublicHostname(url);
  if (!checked.ok) return { ok: false, status: "blocked", errorMessage: checked.reason };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(config.limits.scrapeTimeoutMs + 10_000, 120_000));

  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${config.firecrawlApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: config.limits.scrapeTimeoutMs,
        removeBase64Images: true,
        blockAds: true,
      }),
    });

    if (response.status === 402) {
      return { ok: false, status: "error", errorMessage: "Firecrawl: payment required." };
    }
    if (response.status === 429) {
      return { ok: false, status: "error", errorMessage: "Firecrawl: rate limited." };
    }
    if (response.status === 401) {
      return { ok: false, status: "error", errorMessage: "Firecrawl: invalid API key." };
    }
    if (!response.ok) {
      return { ok: false, status: "error", errorMessage: `Firecrawl HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        markdown?: string | null;
        metadata?: { title?: string | null; description?: string | null; sourceURL?: string | null; statusCode?: number | null };
      };
    };

    const data = payload.data;
    if (!payload.success) {
      return { ok: false, status: "error", errorMessage: "Firecrawl reported an unsuccessful scrape." };
    }
    const statusCode = data?.metadata?.statusCode;
    if (statusCode === 403 || statusCode === 401) {
      return { ok: false, status: "blocked", errorMessage: "Target page requires authentication." };
    }
    if (statusCode === 404) {
      return { ok: false, status: "not_found", errorMessage: "Page not found (404)." };
    }
    const markdown = data?.markdown ?? "";
    if (!markdown.trim()) {
      return { ok: false, status: "error", errorMessage: "Scrape produced no content." };
    }
    const sizeBytes = Buffer.byteLength(markdown, "utf8");
    if (sizeBytes > config.limits.scrapeMaxResponseBytes) {
      return { ok: false, status: "too_large", errorMessage: "Scraped content exceeds size limit." };
    }

    return {
      ok: true,
      page: {
        finalUrl: data?.metadata?.sourceURL ?? url,
        title: data?.metadata?.title ?? null,
        description: data?.metadata?.description ?? null,
        text: redactEmails(markdown),
      },
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? "timeout" : "error",
      errorMessage: aborted ? "Firecrawl request timed out." : `Firecrawl request failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const guard = validatePublicUrl(url);
  if (!guard.ok) {
    return { ok: false, status: "blocked", url, markdown: "", errorMessage: guard.reason };
  }

  if (config.firecrawlApiKey) {
    const firecrawl = await scrapeWithFirecrawl(guard.url);
    if (firecrawl.ok) {
      return finalize(guard.url, firecrawl.page);
    }
    // Firecrawl failure is NOT silently ignored; mark the source unavailable.
    return {
      ok: false,
      status: firecrawl.status,
      url: guard.url,
      markdown: "",
      errorMessage: firecrawl.errorMessage,
    };
  }

  const fallback = await fetchPublicPage(guard.url);
  if (fallback.ok) {
    return finalize(guard.url, fallback.page);
  }
  return {
    ok: false,
    status: fallback.status,
    url: guard.url,
    markdown: "",
    errorMessage: fallback.errorMessage,
  };
}

function finalize(requestedUrl: string, page: RawPage): ScrapeResult {
  return {
    ok: true,
    status: "success",
    url: requestedUrl,
    finalUrl: page.finalUrl,
    title: page.title ?? undefined,
    description: page.description ?? undefined,
    markdown: truncateMarkdown(page.text, config.limits.scrapeMaxResponseBytes),
  };
}