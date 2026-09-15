const axios = require("axios");

/*
 * WORKFLOW A · ACTION 7 — Call the merge service
 *
 * THIS IS THE LAST ACTION THAT RUNS. HubSpot unenrols a contact from every
 * active workflow the moment it is merged, so when this succeeds the run
 * stops here and the branch below it never fires. That is why the service is
 * asked to set signup_ready itself (setReadyFlag) — it is the only thing
 * still executing once the merge lands, and it is what starts Workflow B.
 *
 * The branch after this action therefore only ever sees the FAILURE case,
 * which is exactly what we want it to handle.
 *
 * The service is idempotent: if the records are already merged it reports
 * success without writing a second note or a second audit row, so a HubSpot
 * retry is safe.
 */

const ENDPOINT =
  "https://australia-southeast1-hubspot-signup-form.cloudfunctions.net/contour-form1-merge";

function clean(v) {
  return String(v ?? "").trim();
}

exports.main = async (event, callback) => {
  const input = event.inputFields || {};
  const enrolledId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);
  const matchedId = clean(input.matched_contact_id);
  const mergeKey = clean(process.env.MERGE_KEY);

  function out(fields) {
    const payload = {
      merge_success: false,
      survivor_id: "",
      ready_flag_set: false,
      already_merged: false,
      absorbed_id: "",
      error_message: "",
      ...fields
    };
    console.log("merge call:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  if (!mergeKey) {
    return out({ error_message: "MERGE_KEY secret is not selected on this action." });
  }
  if (!enrolledId || !matchedId) {
    return out({ error_message: `Missing ids — enrolled: ${enrolledId || "none"}, matched: ${matchedId || "none"}.` });
  }

  try {
    const res = await axios.post(
      ENDPOINT,
      {
        // The enrolled record is primary, so the newer submission's values win
        // and the older record is absorbed into it.
        primaryId: enrolledId,
        secondaryId: matchedId,
        matchedOn: "email",
        reason: "website signup",
        actor: "LGM-04 workflow A",
        // Opt-in: this is what starts Workflow B. A human merging two records
        // by hand deliberately does not pass it.
        setReadyFlag: true,
        // Identity does not survive a merge the way ids do — primary values
        // win, but a blank on the primary is filled from the secondary. These
        // assert what the form actually said.
        overrides: {
          firstname: clean(input.student_first_name_resolved),
          lastname: clean(input.student_last_name_resolved),
          contact_type: "Student"
        }
      },
      {
        headers: { "X-Merge-Key": mergeKey, "Content-Type": "application/json" },
        timeout: 30000,
        validateStatus: () => true
      }
    );

    const body = res.data || {};

    if (res.status !== 200) {
      return out({
        error_message: `Merge service returned ${res.status}: ${JSON.stringify(body).substring(0, 300)}`
      });
    }

    // A merge that succeeded but could not set signup_ready leaves the record
    // stranded — merged, with nothing coming to pick it up. Report it as a
    // failure so the branch below raises it, even though the merge itself
    // worked.
    if (!body.readyFlagSet) {
      return out({
        merge_success: false,
        survivor_id: clean(body.survivorId),
        absorbed_id: clean(body.absorbed?.id),
        already_merged: Boolean(body.alreadyMerged),
        error_message: `Merged into ${clean(body.survivorId)} but signup_ready was not set — this record needs enrolling in Workflow B by hand. ${clean(body.readyFlagError)}`
      });
    }

    return out({
      merge_success: true,
      survivor_id: clean(body.survivorId),
      absorbed_id: clean(body.absorbed?.id),
      already_merged: Boolean(body.alreadyMerged),
      ready_flag_set: true
    });
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    // Network blips and 5xx are worth a retry; a 4xx is not.
    if (!error?.response || status === 429 || status >= 500) throw error;
    return out({ error_message: clean(error.message).substring(0, 500) });
  }
};
