# LGM-04/05 → Workflow A + B: action map

Where every action in the live workflow went. Written so the reasoning can be
checked rather than taken on trust.

Read in full: 3, 7, 12, 25, 42, 43, 44, 45, 46. Everything else is from the
canvas and from a truncated render, and is marked as such.

## As built

Both workflows exist in `[AMRIT TESTING]` form and are OFF. Every custom code
action is written and in this repo.

### Workflow A

| # | Action |
|---|---|
| — | Trigger: `LGM04 Test Enroll` = true, re-enrol ON *(swap to the real condition before go-live)* |
| 1 | Set `LGM04 Signup Ready` = false |
| 3 | Clear `LGM04 Resolved Identity` |
| 5 | Branch — 2026 submissions fork off to Make |
| 5 | Custom code — [identity resolution](workflow-a/03-identity-resolution.js) |
| 6 | Branch — `Waitlist SMS Sent` |
| 8 | Send SMS to `student_phone_resolved`, then 12 sets the flag |
| 7 | Branch on `merge_decision` — merge / review / none |
| 9 | Custom code — [call merge service](workflow-a/07-call-merge.js) |
| 11 | `none` leg sets `LGM04 Signup Ready` = true |

### Workflow B

| # | Action |
|---|---|
| — | Trigger: `LGM04 Signup Ready` = true, re-enrol ON |
| 1 | Custom code — [student and guardian sync](workflow-b/01-sync.js) |
| 2 | Branch `sync_success` → 4 branches `failed_step` (setup / student / guardian / unknown) |
| 3 | Custom code — [school verification](workflow-b/02-school-verification.js) |
| 5 | Branch `school_outcome` — duplicate_schools / error / rest |
| 13 | Custom code — [create trials](workflow-b/03-create-trials.js) |
| 20 | Branch `outcome` — error / no_subjects / rest |
| 22 | Custom code — [build comms](workflow-b/04-build-comms.js) |
| 24 | Branch `comms_success` |
| 25 | Branch `send_mode` — native / rest |
| 27, 28 | Set marketing contact status, then Send email |
| 29 | Branch `should_send_2027_slack` → 32 Send Slack |
| 33 | Branch `needs_review` → 35 task |
| 34 | Custom code — [finish](workflow-b/05-finish.js) |
| 37 | Branch `resubmission_pending` → 36 task |

Every terminating path routes through 29 → 33 → 34, so the ready flag, the SMS
flag and the blob always clear.

## Workflow A — identity and merge

| Old | New | Note |
|---|---|---|
| 1 Identity resolution | A3 | No canonical/temporary threading, no year/location comparison, no writes to the matched record before a human agrees |
| 3 Branch on success | kept | |
| 4 Branch on manual_review_required | A5, three legs on `merge_decision` | `merge` / `review` / `none` |
| 16, 17 note + task | kept | |
| — | **A1 sets `signup_ready` = false** | New. Stops the blob write enrolling the record in B *before* the merge |
| — | **A3 writes `lgm04_resolved_identity`** | New. Separate workflows cannot share action outputs |
| Final merge | A7 → merge service | Idempotent, audited, sets the ready flag itself because HubSpot unenrols on merge |

## The manual-review duplicate path — deleted

Actions 5, 7, 8, 9, 23, 24, 25, 26, 27, 29, 33, 39, 118 were a second
implementation of guardian upsert and trial creation, for records whose identity
had not been settled. Merge-first settles identity before B is enrolled, so
there is one path.

The `23` wait-for-event on `email IS_KNOWN` (30 days) went with it. It fired on
*any* email write, not only a reviewer's fix.

## Workflow B — main path

| Old | New | Note |
|---|---|---|
| 2 Student upsert, 6 Guardian upsert, 18 | B1 | One action. No longer retypes a Student as a Parent |
| 12 School verification | B3 | Recognises the real `acara_id` sentinels ("1", "NULL"); duplicate schools report instead of throwing |
| 20, 22, 23, 26, 27, 31, 39, 40, 50–54 | **gone** | ID polling. Student ID is now issued synchronously; `supabase_id` no longer blocks |
| 25 Create trials | B5 | Keeps the 2027 Slack builder. Drops the temp-contact `student_id` recovery |
| 29 Branch on `student_trial_status` | B branch on `outcome` | One leg fewer, two legs more |
| 34–37 one-minute delays | **gone** | Comms computes its own inputs in-process |
| 42–46 comms | B comms | See below |
| 48 Branch → None met → Slack → End | gone | Legs are exhaustive over one enum |
| 55 email, 62 SMS | kept | See open questions |
| 77 | B finish | Clears `signup_ready`, `waitlist_sms_sent` and the blob |

## The comms layer as rebuilt

Five actions become one. [04-build-comms.js](workflow-b/04-build-comms.js)
renders the student's HTML and the guardian's, writes both records, and sets
whichever trigger flag the outcome calls for — in the same PATCH as the content,
so a record is never flagged for sending with a half-written body.

