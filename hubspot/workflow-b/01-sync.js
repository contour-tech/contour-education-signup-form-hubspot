const axios = require("axios");

/*
 * WORKFLOW B · ACTION 1 — Student and guardian sync
 *
 * One action doing what the old workflow spread over six: student upsert,
 * guardian upsert, association, and the parent_email bookkeeping between them.
 * They share a contact read, a token and a set of ids, and splitting them only
 * bought more places for a run to stop halfway.
 *
 * It still reports per step. failed_step names which half broke, so a branch
 * can tell "the student write failed" from "the student is fine, the guardian
 * is not" — the two need different handling, and a single boolean could not
 * say which had happened.
 *
 * IDENTITY COMES OFF THE RECORD, NOT OFF THE INPUTS. Workflow A resolved who
 * the student and guardian are, then ended — a separate workflow's action
 * outputs are not reachable here. It parked the answer in
 * lgm04_resolved_identity, this reads it back, and the finish action deletes
 * it. Re-deriving it here instead would put the identity rules in two places,
 * where they would drift.
 *
 * Raw form values (year level, campus, school, referral) are NOT in the blob.
 * They are ordinary properties the form already wrote, so they arrive as
 * normal action inputs.
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
 * 2. It no longer retypes a student as a parent. The old guardian step patched
 *    contact_type: "Parent" onto whatever the guardian email matched, so a
 *    parent typing their child's old address converted that student into a
 *    parent and overwrote their name. When the match is Student-typed this
 *    associates, changes nothing, and reports it.
 *
 * Blank submitted values never erase existing data — a resubmission that omits
 * a field must not wipe what an earlier one captured.
 */

const CONTACT = "0-1";
const SUBJECTS_PROPERTY = "interested_subjects";
const RESOLVED_PROPERTY = "lgm04_resolved_identity";
const PARENT_EMAIL_PROPERTY = "parent_email";
const VALID_PROGRAMS = ["Education", "MedPrep", "TestPrep"];

const PRIMARY_GUARDIAN_ASSOCIATION = 1046;
const GUARDIAN_ASSOCIATION = 1;

// Guardian and Parent are separate contact_type options meaning the same
// thing. Anything this touches is normalised to Parent, which is how the
// legacy Guardian value retires without a data migration.
const STUDENT_TYPES = ["student"];

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

function fail(step, type, message) {
  return { ok: false, step, errorType: type, errorMessage: message };
}

/* ------------------------------------------------------------------ student */

async function syncStudent({ headers, contactId, existing, allowedSubjects, identity, raw }) {
  const programs = splitList(raw.program_interest);
  const badPrograms = programs.filter((p) => !VALID_PROGRAMS.includes(p));
  if (badPrograms.length) {
    return fail(
      "student",
      "invalid_program_interest",
      `Unrecognised program interest: ${badPrograms.join(", ")}. Expected ${VALID_PROGRAMS.join(", ")}.`
    );
  }

  const submitted = splitList(identity.interestedSubjects);
  const known = submitted.filter((c) => allowedSubjects.has(c.toUpperCase()));
  const unknown = submitted.filter((c) => !allowedSubjects.has(c.toUpperCase()));

  const existingSubjects = splitList(existing.interested_subjects);
  const afterMerge = mergeLists(existingSubjects, known);
  const added = known.filter((c) => !existingSubjects.some((e) => e.toLowerCase() === c.toLowerCase()));

  const existingSegments = splitList(existing.web_form__interested_subject);
  const existingCodes = new Set(existingSegments.map((s) => segmentCode(s).toLowerCase()).filter(Boolean));
  const newSegments = splitList(raw.web_form__interested_subject).filter((s) => {
    const code = segmentCode(s).toLowerCase();
    return code && !existingCodes.has(code);
  });

  const phone = normaliseAuPhone(identity.student?.phone);

  const properties = {
    // This is what causes a student_id to be issued, which is why the id check
    // sits after this action rather than before it: on a brand-new record the
    // id does not exist until this write lands.
    contact_type: "Student"
  };

  const maybe = {
    firstname: clean(identity.student?.firstName),
    lastname: clean(identity.student?.lastName),
    email: clean(identity.student?.email).toLowerCase(),
    year_level: clean(raw.year_level),
    state_territory_country: clean(raw.state_territory_country),
    school_text: clean(raw.school_text),
    campus: clean(raw.campus),
    referral: clean(raw.referral),
    are_you_: clean(identity.registeredBy)
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
    return fail(
      "student",
      "student_update_failed",
      `Student update failed (${res.status}): ${JSON.stringify(res.data).substring(0, 300)}`
    );
  }

  return {
    ok: true,
    status: unknown.length ? "Updated; some subject codes were not recognised" : "Updated",
    // The validated codes from THIS submission. Create trials needs these and
    // not subjectsAfterMerge: the merged list carries subjects from every
    // previous signup too, and a trial is only owed for what was just asked
    // for.
    subjectsSubmitted: known.join(";"),
    subjectsAdded: added.join(";"),
    subjectsAfterMerge: afterMerge.join(";"),
    unknownSubjectCodes: unknown.join(";")
  };
}

