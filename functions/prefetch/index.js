const functions = require("@google-cloud/functions-framework");

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const HUBSPOT_BASE = "https://api.hubapi.com";

// Trials custom object type id; Enrolments are the renamed deals object.
const TRIALS_OBJECT_TYPE = "2-207877831";
const ENROLMENTS_OBJECT_TYPE = "deals";
const SUBJECT_CODE_PROPERTY = "subject_code";

const CONTACT_PROPERTIES = [
  "contact_type",
  "web_form_contact_type",
  "firstname",
  "lastname",
  "student_first_name",
  "student_last_name",
  "student_email",
  "student_phone_number",
  "student_phone",
  "email",
  "email_2",
  "phone",
  "state_territory_country",
  "state",
  "which_year_are_you_interested_in_tutoring_for_",
  "year_level",
  "school_text",
  "school_code",
  "acara_id",
  "program_interest",
  "web_form__interested_subject",
  "web_form__preferred_campuses",
  "referral"
];

// Superseded by student_phone_number (single-line text -> phone number type).
// Still read so contacts that only carry the old value keep prefilling, but
// dropped from the request if HubSpot rejects it (i.e. once it's deleted).
const LEGACY_CONTACT_PROPERTIES = ["student_phone"];

// Loose shape check only — HubSpot search does the authoritative matching.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Properties the form can write an email into; a hit on any of them means
// this address already has an entry.
// Emails are matched across every property that can hold one, whichever field
// was typed into: the contact's own, the stand-in used by the form, the
// student/guardian pair, and contact_email (Amitav).
const EMAIL_MATCH_PROPERTIES = [
  "email",
  "email_2",
  "student_email",
  "guardian_email",
  "contact_email"
];
// Both phone fields search every phone property (Amitav). mobilephone matters
// most here: ~7.5k contacts carry a number there and nowhere else, so leaving
// it out missed real duplicates.
const PHONE_MATCH_PROPERTIES = [
  "phone",
  "mobilephone",
  "student_phone_number",
  "student_phone",
  "guardian_phone"
];

const ALLOWED_ORIGINS = [
  "https://contour-staging.webflow.io",
  "https://www.contoureducation.com.au",
  "https://contoureducation.com.au"
];

// Minimal in-instance rate limit: 30 requests/min per IP.
const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || [];
  const recent = bucket.filter((t) => now - t < 60000);
  recent.push(now);
  rateBuckets.set(ip, recent);
  return recent.length > 30;
}

async function hubspotGet(path) {
  const res = await fetch(HUBSPOT_BASE + path, {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HubSpot ${res.status} on ${path}`);
  return res.json();
}

async function hubspotBatchRead(objectType, ids, properties) {
  if (ids.length === 0) return [];
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/${objectType}/batch/read`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      properties,
      inputs: ids.map((id) => ({ id }))
    })
  });
  if (!res.ok) throw new Error(`HubSpot batch ${res.status} on ${objectType}`);
  const data = await res.json();
  return data.results || [];
}

async function associatedPeople(contactId) {
  const assoc = await hubspotGet(
    `/crm/v4/objects/contacts/${contactId}/associations/contacts?limit=100`
  );
  const results = (assoc && assoc.results) || [];
  if (results.length === 0) return { guardian: null, student: null };
  const ids = [...new Set(results.map((r) => String(r.toObjectId)))];
  const records = await hubspotBatchRead("contacts", ids, [
    "firstname",
    "lastname",
    "email",
    "email_2",
    "phone",
    "contact_type"
  ]);
  const byId = new Map(records.map((r) => [String(r.id), r.properties || {}]));
  let guardian = null;
  let student = null;
  for (const r of results) {
    const props = byId.get(String(r.toObjectId));
    if (!props) continue;
    const labels = (r.associationTypes || []).map((t) => t.label || "");
    const guardianish =
      labels.some((l) => /guardian|parent/i.test(l)) ||
      props.contact_type === "Guardian" ||
      props.contact_type === "Parent";
    if (!guardian && guardianish) guardian = props;
    if (!student && props.contact_type === "Student") student = props;
  }
  return { guardian, student };
}

