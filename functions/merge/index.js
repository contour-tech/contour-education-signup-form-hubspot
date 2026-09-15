const functions = require("@google-cloud/functions-framework");
const { GoogleAuth } = require("google-auth-library");

/*
 * LGM-04 — contact merge service
 *
 * One merge implementation for the whole org. The signup workflow calls it;
 * a Slack command can call it later without a second copy of any of this.
 * Five copies of the merge script exist in the live workflow today precisely
 * because a HubSpot custom code action is a thing people paste rather than
 * call.
 *
 * Merge is the only irreversible operation in the signup system, so this
 * endpoint does three things a custom code action never did:
 *
 *   1. Captures BOTH records in full before merging. Once the merge lands the
 *      absorbed record is unreadable, so the capture is the only surviving
 *      evidence of what was destroyed. It has to happen first, not after.
 *   2. Writes that capture to two places — a note on the survivor (where
 *      someone debugging THIS student will look) and a row in the audit Sheet
 *      (the reporting view). Both best-effort: a logging failure must never
 *      fail a merge that already succeeded.
 *   3. Refuses to run unauthenticated. The prefetch endpoint is open because
 *      it only reads; an open merge endpoint would let anyone destroy records.
 *
 * Direction matters and is deliberate: the caller passes the ENROLLED record
 * as primaryObjectId, so HubSpot keeps it and absorbs the older one. That is
 * what lets the workflow merge early and keep running — the record it is
 * enrolled on survives. Primary values win and blanks fill from the secondary,
 * so student_id and supabase_id carry across on their own; identity fields do
 * NOT, which is why `overrides` exists.
 */

const HUBSPOT_BASE = "https://api.hubapi.com";
const CONTACT = "0-1";

// HubSpot-defined association type for Note -> Contact.
const NOTE_TO_CONTACT_ASSOCIATION_TYPE_ID = 202;

// Everything worth keeping a record of before a record stops existing. The
// source label matters as much as the values: "this came from a bulk import"
// is most of what a reviewer needs to judge whether a merge was right.
const CAPTURE_PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "contact_type",
  "hs_object_source_label",
  "createdate",
  "student_id",
  "supabase_id",
  "student_prefix",
  "phone",
  "parent_email"
];

// HubSpot names the real canonical target in its own rejection message when
// the primary has itself already been merged away:
//   "...has a forward reference to 348661568976. Only canonical objects can
//    be merged."
const FORWARD_REFERENCE = /forward reference to (\d+)/i;

const SHEET_ID = process.env.SHEET_ID || "";
const SHEET_RANGE = process.env.SHEET_RANGE || "Sheet1!A:L";

function clean(value) {
  return String(value ?? "").trim();
}

function fullName(properties) {
  return [properties.firstname, properties.lastname]
    .map((part) => clean(part))
    .filter(Boolean)
    .join(" ");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function hubspot(path, init, token) {
  const res = await fetch(HUBSPOT_BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init && init.headers)
    }
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

/*
 * Reads a contact in full. Returns null for 404 rather than throwing, because
 * "the record you asked me to merge does not exist" is a caller error worth a
 * clear 4xx, not a 500.
 */
async function capture(contactId, token) {
  const { status, body } = await hubspot(
    `/crm/v3/objects/${CONTACT}/${contactId}?properties=${CAPTURE_PROPERTIES.join(",")}`,
    { method: "GET" },
    token
  );
  if (status === 404) return null;
  if (status !== 200) {
    throw Object.assign(new Error(`Reading contact ${contactId} failed (${status})`), {
      statusCode: status,
      detail: body
    });
  }
  const properties = body.properties || {};
  return {
    id: clean(body.id),
    email: clean(properties.email),
    name: fullName(properties),
    type: clean(properties.contact_type),
    source: clean(properties.hs_object_source_label),
    createdate: clean(properties.createdate),
    student_id: clean(properties.student_id),
    supabase_id: clean(properties.supabase_id)
  };
}

/*
 * Merges, and retries once against the real target if HubSpot says the primary
 * has already been merged away. Two overlapping enrollments for the same person
 * produce exactly that — one run's merge invalidates the canonical id the other
 * run already captured.
 */
async function mergeContacts(primaryId, secondaryId, token) {
  let primary = primaryId;
  let correctedFrom = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { status, body } = await hubspot(
      "/crm/v3/objects/contacts/merge",
      { method: "POST", body: JSON.stringify({ primaryObjectId: primary, objectIdToMerge: secondaryId }) },
      token
    );

    if (status === 200) {
      return { survivorId: clean(body && body.id), correctedFrom };
    }

    if (status === 429 || status >= 500) {
      throw Object.assign(new Error(`Merge temporarily failed (${status})`), {
        statusCode: 503,
        retryable: true,
        detail: body
      });
    }

    const message = typeof (body && body.message) === "string" ? body.message : JSON.stringify(body);
    const match = attempt === 0 ? message.match(FORWARD_REFERENCE) : null;

    if (match) {
      const realTarget = clean(match[1]);

      // The secondary has already been absorbed into the primary we were asked
      // for. Nothing left to do, and a retrying caller should see success
      // rather than an error — merge is not safely repeatable, so this endpoint
      // has to be.
      if (realTarget === clean(primary)) {
        return { survivorId: clean(primary), correctedFrom: "", alreadyMerged: true };
      }

      correctedFrom = clean(primary);
      primary = realTarget;
      continue;
    }

    throw Object.assign(new Error(`Merge failed (${status})`), { statusCode: 422, detail: body });
  }

  throw Object.assign(new Error("Merge failed after forward-reference recovery"), { statusCode: 422 });
}