`send_mode` is the single value the canvas branches on:

| Value | Meaning |
|---|---|
| `native` | this workflow sends it — first-time student |
| `handoff` | a flag is set; a sending workflow takes over |
| `none` | nothing to send |

| Outcome | Student flag | Guardian flag |
|---|---|---|
| `first_time` | *(native send)* | `send_waitlist_confirmation_guardian_mail` |
| `first_time_already_enrolled` | `send_already_enrolled_confirmation` | `..._guardian_mail` |
| `repeat_new_trials` | `send_waitlist_added_subjects_mail` | `send_waitlist_subject_added_confirmation_guardian_mail` |
| `repeat_no_new_trials` | `already_on_waitlist_no_new_subjects_added` | `..._confirmation_guardian_mail` |
| `partial` | resolves to first_time or repeat_new_trials | same |
| `no_subjects`, `error` | none | none |

`partial` was in no row of the original and would have set no flag and triggered
no send: the student would have heard nothing precisely when something had
already gone wrong.

## The comms layer as it was: one renderer, four trigger flips

| Leg | Action | What it does |
|---|---|---|
| First Time Trial Creation | 42 | Renders all HTML, student and guardian, writes both records. Native send |
| First Time - Already Enrolled | 44 | Sets `send_already_enrolled_confirmation` |
| First Time - Existing Contact Match | 46 | Sets `send_first_time_confirmation_mail` |
| Repeat - New Trial(s) Added | 43 | Sets `send_waitlist_added_subjects_mail` |
| Repeat - No New Trials | 45 | Sets `already_on_waitlist_no_new_subjects_added` |
| guardian | 69 / 92 | Sets `send_waitlist_confirmation_guardian_mail` — unconfirmed |

Every flag exists for one reason, stated outright in action 46's own header: the
enrolled contact might not be the student, so a native "Send email → Enrolled
contact" would mail an often email-less temp record. **Merge-first removes that
reason** — the enrolled contact is always the student.

- The `Existing Contact Match` leg and `send_first_time_confirmation_mail` go
  entirely: that outcome cannot occur.
- The other three flags could also become native sends, but their email content
  lives in the receiving workflows. Collapsing them is a separate decision.

## Where each flag lands

From the Email/SMS mapping document. Three templates, four receiving workflows,
every one of them sending Email **and** SMS.

| Receiving workflow | Audience | Template | Fed by |
|---|---|---|---|
| LGM-04/05 Website Trial Sign-up | Student | `waitlist-confirmation` | native send on the First Time leg |
| Waitlist Parent Confirmation | Parent | `waitlist-confirmation` | `send_waitlist_confirmation_guardian_mail` |
| Waitlist Subject added Parent Confirmation | Parent | `waitlist-added-subjects`, `already-on-the-waitlist` | the two repeat-student flags |
| Waitlist Added Subjects comms | Student | `waitlist-added-subjects`, `waitlist-confirmation`, `already-on-the-waitlist` | `send_waitlist_added_subjects_mail`, `send_first_time_confirmation_mail`, `already_on_waitlist_no_new_subjects_added` |

The document names the "existing HubSpot contact matching" branch explicitly as
a `waitlist-confirmation` send. That branch exists only because the enrolled
contact might not be the student, so it goes with merge-first.

`send_already_enrolled_confirmation` appears in no row of the document because
**nothing sends on it.** The branch that sets it cannot fire:

| property | contacts with any value |
|---|---|
| `already_enrolled` | **0** |
| `send_already_enrolled_confirmation` | 0 |
| `enrolment_status` | 1 |
| `enrolment_id` | 0 |
| *(for scale)* `student_id` | 6,112 |

`already_enrolled` has never been written to a single contact — not `true`, not
`false`, no value at all. The leg is gated on `isFirstTimeStudent &&
isAlreadyEnrolled`, so it has never run. The action that sets the flag, the
property, the clear step in the receiving workflow and the branch leg all exist
for a case that has not occurred once.

The intent is clear and worth keeping: do not send "your waitlist spot is
confirmed" to someone who is already a paying student. **That intent is
currently unimplemented** — an enrolled student who signs up today gets the
standard first-time waitlist confirmation.

Nothing in HubSpot carries the signal. `enrolment_status` and `subject_enrolled`
are populated on one contact each. Whatever knows a student is enrolled lives in
the student-accounts system, not here.

## Infrastructure built for this

| Thing | State |
|---|---|
| Merge service | deployed, idempotent, audited to a Google Sheet |
| [Student ID issuer](../functions/student-id/index.js) | deployed `australia-southeast1`, Firestore counter seeded to **158000** |
| [Counter seeding script](../scripts/seed-student-id-counter.js) | `--min` raises the floor; never lowers |

