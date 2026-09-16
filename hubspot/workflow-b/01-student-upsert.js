const axios = require("axios");

/*
 * WORKFLOW B · ACTION 1 — Student upsert
 *
 * Writes the submission onto the one surviving record. There is no temporary
 * contact any more and no canonical id to thread through — Workflow A merged
 * before this workflow was ever enrolled, so "the enrolled contact" and "the
 * student" are the same record. Roughly half the original script was there to
 * juggle those two ids and is simply gone.
 *
 * Two behaviours are deliberately different from the original:
 *
 * 1. It no longer edits the interested_subjects property SCHEMA at runtime.
 *    The old version added any submitted code it did not recognise as a new
 *    permanently-allowed dropdown option, portal-wide, so one malformed
 *    payload polluted a shared property forever. Unrecognised codes are now
 *    left out of the write and returned in unknown_subject_codes for a branch
 *    to catch — not silently added, and not silently dropped either.
 *
 * 2. Setting contact_type = Student is what causes a student_id to be issued,
 *    by something outside this workflow. That is why the id check belongs
 *    AFTER this action, not before it: on a brand-new record the id does not
 *    exist until this write lands.
 *
 * Blank submitted values never erase existing data — a resubmission that
 * omits a field must not wipe what an earlier one captured.
 */

const CONTACT = "0-1";
const SUBJECTS_PROPERTY = "interested_subjects";
const VALID_PROGRAMS = ["Education", "MedPrep", "TestPrep"];

function clean(v) {
  return String(v ?? "").trim();
}

function splitList(v) {
  return clean(v)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeLists(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const value of [...existing, ...incoming]) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/*
 * Pulls "code:XXX" out of a structured segment. The two subject properties
 * hold different things: interested_subjects is bare codes, while
 * web_form__interested_subject keeps the full submission detail the comms
 * builder reads. They are merged separately, and duplicates in the structured
 * one are detected by the embedded code — two segments for the same subject
 * are never byte-identical.
 */
function segmentCode(segment) {
  const m = clean(segment).match(/(?:^|\|)\s*code\s*:\s*([^|]+)/i);
  return m ? clean(m[1]) : "";
}

/*
 * Normalises to +61 format. Only touches numbers that are already Australian
 * or have no country code at all — a number that arrives with a different
 * country code is left exactly as it is rather than forced into AU shape.
 */
function normaliseAuPhone(raw) {
  const trimmed = clean(raw);
  if (!trimmed) return trimmed;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (hasPlus && !digits.startsWith("61")) return trimmed;

  // Strip the country code unconditionally, not only at an expected length —
  // a mistyped number starting "61" but not 11 digits long previously fell
  // through and got a second +61 prepended on top of the one already there.
  if (digits.startsWith("61")) digits = digits.slice(2);
  // A local leading 0 and a country code cannot both be right.
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length === 9) {
    return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  // An 8-digit landline is still valid; it just is not grouped like a mobile.
  return digits ? `+61 ${digits}` : trimmed;
}

function errorMessage(error) {
  const d = error?.response?.data?.message || error?.response?.data || error?.message || "Unknown error";
  return typeof d === "string" ? d : JSON.stringify(d);
}

function isTemporary(error) {
  const code = Number(error?.response?.status || error?.statusCode || 0);
  return (!error?.response && Boolean(error?.request || error?.code)) || code === 429 || code >= 500;
}

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const contactId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  function out(fields) {
    const payload = {
      student_upsert_success: false,
      student_upsert_status: "",
      subjects_added: "",
      subjects_after_merge: "",
      unknown_subject_codes: "",
      has_unknown_subjects: false,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("student upsert:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const programs = splitList(input.program_interest);
    const badPrograms = programs.filter((p) => !VALID_PROGRAMS.includes(p));
    if (badPrograms.length) {
      return out({
        error_type: "invalid_program_interest",
        error_message: `Unrecognised program interest: ${badPrograms.join(", ")}. Expected ${VALID_PROGRAMS.join(", ")}.`
      });
    }

    const current = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: {
        properties: [
          "interested_subjects",
          "web_form__interested_subject",
          "program_interest"
        ].join(",")
      }
    });
    const existing = current.data?.properties || {};

    // Which codes the property will actually accept. Anything else is reported
    // rather than written, and rather than added to the schema.
    const propertyRes = await axios.get(
      `https://api.hubapi.com/crm/v3/properties/${CONTACT}/${SUBJECTS_PROPERTY}`,
      { headers }
    );
    const allowed = new Set(
      (propertyRes.data?.options || []).map((o) => clean(o.value).toUpperCase())
    );

    const submitted = splitList(input.interested_subjects_resolved);
    const known = submitted.filter((c) => allowed.has(c.toUpperCase()));
    const unknown = submitted.filter((c) => !allowed.has(c.toUpperCase()));

    const existingSubjects = splitList(existing.interested_subjects);
    const afterMerge = mergeLists(existingSubjects, known);
    const added = known.filter((c) => !existingSubjects.some((e) => e.toLowerCase() === c.toLowerCase()));

    const existingSegments = splitList(existing.web_form__interested_subject);
    const existingCodes = new Set(existingSegments.map((s) => segmentCode(s).toLowerCase()).filter(Boolean));
    const newSegments = splitList(input.web_form__interested_subject).filter((s) => {
      const code = segmentCode(s).toLowerCase();
      return code && !existingCodes.has(code);
    });

    const phone = normaliseAuPhone(input.student_phone_resolved);

    const properties = {
      // This is what causes a student_id to be issued, which is why the id
      // check sits after this action rather than before it.
      contact_type: "Student"
    };

    const maybe = {
      firstname: clean(input.student_first_name_resolved),
      lastname: clean(input.student_last_name_resolved),
      email: clean(input.student_email_resolved).toLowerCase(),
      year_level: clean(input.year_level),
      state_territory_country: clean(input.state_territory_country),
      school_text: clean(input.school_text),
      campus: clean(input.campus),
      referral: clean(input.referral),
      are_you_: clean(input.registered_by_resolved)
    };
    for (const [key, value] of Object.entries(maybe)) if (value) properties[key] = value;

    // phone and student_phone_number are two separate properties and both have
    // to carry the same value.
    if (phone) {
      properties.phone = phone;
      properties.student_phone_number = phone;
    }
    if (afterMerge.length) properties.interested_subjects = afterMerge.join(";");
    if (existingSegments.length || newSegments.length) {
      properties.web_form__interested_subject = [...existingSegments, ...newSegments].join(";");
    }
    const mergedPrograms = mergeLists(splitList(existing.program_interest), programs);
    if (mergedPrograms.length) properties.program_interest = mergedPrograms.join(";");

    const res = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
      { properties },
      { headers, validateStatus: () => true }
    );

    if (res.status === 429 || res.status >= 500) {
      throw Object.assign(new Error(`Student update temporarily failed (${res.status})`), {
        statusCode: res.status
      });
    }
    if (res.status !== 200) {
      return out({
        error_type: "student_update_failed",
        error_message: `Student update failed (${res.status}): ${JSON.stringify(res.data).substring(0, 300)}`
      });
    }

    return out({
      student_upsert_success: true,
      student_upsert_status: unknown.length ? "Updated; some subject codes were not recognised" : "Updated",
      subjects_added: added.join(";"),
      subjects_after_merge: afterMerge.join(";"),
      unknown_subject_codes: unknown.join(";"),
      has_unknown_subjects: unknown.length > 0
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ error_type: "student_upsert_error", error_message: errorMessage(error).substring(0, 500) });
  }
};
