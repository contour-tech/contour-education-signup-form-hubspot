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

  const studentId = String(req.query.studentId || "").trim();
  if (!/^\d{1,20}$/.test(studentId)) {
    return res.status(400).json({ error: "invalid studentId" });
  }

  try {
    const contact = await hubspotGet(
      `/crm/v3/objects/contacts/${studentId}?properties=${CONTACT_PROPERTIES.join(",")}`
    );
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