/* ----------------------------------------------------------------- guardian */

async function upsertGuardian({ headers, studentId, guardian, guardianRequired }) {
  if (!guardianRequired) {
    return { ok: true, status: "No guardian on this submission", guardianContactId: "" };
  }
  if (!guardian.email) {
    return fail("guardian", "missing_guardian_email", "A guardian was submitted but with no email address.");
  }

  // email is unique on contacts, so this is at most one record. The old
  // "more than one match" branch could never fire, and returned a manual-review
  // message into a void where nothing read it.
  const search = await axios.post(
    "https://api.hubapi.com/crm/v3/objects/contacts/search",
    {
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: guardian.email }] }],
      properties: ["firstname", "lastname", "email", "phone", "contact_type"],
      limit: 1
    },
    { headers }
  );

  const match = (search.data?.results || [])[0] || null;
  const matchedType = clean(match?.properties?.contact_type).toLowerCase();
  const matchIsStudent = Boolean(match) && STUDENT_TYPES.includes(matchedType);

  let guardianContactId = "";
  let created = false;

  if (match) {
    guardianContactId = clean(match.id);

    if (matchIsStudent) {
      /*
       * The address belongs to a student record. Retyping it as a parent and
       * overwriting the name would destroy a real student — the exact failure
       * this guard exists for. Associate, change nothing about the record, and
       * let a human decide whether it is a mis-typed import or a genuine
       * mix-up.
       */
      console.log(`Guardian email ${guardian.email} matches STUDENT record ${guardianContactId} — not retyping it.`);
    } else {
      const update = { contact_type: "Parent" };
      if (guardian.firstName) update.firstname = guardian.firstName;
      if (guardian.lastName) update.lastname = guardian.lastName;
      if (guardian.phone) update.phone = guardian.phone;

      const res = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${guardianContactId}`,
        { properties: update },
        { headers, validateStatus: () => true }
      );
      if (res.status === 429 || res.status >= 500) {
        throw Object.assign(new Error(`Guardian update temporarily failed (${res.status})`), { statusCode: res.status });
      }
      if (res.status !== 200) {
        return fail(
          "guardian",
          "guardian_update_failed",
          `Guardian update failed (${res.status}): ${JSON.stringify(res.data).substring(0, 200)}`
        );
      }
    }
  } else {
    const create = { email: guardian.email, contact_type: "Parent" };
    if (guardian.firstName) create.firstname = guardian.firstName;
    if (guardian.lastName) create.lastname = guardian.lastName;
    if (guardian.phone) create.phone = guardian.phone;

    const res = await axios.post(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT}`,
      { properties: create },
      { headers, validateStatus: () => true }
    );
    if (res.status === 429 || res.status >= 500) {
      throw Object.assign(new Error(`Guardian create temporarily failed (${res.status})`), { statusCode: res.status });
    }
    if (res.status !== 201) {
      return fail(
        "guardian",
        "guardian_create_failed",
        `Guardian create failed (${res.status}): ${JSON.stringify(res.data).substring(0, 200)}`
      );
    }
    guardianContactId = clean(res.data?.id);
    created = true;
  }

  if (!guardianContactId) {
    return fail("guardian", "missing_guardian_id", "No guardian id after upsert.");
  }

  // Who, if anyone, is already the primary guardian on this student.
  const assoc = await axios.get(
    `https://api.hubapi.com/crm/v4/objects/contacts/${studentId}/associations/contacts`,
    { headers, params: { limit: 500 } }
  );
  const existingPrimary = (assoc.data?.results || []).find((a) =>
    (a.associationTypes || []).some(
      (t) => Number(t.typeId ?? t.associationTypeId) === PRIMARY_GUARDIAN_ASSOCIATION
    )
  );
  const existingPrimaryId = clean(existingPrimary?.toObjectId ?? existingPrimary?.id);

  // Primary when there is no primary yet, or when this is already the primary.
  // A different primary already existing means this one is a second guardian,
  // and parent_email keeps pointing at the real primary.
  const becomesPrimary = !existingPrimaryId || existingPrimaryId === guardianContactId;

  await axios.put(
    `https://api.hubapi.com/crm/v4/objects/contacts/${studentId}/associations/contacts/${guardianContactId}`,
    [
      {
        associationCategory: "USER_DEFINED",
        associationTypeId: becomesPrimary ? PRIMARY_GUARDIAN_ASSOCIATION : GUARDIAN_ASSOCIATION
      }
    ],
    { headers }
  );

  if (becomesPrimary) {
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${studentId}`,
      { properties: { [PARENT_EMAIL_PROPERTY]: guardian.email } },
      { headers }
    );
  }

  const role = becomesPrimary ? "primary guardian" : "guardian";
  return {
    ok: true,
    status: matchIsStudent
      ? `Associated as ${role}, but the address belongs to a student record — type left unchanged`
      : `${created ? "Created" : "Updated"} and associated as ${role}`,
    guardianContactId,
    guardianCreated: created,
    matchedStudentRecord: matchIsStudent
  };
}

/* --------------------------------------------------------------------- main */

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const contactId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  function out(fields) {
    const payload = {
      sync_success: false,
      failed_step: "",
      student_upsert_status: "",
      subjects_submitted: "",
      subjects_added: "",
      subjects_after_merge: "",
      unknown_subject_codes: "",
      has_unknown_subjects: false,
      guardian_upsert_status: "",
      guardian_contact_id: "",
      guardian_created: false,
      guardian_matched_student_record: false,
      identity_mode: "",
      resolved_at: "",
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("student sync:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ failed_step: "setup", error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ failed_step: "setup", error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const current = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: {
        properties: [
          RESOLVED_PROPERTY,
          "interested_subjects",
          "web_form__interested_subject",
          "program_interest"
        ].join(",")
      }
    });
    const existing = current.data?.properties || {};

    /*
     * No blob means nobody resolved this record — most likely the ready flag
     * was ticked by hand, or Workflow B ran twice and the finish action already
     * cleared it. Either way the identity is unknown, and guessing it from
     * whatever is on the record is how the old workflow turned students into
     * parents. Stop and say so.
     */
    let identity;
    try {
      identity = JSON.parse(clean(existing[RESOLVED_PROPERTY]) || "null");
    } catch (e) {
      identity = null;
    }
    if (!identity || !identity.student) {
      return out({
        failed_step: "setup",
        error_type: "missing_resolved_identity",
        error_message: `${RESOLVED_PROPERTY} is empty or unreadable — this record was not resolved by Workflow A, so there is nothing to sync.`
      });
    }
    if (!clean(identity.student.firstName) || !clean(identity.student.lastName)) {
      return out({
        failed_step: "setup",
        error_type: "incomplete_resolved_identity",
        error_message: "The resolved identity has no student first and last name."
      });
    }

    // Which subject codes the property will actually accept. Anything else is
    // reported rather than written, and rather than added to the schema.
    const propertyRes = await axios.get(
      `https://api.hubapi.com/crm/v3/properties/${CONTACT}/${SUBJECTS_PROPERTY}`,
      { headers }
    );
    const allowedSubjects = new Set(
      (propertyRes.data?.options || []).map((o) => clean(o.value).toUpperCase())
    );

    const student = await syncStudent({
      headers,
      contactId,
      existing,
      allowedSubjects,
      identity,
      raw: {
        program_interest: input.program_interest,
        web_form__interested_subject: input.web_form__interested_subject,
        year_level: input.year_level,
        state_territory_country: input.state_territory_country,
        school_text: input.school_text,
        campus: input.campus,
        referral: input.referral
      }
    });

    if (!student.ok) {
      return out({
        failed_step: student.step,
        identity_mode: clean(identity.identityMode),
        resolved_at: clean(identity.resolvedAt),
        error_type: student.errorType,
        error_message: student.errorMessage
      });
    }

    const studentFields = {
      student_upsert_status: student.status,
      subjects_submitted: student.subjectsSubmitted,
      subjects_added: student.subjectsAdded,
      subjects_after_merge: student.subjectsAfterMerge,
      unknown_subject_codes: student.unknownSubjectCodes,
      has_unknown_subjects: Boolean(student.unknownSubjectCodes),
      identity_mode: clean(identity.identityMode),
      // The finish action compares this against the blob as it stands then.
      // A different value means a second submission landed mid-run, and
      // clearing the flag would throw that submission away unnoticed.
      resolved_at: clean(identity.resolvedAt)
    };

    const guardian = await upsertGuardian({
      headers,
      studentId: contactId,
      guardian: {
        firstName: clean(identity.guardian?.firstName),
        lastName: clean(identity.guardian?.lastName),
        email: clean(identity.guardian?.email).toLowerCase(),
        phone: normaliseAuPhone(identity.guardian?.phone)
      },
      guardianRequired: Boolean(identity.guardianRequired)
    });

    // The student write has already landed and cannot be taken back, so a
    // guardian failure reports the student result too. A branch on failed_step
    // can then chase only the guardian rather than redoing the lot.
    if (!guardian.ok) {
      return out({
        ...studentFields,
        failed_step: guardian.step,
        error_type: guardian.errorType,
        error_message: guardian.errorMessage
      });
    }

    return out({
      ...studentFields,
      sync_success: true,
      guardian_upsert_status: guardian.status,
      guardian_contact_id: guardian.guardianContactId || "",
      guardian_created: Boolean(guardian.guardianCreated),
      guardian_matched_student_record: Boolean(guardian.matchedStudentRecord)
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ failed_step: "unknown", error_type: "sync_error", error_message: errorMessage(error).substring(0, 500) });
  }
};
