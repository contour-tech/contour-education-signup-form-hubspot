const axios = require("axios");

/*
 * WORKFLOW B · ACTION 3 — Create trials
 *
 * One Trial per submitted subject, associated to the student and to the
 * Subject record, and classified into the outcome the comms step branches on.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO IDS USED TO GATE THIS ACTION. NEITHER GATES IT NOW.
 *
 * The old workflow reached this point through two nested polling loops —
 * "is supabase_id known", then "is HubSpot student_id known" — each a branch,
 * a delay and a recheck, three retry tiers deep, because several other systems
 * generate those ids in parallel and none of them report back. When the last
 * tier still found nothing the record hit a bare End: no trials, no email, no
 * task, no Slack. A student signed up and nothing happened.
 *
 * student_id is REQUIRED — unique_trial_id is built from it. So this gets it
 * rather than waiting for it: if the contact has no student_id and an issuer
 * endpoint is configured, it asks the issuer and writes the answer back. The
 * issuer is a Firestore transaction, atomic and idempotent per contact, so the
 * answer arrives in one call instead of over several minutes of polling.
 *
 * supabase_id is NOT required. It is one field copied onto the Trial. Blocking
 * a student's trials and confirmation email on it was never justified — and
 * when the old loop timed out it created the Trial with a blank one anyway, so
 * blank ones already ship. This creates the Trial regardless and reports
 * supabase_id_missing so a backfill can stamp it when it lands.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Also different from the original:
 *
 * - Unknown subject codes no longer stop the run. Each subject is processed
 *   independently and a failure on one is recorded against that subject, so
 *   one bad code cannot cost a student the other four trials.
 *
 * - A Trial that is created but cannot be associated is deleted again. That
 *   compensating delete is inherited from the original and kept: a Trial
 *   attached to nothing is invisible in the UI and impossible to find later.
 */

const CONTACT = "0-1";
const TRIAL = "2-207877831";
const SUBJECT = "0-410";

const TRIAL_PIPELINE_ID = "1313869299";
const LEAD_NO_TRIAL_BOOKED_STAGE_ID = "2172208571";

const CONTACT_TO_TRIAL_UNBOOKED_ASSOCIATION = 951;
const TRIAL_TO_SUBJECT_ASSOCIATION = 994;

/*
 * SET THIS before going live. The original associated the student to the
 * Subject record as "considering" as well, but that action's association type
 * id is not in anything I have. Left at 0 the step is skipped rather than
 * guessed at — a wrong type id would write a silently wrong relationship.
 */
const CONTACT_TO_SUBJECT_CONSIDERING_ASSOCIATION = 0;

/*
 * SET THIS TOO, or leave blank to skip. The original appended newly added
 * subject names to a contact property for the repeat-student comms. Same
 * reason: the property name is not in anything I have.
 */
const ADDED_SUBJECTS_PROPERTY = "";

const TRIAL_SOURCE_VALUE = "Website Sign-Up";
const TRIAL_STATUS_SIGNED_UP = "Signed Up";

const SUBJECT_NAME_PROPERTY = "hs_course_name";
const SUBJECT_CODE_PROPERTY = "subject_code_new";

function clean(v) {
  return String(v ?? "").trim();
}

