const axios = require("axios");

/*
 * WORKFLOW B · Build comms
 *
 * Renders the waitlist confirmation for the student and, when there is one, the
 * guardian — then sets the trigger flag that enrols each of them in the right
 * sending workflow.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ONE ACTION, NOT FIVE.
 *
 * The old workflow put a different action on each leg of the outcome branch:
 * one renderer (42) and four flag-flippers (43, 44, 45, 46). The flag-flippers
 * existed because the enrolled contact might not be the student, so a native
 * "Send email → Enrolled contact" would have mailed an often email-less
 * temporary record. Merge-first removes that reason — the enrolled contact is
 * always the student — but the receiving workflows still own the templates, so
 * the flags stay and this action sets whichever one the outcome calls for.
 *
 * The dead leg goes: `send_first_time_confirmation_mail` fired only on
 * "First Time Trial Creation - Existing Contact Match", which cannot happen now.
 *
 * EVERY OUTPUT IS DECLARED. Action 42 returned `success` but declared only
 * `sms_key_date_line` and `subject_list`, so no branch could see a render
 * failure — the student got an email with empty body tokens and the workflow
 * reported success. Actions 43 and 45 declared `trb06_handoff_*` and returned
 * `success`/`status`/`error_type`/`error_message`, so all four of their
 * declared outputs were empty on every run.
 *
 * THE GUARDIAN COMES FROM ACTION 1, not from an association-label search
 * followed by a contact_type filter. That search is why a guardian typed
 * "Guardian" or "Parent/Guardian" rather than "Parent" received the guardian
 * body with the student's subject line.
 *
 * Every HTML template below is copied verbatim from action 42. The copy is
 * deliberate work and not mine to reword.
 * ────────────────────────────────────────────────────────────────────────────
 */

const CONTACT_OBJECT_TYPE = "0-1";
const TRIAL_OBJECT_TYPE = "2-207877831";

const WAITLIST_PROPERTY = "waitlist_subjects";
const INTRO_BODY_PROPERTY = "waitlist_confirmation_intro_body";
const CONFIRMATION_BODY_PROPERTY = "waitlist_confirmation_body";
const HAS_TRIAL_PROPERTY = "has_a_trial";
const ADD_SUBJECTS_URL_PROPERTY = "add_subjects_url";
const DATES_VIZ_PROPERTY = "waitlist_dates_viz_variant";
const RESOLVED_PROPERTY = "lgm04_resolved_identity";

/*
 * Which flag enrols which record in which sending workflow. The student on a
 * first-time signup has no flag: that one is a native send from this workflow,
 * which is safe now that the enrolled contact is always the student.
 *
 * The receiving workflows clear their own flag after sending, so each is
 * already a one-shot and a plain write to true re-triggers correctly.
 */
const TRIGGER_FLAGS = {
  first_time: { student: "", guardian: "send_waitlist_confirmation_guardian_mail" },
  first_time_already_enrolled: {
    student: "send_already_enrolled_confirmation",
    guardian: "send_already_enrolled_confirmation_guardian_mail"
  },
  repeat_new_trials: {
    student: "send_waitlist_added_subjects_mail",
    guardian: "send_waitlist_subject_added_confirmation_guardian_mail"
  },
  repeat_no_new_trials: {
    student: "already_on_waitlist_no_new_subjects_added",
    guardian: "already_on_waitlist_no_new_subjects_added_confirmation_guardian_mail"
  }
};


function clean(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function extractErrorMessage(error) {
  const details =
    error?.response?.data?.message || error?.response?.data || error?.message || "Unknown error";
  return typeof details === "string" ? details : JSON.stringify(details);
}

function isTemporaryError(error) {
  const statusCode = Number(error?.response?.status || error?.statusCode || 0);
  const networkError = !error?.response && Boolean(error?.request || error?.code);
  return error?.isTemporary === true || networkError || statusCode === 429 || statusCode >= 500;
}

function buildIntroBodyHtml({
  isGuardian,
  studentFirstName,
  isIntFuture,
  isIntNow,
  intOutreachYear,
  hasBooking,
  hasConsult,
  hasPriorityVic,
  programPendingLabel,
  waitlistHtml,
  canAddMore,
  addSubjectsLink,
  hasInterviews,
  results,
  resultStats,
  hallOfFameLink,
  extensionFirst,
  stepExtNum,
  extensionDiagLabel,
  stepConsultNum,
  consultScopeLabel,
  isGraduated,
  medJourneyLabel,
  hasTrial,
  consultInviteLabel,
  testDiagLabel,
  testJourneyLabel,
  bookingScopeLabel,
  stepBookingNum,
  vicBookingOpenLabel,
  stepTrialNum,
  trialLeadLabel,
  trialDatesHtml,
  consultVariant,
  hasPriorityInterstate,
  interstateBookingOpenLabel
}) {
  const studentPossessive = isGuardian ? `${studentFirstName}'s` : "Your";
  const theirYour = isGuardian ? "their" : "your";

  const introText =
  isIntFuture
    ? `This means ${
        isGuardian ? `${studentFirstName}'s` : "your"
      } place is saved, and since the Interview Program runs ${theirYour} final school year, we'll reach out in <strong>${intOutreachYear}</strong> to set it up. It's completely free, and there's nothing more to do until then.`

    : isIntNow
      ? `This means ${
          isGuardian ? `${studentFirstName} gets` : "you get"
        } <strong>guaranteed access to early enrolment</strong> before the Interview Program opens to everyone, with priority booking for all ${theirYour} sessions. It's completely free, and ${
          isGuardian ? `${studentFirstName}'s` : "your"
        } spot is already saved.`

      : hasBooking
        ? hasConsult
          ? hasPriorityVic
            ? `This means ${
                isGuardian ? `${studentFirstName} will` : "you'll"
              } get <strong>24-hour priority access</strong> to book ${theirYour} classes for our 2027 program before we release the class timetable to the public, plus a <strong>guaranteed spot</strong> in a free welcome consultation.`

            : `This means ${
                isGuardian ? `${studentFirstName} has` : "you have"
              } a <strong>guaranteed spot</strong> in a free welcome consultation for our 2027 program, plus <strong>priority access</strong> to book ${theirYour} classes before we release the class timetable to the public.`

          : `This means ${
              isGuardian ? `${studentFirstName} will` : "you'll"
            } get <strong>${
              hasPriorityVic ? "24-hour priority access" : "priority access"
            }</strong> to book ${theirYour} classes for our 2027 program before we release the class timetable to the public.`

        : programPendingLabel !== ""
          ? hasConsult
            ? `This means ${
                isGuardian ? `${studentFirstName} has` : "you have"
              } a <strong>guaranteed spot</strong> in a free welcome consultation for our 2027 program.`

            : `This means ${
                isGuardian ? `${studentFirstName}'s` : "your"
              } spot in our 2027 ${programPendingLabel} program is saved while we finalise the details.`

          : `This means ${
              isGuardian ? `${studentFirstName} has` : "you have"
            } a <strong>guaranteed spot</strong> in a free welcome consultation for our 2027 program.`;

  const endingText =
  !isIntFuture && !isIntNow
    ? programPendingLabel !== ""
      ? hasConsult
        ? `It's completely free, and ${
            hasBooking
              ? "you're already ahead of the queue"
              : `${isGuardian ? `${studentFirstName}'s` : "your"} spot is already saved`
          }.`
        : `We'll email ${
            isGuardian ? `${studentFirstName}'s` : "your"
          } full program information in <strong>November</strong> - there's nothing more to do until then.`

      : `It's completely free, and ${
          hasBooking
            ? "you're already ahead of the queue"
            : `${isGuardian ? `${studentFirstName}'s` : "your"} spot is already saved`
        }.`
    : "";

