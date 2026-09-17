#!/usr/bin/env node
/*
 * Seeds the student ID counter from what HubSpot already holds.
 *
 * MUST RUN BEFORE THE ISSUER IS USED. The issuer refuses to hand out numbers
 * until this has run, because an unseeded counter starts at 1 and reissues ids
 * that thousands of existing records already carry — and student_id is unique,
 * so the damage is silent until someone notices two people sharing one.
 *
 * Reads every contact with a student_id, takes the trailing digits, and seeds
 * the counter to the highest. Safe to re-run: it never lowers the counter.
 *
 *   node scripts/seed-student-id-counter.js            # report only
 *   node scripts/seed-student-id-counter.js --write    # seed Firestore
 *
 * Token: $HUBSPOT_TOKEN, or pulled from Secret Manager if unset.
 */

const { execSync } = require("child_process");

const SECRET = "contour-form1-hubspot-token";
const SECRET_PROJECT = "hubspot-signup-form";
const COUNTER_DOC = "counters/student";

const WRITE = process.argv.includes("--write");

function token() {
  if (process.env.HUBSPOT_TOKEN) return process.env.HUBSPOT_TOKEN.trim();
  return execSync(
    `gcloud secrets versions access latest --secret=${SECRET} --project=${SECRET_PROJECT}`,
    { encoding: "utf8" }
  ).trim();
}

/*
 * A student_id is a non-numeric prefix followed by the sequence. Prefixes vary
 * in length (NG, PAR, "A K"), so anchoring on the trailing digits is the only
 * rule that holds — but the prefix has to be THERE.
 *
 * Some records carry a bare HubSpot record id in student_id instead:
 *
 *   87332455302   Test 1
 *   18356961273   Soliman
 *   18356400204   Xian
 *
 * Eleven digits, no prefix, and nothing to do with the sequence. Counting them
 * would have seeded the counter to 87 billion and every future id would have
 * been junk. Anything without a non-digit prefix is not a student_id.
 */
function sequenceOf(studentId) {
  const m = String(studentId || "").match(/^(.*\D)(\d+)$/);
  return m ? Number(m[2]) : null;
}

async function main() {
  const headers = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" };

  let after;
  let scanned = 0;
  let unparsed = 0;
  const seen = [];
  const rejected = [];

  process.stderr.write("Scanning contacts with a student_id");

  do {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "student_id", operator: "HAS_PROPERTY" }] }],
        properties: ["student_id", "lastname"],
        limit: 200,
        ...(after ? { after } : {})
      })
    });

    if (!res.ok) throw new Error(`HubSpot search failed (${res.status}): ${await res.text()}`);
    const body = await res.json();

    for (const record of body.results || []) {
      scanned += 1;
      const studentId = record.properties?.student_id;
      const sequence = sequenceOf(studentId);
      if (sequence === null) {
        unparsed += 1;
        rejected.push({ id: record.id, studentId, lastname: record.properties?.lastname });
        continue;
      }
      seen.push({ sequence, studentId, lastname: record.properties?.lastname, id: record.id });
    }

    after = body.paging?.next?.after;
    process.stderr.write(".");
  } while (after);

  process.stderr.write("\n");

  seen.sort((a, b) => b.sequence - a.sequence);
  const max = seen[0];

  console.log(`\nScanned ${scanned} contacts, ${seen.length} with a readable sequence, ${unparsed} without.`);

  if (rejected.length) {
    console.log(`\n${rejected.length} contact(s) hold something in student_id that is not one. These are a`);
    console.log("separate mess and worth a look, but they do not affect the counter:\n");
    for (const row of rejected.slice(0, 15)) {
      console.log(`  ${row.id}  ${JSON.stringify(row.studentId).padEnd(18)} ${row.lastname || ""}`);
    }
    if (rejected.length > 15) console.log(`  ...and ${rejected.length - 15} more`);
  }
  console.log("\nHighest twenty — check these look like one sequence and not a stray import:\n");
  for (const row of seen.slice(0, 20)) {
    console.log(`  ${String(row.sequence).padStart(8)}  ${String(row.studentId).padEnd(14)} ${row.lastname || ""}`);
  }

  if (!max) throw new Error("No parseable student_id found — refusing to seed.");

  if (!WRITE) {
    console.log(`\nWould seed ${COUNTER_DOC} to next = ${max.sequence}. Re-run with --write to apply.`);
    return;
  }

  const { Firestore } = require("../functions/student-id/node_modules/@google-cloud/firestore");
  const firestore = new Firestore();
  const ref = firestore.doc(COUNTER_DOC);

  // Never lower it. A re-run after the issuer has been live would otherwise
  // wind the counter back to the highest id HubSpot happens to show and hand
  // out numbers the issuer has already given away.
  const applied = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data().next || 0) : 0;
    if (current >= max.sequence) return { changed: false, current };
    tx.set(ref, { next: max.sequence, seededAt: new Date().toISOString(), seededFrom: max.studentId }, { merge: true });
    return { changed: true, current, next: max.sequence };
  });

  console.log(
    applied.changed
      ? `\nSeeded ${COUNTER_DOC}: ${applied.current} -> ${applied.next}. Next id issued will be ${max.sequence + 1}.`
      : `\nLeft ${COUNTER_DOC} alone — already at ${applied.current}, which is not below ${max.sequence}.`
  );
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