function splitList(v) {
  return clean(v)
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function uniqueCaseInsensitive(values) {
  const seen = new Set();
  return values.filter((v) => {
    const key = clean(v).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseBoolean(v) {
  if (typeof v === "boolean") return v;
  return ["true", "yes", "1"].includes(clean(v).toLowerCase());
}

function errorMessage(error) {
  const d = error?.response?.data?.message || error?.response?.data || error?.message || "Unknown error";
  return typeof d === "string" ? d : JSON.stringify(d);
}

function isTemporary(error) {
  const code = Number(error?.response?.status || error?.statusCode || 0);
  return (
    error?.isTemporary === true ||
    (!error?.response && Boolean(error?.request || error?.code)) ||
    code === 429 ||
    code >= 500
  );
}

function typedError(message, type, extra) {
  return Object.assign(new Error(message), { customType: type }, extra || {});
}

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const contactId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  // Optional. Present = student ids are issued on demand; absent = the id has
  // to already be on the record.
  const issuerUrl = clean(process.env.STUDENT_ID_ENDPOINT);
  const issuerKey = clean(process.env.STUDENT_ID_KEY);

  const results = [];
  const createdIds = [];
  const newSubjectNames = [];
  let createdCount = 0;
  let skippedCount = 0;

  function out(fields) {
    const payload = {
      trials_success: false,
      trials_status: "",
      outcome: "error",
      trials_created: 0,
      trials_skipped: 0,
      trials_errors: 0,
      created_trial_ids: "",
      new_subject_names: "",
      is_first_time_student: false,
      student_id: "",
      student_id_issued: false,
      supabase_id_missing: false,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("create trials:", JSON.stringify({ ...payload, detail: results }, null, 2));
    callback({ outputFields: payload });
  }

  /*
   * The issuer builds the prefix itself from the surname, so this sends the
   * name rather than a prefix. One place owns the rule, and a backfill script
   * calling the same endpoint cannot drift from what the workflow produces.
   */
  async function issueStudentId(lastName) {
    const res = await axios.post(
      issuerUrl,
      { contactId, lastName },
      { headers: { "X-Issuer-Key": issuerKey, "Content-Type": "application/json" }, timeout: 15000, validateStatus: () => true }
    );
    if (res.status === 429 || res.status >= 500) {
      throw typedError(`Student ID service temporarily failed (${res.status})`, "student_id_temporary", {
        isTemporary: true,
        statusCode: res.status
      });
    }
    if (res.status !== 200) {
      throw typedError(
        `Student ID service returned ${res.status}: ${JSON.stringify(res.data).substring(0, 200)}`,
        "student_id_issue_failed"
      );
    }
    return clean(res.data?.studentId);
  }

  async function getExistingTrials() {
    const ids = [];
    let after;
    do {
      const res = await axios.get(
        `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/${TRIAL}`,
        { headers, params: { limit: 500, ...(after ? { after } : {}) } }
      );
      for (const result of res.data?.results || []) {
        const id = clean(result.toObjectId ?? result.id);
        if (id) ids.push(id);
      }
      after = res.data?.paging?.next?.after;
    } while (after);

    const trials = [];
    for (let i = 0; i < ids.length; i += 100) {
      const res = await axios.post(
        `https://api.hubapi.com/crm/v3/objects/${TRIAL}/batch/read`,
        {
          properties: ["trial_name", "unique_trial_id", "trialling_subject", "trial_subject", "subject_code"],
          inputs: ids.slice(i, i + 100).map((id) => ({ id }))
        },
        { headers }
      );
      trials.push(...(res.data?.results || []));
    }
    return trials;
  }

  async function findSubjectByCode(subjectCode) {
    const res = await axios.post(
      `https://api.hubapi.com/crm/v3/objects/${SUBJECT}/search`,
      {
        filterGroups: [{ filters: [{ propertyName: SUBJECT_CODE_PROPERTY, operator: "EQ", value: subjectCode }] }],
        properties: [SUBJECT_CODE_PROPERTY, SUBJECT_NAME_PROPERTY, "contour_brand"],
        limit: 10
      },
      { headers }
    );
    const matches = res.data?.results || [];
    if (matches.length === 0) throw typedError(`No Subject record for subject code "${subjectCode}".`, "subject_not_found");
    if (matches.length > 1) throw typedError(`More than one Subject record for subject code "${subjectCode}".`, "multiple_subject_matches");

    const subjectId = clean(matches[0].id);
    const subjectName = clean(matches[0].properties?.[SUBJECT_NAME_PROPERTY]);
    if (!subjectId || !subjectName) throw typedError(`Subject record for "${subjectCode}" is missing an id or a name.`, "subject_incomplete");
    return { subjectId, subjectName };
  }

  /*
   * Adds a dropdown option when the property does not have it yet.
   *
   * The student sync deliberately does NOT do this for interested_subjects,
   * because there the value came straight off the form and one malformed
   * payload polluted a shared property forever. Here the value is a Subject
   * record's own name, looked up a moment ago — it is provably a real subject,
   * not whatever arrived in a POST body. Different input, different rule.
   */
  async function ensureOption(propertyName, value) {
    const res = await axios.get(`https://api.hubapi.com/crm/v3/properties/${TRIAL}/${propertyName}`, {
      headers,
      validateStatus: () => true
    });
    if (res.status !== 200) {
      throw typedError(`Could not read ${propertyName} (${res.status}).`, "property_fetch_failed");
    }
    const options = res.data?.options || [];
    if (options.some((o) => o.value === value || o.label === value)) return;

    await axios.patch(
      `https://api.hubapi.com/crm/v3/properties/${TRIAL}/${propertyName}`,
      { options: [...options, { label: value, value, displayOrder: options.length + 1, hidden: false }] },
      { headers }
    );
  }

  async function associate(fromType, fromId, toType, toId, typeId) {
    await axios.put(
      `https://api.hubapi.com/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`,
      [{ associationCategory: "USER_DEFINED", associationTypeId: typeId }],
      { headers }
    );
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const submittedSubjects = uniqueCaseInsensitive(splitList(input.interested_subjects_resolved));
    if (!submittedSubjects.length) {
      return out({
        trials_success: true,
        outcome: "no_subjects",
        trials_status: "No subjects were submitted, so no trials were created."
      });
    }

    const contactRes = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: { properties: ["firstname", "lastname", "student_id", "supabase_id", "already_enrolled"].join(",") }
    });
    const props = contactRes.data?.properties || {};

    const studentFullName = [clean(props.firstname), clean(props.lastname)].filter(Boolean).join(" ");
    const alreadyEnrolled = parseBoolean(props.already_enrolled);

    // Not required. Reported when absent so a backfill can stamp it later.
    const supabaseId = clean(props.supabase_id);

    let studentId = clean(props.student_id);
    let studentIdIssued = false;

    if (!studentId) {
      if (!issuerUrl || !issuerKey) {
        return out({
          error_type: "missing_student_id",
          error_message:
            "The contact has no student_id and no issuer endpoint is configured, so unique_trial_id cannot be built."
        });
      }
      const lastName = clean(props.lastname);
      if (!lastName) {
        return out({
          error_type: "missing_last_name",
          error_message: "A student_id has to be issued but the contact has no last name to build the prefix from."
        });
      }
      studentId = await issueStudentId(lastName);
      if (!studentId) {
        return out({ error_type: "student_id_issue_failed", error_message: "The student ID service returned no id." });
      }
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
        { properties: { student_id: studentId } },
        { headers }
      );
      studentIdIssued = true;
    }

    const existingTrials = await getExistingTrials();
    const isFirstTimeStudent = existingTrials.length === 0;

    /*
     * Two lookups because the two properties hold different vocabularies:
     * trialling_subject carries the code, trial_subject the human name, and
     * older records only ever had the name.
     */
    const byCode = new Map();
    const byName = new Map();
    for (const trial of existingTrials) {
      const code = clean(trial.properties?.trialling_subject).toLowerCase();
      const name = clean(trial.properties?.trial_subject).toLowerCase();
      if (code && !byCode.has(code)) byCode.set(code, trial);
      if (name && !byName.has(name)) byName.set(name, trial);
    }

    for (const subjectCode of submittedSubjects) {
      let newTrialId = "";
      try {
        const { subjectId, subjectName } = await findSubjectByCode(subjectCode);
        const uniqueTrialId = `${subjectCode} - ${studentId}`;

        const existing = byCode.get(subjectCode.toLowerCase()) || byName.get(subjectName.toLowerCase()) || null;

        if (existing) {
          const trialId = clean(existing.id);
          await associate(TRIAL, trialId, SUBJECT, subjectId, TRIAL_TO_SUBJECT_ASSOCIATION);
          skippedCount += 1;
          results.push({ subject: subjectCode, subject_name: subjectName, trial_id: trialId, status: "skipped_duplicate" });
          continue;
        }

        await ensureOption("trial_subject", subjectName);
        await ensureOption("trialling_subject", subjectCode);

        const createRes = await axios.post(
          `https://api.hubapi.com/crm/v3/objects/${TRIAL}`,
          {
            properties: {
              trial_name: `${studentFullName} | ${uniqueTrialId}`,
              unique_trial_id: uniqueTrialId,
              trialling_subject: subjectCode,
              trial_subject: subjectName,
              subject_code: subjectCode,
              trial_source: TRIAL_SOURCE_VALUE,
              hs_pipeline: TRIAL_PIPELINE_ID,
              hs_pipeline_stage: LEAD_NO_TRIAL_BOOKED_STAGE_ID,
              // The Trial's student_id field holds the contact's SUPABASE id,
              // not its student_id. Confusing, and inherited — renaming it is
              // a separate job with its own blast radius.
              student_id: supabaseId,
              trial_status: TRIAL_STATUS_SIGNED_UP
            }
          },
          { headers, validateStatus: () => true }
        );

        if (createRes.status === 429 || createRes.status >= 500) {
          throw typedError(`Trial creation temporarily failed (${createRes.status}).`, "trial_create_temporary", {
            isTemporary: true,
            statusCode: createRes.status
          });
        }
        if (createRes.status !== 201) {
          throw typedError(
            `Trial creation failed (${createRes.status}): ${JSON.stringify(createRes.data).substring(0, 200)}`,
            "trial_create_failed"
          );
        }

        newTrialId = clean(createRes.data?.id);
        if (!newTrialId) throw typedError("Trial was created but returned no id.", "missing_created_trial_id");

        await associate(CONTACT, contactId, TRIAL, newTrialId, CONTACT_TO_TRIAL_UNBOOKED_ASSOCIATION);
        await associate(TRIAL, newTrialId, SUBJECT, subjectId, TRIAL_TO_SUBJECT_ASSOCIATION);
        if (CONTACT_TO_SUBJECT_CONSIDERING_ASSOCIATION) {
          await associate(CONTACT, contactId, SUBJECT, subjectId, CONTACT_TO_SUBJECT_CONSIDERING_ASSOCIATION);
        }

        createdIds.push(newTrialId);
        newSubjectNames.push(subjectName);
        createdCount += 1;

        // Keep the maps current so two segments for the same subject in one
        // submission do not create two Trials.
        const record = { id: newTrialId, properties: { trialling_subject: subjectCode, trial_subject: subjectName } };
        byCode.set(subjectCode.toLowerCase(), record);
        byName.set(subjectName.toLowerCase(), record);

        results.push({ subject: subjectCode, subject_name: subjectName, trial_id: newTrialId, status: "created" });
      } catch (error) {
        /*
         * A Trial that exists but is associated to nothing cannot be found in
         * the UI and will never be cleaned up by hand. Undo it.
         */
        if (newTrialId) {
          try {
            await axios.delete(`https://api.hubapi.com/crm/v3/objects/${TRIAL}/${newTrialId}`, { headers });
          } catch (deleteError) {
            console.error(`Could not delete orphaned trial ${newTrialId}:`, errorMessage(deleteError));
          }
        }
        if (isTemporary(error)) throw error;
        results.push({
          subject: subjectCode,
          status: "error",
          error_type: error.customType || "subject_processing_error",
          error_message: errorMessage(error)
        });
      }
    }

    const errorCount = results.filter((r) => r.status === "error").length;
    const completed = results.length - errorCount;

    if (ADDED_SUBJECTS_PROPERTY && !isFirstTimeStudent && newSubjectNames.length) {
      await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
        { properties: { [ADDED_SUBJECTS_PROPERTY]: newSubjectNames.join(";") } },
        { headers }
      );
    }

    /*
     * One value for the comms branch to read. The original spread the same
     * decision across several booleans that had to be combined correctly at
     * every branch, and the "none of these matched" leg sent nothing at all.
     */
    let outcome;
    if (errorCount && !completed) outcome = "error";
    else if (errorCount) outcome = "partial";
    else if (isFirstTimeStudent && alreadyEnrolled) outcome = "first_time_already_enrolled";
    else if (isFirstTimeStudent) outcome = "first_time";
    else if (createdCount) outcome = "repeat_new_trials";
    else outcome = "repeat_no_new_trials";

    const status =
      errorCount && completed
        ? "Partial success — some subjects failed"
        : errorCount
          ? "No trials could be created"
          : createdCount && skippedCount
            ? "Trials created; existing duplicates skipped"
            : createdCount
              ? "Trials created"
              : "No new trials needed";

    return out({
      trials_success: errorCount === 0,
      trials_status: status,
      outcome,
      trials_created: createdCount,
      trials_skipped: skippedCount,
      trials_errors: errorCount,
      created_trial_ids: createdIds.join(";"),
      new_subject_names: newSubjectNames.join(";"),
      is_first_time_student: isFirstTimeStudent,
      student_id: studentId,
      student_id_issued: studentIdIssued,
      supabase_id_missing: !supabaseId,
      error_type: errorCount ? "subject_errors" : "",
      error_message: errorCount
        ? results
            .filter((r) => r.status === "error")
            .map((r) => `${r.subject}: ${r.error_message}`)
            .join(" | ")
            .substring(0, 500)
        : ""
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({
      error_type: error.customType || "create_trials_error",
      error_message: errorMessage(error).substring(0, 500)
    });
  }
};