const waitlistUpdateLine =
  '<p style="margin:12px 0 0 0; font-size:12px; line-height:18px; color:#8a8a8a;">' +
  "Spot a mistake" +
  (canAddMore ? ", or want to add a subject for free" : "") +
  '? <a clicktracking="off" href="' +
  addSubjectsLink +
  '" target="_blank" style="color:#007AFF !important; text-decoration:none; font-weight:bold;">' +
  "Update the waitlist" +
  "</a>, or just reply to this email.</p>";

  return `
    <p style="font-size: 14px; line-height: 175%;">
      ${studentPossessive} spot on the 2027 Contour waitlist is confirmed.
      ${introText} ${endingText}
    </p>
	<p style="margin: 10px 0 10px 0;">Keep reading to know what to expect next 👇</p>
<!-- ======= Simple Card ======= -->
<div style="
  width:100%;
  max-width:640px;
  margin:20px auto 20px auto;
  border:1px solid #DDEDFF;
  border-radius:12px;
  background:#FEFAF1;
  overflow:hidden;
  box-sizing:border-box;
">

  <!-- Header -->
  <div style="
    padding:10px 18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:18px;
    line-height:26px;
    color:#ffffff;
    font-weight:bold;
    background:#0C3066;
    border-bottom:1px solid #DDEDFF;
    text-align:left;
  ">
    ${isGuardian ? `${studentFirstName}'s 2027 waitlist ✅` : "Your 2027 waitlist ✅"}
  </div>

  <!-- Body -->
  <div style="
    padding:18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:14px;
    line-height:22px;
    color:#333333;
  ">
	${waitlistHtml}
    ${waitlistUpdateLine}
    <p></p>
  </div>
</div>
<!-- ======= Simple Card ======= -->
<div style="
  width:100%;
  max-width:640px;
  margin:10px auto 20px auto;
  border:1px solid #DDEDFF;
  border-radius:12px;
  background:#FEFAF1;
  overflow:hidden;
  box-sizing:border-box;
">

  <!-- Header -->
  <div style="
    padding:10px 18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:18px;
    line-height:26px;
    color:#ffffff;
    font-weight:bold;
    background:#0C3066;
    border-bottom:1px solid #DDEDFF;
    text-align:left;
  ">
    You're in the right place 🏆
  </div>

  <!-- Body -->
  <div style="
    padding:18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:14px;
    line-height:22px;
    color:#333333;
  ">
    ${`
  <p style="margin:0 0 10px 0;">
    We started Contour to build the tutoring we wish we'd had as students.
    Here's what that looks like in results:
  </p>

  <ul style="margin:0 0 12px 0; padding-left:20px;">

    ${
      hasInterviews
        ? `
    <li style="margin-bottom:4px; color:#212121;">
      ${results.int1}
    </li>
    `
        : ""
    }

    ${resultStats
      .map(
        result => `
    <li style="margin-bottom:4px; color:#212121;">
      ${result}
    </li>
    `
      )
      .join("")}

  </ul>

  ${
    hallOfFameLink
      ? `
  <p style="margin:0 0 10px 0;">
    See more of our students' results in the
    <a
      clicktracking="off"
      href="${hallOfFameLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      Contour hall of fame</a>.</p>
  `
      : ""
  }

  <p style="margin:0;">
    ${isGuardian ? `${studentFirstName} is` : "You're"} in good hands.
  </p>
`}
  </div>
</div>
<!-- ======= Simple Card ======= -->
<div style="
  width:100%;
  max-width:640px;
  margin:20px auto 0 auto;
  border:1px solid #DDEDFF;
  border-radius:12px;
  background:#FEFAF1;
  overflow:hidden;
  box-sizing:border-box;
