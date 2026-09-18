const functions = require("@google-cloud/functions-framework");

/*
 * LGM-04 — "email me my signup link"
 *
 * The form's student email box recognises an address that already belongs to a
 * Student record (see /exists in functions/prefetch). This endpoint is what the
 * resulting "Send me the link" button calls: it flips one boolean on that
 * contact, and a HubSpot workflow sends the "continue your signup" email —
 * which renders its button from the contact's own add_subjects_url.
 *
 * This is the only endpoint in the form that causes mail to leave the building
 * on an anonymous visitor's say-so, so three rules hold it in:
 *
 *   1. The browser never names the record. It sends an address; this resolves
 *      the contact itself. A record id from the client would let anyone mail
 *      themselves any student's prefill link.
 *   2. Nothing about the contact comes back — not the link, not the id, not
 *      the name. The caller already learned "this address belongs to a
 *      student" from /exists; this adds no new disclosure.
 *   3. The flag is only ever set, never cleared, and setting it twice is a
 *      no-op. Once it is true the workflow already owes this contact an email,
 *      so a second click cannot queue a second send. That is the per-recipient
 *      cap — it lives on the record, so it survives cold starts, unlike the
 *      per-IP bucket below.
 *
 * KNOWN GAP: the per-IP limit is in-instance memory. Under concurrency each
 * Cloud Run instance keeps its own bucket, and a cold start resets it, so the
 * effective ceiling is (instances x RATE_LIMIT_PER_MINUTE). Rule 3 bounds the
 * damage — an attacker can trigger at most one mail per address that is
 * already a student with a link, and never a second — but a shared counter
 * (Firestore) plus a captcha on the button is the real fix. See README.
 */

const HUBSPOT_BASE = "https://api.hubapi.com";

// The boolean the sending workflow enrols on. Deliberately has no default:
// writing the wrong property on a live contact either sends nothing or sends
// the wrong mail to a real family, and neither failure is visible from here.
// Set it explicitly at deploy time.
const SEND_TRIGGER_PROPERTY = String(process.env.SEND_TRIGGER_PROPERTY || "").trim();

// Local testing only. Everything runs — the address is resolved, the record is
// checked, the answer is the one the form would get — except the write. Without
// it, exercising the button against the real portal would put actual mail in a
// real family's inbox, which is not a thing to find out by trying.
const DRY_RUN = String(process.env.DRY_RUN || "").trim().toLowerCase() === "true";

// Same allowlist as the prefetch function — the form is the only caller.
const ALLOWED_ORIGINS = [
  "https://contour-staging.webflow.io",
  "https://www.contoureducation.com.au",
  "https://contoureducation.com.au"
];

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_PER_MINUTE = 10;

const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (rateBuckets.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  rateBuckets.set(ip, recent);
  return recent.length > RATE_LIMIT_PER_MINUTE;
}

function hubspotToken() {
  return String(process.env.HUBSPOT_TOKEN || "").trim();
}

async function hubspotFetch(path, init) {
  const res = await fetch(HUBSPOT_BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${hubspotToken()}`,
      "Content-Type": "application/json",
      ...((init && init.headers) || {})
    }
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status} on ${path}`);
  return res.status === 204 ? null : res.json();
}

// Resolved the same way /exists resolves it: the canonical `email` property
// only. Matching any wider net here would mail the link to an address that
// merely appears somewhere on the record — a guardian's, most often — which is
// exactly the person the form is trying to keep it away from.
async function findStudentContact(email) {
  const data = await hubspotFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "contact_type", "add_subjects_url", SEND_TRIGGER_PROPERTY],
      limit: 1
    })
  });
  const contact = (data && data.results && data.results[0]) || null;
  if (!contact) return null;
  const properties = contact.properties || {};
  if (String(properties.contact_type || "").trim().toLowerCase() !== "student") return null;
  if (String(properties.add_subjects_url || "").trim() === "") return null;
  return { id: contact.id, properties };
}

functions.http("sendLink", async (req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Vary", "Origin");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // An unconfigured deploy must fail loudly rather than write a guessed
  // property name onto a real contact.
  if (!SEND_TRIGGER_PROPERTY) {
    console.error("SEND_TRIGGER_PROPERTY is not set; refusing to write");
    return res.status(503).json({ error: "not configured" });
  }
  if (!hubspotToken()) {
    console.error("HUBSPOT_TOKEN is not set");
    return res.status(503).json({ error: "not configured" });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.ip || "unknown").split(",")[0].trim();
  if (rateLimited(ip)) return res.status(429).json({ error: "too many requests" });

  const body = req.body || {};
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_SHAPE.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  try {
    const contact = await findStudentContact(email);
    // Not a student, or a student with nowhere to send them. Reported as a
    // plain "no" — the form already knows which of the two it is, because
    // /exists told it before the button was ever rendered.
    if (!contact) return res.json({ sent: false, reason: "not_eligible" });

    // Already queued. Setting it again would not send a second mail (the
    // workflow enrols on the transition), but returning early keeps the write
    // count honest and makes repeat clicks free.
    const already = String(contact.properties[SEND_TRIGGER_PROPERTY] || "").toLowerCase() === "true";
    if (already) return res.json({ sent: true, alreadyQueued: true });

    if (DRY_RUN) {
      console.log(`send-link: DRY RUN, would set ${SEND_TRIGGER_PROPERTY} on contact ${contact.id}`);
      return res.json({ sent: true, alreadyQueued: false, dryRun: true });
    }
    await hubspotFetch(`/crm/v3/objects/contacts/${contact.id}`, {
      method: "PATCH",
      body: JSON.stringify({ properties: { [SEND_TRIGGER_PROPERTY]: "true" } })
    });
    console.log(`send-link: queued ${SEND_TRIGGER_PROPERTY} for contact ${contact.id}`);
    return res.json({ sent: true, alreadyQueued: false });
  } catch (err) {
    console.error("send-link error:", err.message);
    return res.status(500).json({ error: "internal error" });
  }
});
