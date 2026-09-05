// Contour Form 1 — email deliverability check.
//
// The form asks this function, on blur, whether an address is worth accepting:
// is it shaped like an address, does its domain exist, does that domain run a
// mail server, and is it a throwaway inbox. It is a domain-level verdict on
// purpose. Nothing here talks SMTP to the mail server: Google Cloud blocks
// outbound port 25, and the big providers accept every RCPT TO anyway, so a
// mailbox probe would cost a round trip and prove nothing. What the domain
// checks do catch is the bulk of real junk — "gamil.com", "hotmial.con",
// "asdf@asdf", tempmail domains — without turning away the one-school
// domains half the students sign up with.
//
// Verdicts are "valid", "invalid" or "unknown". "unknown" means DNS did not
// answer in time and the form should fail open; it never blocks a submission
// on our own infrastructure hiccup.

const functions = require("@google-cloud/functions-framework");
const dns = require("dns");
const { domainToASCII } = require("url");

const DISPOSABLE_DOMAINS = new Set(require("disposable-email-domains"));

const ALLOWED_ORIGINS = [
  "https://contour-staging.webflow.io",
  "https://www.contoureducation.com.au",
  "https://contoureducation.com.au",
  // test/serve.sh — the local harness page.
  "http://localhost:8000",
  "http://127.0.0.1:8000"
];

// Same shape the form applies before it asks, so nothing structurally wrong
// costs a DNS lookup. Local part per RFC 5322 dot-atom; domain labels as in
// RFC 1035 with a letters-only public suffix.
const LOCAL_PART = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^[a-z]{2,}$/;

const MAX_BATCH = 5;
const DNS_TIMEOUT_MS = 2500;

// One resolver with a hard timeout, so a slow authoritative server yields
// "unknown" inside the form's own patience rather than hanging the request.
const resolver = new dns.promises.Resolver({ timeout: DNS_TIMEOUT_MS, tries: 2 });

/* ---------------------------------------------------------------------------
   Syntax
--------------------------------------------------------------------------- */

// Returns { local, domain } for an address the rest of the pipeline can use,
// or null when the shape alone rules it out.
function parseAddress(raw) {
  const value = String(raw || "").trim();
  if (value === "" || value.length > 254) return null;
  const at = value.lastIndexOf("@");
  if (at < 1 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domainRaw = value.slice(at + 1);
  if (local.length > 64) return null;
  if (!LOCAL_PART.test(local)) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  // Internationalised domains are checked in their punycode form, which is
  // also what DNS wants.
  const domain = domainToASCII(domainRaw.toLowerCase());
  if (!domain || domain.length > 253) return null;
  const labels = domain.split(".");
  if (labels.length < 2) return null;
  for (const label of labels) {
    if (!LABEL.test(label)) return null;
  }
  if (!TLD.test(labels[labels.length - 1])) return null;
  return { local, domain };
}

/* ---------------------------------------------------------------------------
   Disposable domains
--------------------------------------------------------------------------- */

// A throwaway provider's subdomains are throwaway too, so every parent of the
// domain is looked up as well: "mail.tempmail.com" matches "tempmail.com".
function isDisposable(domain) {
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return false;
}

/* ---------------------------------------------------------------------------
   DNS
--------------------------------------------------------------------------- */

// Per-domain memo. A DNS answer is good for a while and the same domain
// arrives from both email boxes on the form, often within seconds, so the
// second lookup should not leave the instance. Bounded so a flood of unique
// junk domains cannot grow it without limit.
const domainCache = new Map();
const CACHE_MAX = 5000;
const TTL_MS = { valid: 60 * 60 * 1000, invalid: 15 * 60 * 1000, unknown: 60 * 1000 };

function cacheGet(domain) {
  const hit = domainCache.get(domain);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    domainCache.delete(domain);
    return null;
  }
  return hit.result;
}

function cacheSet(domain, result) {
  if (domainCache.size >= CACHE_MAX) {
    // Map iterates in insertion order, so this drops the oldest entry.
    domainCache.delete(domainCache.keys().next().value);
  }
  domainCache.set(domain, { result, expires: Date.now() + TTL_MS[result.status] });
}

function isNegative(err) {
  return err && (err.code === "ENOTFOUND" || err.code === "ENODATA");
}