/*
 * Identity does not survive a merge the way the ids do: primary values win,
 * but a blank on the primary is filled from the secondary. A form that captured
 * no surname would therefore silently inherit the absorbed record's one. The
 * caller passes what the form actually asserted and it is written explicitly.
 */
async function applyOverrides(contactId, overrides, token) {
  const properties = {};
  for (const [key, value] of Object.entries(overrides || {})) {
    const v = clean(value);
    if (v) properties[key] = v;
  }
  if (Object.keys(properties).length === 0) return { applied: {} };

  const { status, body } = await hubspot(
    `/crm/v3/objects/${CONTACT}/${contactId}`,
    { method: "PATCH", body: JSON.stringify({ properties }) },
    token
  );
  if (status !== 200) {
    throw Object.assign(new Error(`Applying overrides to ${contactId} failed (${status})`), {
      statusCode: status,
      detail: body,
      afterMerge: true
    });
  }
  return { applied: properties };
}

function noteBody(absorbed, survivor, meta) {
  const lines = [
    "<b>Auto-merged on website signup</b>",
    "",
    `Absorbed record <b>${absorbed.id}</b> into this one.`,
    "",
    `&bull; Email: ${absorbed.email || "(none)"}`,
    `&bull; Name: ${absorbed.name || "(none)"}`,
    `&bull; Contact type: ${absorbed.type || "(unassigned)"}`,
    `&bull; Record source: ${absorbed.source || "(unknown)"}`,
    `&bull; Created: ${absorbed.createdate || "(unknown)"}`,
    "",
    `Matched on: ${meta.matchedOn}`,
    `Reason: ${meta.reason}`,
    `Requested by: ${meta.actor}`
  ];

  // Worth saying out loud on the record itself rather than only in a spec: a
  // reviewer reading this note is looking at the only remaining description of
  // a record that no longer exists.
  if (absorbed.name && survivor.name && absorbed.name.toLowerCase() !== survivor.name.toLowerCase()) {
    lines.push("", `<b>Note:</b> the absorbed record carried a different name (${absorbed.name}).`);
  }

  return lines.join("<br>");
}

async function writeNote(survivorId, body, token) {
  const { status } = await hubspot(
    "/crm/v3/objects/notes",
    {
      method: "POST",
      body: JSON.stringify({
        properties: { hs_note_body: body, hs_timestamp: new Date().toISOString() },
        associations: [
          {
            to: { id: survivorId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: NOTE_TO_CONTACT_ASSOCIATION_TYPE_ID
              }
            ]
          }
        ]
      })
    },
    token
  );
  return status === 201;
}

let sheetsAuth = null;

/*
 * One row per merge, carrying both sides in full. The absorbed half is the
 * only record of something that no longer exists; the survivor half saves a
 * reviewer having to open HubSpot to find out what it became.
 *
 * Column order (A:L):
 *   merged_at, matched_on,
 *   survivor_id, survivor_email, survivor_name, survivor_type, survivor_source,
 *   absorbed_id, absorbed_email, absorbed_name, absorbed_type, absorbed_source
 */
async function appendAuditRow(row) {
  if (!SHEET_ID) return { written: false, reason: "no SHEET_ID configured" };

  if (!sheetsAuth) {
    sheetsAuth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  }
  const client = await sheetsAuth.getClient();
  const { token } = await client.getAccessToken();

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/` +
    `${encodeURIComponent(SHEET_RANGE)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] })
  });

  if (!res.ok) {
    return { written: false, reason: `Sheets ${res.status}: ${(await res.text()).slice(0, 200)}` };
  }
  return { written: true };
}

