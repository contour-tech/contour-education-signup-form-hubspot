const axios = require("axios");

/*
 * WORKFLOW A · ACTION 3 — Identity resolution
 *
 * Decides three things and nothing else:
 *   who the student is, who the guardian is, and whether an existing
 *   record already owns the student's email address.
 *
 * Everything the old action 3 did beyond that is gone. No canonical-vs-
 * temporary threading, no form_contact_is_canonical, no year/location
 * comparison, no manual-review message builder, no writes to the matched
 * record before a human has agreed to anything. The merge decides what
 * happens to the two records, and the merge is a separate action.
 *
 * merge_decision is the only output branch 5 reads:
 *   merge   — absorb the matched record into this one
 *   review  — a human has to look: the address belongs to a parent, and
 *             merging would collapse two people into one record
 *   none    — no match, this is a new record
 *
 * "review" only happens when someone reaches the workflow without passing
 * the form's own check, since the form blocks Student and Parent addresses
 * in the student field. An API submission or a stale cached form can still
 * get here, and merging a Parent into a Student is the one mistake with no
 * undo.
 */

const CONTACT = "0-1";

// contact_type carries Parent and Guardian as separate options and they mean
// the same thing here: the address belongs to a grown-up.
const GUARDIAN_TYPES = ["parent", "guardian", "parent/guardian"];

function clean(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return clean(v).toLowerCase();
}

/*
 * The form submits subjects as structured segments —
 * "code:VCE-EN34|program:Education|state:VIC|..." — and everything
 * downstream wants the bare codes.
 */
function subjectCodes(raw) {
  const seen = new Set();
  return clean(raw)
    .split(";")
    .map((segment) => {
      const m = clean(segment).match(/(?:^|\|)\s*code\s*:\s*([^|]+)/i);
      return m ? clean(m[1]) : clean(segment);
    })
    .filter((code) => {
      const key = code.toLowerCase();
      if (!code || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(";");
}

function errorMessage(error) {
  const d =
    error?.response?.data?.message || error?.response?.data || error?.message || "Unknown error";
  return typeof d === "string" ? d : JSON.stringify(d);
}

function isTemporary(error) {
  const code = Number(error?.response?.status || 0);
  return (!error?.response && Boolean(error?.request || error?.code)) || code === 429 || code >= 500;
}

exports.main = async (event, callback) => {
  const token =
    process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const enrolledId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  let student = { firstName: "", lastName: "", email: "", phone: "" };
  let guardian = { firstName: "", lastName: "", email: "", phone: "" };
  let identityMode = "";

  function out(fields) {
    const payload = {
      success: true,
      merge_decision: "none",
      match_found: false,
      matched_contact_id: "",
      matched_contact_type: "",
      identity_mode: identityMode,
      student_first_name_resolved: student.firstName,
      student_last_name_resolved: student.lastName,
      student_email_resolved: student.email,
      student_phone_resolved: student.phone,
      guardian_required: false,
      guardian_first_name_resolved: guardian.firstName,
      guardian_last_name_resolved: guardian.lastName,
      guardian_email_resolved: guardian.email,
      guardian_phone_resolved: guardian.phone,
      interested_subjects_resolved: "",
      registered_by_resolved: "",
      enrolled_contact_id: enrolledId,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("identity resolution:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ success: false, error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!enrolledId) return out({ success: false, error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const generic = {
      firstName: clean(input.firstname),
      lastName: clean(input.lastname),
      email: lower(input.email2),
      phone: clean(input.phone)
    };
    const dedicatedStudent = {
      firstName: clean(input.student_first_name),
      lastName: clean(input.student_last_name),
      email: lower(input.student_email),
      phone: clean(input.student_phone_number)
    };
    const dedicatedGuardian = {
      firstName: clean(input.guardian_s_first_name),
      lastName: clean(input.guardian_s_last_name),
      email: lower(input.guardian_email),
      phone: clean(input.guardian_phone)
    };

    /*
     * A NAME is what proves a field group was filled in this run. Phone alone
     * is not: Student Upsert writes student_phone_number on every successful
     * run, so on a second submission that value is still sitting there and a
     * looser check reads it as "dedicated student data present" — pulling in a
     * student with a phone and no name while the real name sits unread in the
     * generic fields.
     */
    const hasStudent = Boolean(dedicatedStudent.firstName && dedicatedStudent.lastName);
    const hasGuardian = Boolean(dedicatedGuardian.firstName && dedicatedGuardian.lastName);

    if (hasStudent) {
      student = dedicatedStudent;
      guardian = hasGuardian ? dedicatedGuardian : generic;
      identityMode = hasGuardian ? "dedicated_student_dedicated_guardian" : "dedicated_student_generic_guardian";
    } else if (hasGuardian) {
      student = generic;
      guardian = dedicatedGuardian;
      identityMode = "generic_student_dedicated_guardian";
    } else {
      student = generic;
      identityMode = "generic_is_student";
    }

    const guardianRequired = Boolean(
      guardian.firstName || guardian.lastName || guardian.email || guardian.phone
    );
    const subjects = subjectCodes(input.web_form__interested_subject);
    const registeredBy = clean(input.web_form_contact_type);

    if (!student.firstName || !student.lastName) {
      return out({
        success: false,
        guardian_required: guardianRequired,
        interested_subjects_resolved: subjects,
        registered_by_resolved: registeredBy,
        error_type: "missing_student_name",
        error_message: "Could not resolve a student first and last name from the submission."
      });
    }

    const base = {
      guardian_required: guardianRequired,
      interested_subjects_resolved: subjects,
      registered_by_resolved: registeredBy
    };

    if (!student.email) return out(base);

    /*
     * `email` is the contact's own address and the only property that
     * identifies the person a record is for. HubSpot enforces it unique, so
     * this returns at most one match — the "more than one match" case the old
     * scripts guarded against cannot happen.
     */
    const res = await axios.post(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: student.email }] }],
        properties: ["email", "firstname", "lastname", "contact_type"],
        limit: 2
      },
      { headers }
    );

    const match = (res.data?.results || []).find((r) => String(r.id) !== enrolledId);
    if (!match) return out(base);

    const matchedType = lower(match.properties?.contact_type);

    if (GUARDIAN_TYPES.includes(matchedType)) {
      return out({
        ...base,
        merge_decision: "review",
        match_found: true,
        matched_contact_id: String(match.id),
        matched_contact_type: clean(match.properties?.contact_type)
      });
    }

    return out({
      ...base,
      merge_decision: "merge",
      match_found: true,
      matched_contact_id: String(match.id),
      matched_contact_type: clean(match.properties?.contact_type) || "Unassigned"
    });
  } catch (error) {
    // Throwing makes HubSpot retry, which is right for a rate limit or a 5xx
    // and wrong for anything else.
    if (isTemporary(error)) throw error;
    return out({
      success: false,
      error_type: "identity_resolution_error",
      error_message: errorMessage(error).substring(0, 500)
    });
  }
};