The ID sequence is global, not per surname — verified against 6,105 live records.
The prefix is the first three **letters** of the surname, where the old rule took
the first three characters and produced ids like `AL-157110` and `A K157097`.

## Bugs in the live workflow

Live today. Not caused by the rebuild.

1. **`trb06_handoff_*` outputs are always empty.** 43 and 45 declare
   `trb06_handoff_success` / `_status` / `_error_type` / `_error_message` and
   return `success` / `status` / `error_type` / `error_message`. Nothing
   matches, so anything branching on the handoff result sees false regardless.

2. **Action 42 does not declare `success`.** Only `sms_key_date_line` and
   `subject_list` are declared. A render failure is unreadable by any branch —
   the contact gets an email with empty body tokens and the workflow reports
   success.

3. ~~The trigger flags are never reset.~~ **Not a bug.** The receiving
   workflows clear their own flag after sending — "Waitlist Added Subjects
   comms" action 32 clears `send_waitlist_added_subjects_mail` and action 47
   clears `send_already_enrolled_confirmation`, both as Edit record / Clear. So
   each flag is already a one-shot and a second signup re-triggers correctly.
   The new comms action sets the flag the same way: a plain write to `true`.

4. **Action descriptions do not match their code.** 44 reads "render mail for
   new waitlist students" but sets `send_already_enrolled_confirmation`. 46
   reads "Already on waitlist no new subjects added" but sets
   `send_first_time_confirmation_mail`. Anyone reading the canvas gets the
   wrong picture of what the workflow does.

5. ~~Only the manual-review path sets marketing contact status.~~ **Largely not
   a bug.** The receiving workflows set marketing contact status before every
   send — "Waitlist Added Subjects comms" actions 26, 34 and 43 each sit
   directly before their email. The concern was real in principle: these are
   marketing emails, and HubSpot drops marketing sends to non-marketable
   contacts silently, with no error and no branch. It is already handled.

   **Carried forward as a requirement:** every send in the rebuild must be
   preceded by Set marketing contact status. Around 83% of Student, Parent and
   Guardian contacts here came from data import, which is the population most
   likely to be non-marketable, so a missing one fails silently and looks like
   success.

6. **`48. Branch → None met → Slack → End`.** Trials created, student on the
   waitlist, confirmation email and SMS both skipped. Only trace is a Slack
   message; everything upstream reports success.

7. **Guardian upsert and school verification failures have no branch.**
   `guardian_upsert_success` and `school_association_success` are never read.
   `multiple_guardian_email_matches` returns "Manual Review Required" into a
   void.

8. **The guardian is found by association label**, then filtered on
   `contact_type`. A guardian typed `Guardian` or `Parent/Guardian` rather than
   `Parent` gets the guardian body with the student's subject line.

9. **Dead conditions in `hasConsult`.** `GAMSAT` and `/^VSC-/` appear in the
   first clause and are excluded by the second. The header says the value is
   derived from MedPrep/TestPrep program interest; the code never looks at it.

10. **Action 25's secrets.** Attached: `Supabase_URL`, `Counter`,
   `Supabase_CustomCode_API`, `Supabase_Webhook_API`. The code reads
   `HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || HUBSPOT_TOKEN || Counter` and the first
   two are not attached — so the secret named `Counter` holds a HubSpot token.
   The Supabase secrets are unused; that integration was removed.

11. **1,127 contacts hold something other than a student ID in `student_id`** —
    mostly bare HubSpot record ids, plus values like `"0384"`.

12. **No Trial↔Course association type exists in the portal's schema**, yet
    action 25 associates them with type 994 and works. Unexplained.

13. **Action 42's success log claims it set
    `send_waitlist_confirmation_guardian_mail`.** The PATCH does not.

## Open questions

- What sets `send_waitlist_confirmation_guardian_mail` in the OLD workflow? The
  rebuild sets it in the comms action; it is not clear what did before, since
  action 42 only logs that it did.
- ~~Do the receiving workflows reset their own trigger flags?~~ Resolved: yes.
- Does the Slack action pass through the message's markdown and newlines
  unchanged? `slack_message_text` is fully formatted by the code.
- What should populate `already_enrolled`? Until something does, the
  already-enrolled leg is unreachable and paying students get the wrong email.
  There is a `send_already_enrolled_confirmation_guardian_mail` property too,
  equally unused.
- The SMS is now a single generic send in Workflow A. The mapping document has
  an SMS on all four receiving workflows, so parents currently get one and
  would stop. Deliberate?
- ~~Workflow A sends the SMS to `phone`~~ — resolved, it uses
  `student_phone_resolved` from identity resolution.
- `Waitlist SMS Sent` is cleared by Workflow B's finish action, alongside
  `signup_ready` and the blob. Not at the start of A: if the merge fails the
  record stalls and B never runs, and clearing at A's start would send a second
  SMS to the same student when someone re-triggers it.
