const axios = require("axios");

/*
 * WORKFLOW B · ACTION 2 — School verification
 *
 * Matches the submitted ACARA ID to a school company record and marks it the
 * student's CURRENT school, demoting whatever was current before to PAST.
 * When it cannot match, it sets school_not_verified and says why.
 *
 * Four things differ from the original:
 *
 * 1. IT RECOGNISES THE REAL "NO SCHOOL" SENTINELS. HubSpot ships this form
 *    with acara_id defaulted to "1" and school_code to "NULL"; form1.js clears
 *    them when nobody picks a school, but a submission that bypasses the JS
 *    still carries them. The old version only treated "" and "0" as absent, so
 *    "1" went through as a real ACARA ID and was searched for. It happened to
 *    find nothing and land on the right answer by luck, one wasted search
 *    later — and it would have associated a school outright if any company
 *    record ever carried acara "1".
 *
 * 2. Duplicate school companies no longer throw. Throwing makes HubSpot retry,
 *    and two companies sharing an ACARA ID is a data problem that will still
 *    be there on the third attempt. It now reports the failure so a branch can
 *    raise a task against it once.
 *
 * 3. "Never asked" is separated from "asked and unmatched". Overseas, UK and
 *    NZ students are never shown the school field at all and submit the
 *    SCHOOL_NOT_ASKED_VALUE sentinel. Both still set school_not_verified —
 *    downstream reads that — but only one of them is worth a human's time.
 *
 * 4. It takes one contact id, not two. The old action needed both a
 *    "confirmed" student id and a temporary form contact id, and read the
 *    ACARA ID off the second with its own API call. The merge happens before
 *    this workflow now, so there is one record and the value arrives as an
 *    ordinary input.
 */

const CONTACT = "contacts";
const SCHOOL = "companies";

const SCHOOL_ACARA_PROPERTY = "acara";
const NOT_VERIFIED_PROPERTY = "school_not_verified";

const CURRENT_SCHOOL_ASSOCIATION = 1016;
const PAST_SCHOOL_ASSOCIATION = 1018;

// What the form sends when no school was picked. "1" and "NULL" are HubSpot's
// own defaults on this form, not values anyone typed.
const NO_ACARA_VALUES = ["", "0", "1", "null"];
const SCHOOL_NOT_ASKED_VALUE = "not applicable";

function clean(v) {
  return String(v ?? "").trim();
}

function errorMessage(error) {
  const d = error?.response?.data?.message || error?.response?.data || error?.message || "Unknown error";
  return typeof d === "string" ? d : JSON.stringify(d);
}

function isTemporary(error) {
  const code = Number(error?.response?.status || error?.statusCode || 0);
  return (!error?.response && Boolean(error?.request || error?.code)) || code === 429 || code >= 500;
}

/*
 * A PUT on an association replaces its whole label set, so the desired status
 * label has to be sent together with every label that record already carries
 * for other reasons. Dropping the Current/Past pair and re-adding one is how
 * the status changes without discarding the rest.
 */
