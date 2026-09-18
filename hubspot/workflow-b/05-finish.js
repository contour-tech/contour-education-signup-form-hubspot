const axios = require("axios");

/*
 * WORKFLOW B · ACTION 5 — Finish
 *
 * Last action on every leg that reaches the end, including the ones that
 * failed. Clearing the ready flag is what lets the NEXT submission enrol:
 * Workflow A sets it false at the start and the merge service sets it true at
 * the end, so signup_ready is a one-shot token and this is what spends it. A
 * run that ends without clearing leaves the contact stuck — which is exactly
 * how records reached Workflow B unresolved in the first place.
 *
 * IT DOES NOT CLEAR BLINDLY. HubSpot will not enrol the same contact in the
 * same workflow twice at once, so a second submission that lands mid-run is
 * left waiting on the record rather than starting its own run. Clearing the
 * flag and deleting the blob at that moment would throw that submission away
 * with nothing to show for it — no error, no task, no trace.
 *
 * So it compares the blob as it stands now against the one action 1 actually
 * processed. Different means a newer submission arrived while this run was
 * going. It clears nothing, leaves the flag set and the blob intact, and says
 * so for a branch to raise. The submission still needs a human to nudge it,
 * but a visible stall beats silent loss.
 */

const CONTACT = "0-1";
const RESOLVED_PROPERTY = "lgm04_resolved_identity";
const READY_PROPERTY = "signup_ready";

/*
 * Cleared here rather than at the start of Workflow A. If the merge fails, the
 * record stalls and B never runs — clearing at A's start would send a second
 * welcome SMS to the same student the moment anyone re-triggered it. Clearing
 * at the end of a completed run means one SMS per completed signup.
 */
const SMS_SENT_PROPERTY = "waitlist_sms_sent";

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

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const input = event.inputFields || {};
  const contactId = clean(event.object?.objectId || input.hs_object_id?.value || input.hs_object_id);

  function out(fields) {
    const payload = {
      finish_success: false,
      finish_status: "",
      cleared: false,
      resubmission_pending: false,
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("finish:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    // What action 1 ran on. Blank when action 1 never got that far, which is
    // itself a reason to clear: there is nothing to protect.
    const processedAt = clean(input.resolved_at);

    const res = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: { properties: RESOLVED_PROPERTY }
    });

    const raw = clean(res.data?.properties?.[RESOLVED_PROPERTY]);
    let currentAt = "";
    if (raw) {
      try {
        currentAt = clean(JSON.parse(raw)?.resolvedAt);
      } catch (e) {
        // Unreadable blob is not worth preserving.
        currentAt = "";
      }
    }

    if (processedAt && currentAt && currentAt !== processedAt) {
      return out({
        finish_success: true,
        resubmission_pending: true,
        finish_status: `A newer submission landed while this run was in progress (processed ${processedAt}, on record ${currentAt}). Nothing was cleared — the record is still flagged and still holds the newer identity, and needs re-enrolling in Workflow B by hand.`
      });
    }

    await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
      { properties: { [READY_PROPERTY]: "false", [SMS_SENT_PROPERTY]: "false", [RESOLVED_PROPERTY]: "" } },
      { headers }
    );

    return out({
      finish_success: true,
      cleared: true,
      finish_status: "Ready flag and SMS flag cleared, resolved identity removed."
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ error_type: "finish_error", error_message: errorMessage(error).substring(0, 500) });
  }
};
