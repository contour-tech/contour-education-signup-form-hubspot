const axios = require("axios");

/*
 * WORKFLOW B · Create trials
 *
 * One Trial per submitted subject, associated to the student and the Course,
 * classified into the outcome the comms step branches on, and — when the
 * signup is for the target year — the Slack announcement text built ready for
 * a native Send Slack action to post.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO IDS USED TO GATE THIS ACTION. NEITHER GATES IT NOW.
 *
 * The old workflow reached this point through two nested polling loops —
 * "is supabase_id known", then "is HubSpot student_id known" — each a branch,
 * a delay and a recheck, three retry tiers deep, because other systems
 * generate those ids in parallel and none of them report back. When the last
 * tier still found nothing the record hit a bare End: no trials, no email, no
 * task, no Slack.
 *
 * student_id is REQUIRED — unique_trial_id is built from it. So this gets one
 * rather than waiting: the issuer is a Firestore transaction, atomic and
 * idempotent per contact, so it answers in one call.
 *
 * supabase_id is NOT required. It is one field copied onto the Trial, and the
 * old loop created the Trial with a blank one on timeout anyway.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHAT THE MERGE-FIRST DESIGN DELETES FROM HERE
 *
 * The old action carried a whole recovery path: when identity resolution
 * matched an existing contact, student_id was generated on the TEMPORARY form
 * contact while this action read the canonical one, so it fell back to reading
 * student_id off the temp record, used it in memory, and deliberately did not
 * write it back to avoid a unique-property clash while both records were live.
 * A fifth status — "First Time Trial Creation - Existing Contact Match" —
 * existed only to route around a native "send to enrolled contact" that would
 * have mailed the wrong, often email-less, record.
 *
 * All of it is gone. Workflow A merges before Workflow B is ever enrolled, so
 * there is one record, and the enrolled contact IS the student. No temp id, no
 * fallback, no fifth branch.
 *
 * Also changed:
 *
 * - Unknown subject codes no longer stop the run. Each subject is independent,
 *   so one bad code cannot cost a student their other four trials.
 *
 * - Identity and form values are read off the record rather than passed in as
 *   fifteen action inputs. The resolved blob and the contact already hold
 *   everything; fifteen mappings were fifteen things to get wrong silently.
 */

const CONTACT = "0-1";
const TRIAL = "2-207877831";
const SUBJECT = "0-410";

const TRIAL_PIPELINE_ID = "1313869299";
const LEAD_NO_TRIAL_BOOKED_STAGE_ID = "2172208571";

// Verified against the portal's association schema: 951 is "Unbooked Trial"
// on contact -> trial, paired with 950 "Trialling Student" coming back.
const CONTACT_TO_TRIAL_UNBOOKED_ASSOCIATION = 951;

// Verified: 351 is "Considering" on contact -> course, paired with 350.
const CONTACT_TO_SUBJECT_CONSIDERING_ASSOCIATION = 351;

/*
 * UNRESOLVED DISCREPANCY. This is the value the live action uses and the live
 * action demonstrably works — a failure here would throw into the per-subject
 * catch, delete the Trial and error every subject, and trials plainly do get
 * created. But the portal's own association schema reports nothing between
 * Trial and Course in either direction, and 994 appears nowhere in it:
 *
 *   2-207877831 -> 0-410 : (none)
 *   0-410 -> 2-207877831 : (none)
 *
 * So the call is made, but NOT allowed to fail the subject — see
 * associateSubjectToTrial. Worth opening a Trial in the UI and checking
 * whether it actually shows an associated Course.
 */
const TRIAL_TO_SUBJECT_ASSOCIATION = 994;

const ADDED_SUBJECTS_PROPERTY = "added_subject_list";
const RESOLVED_PROPERTY = "lgm04_resolved_identity";
const CAMPUS_PROPERTY = "web_form__preferred_campuses";
const YEAR_PROPERTY = "which_year_are_you_interested_in_tutoring_for_";

const TRIAL_SOURCE_VALUE = "Website Sign-Up";
const TRIAL_STATUS_SIGNED_UP = "Signed Up";
const SLACK_TARGET_YEAR_VALUE = "2027";

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

// Pulls "code:XXX" out of a structured pipe-delimited segment, or returns the
// value as-is when it is already a bare code. Display fallback only.
function extractSegmentCode(rawSegment) {
  const m = clean(rawSegment).match(/(?:^|\|)\s*code\s*:\s*([^|]+)/i);
  return m ? clean(m[1]) : clean(rawSegment);
}