function buildAssociationTypes(existingTypes, desiredTypeId) {
  const kept = [];
  const seen = new Set();

  for (const type of existingTypes || []) {
    const category = clean(type.associationCategory || type.category);
    const typeId = Number(type.associationTypeId ?? type.typeId);
    if (!category || !Number.isFinite(typeId)) continue;
    if (typeId === CURRENT_SCHOOL_ASSOCIATION || typeId === PAST_SCHOOL_ASSOCIATION) continue;
    const key = `${category}:${typeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push({ associationCategory: category, associationTypeId: typeId });
  }

  kept.push({ associationCategory: "USER_DEFINED", associationTypeId: desiredTypeId });
  return kept;
}

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const contactId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  function out(fields) {
    const payload = {
      school_success: false,
      /*
       * One value for the branch to read, so the workflow never has to
       * string-match on school_status. That prose is for the human reading the
       * task; this is for the branch, and the two drift apart the moment
       * anyone edits the wording.
       */
      school_outcome: "error",
      school_status: "",
      school_record_id: "",
      school_not_verified: false,
      schools_demoted: 0,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("school verification:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  async function setNotVerified(value) {
    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
      { properties: { [NOT_VERIFIED_PROPERTY]: value ? "true" : "false" } },
      { headers }
    );
  }

  async function findSchoolsByAcara(acaraId) {
    const results = [];
    let after;
    do {
      const res = await axios.post(
        `https://api.hubapi.com/crm/v3/objects/${SCHOOL}/search`,
        {
          filterGroups: [
            { filters: [{ propertyName: SCHOOL_ACARA_PROPERTY, operator: "EQ", value: acaraId }] }
          ],
          properties: ["name", SCHOOL_ACARA_PROPERTY],
          limit: 100,
          ...(after ? { after } : {})
        },
        { headers }
      );
      results.push(...(res.data?.results || []));
      after = res.data?.paging?.next?.after;
      // Two is already too many. Stop rather than page through a data problem.
    } while (after && results.length < 3);
    return results;
  }

  async function getAssociatedSchools() {
    const associations = [];
    let after;
    do {
      const res = await axios.get(
        `https://api.hubapi.com/crm/v4/objects/${CONTACT}/${contactId}/associations/${SCHOOL}`,
        { headers, params: { limit: 500, ...(after ? { after } : {}) } }
      );
      for (const result of res.data?.results || []) {
        const schoolRecordId = clean(result.toObjectId ?? result.id);
        if (!schoolRecordId) continue;
        associations.push({ schoolRecordId, associationTypes: result.associationTypes || [] });
      }
      after = res.data?.paging?.next?.after;
    } while (after);
    return associations;
  }

  async function setStatus(schoolRecordId, existingTypes, desiredTypeId) {
    await axios.put(
      `https://api.hubapi.com/crm/v4/objects/${CONTACT}/${contactId}/associations/${SCHOOL}/${schoolRecordId}`,
      buildAssociationTypes(existingTypes, desiredTypeId),
      { headers }
    );
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const acaraId = clean(input.acara_id);
    const schoolText = clean(input.school_text);

    if (schoolText.toLowerCase() === SCHOOL_NOT_ASKED_VALUE) {
      await setNotVerified(true);
      return out({
        school_success: true,
        school_outcome: "not_applicable",
        school_not_verified: true,
        school_status: "Not applicable — the school question was never asked"
      });
    }

    if (NO_ACARA_VALUES.includes(acaraId.toLowerCase())) {
      await setNotVerified(true);
      return out({
        school_success: true,
        school_outcome: "not_verified",
        school_not_verified: true,
        school_status: schoolText
          ? `Not verified — "${schoolText}" was typed but no school was picked from the list`
          : "Not verified — no ACARA ID and no school name"
      });
    }

    const matches = await findSchoolsByAcara(acaraId);

    if (matches.length === 0) {
      await setNotVerified(true);
      return out({
        school_success: true,
        school_outcome: "not_verified",
        school_not_verified: true,
        school_status: `Not verified — no school record carries ACARA ID ${acaraId}`
      });
    }

    if (matches.length > 1) {
      /*
       * Two company records sharing an ACARA ID. Picking one would silently
       * split a school's students across duplicate records, so this stops. It
       * does NOT throw: a retry finds the same two records.
       */
      await setNotVerified(true);
      return out({
        school_outcome: "duplicate_schools",
        school_not_verified: true,
        error_type: "multiple_school_matches",
        error_message: `ACARA ID ${acaraId} matches more than one company record (${matches
          .map((m) => m.id)
          .join(", ")}). The duplicates need merging before this student can be associated.`
      });
    }

    const schoolRecordId = clean(matches[0]?.id);
    if (!schoolRecordId) {
      return out({ error_type: "missing_school_id", error_message: "The matched school record had no ID." });
    }

    const associated = await getAssociatedSchools();
    const byId = new Map(associated.map((a) => [a.schoolRecordId, a]));

    // Anything else still marked Current is a school they have left.
    const previousCurrent = associated.filter(
      (a) =>
        a.schoolRecordId !== schoolRecordId &&
        (a.associationTypes || []).some(
          (t) => Number(t.associationTypeId ?? t.typeId) === CURRENT_SCHOOL_ASSOCIATION
        )
    );

    for (const previous of previousCurrent) {
      await setStatus(previous.schoolRecordId, previous.associationTypes, PAST_SCHOOL_ASSOCIATION);
    }

    await setStatus(schoolRecordId, byId.get(schoolRecordId)?.associationTypes, CURRENT_SCHOOL_ASSOCIATION);
    await setNotVerified(false);

    return out({
      school_success: true,
      school_outcome: "verified",
      school_record_id: schoolRecordId,
      school_not_verified: false,
      schools_demoted: previousCurrent.length,
      school_status: previousCurrent.length
        ? `Verified; ${previousCurrent.length} previous school(s) marked past`
        : "Verified"
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ error_type: "school_verification_error", error_message: errorMessage(error).substring(0, 500) });
  }
};