">

  <!-- Header -->
  <div style="
    padding:10px 18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:18px;
    line-height:26px;
    color:#ffffff;
    font-weight:bold;
    background:#0C3066;
    border-bottom:1px solid #DDEDFF;
    text-align:left;
  ">
    What happens next 📅
  </div>

  <!-- Body -->
  <div style="
    padding:18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:14px;
    line-height:22px;
    color:#333333;
  ">
    ${`
  ${
    extensionFirst
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>${stepExtNum}Extension diagnostic:</strong>
    on <strong>${extensionDiagLabel}</strong>, we'll email
    ${isGuardian ? `${studentFirstName}'s` : "your"}
    invitation to complete a diagnostic test for extension.
  </p>
  `
      : ""
  }

  ${
    hasConsult
      ? `
    ${
      isIntFuture
        ? `
    <p style="margin:0 0 10px 0;">
      <strong>We'll reach out in ${intOutreachYear}:</strong>
      the Interview Program runs in
      ${isGuardian ? `${studentFirstName}'s` : "your"}
      final school year, so there's nothing to book today.
      ${isGuardian ? `${studentFirstName}'s` : "Your"} place stays saved,
      and we'll be in touch in ${intOutreachYear} with everything needed
      to get started: live format-specific workshops, 1-on-1 mock interviews
      with personalised reports, and daily practice and video feedback
      with our tutors.
    </p>

    <p style="margin:0 0 10px 0;">
      <strong>UCAT comes first:</strong>
      before any interview,
      ${isGuardian ? studentFirstName : "you"} will sit the UCAT,
      the entry test that shapes most medical and dental interview offers
      in Australia, and the results above are why
      ${isGuardian ? "families" : "students"} start UCAT with us early.
      <a
        clicktracking="off"
        href="${addSubjectsLink}"
        target="_blank"
        style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
      >
        Add UCAT to ${isGuardian ? `${studentFirstName}'s` : "your"} waitlist for free
      </a>,
      and we'll take care of the rest when the time comes.
    </p>
    `
        : ""
    }

    ${
      isIntNow
        ? `
    <p style="margin:0 0 10px 0;">
      <strong>${stepConsultNum}Early enrolment:</strong>
      we'll email ${isGuardian ? `${studentFirstName}'s` : "your"}
      invitation to this inbox. Inside the program: live format-specific
      workshops, 1-on-1 mock interviews with personalised reports,
      and daily practice and video feedback with our tutors.
    </p>
    `
        : ""
    }

    ${
      consultVariant === "med"
        ? `
    <p style="margin:0 0 10px 0;">
      <strong>
        ${stepConsultNum}Welcome consultation${consultScopeLabel ? ` (${consultScopeLabel})` : ""}:
      </strong>
      for ${
        isGuardian
          ? `${studentFirstName} and you`
          : isGraduated
            ? "you"
            : "you and your parent or guardian"
      },
      with a current medical/dental student.
      We'll plan
      ${isGuardian ? `${studentFirstName}'s` : "your"}
      ${medJourneyLabel} journey${
        hasTrial
          ? `, and book ${isGuardian ? "their" : "your"} free trial`
          : ""
      }.
      We'll invite you to book${
        consultInviteLabel
          ? ` (${consultInviteLabel})`
          : `: invitations go out in waves, and ${
              isGuardian ? `${studentFirstName}'s` : "yours"
            } will arrive in this inbox`
      }.
    </p>
    `
        : ""
    }

    ${
      consultVariant === "test"
        ? `
    <p style="margin:0 0 10px 0;">
      <strong>
        ${stepConsultNum}Diagnostic + welcome consultation${
          consultScopeLabel ? ` (${consultScopeLabel})` : ""
        }:
      </strong>
      ${testDiagLabel ? `on ${testDiagLabel} ` : ""}
      we'll email ${isGuardian ? `${studentFirstName}'s` : "your"}
      free diagnostic mock exam, then invite you
      ${isGuardian ? "" : "and your parent or guardian "}
      to book a free 30-minute 1-on-1 consultation${
        consultInviteLabel ? ` (${consultInviteLabel})` : ""
      },
      where we review the results, plan
      ${isGuardian ? `${studentFirstName}'s` : "your"}
      ${testJourneyLabel} journey, recommend the right subjects,
      and book ${isGuardian ? "their" : "your"} free trial classes.
    </p>
    `
        : ""
    }

    ${
      consultVariant === "gen"
        ? `
    <p style="margin:0 0 10px 0;">
      <strong>
        ${stepConsultNum}Welcome consultation${
          consultScopeLabel ? ` (${consultScopeLabel})` : ""
        }:
      </strong>
      ${isGuardian ? `${studentFirstName}'s` : "Your"} next step is a
      free 1-on-1 session where we get to know
      ${
        isGuardian
          ? `${studentFirstName} and their`
          : "you and your"
      }
      goals,
      ${
        hasTrial
          ? `plan the right program, answer any questions, and set up ${
              isGuardian ? "their" : "your"
            } free trial`
          : "plan the right program, and answer any questions"
      }.
      ${isGuardian ? `${studentFirstName}'s` : "Your"} spot is guaranteed:
      invitations to book go out in waves, and
      ${isGuardian ? `${studentFirstName}'s` : "yours"}
      will arrive in this inbox${
        consultInviteLabel ? ` (${consultInviteLabel})` : ""
      }.
    </p>
    `
        : ""
    }
  `
      : ""
  }

  ${
    hasPriorityVic
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>
      ${stepBookingNum}Trial class booking${
        bookingScopeLabel ? ` (${bookingScopeLabel})` : ""
      }:
    </strong>
    on <strong>${vicBookingOpenLabel} (AEDT)</strong>,
    ${isGuardian ? `${studentFirstName} will` : "you'll"}
    get 24-hour priority access to choose
    ${isGuardian ? "their" : "your"}
    ${bookingScopeLabel ? `${bookingScopeLabel} ` : ""}
    classes before the public.
  </p>
  `
      : ""
  }

  ${
    hasPriorityInterstate
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>
      ${stepBookingNum}Trial class booking${
        bookingScopeLabel ? ` (${bookingScopeLabel})` : ""
      }:
    </strong>
    on <strong>${interstateBookingOpenLabel}</strong>,
    ${isGuardian ? `${studentFirstName} will` : "you'll"}
    get 24-hour priority access to choose
    ${isGuardian ? "their" : "your"}
    ${bookingScopeLabel ? `${bookingScopeLabel} ` : ""}
    classes before the public.
    We'll email ${isGuardian ? `${studentFirstName}'s` : "your"}
    booking link the moment bookings open.
  </p>
  `
      : ""
  }

  ${
    hasTrial
      ? `
  <p style="margin:0;">
    <strong>${stepTrialNum}Two-week free trial:</strong>
    ${
      trialLeadLabel
        ? trialLeadLabel
        : hasInterviews
          ? "every subject except the Interview Program"
          : "every subject"
    }
    begins with a two-week free trial${trialDatesHtml}.
    It's completely obligation-free, because we're confident
    ${isGuardian ? `${studentFirstName} will` : "you'll"} love it.
  </p>

  ${
    hasInterviews
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>Interviews come later:</strong>
    we'll prepare ${isGuardian ? studentFirstName : "you"} for interviews
    towards the end of Year 12 - we'll email the invitation when it's time.
  </p>
  `
      : ""
  }
  `
      : ""
  }

  ${
    programPendingLabel !== ""
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>We'll reach out in November:</strong>
    we're still finalising the ${programPendingLabel} program for 2027.
    We'll email ${isGuardian ? `${studentFirstName}'s` : "your"}
    full program information (dates, format and fees) in November,
    and ${isGuardian ? `${studentFirstName}'s` : "your"}
    spot stays saved in the meantime.
  </p>
  `
      : ""
  }

  ${
    !hasBooking && programPendingLabel === ""
      ? `
  <p style="margin:12px 0 0 0; font-size:12px; line-height:18px; color:#8a8a8a;">
    <em>
      We'll release further program info (schedule, tutors, and fees)
      as we get closer to the key dates.
    </em>
  </p>
  `
      : ""
  }
`}
  </div>
</div>
  `;
}

function buildConfirmationBodyHtml({
  results,

  hasConsult,
  isIntFuture,
  addSubjectsLink,

  consultVariant,
  isGuardian,
  studentFirstName,

  hasPriorityVic,

  hasPriorityInterstate,
  interstateBookingOpenLabel,

  programPendingLabel,
  hasBooking,

  canAddMore,
  ucatCrossSellLabel,
  referralLink,
  consultCallLink,

  calendarGoogleLink,
  calendarIcsLink
}) {
  return `
${hasPriorityVic ? `
<div style="
  width:100%;
  max-width:640px;
  margin:20px auto;
  padding:12px 20px 14px 20px;
  background:#EFF6FF;
  border-left:4px solid #007AFF;
  border-radius:6px;
  font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;
  font-size:13px;
  line-height:20px;
  color:#333333;
  box-sizing:border-box;
">
	
    <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #0c3166 !important;">Save the date!</p>
    
    <p style="margin:0 0 10px 0;">
    Every year, popular classes fill quickly
    <em>
      (last year, thousands of trials were booked within hours of releasing the class timetable)
    </em>,
    and in 2027, every class is capped. Bookings are first-come, first-served.
  </p>

  <p style="margin:0;">
    After the 24-hour window, the class timetable opens to everyone,
    so we highly recommend saving the date to make sure you don't miss
    ${isGuardian ? `${studentFirstName}'s` : "your"}
    priority booking.
  </p>
    <div style="text-align: center; margin-top: 10px; width: 100%;"><a href="${calendarGoogleLink}" target="_blank" style="display: inline-block; width: 49%; box-sizing: border-box; padding: 7px 10px; border: 1px solid #C7D8EC; border-radius: 6px; background-color: #ffffff; font-family: Arial,Helvetica,sans-serif; font-size: 12px; font-weight: bold; color: #0c3166 !important; text-decoration: none; text-align: center; vertical-align: top;" rel="noopener"> Add to Google Calendar </a> <a href="${calendarIcsLink}" target="_blank" style="display: inline-block; width: 49%; box-sizing: border-box; padding: 7px 10px; border: 1px solid #C7D8EC; border-radius: 6px; background-color: #ffffff; font-family: Arial,Helvetica,sans-serif; font-size: 12px; font-weight: bold; color: #0c3166 !important; text-decoration: none; text-align: center; vertical-align: top;" rel="noopener"> Apple / Outlook </a></div>
	
	<p style="margin:10px 0 0 0; font-size:12px; line-height:18px; color:#8a8a8a;">
    <em>
      <strong>More info coming:</strong>
      before then, we'll send through the 2027 program schedule,
      tutor info and fees via email and on our website.
    </em>
  </p>
</div>
` : ''}

${hasPriorityInterstate ? `
  <!-- ======= SAVE THE DATE (interstate navy callout) ======= -->
  <div style="
	width:100%;
  	max-width:640px;
  	margin:20px auto;
    padding:14px 20px 16px 20px;
    background-color:#0C3166;
    border-radius:10px;
    font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;
    font-size:13px;
    line-height:20px;
    color:#ffffff;
    box-sizing:border-box;
  ">
    <p style="
      margin:0 0 8px 0;
      font-size:16px;
      font-weight:bold;
      color:#D7FC3D !important;
    ">
      Save the date!
    </p>

    <p style="
      margin:0;
      color:#ffffff !important;
    ">
      Class booking opens on <strong>${interstateBookingOpenLabel}</strong>:
      ${isGuardian ? `${studentFirstName} gets` : "you get"}
      a 24-hour priority window before the public.
      We'll email full 2027 program info and fees by November,
      and ${isGuardian ? `${studentFirstName}'s` : "your"}
      booking link the moment bookings open.
    </p>
  </div>
` : ""}

<!-- ======= Simple Card ======= -->
${!isIntFuture ? `<div style="
  width:100%;
  max-width:640px;
  margin:20px auto;
  border:1px solid #DDEDFF;
  border-radius:12px;
  background:#FEFAF1;
  overflow:hidden;
  box-sizing:border-box;
">

  <!-- Header -->
  <div style="
    padding:10px 18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:18px;
    line-height:26px;
    color:#ffffff;
    font-weight:bold;
    background:#0C3066;
    border-bottom:1px solid #DDEDFF;
    text-align:left;
  ">
    While you wait ⏳
  </div>

  <!-- Body -->
  <div style="
    padding:18px;
    font-family:Arial, Helvetica, sans-serif;
    font-size:14px;
    line-height:22px;
    color:#333333;
  ">
	${canAddMore ? `
  ${
    ucatCrossSellLabel
      ? `
  <p style="margin:0 0 10px 0;">
    <strong>1. Thinking about school tutoring too?</strong>
    We also run ${ucatCrossSellLabel} tutoring: ${results.edu1}
    <a
      clicktracking="off"
      href="${addSubjectsLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      Add ${ucatCrossSellLabel} subjects to the waitlist
    </a>
    now for free, so everything is ready before the welcome consultation,
    and get a two-week free trial.
  </p>
  `
      : `
  <p style="margin:0 0 10px 0;">
    <strong>1. Thinking about another subject?</strong>
    <a
      clicktracking="off"
      href="${addSubjectsLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      Add it to the waitlist
    </a>
    now for free, so
    ${
      hasBooking
        ? `${isGuardian ? studentFirstName : "you"} can book everything together when the class timetable is released`
        : hasConsult
          ? `everything is ready before ${
              consultVariant === "int"
                ? "enrolment opens"
                : "the welcome consultation, and get a two-week free trial"
            }`
          : programPendingLabel !== ""
            ? "everything is ready when we reach out in November"
            : `everything is ready before ${
                consultVariant === "int"
                  ? "enrolment opens"
                  : "the welcome consultation, and get a two-week free trial"
              }`
    }.
  </p>
  `
  }

  <p style="margin:0 0 10px 0;">
    <strong>2. Invite friends:</strong>
    Share
    <a
      clicktracking="off"
      href="${referralLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      this sign-up link
    </a>
    so ${
      isGuardian
        ? `${studentFirstName} and their friends`
        : "you and your friends"
    }
    can ${hasBooking ? "book into" : "join"} the same classes.
    Learning is more fun with friends :)
  </p>

  <p style="margin:0;">
    <strong>3. Need guidance?</strong>
    Reply to this email${
      consultCallLink
        ? `, or
    <a
      clicktracking="off"
      href="${consultCallLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      book a free ${hasConsult ? "call" : "consultation"} with our student consultants
    </a>`
        : ""
    }
    so we can help with
    ${isGuardian ? `${studentFirstName}'s` : "your"}
    enrolment.
  </p>
` : `
  <p style="margin:0 0 10px 0;">
    <strong>1. Invite friends:</strong>
    Share
    <a
      clicktracking="off"
      href="${referralLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      this sign-up link
    </a>
    so ${
      isGuardian
        ? `${studentFirstName} and their friends`
        : "you and your friends"
    }
    can ${hasBooking ? "book into" : "join"} the same classes.
    Learning is more fun with friends :)
  </p>

  <p style="margin:0;">
    <strong>2. Need guidance?</strong>
    Reply to this email${
      consultCallLink
        ? `, or
    <a
      clicktracking="off"
      href="${consultCallLink}"
      target="_blank"
      style="color:#007AFF !important; text-decoration:none; font-weight:bold;"
    >
      book a free ${hasConsult ? "call" : "consultation"} with our student consultants
    </a>`
        : ""
    }
    so we can help with
    ${isGuardian ? `${studentFirstName}'s` : "your"}
    enrolment.
  </p>
`}
  </div>
</div>
` : ""}
<div style="width:100%; max-width:640px; margin:20px auto; font-family: Arial,'Helvetica Neue',Helvetica,sans-serif; font-size: 14px; line-height: 20px; color: #333333;
">
${
  isIntFuture
    ? `
    
      <p style="margin:12px 0 0 0;">
        Everything we build is designed by students, for students, and helps
        ${isGuardian
          ? `${studentFirstName} achieve their`
          : "you achieve your"
        }
        full potential.
        We can't wait to support
        ${isGuardian ? studentFirstName : "you"}
        when the time comes.
        If you have any questions, simply reply :)
      </p>
	
    `
    : `

      <p style="margin:12px 0 10px 0;">
        Next year will be the best <em>(and biggest)</em> program we've ever built.
        New campuses across Australia, more resources and support for students,
        and huge upgrades to our learning portal and tech.
      </p>

      <p style="margin:0;">
        Our mission is to be your academic partner, and we're working tirelessly
        in the background to make sure
        ${isGuardian
          ? `${studentFirstName} achieves their`
          : "you achieve your"
        }
        potential in 2027.
        If you have any questions, simply reply and we'll be here to help :)
      </p>

    `
}
</div>
`
}

exports.main = async (event, callback) => {
  const token = process.env.HUBSPOT_PRIVATE_APP_ACCESS_TOKEN || process.env.HUBSPOT_TOKEN;
  const hubspotHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const inputFields = event.inputFields || {};

  const contactId = clean(event.object?.objectId || inputFields.hs_object_id?.value || inputFields.hs_object_id);
  const guardianContactId = clean(inputFields.guardian_contact_id);
  const rawOutcome = clean(inputFields.outcome);
  const isFirstTimeStudent = ["true", "yes", "1"].includes(clean(inputFields.is_first_time_student).toLowerCase());

  /*
   * "partial" means some subjects got trials and some did not. The student is
   * owed the same email either way — which one depends on whether they are new,
   * not on whether every subject worked. Left unmapped it would set no flag and
   * trigger no native send, and the student would hear nothing precisely when
   * something had already gone wrong.
   */
  const outcome = rawOutcome === "partial" ? (isFirstTimeStudent ? "first_time" : "repeat_new_trials") : rawOutcome;

  function returnOutputs(fields) {
    const payload = {
      comms_success: false,
      comms_status: "",
      send_mode: "none",
      resolved_outcome: "",
      subject_list: "",
      sms_key_date_line: "",
      subject_count: 0,
      waitlist_subjects_html: "",
      dates_viz_variant: "",
      has_trial: false,
      guardian_updated: false,
      student_flag_set: "",
      guardian_flag_set: "",
      error_type: "",
      error_message: "",
      ...fields
    };
    console.log("build comms:", JSON.stringify({ ...payload, waitlist_subjects_html: "(omitted)" }, null, 2));
    callback({ outputFields: payload });
  }

  async function getStudentTrialIds(studentContactId) {
    const trialIds = [];
    let after = "";
    do {
      const params = { limit: 500 };
      if (after) params.after = after;
      const response = await axios.get(
        `https://api.hubapi.com/crm/v4/objects/contacts/${studentContactId}/associations/${TRIAL_OBJECT_TYPE}`,
        { headers: hubspotHeaders, params, validateStatus: () => true }
      );
      if (response.status !== 200) {
        throw Object.assign(
          new Error(`Fetching Trial associations failed (${response.status}): ${JSON.stringify(response.data)}`),
          { customType: "trial_association_fetch_failed" }
        );
      }
      for (const result of response.data?.results || []) {
        const trialId = clean(result.toObjectId ?? result.id);
        if (trialId) trialIds.push(trialId);
      }
      after = clean(response.data?.paging?.next?.after);
    } while (after);
    return [...new Set(trialIds)];
  }

  async function readTrials(trialIds) {
    if (trialIds.length === 0) return [];
    const trials = [];
    for (const trialIdChunk of chunk(trialIds, 100)) {
      const response = await axios.post(
        `https://api.hubapi.com/crm/v3/objects/${TRIAL_OBJECT_TYPE}/batch/read`,
        {
          properties: ["trial_subject", "trialling_subject", "subject_code"],
          inputs: trialIdChunk.map((id) => ({ id }))
        },
        { headers: hubspotHeaders, validateStatus: () => true }
      );
      if (response.status !== 200) {
        throw Object.assign(
          new Error(`Batch reading Trials failed (${response.status}): ${JSON.stringify(response.data)}`),
          { customType: "trial_batch_read_failed" }
        );
      }
      trials.push(...(response.data?.results || []));
    }
    return trials;
  }

  async function patchContact(id, properties, label) {
    const response = await axios.patch(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT_OBJECT_TYPE}/${id}`,
      { properties },
      { headers: hubspotHeaders, validateStatus: () => true }
    );
    if (response.status === 429 || response.status >= 500) {
      throw Object.assign(new Error(`${label} update temporarily failed (${response.status}).`), {
        isTemporary: true,
        customType: "contact_update_temporary_error"
      });
    }
    return response;
  }

  try {
    if (!token) throw Object.assign(new Error("Missing HubSpot private app access token secret."), { customType: "missing_hubspot_token" });
    if (!contactId) throw Object.assign(new Error("No Contact ID available on event."), { customType: "missing_contact_id" });

    /*
     * One read. The old action fetched the contact with a properties list that
     * had stray spaces in it; HubSpot happens to trim them, which is luck
     * rather than design.
     */
    const contactResponse = await axios.get(
      `https://api.hubapi.com/crm/v3/objects/${CONTACT_OBJECT_TYPE}/${contactId}`,
      {
        headers: hubspotHeaders,
        params: {
          properties: [
            "firstname",
            "hs_object_id",
            "state_territory_country",
            "year_level",
            "program_interest",
            "web_form__interested_subject",
            "can_add_more_subjects",
            RESOLVED_PROPERTY
          ].join(",")
        },
        validateStatus: () => true
      }
    );
    if (contactResponse.status !== 200) {
      throw Object.assign(
        new Error(`Fetching Contact properties failed (${contactResponse.status}): ${JSON.stringify(contactResponse.data)}`),
        { customType: "contact_property_fetch_failed" }
      );
    }
    const contactProperties = contactResponse.data?.properties || {};

    const studentFirstName = clean(contactProperties.firstname) || "Your child";
    const recordID = clean(contactProperties.hs_object_id);
    const state = clean(contactProperties.state_territory_country);
    const yearLevel = clean(contactProperties.year_level);
    const programInterest = clean(contactProperties.program_interest);
    const interestedSubjects = clean(contactProperties.web_form__interested_subject);
    const canAddMore = clean(contactProperties.can_add_more_subjects) === "true";

    const interestedSubjectList = interestedSubjects
      .split(";")
      .map((subject) => {
        const codePart = subject.split("|").find((part) => part.startsWith("code:"));
        return codePart ? clean(codePart.replace(/^code:/, "")) : "";
      })
      .filter(Boolean);

    const trialIds = await getStudentTrialIds(contactId);
    const trials = await readTrials(trialIds);

    const hasTrial = interestedSubjectList.some(
      code =>
        code !== "MD-INT" &&
        code !== "GAMSAT" &&
        !/^VSC-/.test(code) &&
        !/^VSE-[A-Z]+06$/.test(code)
    );

    const hasInterviewProgram = interestedSubjectList.some((subject) => subject === "MD-INT");

    const hasEducationSubject = interestedSubjects
      .split(";")
      .some((subject) => /\|program:Education\|/i.test(subject));

    const hasPriorityVic = state === "VIC" && hasEducationSubject;
    const hasPriorityInterstate = (state === "NSW" || state === "QLD") && hasEducationSubject;

    const isIntOnly = interestedSubjectList.length === 1 && interestedSubjectList[0] === "MD-INT";
    const isIntFuture = (yearLevel === "Year 10" || yearLevel === "Year 11") && isIntOnly;
    const isIntNow = (yearLevel === "Year 12" || yearLevel === "Graduated") && isIntOnly;

    const hasBooking = hasPriorityVic || hasPriorityInterstate;

    let intOutreachYear = "";
    if (hasInterviewProgram && yearLevel === "Year 11") intOutreachYear = "2028";
    else if (hasInterviewProgram && yearLevel === "Year 10") intOutreachYear = "2029";

    const programInterestValues = clean(programInterest).split(";").map(v => v.trim()).filter(Boolean);
    const hasMedPrep = programInterestValues.includes("MedPrep");
    const hasTestPrep = programInterestValues.includes("TestPrep");

    /*
     * Simplified, deliberately: the original listed GAMSAT and /^VSC-/ in the
     * first clause and then excluded both in the second, so those two were
     * dead. This is what it actually resolved to — MD-INT, a UCAT code, or a
     * VSE code that is not a VSE-xx06. Same result, visibly.
     */
    const hasConsult = interestedSubjectList.some(
      code => (code === "MD-INT" || /^UCAT-/.test(code) || /^VSE-/.test(code)) && !/^VSE-[A-Z]+06$/.test(code)
    );

    const hasUCAT = interestedSubjectList.some((code) => /\bUCAT\b/i.test(code));

    let consultVariant = "";
    if (isIntOnly) {
      consultVariant = isIntFuture ? "int_future" : "int";
    } else if (hasConsult) {
      if (hasUCAT) consultVariant = "med";
      else if (hasTestPrep) consultVariant = "test";
      else consultVariant = "gen";
    }

    const mixed = (hasPriorityVic || hasPriorityInterstate) && hasConsult;

    const educationStreams = [
      ...new Set(
        interestedSubjects
          .split(";")
          .filter(subject => /\|program:Education\|/i.test(subject))
          .map(subject => {
            const yearMatch = subject.match(/\|year:([^|]+)/i);
            const years = yearMatch ? yearMatch[1].split(",").map(Number).filter(Boolean) : [];
            const highestYear = Math.max(...years);
            if (highestYear <= 10) return "Year 7-10";
            if (state === "VIC") return "VCE";
            if (state === "NSW") return "HSC";
            if (state === "QLD") return "QCE";
            return "";
          })
          .filter(Boolean)
      )
    ];

    const consultStreams = [
      hasUCAT ? "UCAT" : "",
      hasInterviewProgram ? "Interviews" : "",
      hasTestPrep ? "Selective Entry" : ""
    ].filter(Boolean);

    const streamRank = {
      VCE: 0, HSC: 1, QCE: 2, "Year 7-10": 3, UCAT: 4,
      "UCAT (UK)": 5, "Selective Entry": 6, Scholarship: 7, GAMSAT: 8, Interviews: 9
    };
    const ranked = values => [...values].sort((a, b) => (streamRank[a] ?? 99) - (streamRank[b] ?? 99));

    const bookingScopeLabel =
      mixed && educationStreams.length && educationStreams.length <= 2 ? ranked(educationStreams).join(" and ") : "";
    const consultScopeLabel =
      mixed && consultStreams.length && consultStreams.length <= 2 ? ranked(consultStreams).join(" and ") : "";

    const medJourneyLabel = "UCAT and medical entry";

    const testJourneyTypes = [
      ...new Set(
        interestedSubjectList
          .filter(code => code.startsWith("VSC-") || code.startsWith("VSE-"))
          .map(code => (code.startsWith("VSC-") ? "scholarship" : "selective entry"))
      )
    ];
    const testJourneyLabel = testJourneyTypes.join(" and ");

    const subjectDetails = interestedSubjects
      .split(";")
      .map((subject) => {
        const parts = subject.split("|");
        const codePart = parts.find((part) => part.startsWith("code:"));
        const programPart = parts.find((part) => part.startsWith("program:"));
        const yearPart = parts.find((part) => part.startsWith("year:"));
        return {
          code: codePart ? clean(codePart.replace(/^code:/, "")) : "",
          program: programPart ? clean(programPart.replace(/^program:/, "")) : "",
          years: yearPart
            ? yearPart.replace(/^year:/, "").split(",").map((y) => Number(y.trim())).filter((y) => !Number.isNaN(y))
            : []
        };
      })
      .filter((subject) => subject.code);

    const testPrepGroups = [
      ...new Set(
        subjectDetails
          .filter(subject => subject.program === "TestPrep")
          .map(subject => (/^VSE-/.test(subject.code) || /^VSC-/.test(subject.code) ? "nov23" : null))
          .filter(Boolean)
      )
    ];
    const testDiagLabel = testPrepGroups.length === 1 && testPrepGroups[0] === "nov23" ? "Saturday 3 October" : "";

    const consultSubjectCodes = interestedSubjects
      .split(";")
      .filter(
        subject =>
          !/\|program:Education\|/i.test(subject) &&
          !/^code:GAMSAT\|/i.test(subject) &&
          !/\|code:VSC-/i.test(subject) &&
          !/\|code:VSE-[A-Z]+06\|/i.test(subject)
      )
      .map(subject => {
        const codePart = subject.match(/^code:([^|]+)/i);
        return codePart ? codePart[1] : "";
      })
      .filter(Boolean);

    const consultStandardSubjectCodes = consultSubjectCodes.filter(code => code !== "MD-INT");

    const consultInviteLabel = consultStandardSubjectCodes.length
      ? consultStandardSubjectCodes.every(code => code.startsWith("UCAT-UK"))
        ? "Wednesday 30 December"
        : consultStandardSubjectCodes.every(code => code.startsWith("UCAT-") && !code.startsWith("UCAT-UK"))
          ? "Thursday 15 October"
          : consultStandardSubjectCodes.every(code => /^VSE-[A-Z]+0[78]$/.test(code))
            ? "from Saturday 31 October"
            : ""
      : "";

    const vicBookingOpenLabel = hasPriorityVic ? "Saturday 31 October 2026 at 9:00am" : "";
    const interstateBookingOpenLabel = hasPriorityInterstate
      ? state === "QLD"
        ? "Monday 4 January 2027 at 9:00am (AEST)"
        : "Monday 4 January 2027 at 9:00am (AEDT)"
      : "";

    const trialSubjectCodes = interestedSubjectList.filter(
      code => !(code === "MD-INT" || code === "GAMSAT" || /^VSC-/.test(code) || /^VSE-[A-Z]+06$/.test(code))
    );
    const trialLeadLabel =
      trialSubjectCodes.length > 0 && trialSubjectCodes.every(code => code.startsWith("UCAT-")) ? "UCAT" : "";

    const hasInterviews = hasInterviewProgram;

    const TRIAL_DATES = {
      nov22: "Sunday 22 November 2026",
      nov23: "Monday 23 November 2026",
      jan: "Monday 18 January 2027",
      ukjan: "Sunday 17 January 2027"
    };

    const getTrialGroup = (subject) => {
      const { code, program } = subject;
      if (code === "MD-INT" || code === "GAMSAT") return null;
      if (code.startsWith("UCAT-UK")) return "ukjan";
      if (code.startsWith("UCAT-")) return "nov22";
      if (code.startsWith("VSC-") || /^VSE-[A-Z]+06$/.test(code)) return null;
      if (program === "Education" && (state === "NSW" || state === "QLD")) return "jan";
      return "nov23";
    };

    const subjectsByTrialGroup = {};
    subjectDetails.forEach(subject => {
      const trialGroup = getTrialGroup(subject);
      if (!trialGroup) return;
      if (!subjectsByTrialGroup[trialGroup]) subjectsByTrialGroup[trialGroup] = [];
      subjectsByTrialGroup[trialGroup].push(subject);
    });

    const trialGroups = ["nov22", "nov23", "jan", "ukjan"].filter(group => subjectsByTrialGroup[group]);

    let trialDatesHtml = "";
    if (trialGroups.length === 1) {
      trialDatesHtml = ` from <strong>${TRIAL_DATES[trialGroups[0]]}</strong>`;
    } else if (trialGroups.length > 1) {
      const trialParts = trialGroups.map(group => {
        const subjects = subjectsByTrialGroup[group];
        const subjectNames = [
          ...new Set(
            subjects.map(subject => {
              if (subject.code.startsWith("UCAT-")) return "UCAT";
              if (subject.code.startsWith("VSE-")) return "Selective Entry";
              if (subject.code.startsWith("VSC-")) return "Scholarship";
              if (subject.program === "Education") {
                const highestYear = Math.max(...subject.years);
                if (highestYear <= 10) return "Year 7-10";
                if (state === "VIC") return "VCE";
                if (state === "NSW") return "HSC";
                if (state === "QLD") return "QCE";
              }
              return subject.code;
            })
          )
        ];
        const subjectLabel = subjectNames.length <= 2 ? subjectNames.join(" and ") : "other subjects";
        return `${subjectLabel} from <strong>${TRIAL_DATES[group]}</strong>`;
      });
      trialDatesHtml =
        trialParts.length === 2
          ? `: ${trialParts[0]} and ${trialParts[1]}`
          : `: ${trialParts.slice(0, -1).join(", ")}, and ${trialParts[trialParts.length - 1]}`;
    }

    const calendarGoogleLink =
      "https://calendar.google.com/calendar/render?action=TEMPLATE&dates=20261030T220000Z/20261030T223000Z&ctz=Australia/Melbourne&text=Contour+2027+Priority+Booking+Opens&details=Priority+booking+for+Contour+2027+classes+opens+at+this+time.+You%27ll+have+24-hour+priority+access+before+the+class+timetable+opens+to+everyone.";
    const calendarIcsLink =
      "https://441696810.fs1.hubspotusercontent-ap1.net/hubfs/441696810/contour-2027-priority-booking.ics";

    const programPendingLabel = interestedSubjectList.some(code => code === "GAMSAT")
      ? "GAMSAT"
      : interestedSubjectList.some(code => /^VSC-/.test(code) || /^VSE-[A-Z]+06$/.test(code))
        ? "Scholarship"
        : "";

    const results = {
      edu1: "<strong>1 in 5 of all 99+ ATAR scorers</strong> in 2025 were Contour students.",
      med1: "<strong>1 in 3 99th percentile UCAT scorers</strong> in 2025 were Contour students.",
      med2: "The <strong>World-Record UCAT scorer (3590/3600)</strong>? That was a Contour student.",
      med3: "<strong>850 Contour students</strong> have earned admission into medicine and dentistry.",
      int1: "<strong>82% of Contour students</strong> who completed an interview received an offer.",
      edu2: "<strong>1 in 7 Contour VCE students</strong> scored a 99+ ATAR in 2025."
    };

    const isMedPrepOnly = programInterestValues.length === 1 && hasMedPrep;
    const resultStats = isMedPrepOnly
      ? [results.med1, results.med2, results.med3]
      : hasPriorityVic
        ? [results.edu1, results.edu2, results.med1, results.med3]
        : [results.edu1, results.med1, results.med3];

    const hallOfFameLink = "https://www.contoureducation.com.au/about/our-results";
    const addSubjectsLink = `https://www.contoureducation.com.au/free-trial?student_id=${recordID}`;
    const referralLink = "https://www.contoureducation.com.au/free-trial";
    const consultCallLink = "https://meetings-ap1.hubspot.com/contour/trial-consults";

    const isGraduated = yearLevel === "Graduated";

    const hasVce = interestedSubjectList.some(code => code.startsWith("VCE-"));
    const extensionDiagLabel = hasVce ? "Saturday 3 October" : "";
    const extensionFirst = extensionDiagLabel !== "";

    const steps = [
      extensionFirst ? "e" : null,
      hasConsult && !isIntFuture ? "c" : null,
      hasPriorityVic || hasPriorityInterstate ? "b" : null,
      hasTrial ? "t" : null
    ].filter(Boolean);

    const getStepNumber = step => {
      const index = steps.indexOf(step);
      return index > -1 && steps.length >= 2 ? `${index + 1}. ` : "";
    };

    const stepExtNum = getStepNumber("e");
    const stepConsultNum = getStepNumber("c");
    const stepBookingNum = getStepNumber("b");
    const stepTrialNum = getStepNumber("t");

    const ucatCrossSellLabel =
      interestedSubjectList.length > 0 && interestedSubjectList.every(code => code.startsWith("UCAT-"))
        ? ({ VIC: "VCE", NSW: "HSC", QLD: "QCE" }[state] || "")
        : "";

    const isNsw = state === "NSW";

    let datesVizVariant = "";
    if (hasPriorityVic && hasTrial) {
      datesVizVariant = hasConsult
        ? consultVariant === "test"
          ? "vse_school"
          : hasVce
            ? "school_vic_ucat"
            : "school_vic_hs_ucat"
        : hasVce
          ? "school_vic"
          : "school_vic_hs";
    } else if (hasPriorityInterstate && hasTrial) {
      datesVizVariant = isNsw
        ? hasConsult ? "school_nsw_ucat" : "school_nsw"
        : hasConsult ? "school_qld_ucat" : "school_qld";
    } else if (consultVariant === "test" && testDiagLabel && hasTrial) {
      datesVizVariant = "vse_only";
    } else if (consultVariant === "med" && hasTrial) {
      datesVizVariant =
        consultInviteLabel === "Wednesday 30 December"
          ? "ucat_uk"
          : consultInviteLabel === "Thursday 15 October"
            ? "ucat_anz"
            : "";
    }

    /*
     * Every Trial the student holds, not only this run's. The card is headed
     * "Your 2027 waitlist", so it is the whole list. What was added THIS run
     * lives in added_subject_list, which create trials writes.
     */
    const subjectNames = trials
      .map((trial) =>
        clean(trial.properties?.trial_subject) ||
        clean(trial.properties?.trialling_subject) ||
        clean(trial.properties?.subject_code)
      )
      .filter(Boolean);

    let waitlistHtml = "";
    if (subjectNames.length > 0) {
      const listItems = subjectNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("");
      waitlistHtml = `<ul style="margin-top: 0px; padding-left: 15px;">${listItems}</ul>`;
    }

    let subjectList = "";
    if (subjectNames.length === 1) {
      subjectList = subjectNames[0];
    } else if (subjectNames.length === 2) {
      subjectList = subjectNames.join(" and ");
    } else if (subjectNames.length >= 3) {
      subjectList = subjectNames.slice(0, -1).join(", ") + ", and " + subjectNames[subjectNames.length - 1];
    }

    const intQld = interestedSubjects
      .split(";")
      .some(subject => /\|program:Education\|/i.test(subject) && /\|state:QLD\|/i.test(subject));

    let smsKeyDateLine = "";
    if (hasPriorityVic) {
      smsKeyDateLine = "Class bookings will open for you on Sat 31 Oct, 9am Melbourne time.";
    } else if (hasPriorityInterstate) {
      smsKeyDateLine = intQld
        ? "Class bookings will open for you on Mon 4 Jan, 9am Brisbane time."
        : "Class bookings will open for you on Mon 4 Jan, 9am Sydney time.";
    } else if (consultVariant === "test" && consultInviteLabel) {
      smsKeyDateLine = "Your diagnostic test invitation arrives on Sat 3 Oct.";
    } else if (hasConsult && consultInviteLabel === "Thursday 15 October") {
      smsKeyDateLine = "Your welcome consultation invitation arrives on Thu 15 Oct.";
    } else if (hasConsult && consultInviteLabel === "Wednesday 30 December") {
      smsKeyDateLine = "Your welcome consultation invitation arrives on Wed 30 Dec.";
    }

    const shared = {
      studentFirstName, isIntFuture, isIntNow, intOutreachYear, hasBooking, hasConsult,
      hasPriorityVic, programPendingLabel, waitlistHtml, canAddMore, addSubjectsLink,
      hasInterviews, results, resultStats, hallOfFameLink, extensionFirst, stepExtNum,
      extensionDiagLabel, stepConsultNum, consultScopeLabel, isGraduated, medJourneyLabel,
      hasTrial, consultInviteLabel, testDiagLabel, testJourneyLabel, bookingScopeLabel,
      stepBookingNum, vicBookingOpenLabel, stepTrialNum, trialLeadLabel, trialDatesHtml,
      consultVariant, hasPriorityInterstate, interstateBookingOpenLabel
    };

    const sharedConfirmation = {
      results, hasConsult, isIntFuture, addSubjectsLink, consultVariant, studentFirstName,
      hasPriorityVic, hasPriorityInterstate, interstateBookingOpenLabel, programPendingLabel,
      hasBooking, canAddMore, ucatCrossSellLabel, referralLink, consultCallLink,
      calendarGoogleLink, calendarIcsLink
    };

    const studentIntroBodyHtml = buildIntroBodyHtml({ ...shared, isGuardian: false });
    const guardianIntroBodyHtml = buildIntroBodyHtml({ ...shared, isGuardian: true });
    const studentConfirmationBodyHtml = buildConfirmationBodyHtml({ ...sharedConfirmation, isGuardian: false });
    const guardianConfirmationBodyHtml = buildConfirmationBodyHtml({ ...sharedConfirmation, isGuardian: true });

    /*
     * The trigger flag is set in the same PATCH as the content it depends on.
     * Separating them, as the old workflow did across five actions, opens a
     * window where a record is flagged for sending with a half-written body.
     */
    const flags = TRIGGER_FLAGS[outcome] || { student: "", guardian: "" };

    const studentProperties = {
      [WAITLIST_PROPERTY]: waitlistHtml,
      [INTRO_BODY_PROPERTY]: studentIntroBodyHtml,
      [CONFIRMATION_BODY_PROPERTY]: studentConfirmationBodyHtml,
      [HAS_TRIAL_PROPERTY]: hasTrial,
      [ADD_SUBJECTS_URL_PROPERTY]: addSubjectsLink,
      [DATES_VIZ_PROPERTY]: datesVizVariant
    };
    if (flags.student) studentProperties[flags.student] = true;

    const studentResponse = await patchContact(contactId, studentProperties, "Contact");
    if (studentResponse.status !== 200) {
      throw Object.assign(
        new Error(`Contact update failed (${studentResponse.status}): ${JSON.stringify(studentResponse.data)}`),
        { customType: "contact_update_failed" }
      );
    }

    /*
     * The guardian id comes from the sync action. The old renderer searched the
     * contact's associations for the label "primary guardian" and then filtered
     * on contact_type, which is why a guardian typed "Guardian" rather than
     * "Parent" fell through to the student variant.
     */
    let guardianUpdated = false;
    if (guardianContactId) {
      const guardianProperties = {
        [WAITLIST_PROPERTY]: waitlistHtml,
        [INTRO_BODY_PROPERTY]: guardianIntroBodyHtml,
        [CONFIRMATION_BODY_PROPERTY]: guardianConfirmationBodyHtml,
        [HAS_TRIAL_PROPERTY]: hasTrial,
        [ADD_SUBJECTS_URL_PROPERTY]: addSubjectsLink,
        [DATES_VIZ_PROPERTY]: datesVizVariant,
        student_first_name: studentFirstName,
        web_form__interested_subject: interestedSubjects,
        can_add_more_subjects: canAddMore,
        state_territory_country: state
      };
      if (flags.guardian) guardianProperties[flags.guardian] = true;

      const guardianResponse = await patchContact(guardianContactId, guardianProperties, "Guardian");
      if (guardianResponse.status !== 200) {
        // The student's mail is already rendered and flagged. Losing the
        // guardian's copy should not cost the student theirs.
        console.log(
          `WARNING: could not update guardian ${guardianContactId} (${guardianResponse.status}): ${JSON.stringify(guardianResponse.data)}`
        );
      } else {
        guardianUpdated = true;
      }
    }

    /*
     * One value for the workflow to branch on, so it never has to know which
     * outcome names imply a native send. "native" is this workflow sending it;
     * "handoff" is a flag that enrols the record in a sending workflow.
     */
    const sendMode = flags.student || flags.guardian ? (flags.student ? "handoff" : "native") : "none";

    return returnOutputs({
      comms_success: true,
      send_mode: sendMode,
      resolved_outcome: outcome,
      comms_status: flags.student
        ? `Rendered; ${flags.student} set${guardianUpdated ? ` and ${flags.guardian} set on the guardian` : ""}`
        : `Rendered for a native send${guardianUpdated ? `; ${flags.guardian} set on the guardian` : ""}`,
      subject_list: subjectList,
      sms_key_date_line: smsKeyDateLine,
      subject_count: subjectNames.length,
      waitlist_subjects_html: waitlistHtml,
      dates_viz_variant: datesVizVariant,
      has_trial: hasTrial,
      guardian_updated: guardianUpdated,
      student_flag_set: flags.student,
      guardian_flag_set: guardianUpdated ? flags.guardian : ""
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error("build comms failed:", message);
    if (isTemporaryError(error)) throw error;
    return returnOutputs({
      error_type: error.customType || "build_comms_error",
      error_message: message.substring(0, 500)
    });
  }
};
