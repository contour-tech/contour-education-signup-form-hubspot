const axios = require("axios");

/*
 * SEND PREFILL LINK · Prepare
 *
 * Decides whether the "continue your signup" email can be sent to this record,
 * and makes sure the button in it will work.
 *
 * The send-link Cloud Function is the real gate. It resolves the address
 * itself, refuses anything that is not a Student with a link, rate-limits per
 * IP, and never tells the caller anything about the record. This action is
 * defence in depth, not the main check: the flag is an ordinary boolean anyone
 * can tick by hand, and state can change between the request and the send.
 *
 * ONE THING THE WORKFLOW MUST GET RIGHT. The function treats the uncleared
 * flag as its per-recipient cap — "once it is true the workflow already owes
 * this contact an email, so a second click cannot queue a second send".
 * Clearing the flag immediately after sending removes that cap and every click
 * queues another email. The workflow therefore waits before clearing, so the
 * delay becomes the per-recipient rate limit: durable, on the record, and
 * unaffected by cold starts in a way the function's own in-memory IP bucket
 * is not.
 *
 * Three gates:
 *
 * 1. THE RECORD MUST BE A STUDENT. The link resolves to one record and
 *    prefills the form from it. Sent to a Parent-typed record it would prefill
 *    the parent's own details into a student signup. /exists only offers the
 *    button for Student-typed records, so this only bites when the flag was
 *    set some other way — which is exactly when nobody is watching.
 *
 * 2. THE RECORD MUST HAVE AN EMAIL. HubSpot silently does nothing with a send
 *    to a contact with no address, and the workflow reports success.
 *
 * 3. THE BUTTON MUST HAVE A HREF. add_subjects_url is the prefetch function's
 *    own hard gate — without it the mail goes out with a dead button. It is
 *    derived from the record id, so a missing one is BUILT here rather than
 *    refused: 24,049 contacts have it, and the ones that do not are missing it
 *    for no better reason than never having been through the comms action.
 *
 * Everything else the email renders — the student's name, phone and waitlist
 * subjects — fills a block that renders empty rather than broken, so a missing
 * one is reported and not blocked on.
 */

const CONTACT = "0-1";
const LINK_PROPERTY = "add_subjects_url";
const PREFILL_BASE = "https://www.contoureducation.com.au/free-trial";

// Matches the prefetch function's own classification.
const STUDENT_CONTACT_TYPES = ["student"];

// Fill the "Student linked to this email" block. Missing ones are reported,
// never blocking.
const CONTENT_PROPERTIES = [
  "firstname",
  "student_first_name",
  "student_last_name",
  "student_phone_number",
  "waitlist_subjects"
];

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
      can_send: false,
      block_reason: "",
      prefill_url: "",
      link_was_built: false,
      missing_content: "",
      contact_type: "",
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("prepare prefill link:", JSON.stringify(payload, null, 2));
    callback({ outputFields: payload });
  }

  try {
    if (!token) return out({ error_type: "missing_token", error_message: "No HubSpot token secret selected on this action." });
    if (!contactId) return out({ error_type: "missing_contact_id", error_message: "The enrolled contact had no record ID." });

    const res = await axios.get(`https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`, {
      headers,
      params: { properties: ["email", "contact_type", LINK_PROPERTY, ...CONTENT_PROPERTIES].join(",") }
    });
    const props = res.data?.properties || {};

    const contactType = clean(props.contact_type);
    const email = clean(props.email);

    if (!STUDENT_CONTACT_TYPES.includes(contactType.toLowerCase())) {
      return out({
        contact_type: contactType,
        block_reason: `The prefill link opens one student's record, and this contact is typed "${contactType || "(blank)"}" rather than Student. Sending it would prefill the wrong person's details into a signup form.`
      });
    }

    if (!email) {
      return out({
        contact_type: contactType,
        block_reason: "This contact has no email address, so there is nowhere to send the link."
      });
    }

    /*
     * Derived from the record id, so it is always reconstructable. Building it
     * is strictly better than refusing: the person asked for their link and
     * the only thing standing in the way is a property nobody happened to
     * write.
     *
     * Note this is deliberately MORE permissive than the function, which
     * treats a missing link as "not eligible" and stops. It only diverges for
     * a flag set by hand, since the function never sets one on a record
     * without a link — and a human ticking it has made a decision the function
     * was not in a position to make.
     */
    let prefillUrl = clean(props[LINK_PROPERTY]);
    let linkWasBuilt = false;

    if (!prefillUrl) {
      prefillUrl = `${PREFILL_BASE}?student_id=${contactId}`;
      const patch = await axios.patch(
        `https://api.hubapi.com/crm/v3/objects/${CONTACT}/${contactId}`,
        { properties: { [LINK_PROPERTY]: prefillUrl } },
        { headers, validateStatus: () => true }
      );
      if (patch.status === 429 || patch.status >= 500) {
        throw Object.assign(new Error(`Writing ${LINK_PROPERTY} temporarily failed (${patch.status}).`), {
          statusCode: patch.status
        });
      }
      if (patch.status !== 200) {
        return out({
          contact_type: contactType,
          error_type: "link_write_failed",
          block_reason: `The prefill link was missing and could not be written (${patch.status}), so the email would have gone out with a dead button.`
        });
      }
      linkWasBuilt = true;
    }

    const missing = CONTENT_PROPERTIES.filter((p) => !clean(props[p]));

    return out({
      can_send: true,
      contact_type: contactType,
      prefill_url: prefillUrl,
      link_was_built: linkWasBuilt,
      // Reported, never blocking: these fill a block that renders empty rather
      // than broken.
      missing_content: missing.join(";")
    });
  } catch (error) {
    if (isTemporary(error)) throw error;
    return out({ error_type: "prepare_prefill_error", error_message: errorMessage(error).substring(0, 500) });
  }
};