functions.http("merge", async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const expectedKey = clean(process.env.MERGE_KEY);
  if (!expectedKey) {
    console.error("MERGE_KEY is not configured — refusing every request.");
    return res.status(500).json({ error: "service misconfigured" });
  }
  if (clean(req.get("x-merge-key")) !== expectedKey) {
    return res.status(401).json({ error: "unauthorised" });
  }

  const token = clean(process.env.HUBSPOT_TOKEN);
  if (!token) return res.status(500).json({ error: "service misconfigured" });

  const payload = isPlainObject(req.body) ? req.body : {};
  const primaryId = clean(payload.primaryId);
  const secondaryId = clean(payload.secondaryId);
  const reason = clean(payload.reason) || "website signup";
  const actor = clean(payload.actor) || "lgm04-workflow";
  const matchedOn = clean(payload.matchedOn) || "email";
  const dryRun = payload.dryRun === true;

  if (!/^\d{1,20}$/.test(primaryId) || !/^\d{1,20}$/.test(secondaryId)) {
    return res.status(400).json({ error: "primaryId and secondaryId must both be numeric record ids" });
  }
  if (primaryId === secondaryId) {
    return res.status(200).json({ survivorId: primaryId, merged: false, reason: "same record" });
  }

  try {
    const [primary, secondary] = await Promise.all([
      capture(primaryId, token),
      capture(secondaryId, token)
    ]);

    if (!primary) return res.status(404).json({ error: `primary ${primaryId} not found` });
    if (!secondary) return res.status(404).json({ error: `secondary ${secondaryId} not found` });

    // A dry run answers "what would this destroy" without destroying it. Worth
    // having on the one endpoint in the system with no undo.
    if (dryRun) {
      return res.status(200).json({ dryRun: true, wouldKeep: primary, wouldAbsorb: secondary });
    }

    const { survivorId, correctedFrom, alreadyMerged } = await mergeContacts(primaryId, secondaryId, token);
    if (!survivorId) {
      return res.status(502).json({ error: "merge returned no surviving record id" });
    }

    // A retry has nothing to record: no record was destroyed this time, and
    // writing a second note and audit row for the same merge would leave the
    // log claiming it happened twice.
    if (alreadyMerged) {
      console.log(JSON.stringify({ event: "merge", survivorId, alreadyMerged: true, logged: false }));
      return res.status(200).json({
        survivorId,
        merged: false,
        alreadyMerged: true,
        correctedFrom: correctedFrom || null,
        absorbed: null,
        overridesApplied: {},
        noteWritten: false,
        auditWritten: false
      });
    }

    const overrides = isPlainObject(payload.overrides) ? payload.overrides : {};
    const { applied } = await applyOverrides(survivorId, overrides, token);

    // Read the survivor back rather than inferring it. The merge decides which
    // values won, the overrides then changed some of them, and the audit row
    // should say what the record actually looks like now.
    const survivor = (await capture(survivorId, token)) || { ...primary, id: survivorId };

    const meta = { matchedOn, reason, actor };

    // Both logs are best-effort on purpose. The merge has already happened and
    // cannot be undone; failing the response because a Sheet append 500'd would
    // tell the caller the merge failed when it did not, and a retry would then
    // do nothing useful.
    const [noteWritten, sheet] = await Promise.all([
      writeNote(survivorId, noteBody(secondary, survivor, meta), token).catch((err) => {
        console.error("note write failed:", err.message);
        return false;
      }),
      appendAuditRow([
        new Date().toISOString(),
        matchedOn,
        survivorId,
        survivor.email,
        survivor.name,
        survivor.type || "Unassigned",
        survivor.source,
        secondary.id,
        secondary.email,
        secondary.name,
        secondary.type || "Unassigned",
        secondary.source
      ]).catch((err) => {
        console.error("audit append failed:", err.message);
        return { written: false, reason: err.message };
      })
    ]);

    if (!sheet.written) console.error("audit row not written:", sheet.reason);

    console.log(
      JSON.stringify({
        event: "merge",
        survivorId,
        absorbedId: secondary.id,
        absorbedType: secondary.type || "Unassigned",
        absorbedSource: secondary.source,
        correctedFrom: correctedFrom || undefined,
        alreadyMerged: alreadyMerged || undefined,
        noteWritten,
        auditWritten: sheet.written
      })
    );

    return res.status(200).json({
      survivorId,
      merged: !alreadyMerged,
      alreadyMerged: Boolean(alreadyMerged),
      correctedFrom: correctedFrom || null,
      absorbed: secondary,
      overridesApplied: applied,
      noteWritten,
      auditWritten: sheet.written
    });
  } catch (err) {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    console.error("merge error:", err.message, JSON.stringify(err.detail || {}).slice(0, 400));
    return res.status(status).json({
      error: err.message,
      afterMerge: Boolean(err.afterMerge),
      retryable: Boolean(err.retryable)
    });
  }
});