async function fetchContact(studentId) {
  const path = (props) =>
    `/crm/v3/objects/contacts/${studentId}?properties=${props.join(",")}`;
  try {
    return await hubspotGet(path(CONTACT_PROPERTIES));
  } catch (err) {
    // One removed property makes HubSpot reject the whole read — retry without
    // the legacy ones rather than losing the prefill entirely.
    console.warn("contact read failed, retrying without legacy properties:", err.message);
    return hubspotGet(
      path(CONTACT_PROPERTIES.filter((p) => !LEGACY_CONTACT_PROPERTIES.includes(p)))
    );
  }
}

async function associatedSubjectCodes(contactId, objectType) {
  const assoc = await hubspotGet(
    `/crm/v4/objects/contacts/${contactId}/associations/${objectType}?limit=100`
  );
  const ids = ((assoc && assoc.results) || []).map((r) => r.toObjectId);
  const records = await hubspotBatchRead(objectType, ids, [SUBJECT_CODE_PROPERTY]);
  const codes = records
    .map((r) => (r.properties || {})[SUBJECT_CODE_PROPERTY])
    .filter((c) => typeof c === "string" && c.trim().length > 0)
    .map((c) => c.trim());
  return [...new Set(codes)];
}

async function contactExistsByProperties(propertyNames, value, operator) {
  // filterGroups are OR-ed, so one group per property matches a contact
  // carrying the value on any of them.
  const filterGroups = propertyNames.map((propertyName) => ({
    filters: [{ propertyName, operator: operator || "EQ", value }]
  }));
  if (filterGroups.length === 0) return false;
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filterGroups,
      properties: ["email"],
      limit: 1
    })
  });
  if (!res.ok) throw new Error(`HubSpot search ${res.status}`);
  const data = await res.json();
  return (data.total || 0) > 0;
}

async function contactExistsByEmail(email) {
  return contactExistsByProperties(EMAIL_MATCH_PROPERTIES, email);
}

// Numbers are stored in whatever shape they were captured in: "+61412345678",
// "61412345678", "0412345678", "+61 418 675 330", "(+61) 406352941". Neither an
// exact match nor a substring match copes with that spread: CONTAINS_TOKEN
// splits the stored value on spaces, so "*418675330*" never finds
// "+61 418 675 330", while a bare "*12345678*" matches straight through the
// middle of an unrelated number. So the search only casts a candidate net, and
// the numbers it returns are compared properly in code.
//
// DEFAULT_DIAL is the calling code assumed for a number that carries no country
// code of its own. The form sends the dial code its country select is showing;
// stored values that are ambiguous fall back to Australia.
const DEFAULT_DIAL = "61";

// Canonical form is the full international number, digits only and no plus, so
// two numbers are equal only when they agree on the country as well as the
// national part.
function canonicalPhone(raw, defaultDial) {
  const text = String(raw || "").trim();
  const dial = String(defaultDial || DEFAULT_DIAL).replace(/[^\d]/g, "") || DEFAULT_DIAL;
  let digits = text.replace(/[^\d]/g, "");
  if (!digits) return "";
  // Written internationally ("+61...", "0061..."): the country code is already
  // in the digits, so they are the canonical form as they stand.
  const international = text.trim().startsWith("+") || /^\(\s*\+/.test(text.trim());
  if (digits.startsWith("00")) return digits.slice(2);
  if (international) return digits;
  // A trunk prefix means a national number: swap the leading 0 for the dial code.
  if (digits.startsWith("0")) return dial + digits.replace(/^0+/, "");
  // Already carries the dial code without a plus ("61412345678").
  if (digits.startsWith(dial) && digits.length > dial.length + 6) return digits;
  // Bare national number, no trunk prefix.
  return dial + digits;
}

// The national part is what varies in how it gets grouped, so the candidate net
// is anchored on its first and last three digits: "418675330" is found in
// "+61418675330", "+61 418 675 330" and "0418 675 330" alike, without dragging
// in every number that merely contains those digits somewhere.
function phoneSearchAnchors(canonical, defaultDial) {
  const dial = String(defaultDial || DEFAULT_DIAL).replace(/[^\d]/g, "") || DEFAULT_DIAL;
  let national = canonical;
  if (national.startsWith(dial)) national = national.slice(dial.length);
  // Too short to identify anyone: half the database would come back.
  if (national.length < 8) return null;
  return { head: national.slice(0, 3), tail: national.slice(-3) };
}

async function contactExistsByPhone(phone, dialCode) {
  const canonical = canonicalPhone(phone, dialCode);
  if (!canonical) return false;
  const anchors = phoneSearchAnchors(canonical, dialCode);
  if (!anchors) return false;
  // Filters inside a group are AND-ed and the groups are OR-ed, so this reads
  // as "any phone property that both contains the head and ends with the tail".
  const filterGroups = PHONE_MATCH_PROPERTIES.map((propertyName) => ({
    filters: [
      { propertyName, operator: "CONTAINS_TOKEN", value: `*${anchors.head}*` },
      { propertyName, operator: "CONTAINS_TOKEN", value: `*${anchors.tail}` }
    ]
  }));
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      filterGroups,
      properties: PHONE_MATCH_PROPERTIES,
      limit: 100
    })
  });
  if (!res.ok) throw new Error(`HubSpot search ${res.status}`);
  const data = await res.json();
  const results = data.results || [];
  // The net is deliberately loose, so a candidate only counts as a duplicate
  // once its stored number canonicalises to exactly the one being checked.
  // Stored numbers resolve against DEFAULT_DIAL, never the caller's: a bare
  // "0400700907" sitting in an Australian portal is an Australian number, and
  // reading it as the country the person filling the form happens to have
  // selected would match it to whatever they typed.
  return results.some((record) => {
    const properties = record.properties || {};
    return PHONE_MATCH_PROPERTIES.some(
      (name) => properties[name] && canonicalPhone(properties[name], DEFAULT_DIAL) === canonical
    );
  });
}