// { status, reason, mx } for the domain, from DNS only. The reasons are the
// vocabulary the form maps to messages:
//   no_domain  — the name does not exist at all (NXDOMAIN)
//   null_mx    — RFC 7505 "this domain takes no mail" record
//   no_mx      — a real domain with neither MX nor a host to fall back to
async function resolveDomain(domain) {
  const cached = cacheGet(domain);
  if (cached) return cached;

  let result;
  try {
    const records = await resolver.resolveMx(domain);
    const real = records.filter((r) => r.exchange && r.exchange !== "." && r.exchange !== "");
    if (records.length > 0 && real.length === 0) {
      result = { status: "invalid", reason: "null_mx", mx: [] };
    } else if (real.length > 0) {
      real.sort((a, b) => a.priority - b.priority);
      result = { status: "valid", reason: null, mx: real.slice(0, 3).map((r) => r.exchange) };
    } else {
      // Empty answer with no error: treat like ENODATA and fall back to A.
      result = await resolveFallback(domain);
    }
  } catch (err) {
    if (err.code === "ENOTFOUND") {
      // ENOTFOUND is NXDOMAIN on Linux resolvers; on some platforms it also
      // covers "no records of this type", so a fallback A lookup separates the
      // two rather than assuming the domain is gone.
      result = await resolveFallback(domain, true);
    } else if (err.code === "ENODATA") {
      result = await resolveFallback(domain);
    } else {
      console.warn("mx lookup failed:", domain, err.code || err.message);
      result = { status: "unknown", reason: "dns_error", mx: [] };
    }
  }
  cacheSet(domain, result);
  return result;
}

// RFC 5321 §5.1: no MX means deliver to the host itself, so an A/AAAA record
// still counts as a mail-capable domain. Weak but honest — plenty of small
// domains run this way.
async function resolveFallback(domain, mxWasNotFound) {
  const lookups = [resolver.resolve4(domain), resolver.resolve6(domain)];
  const settled = await Promise.allSettled(lookups);
  const found = settled.some((s) => s.status === "fulfilled" && s.value.length > 0);
  if (found) return { status: "valid", reason: null, mx: [domain], implicitMx: true };
  const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason);
  if (errors.length > 0 && errors.every(isNegative)) {
    // The A lookup answers the NXDOMAIN question the MX one could not: a
    // name with no A record either says ENODATA (exists, nothing there) or
    // ENOTFOUND (no such name). AAAA reports ENODATA for both on some
    // resolvers, so only the A answer is read.
    const nxdomain = mxWasNotFound && errors.some((e) => e.code === "ENOTFOUND");
    return { status: "invalid", reason: nxdomain ? "no_domain" : "no_mx", mx: [] };
  }
  if (errors.length === 0) return { status: "invalid", reason: "no_mx", mx: [] };
  console.warn("fallback lookup failed:", domain, errors.map((e) => e.code || e.message).join(","));
  return { status: "unknown", reason: "dns_error", mx: [] };
}

/* ---------------------------------------------------------------------------
   Verdict
--------------------------------------------------------------------------- */

// scope tells the form how far the verdict travels: a "domain" verdict holds
// for every address at that domain, so the form can memo it once for both
// email boxes; an "address" verdict is about this string only.
async function verify(raw) {
  const parsed = parseAddress(raw);
  const email = String(raw || "").trim();
  if (!parsed) {
    return { email, status: "invalid", reason: "syntax", scope: "address", domain: null };
  }
  const base = { email: `${parsed.local}@${parsed.domain}`, domain: parsed.domain, scope: "domain" };
  if (isDisposable(parsed.domain)) {
    return { ...base, status: "invalid", reason: "disposable" };
  }
  const dnsResult = await resolveDomain(parsed.domain);
  return {
    ...base,
    status: dnsResult.status,
    reason: dnsResult.reason,
    mx: dnsResult.mx,
    implicitMx: !!dnsResult.implicitMx
  };
}

/* ---------------------------------------------------------------------------
   HTTP
--------------------------------------------------------------------------- */

// In-instance rate limit: 60 requests/min per IP. Blur fires per address and
// the form memoises, so a real visitor never gets near it.
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || [];
  const recent = bucket.filter((t) => now - t < 60000);
  recent.push(now);
  rateBuckets.set(ip, recent);
  if (rateBuckets.size > 10000) rateBuckets.clear();
  return recent.length > 60;
}

function requestedEmails(req) {
  if (req.method === "GET") {
    const one = req.query.email;
    return one === undefined ? [] : [String(one)];
  }
  const body = req.body || {};
  if (Array.isArray(body.emails)) return body.emails.map(String);
  if (body.email !== undefined) return [String(body.email)];
  return [];
}

functions.http("verifyEmail", async (req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "too many requests" });

  const emails = requestedEmails(req);
  if (emails.length === 0) return res.status(400).json({ error: "email required" });
  if (emails.length > MAX_BATCH) return res.status(400).json({ error: `at most ${MAX_BATCH} emails` });

  try {
    const results = await Promise.all(emails.map(verify));
    // A verdict is stable for a while, so a repeat of the same blur inside
    // the window is answered from the browser cache.
    res.set("Cache-Control", "private, max-age=300");
    if (req.method === "GET") return res.json(results[0]);
    return res.json({ results });
  } catch (err) {
    console.error("verify error:", err.message);
    return res.status(500).json({ error: "internal error" });
  }
});

module.exports._internals = { parseAddress, isDisposable, resolveDomain, verify };
