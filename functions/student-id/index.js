const functions = require("@google-cloud/functions-framework");
const { Firestore } = require("@google-cloud/firestore");

/*
 * LGM-04 — student ID issuer
 *
 * Issues the next student_id: a surname prefix followed by a number from ONE
 * shared sequence. Confirmed against 6,105 live records — the number is global,
 * not per surname:
 *
 *   PAR157115  Park          13:45
 *   PAR157114  Park          13:43
 *   BAJ157113  Bajwa         12:41
 *   FAH157112  Fahim         12:24
 *   AL-157110  Al-Shishachi  11:47
 *
 * One counter, strictly increasing by creation time, whatever the surname. So
 * two students who share a surname can never collide, and the prefix is purely
 * a human-readable label.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACES THE OLD GENERATOR
 *
 * That one ran two HubSpot searches and a patch against an EVENTUALLY
 * CONSISTENT index: it read the highest existing student_id, added one, then
 * searched again to check nobody had taken it. An id written seconds earlier
 * may not be indexed yet, so both reads can miss it and two signups can be
 * handed the same number — most likely on a busy day, which is exactly when it
 * matters. Around it sat a five-attempt collision loop and four workflow
 * actions of polling.
 *
 * A Firestore transaction on a single counter is atomic and strongly
 * consistent. No polling, no collision loop, no retry ladder — one call, one
 * id, and two simultaneous callers cannot receive the same number.
 *
 * Idempotent by contact: issued/{contactId} records what a contact was given,
 * so a workflow retry returns the same id instead of burning a new one. The
 * gaps in the live sequence — 157094, 157102, 157105, 157106 — are numbers the
 * old generator burned on retries and never used.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * IT DOES NOT WRITE TO HUBSPOT. It issues a number and remembers it; the
 * caller decides what to do with it. That keeps the service usable from a
 * backfill script or by hand without a HubSpot token anywhere near it.
 *
 * THE COUNTER MUST BE SEEDED BEFORE FIRST USE, or it starts at 1 and reissues
 * ids that already exist. scripts/seed-student-id-counter.js does that.
 */

const SEQUENCE_PAD = 5;
const PREFIX_LENGTH = 3;

const COUNTER_DOC = "counters/student";

const firestore = new Firestore();

function clean(v) {
  return String(v ?? "").trim();
}

/*
 * First three LETTERS of the surname, uppercased.
 *
 * The old generator took the first three characters verbatim, which is why the
 * live data holds "AL-157110" (Al-Shishachi) and "A K157097" (A Kumar) — an
 * identifier with a space in it, which does not survive a CSV round-trip or a
 * URL. Letters only from here: Al-Shishachi becomes ALS, A Kumar becomes AKU.
 * Existing ids are left alone. Nothing collides either way, because the number
 * is what makes an id unique.
 *
 * Accents are folded (Müller → MUL) so the prefix stays ASCII, but non-Latin
 * letters are kept rather than stripped — dropping them would leave a student
 * with no prefix at all.
 */
function surnamePrefix(lastName) {
  const letters = clean(lastName)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split("")
    .filter((ch) => /\p{L}/u.test(ch))
    .join("");
  return letters.slice(0, PREFIX_LENGTH).toUpperCase();
}

function format(prefix, n) {
  // padStart is a floor, not a ceiling. The sequence passed 99999 long ago and
  // is six digits today; truncating to five would reissue old numbers.
  return `${prefix}${String(n).padStart(SEQUENCE_PAD, "0")}`;
}

functions.http("studentId", async (req, res) => {
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const expected = clean(process.env.ISSUER_KEY);
  if (!expected) {
    console.error("ISSUER_KEY is not configured — refusing every request.");
    return res.status(500).json({ error: "service misconfigured" });
  }
  if (clean(req.get("x-issuer-key")) !== expected) {
    return res.status(401).json({ error: "unauthorised" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const contactId = clean(body.contactId);
  const lastName = clean(body.lastName);

  if (!/^\d{1,20}$/.test(contactId)) {
    return res.status(400).json({ error: "contactId must be a numeric record id" });
  }
  if (!lastName) {
    return res.status(400).json({ error: "lastName is required to build the prefix" });
  }

  const prefix = surnamePrefix(lastName);
  if (!prefix) {
    return res.status(400).json({ error: `lastName "${lastName}" contains no letters to build a prefix from` });
  }

  try {
    const issuedRef = firestore.doc(`issued/${contactId}`);
    const counterRef = firestore.doc(COUNTER_DOC);

    const result = await firestore.runTransaction(async (tx) => {
      // Both reads happen before any write — Firestore requires it, and it is
      // also what makes "has this contact already been issued one" part of the
      // same atomic decision as taking the next number.
      const [issuedSnap, counterSnap] = await Promise.all([tx.get(issuedRef), tx.get(counterRef)]);

      if (issuedSnap.exists) {
        const prior = issuedSnap.data();
        return { studentId: prior.studentId, sequence: prior.sequence, prefix: prior.prefix, reissued: true };
      }

      if (!counterSnap.exists) {
        /*
         * Refuse rather than start at 1. An unseeded counter would hand out
         * numbers that 6,105 existing records already hold, and student_id is
         * unique — the damage is silent until someone notices two people with
         * the same id.
         */
        throw Object.assign(new Error("The student ID counter has not been seeded."), { code: "unseeded" });
      }

      const next = Number(counterSnap.data().next || 0) + 1;
      const studentId = format(prefix, next);

      tx.set(counterRef, { next, updatedAt: new Date().toISOString() }, { merge: true });
      tx.set(issuedRef, {
        studentId,
        sequence: next,
        prefix,
        lastName,
        contactId,
        issuedAt: new Date().toISOString()
      });

      return { studentId, sequence: next, prefix, reissued: false };
    });

    console.log(JSON.stringify({ event: "student_id", contactId, lastName, ...result }));
    return res.status(200).json(result);
  } catch (err) {
    if (err.code === "unseeded") {
      console.error(err.message);
      return res.status(503).json({ error: err.message, hint: "run scripts/seed-student-id-counter.js" });
    }
    console.error("student id error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports.surnamePrefix = surnamePrefix;
module.exports.format = format;
