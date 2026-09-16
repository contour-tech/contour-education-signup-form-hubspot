const axios = require("axios");

/*
 * WORKFLOW B · Guardian upsert
 *
 * Finds or creates the guardian, associates them to the student, and keeps
 * parent_email pointing at whoever is actually the primary guardian.
 *
 * Written standalone so it can be pasted as its own action, but the whole
 * body is one function (upsertGuardian) so it can be lifted into a combined
 * student-sync block without changing a line of the logic.
 *
 * Three things differ from the live version:
 *
 * 1. IT NO LONGER RETYPES A STUDENT AS A PARENT. The live script patches
 *    contact_type: "Parent" onto whatever the guardian email matches. A parent
 *    who types their child's old address therefore converts that student into
 *    a parent and overwrites their name — silently, today. When the match is
 *    Student-typed this now leaves the type and name alone, still makes the
 *    association, and reports it for a human.
 *
 * 2. The guardian's phone is normalised. The student path has always done
 *    this; the guardian path never did, so the same portal held two formats.
 *
 * 3. The "more than one match" branch is gone. HubSpot enforces `email`
 *    unique on contacts, so the search returns at most one — that branch was
 *    unreachable, and it returned "Manual Review Required" into a void where
 *    nothing read it.
 *
 * Guardian and Parent are separate contact_type options meaning the same
 * thing. Anything this touches is normalised to Parent, which is how the
 * legacy Guardian value retires without a data migration.
 */

const CONTACT = "0-1";
const PRIMARY_GUARDIAN_ASSOCIATION = 1046;
const GUARDIAN_ASSOCIATION = 1;
const PARENT_EMAIL_PROPERTY = "parent_email";

const STUDENT_TYPES = ["student"];

function clean(v) {
  return String(v ?? "").trim();
}

function parseBoolean(v) {
  if (typeof v === "boolean") return v;
  return ["true", "yes", "1"].includes(clean(v).toLowerCase());
}

/* Same rules as the student path — see 01-student-upsert.js. */
function normaliseAuPhone(raw) {
  const trimmed = clean(raw);
  if (!trimmed) return trimmed;
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (hasPlus && !digits.startsWith("61")) return trimmed;
  if (digits.startsWith("61")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9) return `+61 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
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

async function upsertGuardian({ headers, studentId, guardian, guardianRequired }) {
  if (!guardianRequired) {
    return { success: true, status: "No guardian on this submission", guardianContactId: "" };
  }
  if (!studentId) {
    return { success: false, status: "Error", errorType: "missing_student_id", errorMessage: "No student contact id." };
  }
  if (!guardian.email) {
    return {
      success: false,
      status: "Error",
      errorType: "missing_guardian_email",
      errorMessage: "A guardian was submitted but with no email address."
    };
  }

  // email is unique on contacts, so this is at most one record.
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
        return {
          success: false,
          status: "Error",
          errorType: "guardian_update_failed",
          errorMessage: `Guardian update failed (${res.status}): ${JSON.stringify(res.data).substring(0, 200)}`
        };
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
      return {
        success: false,
        status: "Error",
        errorType: "guardian_create_failed",
        errorMessage: `Guardian create failed (${res.status}): ${JSON.stringify(res.data).substring(0, 200)}`
      };
    }
    guardianContactId = clean(res.data?.id);
    created = true;
  }

  if (!guardianContactId) {
    return { success: false, status: "Error", errorType: "missing_guardian_id", errorMessage: "No guardian id after upsert." };
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
    success: true,
    status: matchIsStudent
      ? `Associated as ${role}, but the address belongs to a student record — type left unchanged`
      : `${created ? "Created" : "Updated"} and associated as ${role}`,
    guardianContactId,
    guardianCreated: created,
    matchedStudentRecord: matchIsStudent
  };
}

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const studentId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  function out(fields) {
    const payload = {
      guardian_upsert_success: false,
      guardian_upsert_status: "",
      guardian_contact_id: "",
      guardian_created: false,
      guardian_matched_student_record: false,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("guardian upsert:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });

    const guardian = {
      firstName: clean(input.guardian_first_name_resolved),
      lastName: clean(input.guardian_last_name_resolved),
      email: clean(input.guardian_email_resolved).toLowerCase(),
      phone: normaliseAuPhone(input.guardian_phone_resolved)
    };

    const result = await upsertGuardian({
      headers,
      studentId,
      guardian,
      guardianRequired: parseBoolean(input.guardian_required)
    });

    return out({
      guardian_upsert_success: result.success,
      guardian_upsert_status: result.status,
      guardian_contact_id: result.guardianContactId || "",
      guardian_created: Boolean(result.guardianCreated),
      guardian_matched_student_record: Boolean(result.matchedStudentRecord),
      error_type: result.errorType || "",
      error_message: result.errorMessage || ""
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ error_type: "guardian_upsert_error", error_message: errorMessage(error).substring(0, 500) });
  }
};

module.exports.upsertGuardian = upsertGuardian;
