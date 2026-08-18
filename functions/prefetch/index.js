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
// "61412345678", "0412345678", "+61 412 345 678". Matching the country code and
// spacing exactly is hopeless, so the national digits are searched as a
// substring instead. HubSpot only honours CONTAINS_TOKEN on phone properties
// when the value is wildcarded, so the "*digits*" form is required.
function phoneSearchDigits(raw) {
  let digits = String(raw).replace(/[^\d]/g, "");
  // Drop a leading country code so a number typed with one still matches the
  // same number stored without it, and vice versa.
  if (digits.startsWith("61") && digits.length > 9) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  // Guard against a short fragment matching half the database.
  return digits.length >= 8 ? digits : "";
}

async function contactExistsByPhone(phone) {
  const digits = phoneSearchDigits(phone);
  if (!digits) return false;
  return contactExistsByProperties(PHONE_MATCH_PROPERTIES, `*${digits}*`, "CONTAINS_TOKEN");
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
        : await contactExistsByPhone(phone);
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