functions.http("prefetch", async (req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return res.status(405).json({ error: "method not allowed" });

  const ip = req.headers["x-forwarded-for"] || req.ip || "unknown";
  if (rateLimited(String(ip).split(",")[0].trim())) {
    return res.status(429).json({ error: "too many requests" });
  }

  if (req.path && req.path.endsWith("/exists")) {
    // ?email= and ?phone= are both accepted so one endpoint serves the four
    // duplicate-checked fields (student/guardian email and phone).
    const email = String(req.query.email || "").trim().toLowerCase();
    const phone = String(req.query.phone || "").trim();
    // The country select the form is showing, so a number typed without a
    // country code is read against the right country rather than assumed local.
    const dial = String(req.query.dial || "").replace(/[^\d]/g, "").slice(0, 4);
    if (!email && !phone) {
      return res.status(400).json({ error: "email or phone required" });
    }
    if (email && (email.length > 254 || !EMAIL_SHAPE.test(email))) {
      return res.status(400).json({ error: "invalid email" });
    }
    if (phone && (phone.length > 32 || String(phone).replace(/[^\d]/g, "").length < 6)) {
      return res.status(400).json({ error: "invalid phone" });
    }
    try {
      const exists = email
        ? await contactExistsByEmail(email)
        : await contactExistsByPhone(phone, dial);
      return res.json({ exists });
    } catch (err) {
      console.error("exists error:", err.message);
      return res.status(500).json({ error: "internal error" });
    }
  }

  const studentId = String(req.query.studentId || "").trim();
  if (!/^\d{1,20}$/.test(studentId)) {
    return res.status(400).json({ error: "invalid studentId" });
  }

  try {
    const contact = await fetchContact(studentId);
    if (!contact) return res.json({ found: false });

    const [trialSubjectCodes, enrolledSubjectCodes, people] = await Promise.all([
      associatedSubjectCodes(studentId, TRIALS_OBJECT_TYPE),
      associatedSubjectCodes(studentId, ENROLMENTS_OBJECT_TYPE),
      associatedPeople(studentId)
    ]);

    const props = contact.properties || {};
    const out = {};
    for (const p of CONTACT_PROPERTIES) out[p] = props[p] || "";

    const person = (p) => p ? {
      firstname: p.firstname || "",
      lastname: p.lastname || "",
      email: p.email || "",
      email_2: p.email_2 || "",
      phone: p.phone || ""
    } : null;

    return res.json({
      found: true,
      contact: out,
      guardian: person(people.guardian),
      associatedStudent: person(people.student),
      trialSubjectCodes,
      enrolledSubjectCodes
    });
  } catch (err) {
    console.error("prefetch error:", err.message);
    return res.status(500).json({ error: "internal error" });
  }
});