// "Upper Mount Gravatt (Level 3/12 Mount Gravatt Capalaba Road)" reads as
// "Upper Mount Gravatt" in Slack. Labels without a trailing parenthetical are
// left alone.
function stripTrailingParenthetical(label) {
  return clean(label).replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function chunk(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
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

  const issuerUrl = clean(process.env.STUDENT_ID_ENDPOINT);
  const issuerKey = clean(process.env.STUDENT_ID_KEY);

  const results = [];
  const createdIds = [];
  const existingIds = [];
  const newSubjectNames = [];
  const subjectLinkFailures = [];
  const slackSubjectNames = [];
  let createdCount = 0;
  let skippedCount = 0;

  function out(fields) {
    const payload = {
      trials_success: false,
      outcome: "error",
      student_trial_status: "",
      trials_status: "",
      trials_created: 0,
      trials_skipped: 0,
      trials_errors: 0,
      created_trial_ids: "",
      existing_trial_ids: "",
      new_subject_names: "",
      subject_link_failures: "",
      needs_review: false,
      review_reasons: "",
      is_first_time_student: false,
      is_already_enrolled: false,
      student_id: "",
      student_id_issued: false,
      supabase_id_missing: false,
      should_send_2027_slack: false,
      slack_message_text: "",
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("create trials:", JSON.stringify({ ...payload, detail: results }, null, 2));
    callback({ outputFields: payload });
  }

  /*
   * The issuer builds the prefix from the surname itself, so this sends the
   * name rather than a prefix. One place owns that rule.
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
      after = clean(res.data?.paging?.next?.after) || undefined;
    } while (after);

    const trials = [];
    for (const idChunk of chunk([...new Set(ids)], 100)) {
      const res = await axios.post(
        `https://api.hubapi.com/crm/v3/objects/${TRIAL}/batch/read`,
        {
          properties: ["trial_name", "unique_trial_id", "trialling_subject", "trial_subject", "subject_code"],
          inputs: idChunk.map((id) => ({ id }))
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
    if (!subjectId) throw typedError(`The Subject record for "${subjectCode}" returned no record ID.`, "missing_subject_id");
    if (!subjectName) throw typedError(`The Subject record for "${subjectCode}" has no ${SUBJECT_NAME_PROPERTY}.`, "missing_subject_name");
    return { subjectId, subjectName };
  }

  /*
   * Adds a dropdown option the property does not have yet.
   *
   * The student sync deliberately does NOT do this for interested_subjects,
   * because there the value arrives straight off the form and one malformed
   * payload pollutes a shared property forever. Every value here is either a
   * Course record's own name, looked up a moment ago, or a fixed constant —
   * provably real, not whatever landed in a POST body. Different input,
   * different rule.
   */
  async function ensureOption(propertyName, value, caseInsensitive) {
    const res = await axios.get(`https://api.hubapi.com/crm/v3/properties/${TRIAL}/${propertyName}`, {
      headers,
      validateStatus: () => true
    });
    if (res.status !== 200) {
      throw typedError(`Could not read ${propertyName} (${res.status}).`, `${propertyName}_property_fetch_failed`);
    }
    const options = res.data?.options || [];
    const match = caseInsensitive
      ? (o) => clean(o.value).toLowerCase() === value.toLowerCase() || clean(o.label).toLowerCase() === value.toLowerCase()
      : (o) => o.value === value || o.label === value;
    if (options.some(match)) return;

    const patch = await axios.patch(
      `https://api.hubapi.com/crm/v3/properties/${TRIAL}/${propertyName}`,
      { options: [...options, { label: value, value, displayOrder: options.length + 1, hidden: false }] },
      { headers, validateStatus: () => true }
    );
    if (patch.status === 429 || patch.status >= 500) {
      throw typedError(`Adding "${value}" to ${propertyName} temporarily failed (${patch.status}).`, `${propertyName}_option_add_temporary`, {
        isTemporary: true,
        statusCode: patch.status
      });
    }
    if (patch.status !== 200) {
      throw typedError(`Adding "${value}" to ${propertyName} failed (${patch.status}).`, `${propertyName}_option_add_failed`);
    }
    console.log(`Added "${value}" to Trial ${propertyName}.`);
  }

  async function associate(fromType, fromId, toType, toId, typeId) {
    await axios.put(
      `https://api.hubapi.com/crm/v4/objects/${fromType}/${fromId}/associations/${toType}/${toId}`,
      [{ associationCategory: "USER_DEFINED", associationTypeId: typeId }],
      { headers }
    );
  }

  /*
   * The Trial-to-Course link is metadata. The association that MATTERS is
   * contact -> trial: without it the Trial cannot be found in the UI at all,
   * which is why a failure there deletes the Trial again.
   *
   * This one failing should not cost a student their trial, their school
   * association and their confirmation email. It is reported instead, which
   * also means a stale association type id shows up as a named warning rather
   * than as every subject mysteriously erroring.
   */
  async function associateSubjectToTrial(trialId, subjectId, subjectCode) {
    try {
      await associate(TRIAL, trialId, SUBJECT, subjectId, TRIAL_TO_SUBJECT_ASSOCIATION);
    } catch (error) {
      console.error(`Trial ${trialId} could not be linked to subject ${subjectCode}:`, errorMessage(error));
      subjectLinkFailures.push(subjectCode);
    }
  }

  /*
   * Campus arrives as structured segments ("code:GLWK|state:VIC|...") rather
   * than a display label, so this reads the property's own live option list
   * and matches against it. Renaming or adding a campus in HubSpot needs no
   * code change here. A segment with no matching option falls back to its bare
   * code — visible but plain — so a new campus is never silently dropped.
   */
  async function resolveCampusLabels(rawValue) {
    const segments = splitList(rawValue);
    if (!segments.length) return [];

    const res = await axios.get(`https://api.hubapi.com/crm/v3/properties/${CONTACT}/${CAMPUS_PROPERTY}`, {
      headers,
      validateStatus: () => true
    });
    if (res.status !== 200) {
      console.log(`WARNING: could not read ${CAMPUS_PROPERTY} options (${res.status}) — falling back to raw codes.`);
      return segments.map(extractSegmentCode);
    }
    const labelByValue = new Map((res.data?.options || []).map((o) => [clean(o.value), clean(o.label)]));
    return segments.map((s) => labelByValue.get(clean(s)) || extractSegmentCode(s));
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    /*
     * Carried through from the sync action purely so the workflow can branch
     * on ONE value at the end. A HubSpot if/then branch filters on record
     * properties; action outputs only work with a value-equals branch, which
     * takes a single value. Three separate flags therefore meant three nested
     * branches and two go-tos to reassemble one question: is any of this worth
     * a human's time? Answering it here costs two input mappings.
     */
    const hasUnknownSubjects = parseBoolean(input.has_unknown_subjects);
    const guardianMatchedStudent = parseBoolean(input.guardian_matched_student_record);

    const submittedSubjects = uniqueCaseInsensitive(splitList(input.interested_subjects_resolved));
    if (!submittedSubjects.length) {
      const earlyReasons = [];
      if (hasUnknownSubjects) earlyReasons.push("Unrecognised subject codes were submitted.");
      if (guardianMatchedStudent) earlyReasons.push("The guardian's email address belongs to a Student-typed contact.");
      return out({
        trials_success: true,
        outcome: "no_subjects",
        student_trial_status: "No Subjects Submitted",
        trials_status: "No subjects were submitted, so no trials were created.",
        needs_review: earlyReasons.length > 0,
        review_reasons: earlyReasons.join(" ")
      });
    }

    /*
     * One read for everything. The old action took fifteen action inputs for
     * values that were already on the record; each mapping was a thing that
     * could be pointed at the wrong property without anyone noticing.
     */
    const contactRes = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: {
        properties: [
          "firstname",
          "lastname",
          "email",
          "student_id",
          "supabase_id",
          "already_enrolled",
          "school_text",
          "year_level",
          "state_territory_country",
          CAMPUS_PROPERTY,
          YEAR_PROPERTY,
          RESOLVED_PROPERTY
        ].join(",")
      }
    });
    const props = contactRes.data?.properties || {};

    let identity = null;
    try {
      identity = JSON.parse(clean(props[RESOLVED_PROPERTY]) || "null");
    } catch (e) {
      identity = null;
    }

    const studentFullName = [clean(props.firstname), clean(props.lastname)].filter(Boolean).join(" ");
    const isAlreadyEnrolled = parseBoolean(props.already_enrolled);

    // Already stored on the contact. No Supabase call is made anywhere here.
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
     * Two lookups because the properties hold different vocabularies:
     * trialling_subject carries the code, trial_subject the human name, and
     * older records only ever had the name.
     */
    const byCode = new Map();
    const byName = new Map();
    // Captured before the loop: what the student had BEFORE this run, for the
    // Slack "All Subjects" line on the repeat-with-new-subjects branch.
    const subjectNamesBeforeThisRun = [];

    for (const trial of existingTrials) {
      const code = clean(trial.properties?.trialling_subject).toLowerCase();
      const name = clean(trial.properties?.trial_subject).toLowerCase();
      const display = clean(trial.properties?.trial_subject) || clean(trial.properties?.trialling_subject);
      if (display) subjectNamesBeforeThisRun.push(display);
      if (code && !byCode.has(code)) byCode.set(code, trial);
      if (name && !byName.has(name)) byName.set(name, trial);
    }

    /*
     * Once per run, not per subject. "Signed Up" is a fixed constant rather
     * than user input, so ensuring it is defensive against a config change and
     * cannot pollute the property with junk — without it, one missing option
     * fails every trial for every student.
     */
    await ensureOption("trial_status", TRIAL_STATUS_SIGNED_UP, true);

    for (const subjectCode of submittedSubjects) {
      let newTrialId = "";
      try {
        const { subjectId, subjectName } = await findSubjectByCode(subjectCode);
        slackSubjectNames.push(subjectName);

        const uniqueTrialId = `${subjectCode} - ${studentId}`;
        const existing = byCode.get(subjectCode.toLowerCase()) || byName.get(subjectName.toLowerCase()) || null;

        if (existing) {
          const trialId = clean(existing.id);
          if (!existingIds.includes(trialId)) existingIds.push(trialId);
          skippedCount += 1;
          // Identity and student associations left untouched on an existing
          // Trial — only the Course link is re-confirmed.
          await associateSubjectToTrial(trialId, subjectId, subjectCode);
          results.push({ subject: subjectCode, subject_name: subjectName, trial_id: trialId, status: "skipped_duplicate" });
          continue;
        }

        await ensureOption("trial_subject", subjectName, false);
        await ensureOption("trialling_subject", subjectCode, true);

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

        // Fatal if this fails — an unassociated Trial is invisible in the UI.
        await associate(CONTACT, contactId, TRIAL, newTrialId, CONTACT_TO_TRIAL_UNBOOKED_ASSOCIATION);
        // Only on creation, matching the original: an existing Trial means the
        // student is already marked Considering for that Course.
        await associate(CONTACT, contactId, SUBJECT, subjectId, CONTACT_TO_SUBJECT_CONSIDERING_ASSOCIATION);
        await associateSubjectToTrial(newTrialId, subjectId, subjectCode);

        createdIds.push(newTrialId);
        newSubjectNames.push(subjectName);
        createdCount += 1;

        // Keep the maps current so two segments for the same subject in one
        // submission cannot create two Trials.
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

    /*
     * The status string the team already reads, kept verbatim, and a machine
     * value for the branch to key on. Branching on the prose would break the
     * first time anyone reworded it.
     */
    let outcome;
    let studentTrialStatus;
    if (errorCount && !completed) {
      outcome = "error";
      studentTrialStatus = "Error";
    } else if (errorCount) {
      outcome = "partial";
      studentTrialStatus = "Partial Success";
    } else if (isFirstTimeStudent && isAlreadyEnrolled) {
      outcome = "first_time_already_enrolled";
      studentTrialStatus = "First Time Trial Creation - Already Enrolled";
    } else if (isFirstTimeStudent) {
      outcome = "first_time";
      studentTrialStatus = "First Time Trial Creation";
    } else if (createdCount > 0) {
      outcome = "repeat_new_trials";
      studentTrialStatus = "Repeat Student - New Trial(s) Added";
    } else {
      outcome = "repeat_no_new_trials";
      studentTrialStatus = "Repeat Student - No New Trials";
    }

    const trialsStatus =
      errorCount && completed
        ? "Partial Success"
        : errorCount
          ? "Error"
          : createdCount && skippedCount
            ? "Trials Created; Existing Duplicates Skipped"
            : createdCount
              ? "Trials Created"
              : "All Trials Already Existed";

    // Only for a repeat student who gained subjects this run. Latest wins per
    // run — this is not a running history.
    if (outcome === "repeat_new_trials" && newSubjectNames.length) {
      try {
        await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
          { properties: { [ADDED_SUBJECTS_PROPERTY]: newSubjectNames.join(";") } },
          { headers }
        );
      } catch (error) {
        console.log(`WARNING: could not update ${ADDED_SUBJECTS_PROPERTY}:`, errorMessage(error));
      }
    }

    /*
     * Built here rather than per branch: every outcome leg comes from this one
     * action, so each branch downstream only needs a native Send Slack action
     * pointing at slack_message_text. When the year does not match, the text
     * is blank and should_send_2027_slack is false, so nothing posts and no
     * branch check is needed first.
     */
    let shouldSendSlack = false;
    let slackMessageText = "";
    const yearSelected = clean(props[YEAR_PROPERTY]);

    if (yearSelected === SLACK_TARGET_YEAR_VALUE && outcome !== "error") {
      const registeredBy = clean(identity?.registeredBy);
      const isGuardianRegistration = registeredBy.toLowerCase() === "guardian";
      const guardianFullName = [clean(identity?.guardian?.firstName), clean(identity?.guardian?.lastName)]
        .filter(Boolean)
        .join(" ");

      const typeLine = isGuardianRegistration
        ? `Guardian (Student Name: ${studentFullName || "(unknown)"})`
        : "Student";

      const slackFullName = isGuardianRegistration ? guardianFullName : studentFullName;
      const slackPhone = clean(isGuardianRegistration ? identity?.guardian?.phone : identity?.student?.phone);
      const slackEmail = clean(isGuardianRegistration ? identity?.guardian?.email : props.email);

      const campusDisplay =
        (await resolveCampusLabels(props[CAMPUS_PROPERTY])).map(stripTrailingParenthetical).join(", ") || "";

      /*
       * A repeat student who added subjects gets a different heading and two
       * subject lines. "All Subjects" is what they had before plus what was
       * just added — NOT what was submitted, since a resubmission can include
       * subjects they already had.
       */
      let headingLine;
      let subjectLines;
      if (outcome === "repeat_new_trials") {
        const allSubjects = uniqueCaseInsensitive([...subjectNamesBeforeThisRun, ...newSubjectNames]);
        headingLine = "🎉 *Subject(s) Added!*";
        subjectLines = [
          `*Added Subjects:* ${newSubjectNames.filter(Boolean).join(", ") || "(none)"}`,
          `*All Subjects:* ${allSubjects.filter(Boolean).join(", ") || "(none)"}`
        ];
      } else {
        headingLine = `🎉 *New ${SLACK_TARGET_YEAR_VALUE} Sign-up!*`;
        subjectLines = [`*Subjects:* ${slackSubjectNames.filter(Boolean).join(", ") || "(none)"}`];
      }

      slackMessageText = [
        headingLine,
        "",
        `*Type:* ${typeLine}`,
        `*Full Name:* ${slackFullName || "(unknown)"}`,
        `*Phone:* ${slackPhone || "(none)"}`,
        `*Email:* ${slackEmail || "(none)"}`,
        `*School:* ${clean(props.school_text) || "(none)"}`,
        `*Year Level:* ${clean(props.year_level) || "(none)"}`,
        `*Campus(es):* ${campusDisplay || "(none)"}`,
        `*Region:* ${clean(props.state_territory_country) || "(none)"}`,
        ...subjectLines
      ].join("\n");

      shouldSendSlack = true;
    }

    /*
     * One sentence per thing that went through deliberately but is worth a
     * look. Assembled here rather than as three tokens in the task body, which
     * would print blanks for whichever did not apply.
     */
    const reviewReasons = [];
    if (hasUnknownSubjects) {
      reviewReasons.push("Unrecognised subject codes were submitted and left off the record rather than added to the subject property as new permanent options.");
    }
    if (guardianMatchedStudent) {
      reviewReasons.push("The guardian's email address belongs to a Student-typed contact. They were associated as guardian but that record was left untouched.");
    }
    if (subjectLinkFailures.length) {
      reviewReasons.push(`These subjects could not be linked to their Course record: ${subjectLinkFailures.join(", ")}. If this appears on every signup, the Trial-to-Course association type is stale rather than any one signup being wrong.`);
    }

    return out({
      trials_success: errorCount === 0,
      outcome,
      needs_review: reviewReasons.length > 0,
      review_reasons: reviewReasons.join(" "),
      student_trial_status: studentTrialStatus,
      trials_status: trialsStatus,
      trials_created: createdCount,
      trials_skipped: skippedCount,
      trials_errors: errorCount,
      created_trial_ids: createdIds.join(";"),
      existing_trial_ids: existingIds.join(";"),
      new_subject_names: newSubjectNames.join(";"),
      subject_link_failures: subjectLinkFailures.join(";"),
      is_first_time_student: isFirstTimeStudent,
      is_already_enrolled: isAlreadyEnrolled,
      student_id: studentId,
      student_id_issued: studentIdIssued,
      supabase_id_missing: !supabaseId,
      should_send_2027_slack: shouldSendSlack,
      slack_message_text: slackMessageText,
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
