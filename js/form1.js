/* Contour Form 1 logic — source of truth: github.com/contour-tech/contour-education-signup-form-hubspot */
var ContourForm1Logic = function () {
  "use strict";
  var FIELD_SELECTORS = {
    contactType: '[name="web_form_contact_type"]',
    intakeYear: '[name="which_year_are_you_interested_in_tutoring_for_"]',
    location: '[name="state_territory_country"]',
    programInterest: '[name="program_interest"]',
    interestedSubjects: '[name="web_form__interested_subject"]',
    campus: '[name="web_form__preferred_campuses"]',
    yearLevel: '[name="year_level"]',
    schoolText: '[name="school_text"]',
    schoolCode: '[name="school_code"]',
    acaraId: '[name="acara_id"]',
    emailTemp: '[name="email_2"]',
    studentPhone: '[name="student_phone_number"]',
    noProgramWaitlist: '[name="join_no_program_waitlist"]',
    referral: '[name="referral"]',
    contactMethod: '[name="how_did_they_contact_us"]',
    signedUpBy: '[name="signed_up_by"]'
  };
  var FIELD_WRAPPER_CLASS = "hs-form-field";
  var VALID_LOCATIONS = ["VIC", "NSW", "QLD", "SA", "ACT", "TAS", "WA", "NT", "United Kingdom", "New Zealand", "Overseas"];
  // accent/accentSoft/accentContrast reuse the retired pill palette per
  // brand: hover wipes in the soft tint, selection keeps the accent on the
  // border, ring and badge. accentContrast is the badge tick colour (navy on
  // the lime TestPrep accent, white elsewhere).
  var PROGRAM_CARD_CONFIG = [{
    match: /education|tutoring/i,
    title: "High School Tutoring",
    description: "Expert tutoring for in-depth understanding and results",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbf0cd57f2b816bcc79fb_Final%20EDUCATION%20horizontal%20logo.svg",
    // Right-side clip of the hover tint so only the icon + "contour"
    // wordmark colours in, never the brand suffix. Measured per SVG: the
    // wordmark ends at x=362 and the suffix starts at x=380 in every logo,
    // so the clip sits at the x=371 midpoint of that gap over each width.
    logoTintRight: "45.4%",
    accent: "#3478F7",
    accentSoft: "rgba(52, 120, 247, 0.08)",
    accentContrast: "#FFFFFF"
  }, {
    match: /test\s*prep|selective/i,
    title: "Selective Entry & Scholarship",
    description: "Preparing junior students for selective school examinations",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbed5fdbd2c829b5e4e7c_Final%20TESTPREP%20Charcoal%20horizontal%20logo.svg",
    logoTintRight: "41.8%",
    accent: "#3478F7",
    accentSoft: "rgba(52, 120, 247, 0.08)",
    accentContrast: "#FFFFFF"
  }, {
    match: /med\s*prep|ucat/i,
    title: "Medical Entry",
    description: "UCAT tutoring and medical interview coaching",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbed5058c7ec65b1a454e_Final%20MEDPREP%20Charcoal%20horizontal%20logo.svg",
    logoTintRight: "39.9%",
    accent: "#3478F7",
    accentSoft: "rgba(52, 120, 247, 0.08)",
    accentContrast: "#FFFFFF"
  }];
  var UK_TOKEN = "United Kingdom";
  var UCAT_UK_PATTERN = /UCAT\s*\(UK\)/i;
  var UCAT_ANZ_PATTERN = /UCAT\s*\(ANZ\)/i;
  // 2027 Curriculum Planning Matrix (Wassim, 7 Aug 2026): region x year level
  // -> subject codes shown for intake 2027. Intake 2026 keeps the structured-
  // value logic (the matrix is a 2027 planning view and omits 2026-only
  // subjects like VSE Core).
  var SUBJECT_MATRIX_INTAKE = "2027";
  var SUBJECT_MATRIX = { "VIC": { "Year 5": ["VSC-EN05", "VSC-MA05", "VSC-WR05"], "Year 6": ["VIC-EN07", "VIC-EN08", "VIC-MA07", "VIC-MA08", "VIC-SC07", "VIC-SC08", "VSE-EN06", "VSE-MA06", "VSE-WR06"], "Year 7": ["VIC-EN07", "VIC-EN08", "VIC-EN09", "VIC-MA07", "VIC-MA08", "VIC-MA09", "VIC-SC07", "VIC-SC08", "VIC-SC09", "VSE-EN07", "VSE-MA07", "VSE-WR07"], "Year 8": ["VIC-EN08", "VIC-EN09", "VIC-EN10", "VIC-MA08", "VIC-MA09", "VIC-MA1A", "VIC-SC08", "VIC-SC09", "VIC-SC10", "VSE-EN08", "VSE-MA08", "VSE-WR08"], "Year 9": ["VCE-BI12", "VCE-CH12", "VCE-EL12", "VCE-EN12", "VCE-MM12", "VCE-PH12", "VCE-SM12", "VIC-EN09", "VIC-EN10", "VIC-MA09", "VIC-MA1A", "VIC-SC09", "VIC-SC10"], "Year 10": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-BI34", "VCE-CH12", "VCE-CH34", "VCE-EL12", "VCE-EL34", "VCE-EN12", "VCE-EN34", "VCE-MM12", "VCE-MM34", "VCE-PH12", "VCE-PH34", "VCE-SM12", "VCE-SM34", "VIC-EN10", "VIC-MA1A", "VIC-SC10"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-BI34", "VCE-CH12", "VCE-CH34", "VCE-EL12", "VCE-EL34", "VCE-EN12", "VCE-EN34", "VCE-MM12", "VCE-MM34", "VCE-PH12", "VCE-PH34", "VCE-SM12", "VCE-SM34"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST", "VCE-BI34", "VCE-CH34", "VCE-EL34", "VCE-EN34", "VCE-MM34", "VCE-PH34", "VCE-SM34"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "QLD": { "Year 6": ["QLD-EN07", "QLD-EN08", "QLD-MA07", "QLD-MA08", "QLD-SC07", "QLD-SC08"], "Year 7": ["QLD-EN07", "QLD-EN08", "QLD-EN09", "QLD-MA07", "QLD-MA08", "QLD-MA09", "QLD-SC07", "QLD-SC08", "QLD-SC09"], "Year 8": ["QLD-EN08", "QLD-EN09", "QLD-EN10", "QLD-MA08", "QLD-MA09", "QLD-MA1A", "QLD-SC08", "QLD-SC09", "QLD-SC10"], "Year 9": ["QCE-BI12", "QCE-CH12", "QCE-MM12", "QCE-PH12", "QCE-SM12", "QLD-EN09", "QLD-EN10", "QLD-MA09", "QLD-MA1A", "QLD-SC09", "QLD-SC10"], "Year 10": ["MD-INT", "QCE-BI12", "QCE-BI34", "QCE-CH12", "QCE-CH34", "QCE-MM12", "QCE-MM34", "QCE-PH12", "QCE-PH34", "QCE-SM12", "QCE-SM34", "QLD-EN10", "QLD-MA1A", "QLD-SC10", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "QCE-BI12", "QCE-BI34", "QCE-CH12", "QCE-CH34", "QCE-MM12", "QCE-MM34", "QCE-PH12", "QCE-PH34", "QCE-SM12", "QCE-SM34", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "QCE-BI34", "QCE-CH34", "QCE-MM34", "QCE-PH34", "QCE-SM34", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "WA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "SA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NSW": { "Year 6": ["NSW-EN07", "NSW-EN08", "NSW-MA07", "NSW-MA08", "NSW-SC07", "NSW-SC08"], "Year 7": ["NSW-EN07", "NSW-EN08", "NSW-EN09", "NSW-MA07", "NSW-MA08", "NSW-MA09", "NSW-SC07", "NSW-SC08", "NSW-SC09"], "Year 8": ["NSW-EN08", "NSW-EN09", "NSW-EN10", "NSW-MA08", "NSW-MA09", "NSW-MA10", "NSW-SC08", "NSW-SC09", "NSW-SC10"], "Year 9": ["NSW-EN09", "NSW-EN10", "NSW-MA09", "NSW-MA10", "NSW-SC09", "NSW-SC10", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS"], "Year 10": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "NSW-EN10", "NSW-MA10", "NSW-SC10", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS", "UCAT-ANZ-CORE"], "Year 11": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS", "UCAT-ANZ-CORE"], "Year 12": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "TAS": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "ACT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NZ": { "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-CORE"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "UK": { "Year 10": ["MD-INT", "UCAT-UK-MAST"], "Year 11": ["MD-INT", "UCAT-UK-MAST"], "Year 12": ["MD-INT", "UCAT-UK-MAST"], "Year 13": ["MD-INT", "UCAT-UK-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-UK-MAST"] }, "INTERNATIONAL": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] } };
  // UCAT enrolments are closed until later in September 2026 (Ramodh via Luke,
  // 12 Aug 2026). While closed, UCAT signups are waitlist registrations, not
  // enrolments: the Welcome Consultation scheduler is hidden and a waitlist
  // note takes its place. Flip UCAT_ENROLMENTS_OPEN back to true when
  // enrolments reopen — nothing else needs changing.
  var UCAT_ENROLMENTS_OPEN = false;
  var UCAT_SUBJECT_CODES = ["UCAT-ANZ-CORE", "UCAT-ANZ-MAST", "UCAT-UK-CORE", "UCAT-UK-MAST"];
  var UCAT_WAITLIST_NOTE = "UCAT enrolments are closed until later in September. Submitting this form joins the UCAT waitlist — it is not an enrolment, and no Welcome Consultation can be booked yet. Our team will contact you to book your consultation once enrolments reopen.";
  // Welcome Consultation bookings are switched off for the AY27 intake while
  // consults are not live yet (Amitav, 16 Aug 2026). MedPrep and TestPrep
  // students see the yellow "open soon" note instead of the Calendly
  // scheduler. Flip WC_BOOKINGS_OPEN back to true to restore the scheduler —
  // nothing else needs changing.
  var WC_BOOKINGS_OPEN = false;
  var WC_OPEN_SOON_NOTE = "Welcome Consultation bookings open soon. You can submit this form now — our team will contact you to book your Welcome Consultation once bookings open.";
  var CATEGORY_DISPLAY_ORDER = ["Mathematics", "Science", "English", "TestPrep", "MedPrep", "Other"];
  var CATEGORY_DISPLAY_NAMES = {
    TestPrep: "Selective Entry & Scholarship",
    MedPrep: "Medical Entry"
  };
  function matrixLocationKey(location) {
    if (location === "United Kingdom") return "UK";
    if (location === "New Zealand") return "NZ";
    if (location === "Overseas") return "INTERNATIONAL";
    return location;
  }
  function subjectMatchesMatrix(classification, location, yearLevel, selectedIntakeYear) {
    // Returns true/false when the matrix rules, null when the caller should
    // fall back to the structured-value logic.
    // Test subjects (test:true) never appear in the planning matrix, so they
    // always take the structured-value path — otherwise the matrix would hide
    // them outright and every test round would need a code change here.
    if (classification.test) return null;
    if (selectedIntakeYear !== SUBJECT_MATRIX_INTAKE) return null;
    if (!classification.code || !location || !yearLevel) return null;
    var byYear = SUBJECT_MATRIX[matrixLocationKey(location)];
    if (!byYear) return false;
    var codes = byYear[yearLevel];
    if (!codes) return false;
    return codes.indexOf(classification.code) !== -1;
  }
  function isUcatSubject(classification) {
    return !!classification.code && UCAT_SUBJECT_CODES.indexOf(classification.code) !== -1;
  }
  // AY26 UCAT rules (Amitav, 16 Aug 2026): students sitting UCAT in 2026 —
  // the Mastery cohort (Year 12/13/Graduated depending on region) — can no
  // longer sign up for the 2026 intake, so the MAST subjects are blocked
  // there. Year-11-and-younger AY26 UCAT signups (Core cohort) stay open and
  // are treated as AY27 signups downstream — no form change needed for them.
  var UCAT_BLOCKED_INTAKE = "2026";
  var UCAT_BLOCKED_CODES = ["UCAT-ANZ-MAST", "UCAT-UK-MAST"];
  function ucatBlockedForIntake(classification, selectedIntakeYear) {
    if (selectedIntakeYear !== UCAT_BLOCKED_INTAKE) return false;
    return !!classification.code && UCAT_BLOCKED_CODES.indexOf(classification.code) !== -1;
  }
  function subjectMatchesLocation(subjectState, selectedLocation) {
    if (!subjectState) return true;
    if (subjectState === "ANZ") return !!selectedLocation && selectedLocation !== UK_TOKEN;
    if (subjectState === "UK") return selectedLocation === UK_TOKEN;
    return subjectState === selectedLocation;
  }
  function subjectMatchesPrograms(subjectProgram, selectedPrograms) {
    if (subjectProgram === null) return true;
    return selectedPrograms.indexOf(subjectProgram) !== -1;
  }
  function subjectMatchesDelivery(classification) {
    return classification.delivery === "Term";
  }
  // Test subjects exist so staff can run signup rounds without touching a real
  // offering. They must stay invisible to the public form.
  function subjectMatchesAudience(classification) {
    return !classification.test || isInternalMode();
  }
  function subjectMatchesIntake(classification, selectedIntakeYear) {
    if (!classification.intake) return true;
    if (!selectedIntakeYear) return true;
    return classification.intake.indexOf(selectedIntakeYear) !== -1;
  }
  function parseStructuredSubjectValue(rawValue) {
    if (!rawValue || rawValue.indexOf(":") === -1) return null;
    var pairs = rawValue.split("|");
    var parsed = {};
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf(":");
      if (idx === -1) continue;
      var key = pairs[i].slice(0, idx).trim();
      var value = pairs[i].slice(idx + 1).trim();
      parsed[key] = value;
    }
    if (!parsed.code || !parsed.program) return null;
    return parsed;
  }
  function structuredYearListToLevels(yearStr) {
    if (!yearStr || yearStr === "ALL") return null;
    return yearStr.split(",").map(function (token) {
      var trimmed = token.trim();
      return trimmed === "Graduated" ? "Graduated" : "Year " + trimmed;
    });
  }
  function classificationFromStructuredValue(parsed) {
    var state = !parsed.state || parsed.state === "ALL" ? null : parsed.state;
    var intake = parsed.intake ? parsed.intake.split(",").map(function (s) {
      return s.trim();
    }) : null;
    return {
      program: parsed.program,
      state: state,
      category: parsed.category || parsed.program,
      yearsShown: structuredYearListToLevels(parsed.year),
      delivery: parsed.delivery || "Term",
      intake: intake,
      test: parsed.test === "true",
      code: parsed.code,
      subject: parsed.subject || null,
      structured: true
    };
  }
  function parseStructuredCampusValue(rawValue) {
    if (!rawValue || rawValue.indexOf(":") === -1) return null;
    var pairs = rawValue.split("|");
    var parsed = {};
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf(":");
      if (idx === -1) continue;
      var key = pairs[i].slice(0, idx).trim();
      var value = pairs[i].slice(idx + 1).trim();
      parsed[key] = value;
    }
    if (!parsed.code) return null;
    return parsed;
  }
  function classificationFromStructuredCampusValue(parsed) {
    return {
      code: parsed.code,
      state: !parsed.state || parsed.state === "ALL" ? null : parsed.state,
      country: parsed.country || null
    };
  }
  var formRoot = null;
  function q(selector) {
    return formRoot.querySelector(selector);
  }
  function qAll(selector) {
    return Array.prototype.slice.call(formRoot.querySelectorAll(selector));
  }
  function fieldWrapper(el) {
    if (!el) return null;
    return el.closest ? el.closest("." + FIELD_WRAPPER_CLASS) : null;
  }
  function showFieldWrapper(el) {
    var wrap = fieldWrapper(el);
    if (wrap) wrap.style.removeProperty("display");
  }
  function hideFieldWrapper(el) {
    var wrap = fieldWrapper(el);
    if (wrap) wrap.style.display = "none";
  }
  function toggleFieldWrapper(el, shouldShow) {
    if (shouldShow) showFieldWrapper(el); else hideFieldWrapper(el);
  }
  function getValue(selector) {
    var el = q(selector);
    return el ? el.value || "" : "";
  }
  function getCheckedValues(selector) {
    return qAll(selector + ":checked").map(function (el) {
      return el.value;
    });
  }
  function setCheckboxChecked(inputEl, checked) {
    if (!inputEl) return;
    if (inputEl.checked !== checked) {
      inputEl.click();
    }
  }
  function optionWrapper(inputEl) {
    return inputEl.closest(".contour-program-card") || inputEl.closest("li") || (inputEl.parentElement && inputEl.parentElement.tagName === "LABEL" ? inputEl.parentElement : null) || inputEl.parentElement;
  }
  function optionLabelText(inputEl) {
    var wrap = optionWrapper(inputEl);
    if (!wrap) return "";
    // textContent includes display:none elements, and the exclusion note keeps
    // its stale text after unblocking — so injected UI must be stripped or it
    // leaks into the subject summary chips and label matching.
    var clone = wrap.cloneNode(true);
    var injected = clone.querySelectorAll(".contour-subject-exclusion-note, .contour-interview-program-note");
    for (var i = 0; i < injected.length; i++) {
      injected[i].parentNode.removeChild(injected[i]);
    }
    return clone.textContent.trim();
  }
  function showOption(inputEl) {
    var wrap = optionWrapper(inputEl);
    if (wrap) wrap.style.removeProperty("display");
  }
  function hideOption(inputEl) {
    var wrap = optionWrapper(inputEl);
    if (wrap) wrap.style.display = "none";
    setCheckboxChecked(inputEl, false);
  }
  function setHiddenValue(selector, value) {
    var el = q(selector);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    el.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  function matchCardConfig(inputEl, index) {
    var haystack = (inputEl.value || "") + " " + optionLabelText(inputEl);
    for (var i = 0; i < PROGRAM_CARD_CONFIG.length; i++) {
      if (PROGRAM_CARD_CONFIG[i].match.test(haystack)) return PROGRAM_CARD_CONFIG[i];
    }
    console.warn('Contour Form 1 logic: Program Interest option "' + haystack.trim() + "\" didn't match a known card pattern — falling back to positional order.");
    return PROGRAM_CARD_CONFIG[index] || null;
  }
  function enhanceCampusLabels() {
    var options = qAll(FIELD_SELECTORS.campus);
    options.forEach(function (opt) {
      var wrap = optionWrapper(opt);
      if (!wrap || wrap.querySelector(".contour-campus-address")) return;
      var span = wrap.querySelector("input + span");
      if (!span) return;
      var fullText = span.textContent;
      var match = fullText.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (!match) return;
      var mainText = match[1].trim();
      var addressText = match[2].trim();
      span.textContent = "";
      span.classList.add("contour-campus-label");
      var mainSpan = document.createElement("span");
      mainSpan.className = "contour-campus-name";
      mainSpan.textContent = mainText;
      span.appendChild(mainSpan);
      span.appendChild(document.createTextNode(" "));
      var addressSpan = document.createElement("span");
      addressSpan.className = "contour-campus-address";
      addressSpan.textContent = addressText;
      span.appendChild(addressSpan);
    });
  }
  function injectProgramCardAccentStyles() {
    // The live page can't take stylesheet updates, so the brand-accent
    // hover/selection styling ships from JS. Accent values come from each
    // card's inline CSS variables (set in enhanceProgramInterestCards); the
    // ::before layer wipes the soft tint in slowly from the left on hover
    // and stays put while selected. Injected after the page styles, so ties
    // on specificity resolve in favour of these rules.
    if (document.getElementById("contour-program-card-accent-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-program-card-accent-styles";
    style.textContent = "" +
      // overflow stays visible so the corner badge can straddle the outline.
      ".hs-form .contour-program-card { position: relative; }" +
      // Card background: transparent on hover — the translucent blue tint
      // fades in only while the card is selected.
      ".hs-form .contour-program-card::before { content: \"\"; position: absolute; inset: 0; border-radius: inherit; background: var(--contour-card-accent-soft, transparent); opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }" +
      ".hs-form .contour-program-card--selected::before { opacity: 1; }" +
      // Hover: just the logo and the outline light up in Contour blue.
      ".hs-form .contour-program-card:hover { border-color: var(--contour-card-accent, #3478F7); }" +
      // Selected: bolder border (2px ring on top of the 1px border).
      ".hs-form .contour-program-card--selected { border-color: var(--contour-card-accent, #3478F7); box-shadow: 0 0 0 2px var(--contour-card-accent, #3478F7); }" +
      // Badge: always green, centred SVG tick, pinned half-out on the
      // top-right corner of the outline with a white ring so it never
      // overlaps the card content.
      ".hs-form .contour-program-card .contour-program-card__badge { top: -9px; right: -9px; width: 22px; height: 22px; background-color: #2f9e44; color: #FFFFFF; box-shadow: 0 0 0 2px #FFFFFF; z-index: 1; }" +
      ".hs-form .contour-program-card .contour-program-card__badge svg { display: block; }" +
      // Logo: Contour-blue copy stacked on the charcoal original, wiped in
      // from the left via clip-path. Filter chain recolours the charcoal SVG
      // to #3478F7 (brightness(0) first, then rotate to the blue).
      ".hs-form .contour-program-card__logo-placeholder--has-logo { position: relative; }" +
      ".hs-form .contour-program-card__logo-tint { position: absolute; top: 0; left: 0; height: 100%; width: auto; max-width: 100%; object-fit: contain; pointer-events: none; filter: brightness(0) saturate(100%) invert(42%) sepia(85%) saturate(3550%) hue-rotate(211deg) brightness(100%) contrast(94%); clip-path: inset(0 100% 0 0); transition: clip-path 0.7s ease; }" +
      ".hs-form .contour-program-card:hover .contour-program-card__logo-tint, .hs-form .contour-program-card--selected .contour-program-card__logo-tint { clip-path: inset(0 var(--contour-logo-tint-right, 0%) 0 0); }";
    document.head.appendChild(style);
  }
  function enhanceProgramInterestCards() {
    injectProgramCardAccentStyles();
    var checkboxes = qAll(FIELD_SELECTORS.programInterest);
    var gridApplied = false;
    checkboxes.forEach(function (inputEl, index) {
      if (inputEl.closest(".contour-program-card")) return;
      var config = matchCardConfig(inputEl, index);
      var nativeWrapper = inputEl.closest("li") || inputEl.parentElement;
      var sharedParent = nativeWrapper.parentNode;
      var card = document.createElement("label");
      card.className = "contour-program-card";
      if (config && config.accent) {
        card.style.setProperty("--contour-card-accent", config.accent);
        card.style.setProperty("--contour-card-accent-soft", config.accentSoft);
        card.style.setProperty("--contour-card-accent-contrast", config.accentContrast);
        if (config.logoTintRight) {
          card.style.setProperty("--contour-logo-tint-right", config.logoTintRight);
        }
      }
      var badge = document.createElement("span");
      badge.className = "contour-program-card__badge";
      badge.setAttribute("aria-hidden", "true");
      // Proper geometric tick (SVG polyline) instead of the ✓ text glyph —
      // renders identically everywhere and centres exactly in the circle.
      badge.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" focusable="false"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      card.appendChild(badge);
      var body = document.createElement("span");
      body.className = "contour-program-card__body";
      var logoPlaceholder = document.createElement("span");
      logoPlaceholder.className = "contour-program-card__logo-placeholder";
      logoPlaceholder.setAttribute("aria-hidden", "true");
      if (config && config.logoUrl) {
        logoPlaceholder.classList.add("contour-program-card__logo-placeholder--has-logo");
        var logoImg = document.createElement("img");
        logoImg.className = "contour-program-card__logo";
        logoImg.src = config.logoUrl;
        logoImg.alt = "";
        logoPlaceholder.appendChild(logoImg);
        // Navy-tinted copy of the logo, clipped to zero width until hover
        // wipes it across the charcoal original (see the injected styles).
        var logoTint = document.createElement("img");
        logoTint.className = "contour-program-card__logo-tint";
        logoTint.src = config.logoUrl;
        logoTint.alt = "";
        logoTint.setAttribute("aria-hidden", "true");
        logoPlaceholder.appendChild(logoTint);
      }
      body.appendChild(logoPlaceholder);
      var titleEl = document.createElement("span");
      titleEl.className = "contour-program-card__title";
      titleEl.textContent = config ? config.title : optionLabelText(inputEl);
      body.appendChild(titleEl);
      if (config) {
        var descEl = document.createElement("span");
        descEl.className = "contour-program-card__description";
        descEl.textContent = config.description;
        body.appendChild(descEl);
      }
      card.appendChild(body);
      card.insertBefore(inputEl, card.firstChild);
      function syncSelectedState() {
        card.classList.toggle("contour-program-card--selected", inputEl.checked);
      }
      inputEl.addEventListener("change", syncSelectedState);
      syncSelectedState();
      nativeWrapper.parentNode.replaceChild(card, nativeWrapper);
      if (!gridApplied && sharedParent) {
        enforceProgramCardGrid(sharedParent);
        gridApplied = true;
      }
    });
  }
  function enforceProgramCardGrid(ul) {
    var mq = window.matchMedia("(max-width: 700px)");
    function apply() {
      ul.style.display = "grid";
      ul.style.gap = "14px";
      ul.style.gridTemplateColumns = mq.matches ? "1fr" : "repeat(3, minmax(0, 1fr))";
    }
    apply();
    mq.addEventListener("change", apply);
    var observer = new MutationObserver(apply);
    observer.observe(ul, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  function enforceContactTypeLayout(ul) {
    var mq = window.matchMedia("(max-width: 767px)");
    function apply() {
      ul.style.display = "flex";
      ul.style.flexDirection = mq.matches ? "column" : "row";
      ul.style.gap = mq.matches ? "0.75rem" : "1.25rem";
    }
    apply();
    mq.addEventListener("change", apply);
    var observer = new MutationObserver(apply);
    observer.observe(ul, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  function enforceContactTypeLayoutIfPresent() {
    var contactTypeUl = formRoot.querySelector(".hs-fieldtype-radio .input > ul.inputs-list");
    if (contactTypeUl) enforceContactTypeLayout(contactTypeUl);
  }
  var CONTACT_TYPE_ILLUSTRATIONS = [{
    match: /student/i,
    url: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a66e39e97ac4cd2dff8015f_Workbook%20Outline%202.avif"
  }, {
    match: /guardian/i,
    url: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/69af5e98ec0cb906f867e85d_Special%20events.avif"
  }];
  function matchContactTypeIllustration(labelText) {
    for (var i = 0; i < CONTACT_TYPE_ILLUSTRATIONS.length; i++) {
      if (CONTACT_TYPE_ILLUSTRATIONS[i].match.test(labelText)) return CONTACT_TYPE_ILLUSTRATIONS[i];
    }
    return null;
  }
  function enhanceContactTypeIllustrations() {
    var radios = qAll(FIELD_SELECTORS.contactType);
    radios.forEach(function (radio) {
      var wrap = optionWrapper(radio);
      if (!wrap || wrap.querySelector(".contour-contact-type-illustration")) return;
      var label = wrap.querySelector("label.hs-form-radio-display");
      if (!label) return;
      var config = matchContactTypeIllustration(optionLabelText(radio));
      if (!config) return;
      var img = document.createElement("img");
      img.className = "contour-contact-type-illustration";
      img.src = config.url;
      img.alt = "";
      label.classList.add("contour-contact-type-has-illustration");
      label.insertBefore(img, label.firstChild);
    });
  }
  function subjectMatchesYearLevel(classification, yearLevelValue) {
    if (!yearLevelValue) return true;
    if (classification.yearsShown === null) return true;
    return classification.yearsShown.indexOf(yearLevelValue) !== -1;
  }
  function isProgramEligibleFromSubjects(programValue, location, yearLevel, intakeYear) {
    var subjectInputs = qAll(FIELD_SELECTORS.interestedSubjects);
    for (var i = 0; i < subjectInputs.length; i++) {
      var classification = getClassification(subjectInputs[i]);
      if (classification.program !== programValue) continue;
      if (!subjectMatchesAudience(classification)) continue;
      var matrixVerdict = subjectMatchesMatrix(classification, location, yearLevel, intakeYear);
      if (matrixVerdict === false) continue;
      if (matrixVerdict === null) {
        if (!subjectMatchesLocation(classification.state, location)) continue;
        if (!subjectMatchesYearLevel(classification, yearLevel)) continue;
      }
      if (!subjectMatchesDelivery(classification)) continue;
      if (!subjectMatchesIntake(classification, intakeYear)) continue;
      if (ucatBlockedForIntake(classification, intakeYear)) continue;
      return true;
    }
    return false;
  }
  function hasNativeRequiredMark(fieldWrap) {
    return !!fieldWrap.querySelector('label .hs-form-required:not([class*="contour-"])');
  }
  function createRequiredMarkUpdater(fieldSelectorKey, className) {
    var mark = null;
    return function (shouldShow) {
      if (!mark) {
        var field = q(FIELD_SELECTORS[fieldSelectorKey]);
        var fieldWrap = field ? fieldWrapper(field) : null;
        if (!fieldWrap) return;
        if (hasNativeRequiredMark(fieldWrap)) return;
        var label = fieldWrap.querySelector("label");
        mark = document.createElement("span");
        mark.className = "hs-form-required " + className;
        mark.textContent = "*";
        mark.style.display = "none";
        if (label) label.appendChild(mark); else fieldWrap.insertBefore(mark, fieldWrap.firstChild);
      }
      mark.style.display = shouldShow ? "" : "none";
    };
  }
  var updateProgramInterestRequiredMark = createRequiredMarkUpdater("programInterest", "contour-program-interest-required");
  var updateCampusRequiredMark = createRequiredMarkUpdater("campus", "contour-campus-required");
  var updateSubjectsRequiredMark = createRequiredMarkUpdater("interestedSubjects", "contour-subjects-required");
  function evaluateProgramInterestOptions() {
    var location = getValue(FIELD_SELECTORS.location);
    var yearLevel = getValue(FIELD_SELECTORS.yearLevel);
    var intakeYear = getValue(FIELD_SELECTORS.intakeYear);
    var options = qAll(FIELD_SELECTORS.programInterest);
    var anyEligible = false;
    var eligibleOptions = [];
    options.forEach(function (opt) {
      var programValue = opt.value;
      var eligible = !!location && !!yearLevel && !!intakeYear && isProgramEligibleFromSubjects(programValue, location, yearLevel, intakeYear);
      if (eligible) {
        anyEligible = true;
        eligibleOptions.push(opt);
      }
      var card = opt.closest(".contour-program-card");
      if (card) card.classList.toggle("contour-program-card--disabled", !eligible);
      if (!eligible) setCheckboxChecked(opt, false);
      opt.disabled = !eligible;
    });
    var anyChecked = options.some(function (opt) {
      return opt.checked;
    });
    if (eligibleOptions.length === 1 && !anyChecked) {
      setCheckboxChecked(eligibleOptions[0], true);
    }
    showFieldWrapper(q(FIELD_SELECTORS.programInterest));
    updateProgramInterestLocationHint(!location || !yearLevel || !intakeYear);
    updateProgramInterestRequiredMark(anyEligible);
    updateNoProgramsAvailableMessage(location, yearLevel, intakeYear, anyEligible);
  }
  function ensureProgramInterestLocationHint() {
    var existing = formRoot.querySelector("#contour-program-interest-location-hint");
    if (existing) return existing;
    var programField = q(FIELD_SELECTORS.programInterest);
    var fieldWrap = programField ? fieldWrapper(programField) : null;
    if (!fieldWrap) return null;
    var hint = document.createElement("p");
    hint.id = "contour-program-interest-location-hint";
    hint.className = "contour-program-interest-location-hint";
    hint.textContent = "Select your location, year level, and intake year to see available programs";
    var label = fieldWrap.querySelector("label");
    if (label && label.parentNode) {
      label.parentNode.insertBefore(hint, label.nextSibling);
    } else {
      fieldWrap.insertBefore(hint, fieldWrap.firstChild);
    }
    return hint;
  }
  function updateProgramInterestLocationHint(shouldShow) {
    var hint = ensureProgramInterestLocationHint();
    if (!hint) return;
    hint.style.display = shouldShow ? "" : "none";
  }
  function ensureNoProgramsMessage() {
    var existing = formRoot.querySelector("#contour-no-programs-message");
    if (existing) return existing;
    var container = document.createElement("div");
    container.id = "contour-no-programs-message";
    container.className = "contour-no-programs-message";
    container.style.display = "none";
    var text = document.createElement("p");
    text.className = "contour-no-programs-message__text";
    container.appendChild(text);
    var programField = q(FIELD_SELECTORS.programInterest);
    var fieldWrap = programField ? fieldWrapper(programField) : null;
    if (fieldWrap && fieldWrap.parentNode) {
      fieldWrap.parentNode.insertBefore(container, fieldWrap.nextSibling);
    } else if (formRoot) {
      formRoot.appendChild(container);
    }
    var waitlistField = q(FIELD_SELECTORS.noProgramWaitlist);
    var waitlistWrap = waitlistField ? fieldWrapper(waitlistField) : null;
    if (waitlistWrap) container.appendChild(waitlistWrap);
    return container;
  }
  function getNoProgramsMessageText(location, yearLevel, intakeYear) {
    var DEFAULT_MESSAGE = "We don't currently offer any programs for your location and year level, join the waitlist to be notified when new programs become available";
    if (intakeYear !== "2026") return DEFAULT_MESSAGE;
    var programValues = qAll(FIELD_SELECTORS.programInterest).map(function (opt) {
      return opt.value;
    });
    var wouldBeEligibleFor2027 = programValues.some(function (programValue) {
      return isProgramEligibleFromSubjects(programValue, location, yearLevel, "2027");
    });
    if (wouldBeEligibleFor2027) {
      return "We don't currently offer any programs for your location and year level in 2026, update your intake year to 2027 to see more options";
    }
    return DEFAULT_MESSAGE;
  }
  function updateNoProgramsAvailableMessage(location, yearLevel, intakeYear, anyEligible) {
    var shouldShow = !!location && !!yearLevel && !!intakeYear && !anyEligible;
    var message = ensureNoProgramsMessage();
    message.style.display = shouldShow ? "" : "none";
    if (shouldShow) {
      var textEl = message.querySelector(".contour-no-programs-message__text");
      if (textEl) textEl.textContent = getNoProgramsMessageText(location, yearLevel, intakeYear);
    } else {
      var waitlistField = q(FIELD_SELECTORS.noProgramWaitlist);
      setCheckboxChecked(waitlistField, false);
    }
  }
  var YEAR_13_LOCATIONS = ["United Kingdom", "New Zealand", "Overseas"];
  function evaluateYearLevelOptions() {
    var select = q(FIELD_SELECTORS.yearLevel);
    if (!select) return;
    var location = getValue(FIELD_SELECTORS.location);
    var intakeYear = getValue(FIELD_SELECTORS.intakeYear);
    var year13Eligible = YEAR_13_LOCATIONS.indexOf(location) !== -1;
    // Year 5 has no 2026 offering publicly, but internal test rounds need it
    // selectable so a test:true Year 5 subject can be reached in either intake.
    var year5Blocked = intakeYear === "2026" && !isInternalMode();
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.value === "Year 13") {
        opt.hidden = !year13Eligible;
        opt.disabled = !year13Eligible;
        return;
      }
      if (opt.value === "Year 5") {
        if (!opt.hasAttribute("data-original-text")) {
          opt.setAttribute("data-original-text", opt.textContent);
        }
        var originalText = opt.getAttribute("data-original-text");
        opt.disabled = year5Blocked;
        opt.textContent = year5Blocked ? originalText + " - Subjects coming in 2027" : originalText;
      }
    });
    if (!year13Eligible && select.value === "Year 13") {
      select.value = "";
      select.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    if (year5Blocked && select.value === "Year 5") {
      select.value = "";
      select.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
  }
  var subjectClassificationCache = new WeakMap;
  var updateSchoolRequiredMark = createRequiredMarkUpdater("schoolText", "contour-school-required");
  function evaluateSchoolFieldVisibility() {
    var input = q(FIELD_SELECTORS.schoolText);
    if (!input) return;
    var location = getValue(FIELD_SELECTORS.location);
    var shouldHide = YEAR_13_LOCATIONS.indexOf(location) !== -1;
    toggleFieldWrapper(input, !shouldHide);
    updateSchoolRequiredMark(!shouldHide);
    if (shouldHide) {
      var codeInput = q(FIELD_SELECTORS.schoolCode);
      var acaraInput = q(FIELD_SELECTORS.acaraId);
      if (input.value) setHiddenValue(FIELD_SELECTORS.schoolText, "");
      if (codeInput && codeInput.value) setHiddenValue(FIELD_SELECTORS.schoolCode, "");
      if (acaraInput && acaraInput.value) setHiddenValue(FIELD_SELECTORS.acaraId, "");
    }
  }
  function setFieldLabelText(fieldSelectorKey, text) {
    var field = q(FIELD_SELECTORS[fieldSelectorKey]);
    var wrap = field ? fieldWrapper(field) : null;
    if (!wrap) return;
    var label = wrap.querySelector("label");
    if (!label) return;
    var spans = label.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (!/hs-form-required/.test(spans[i].className)) {
        spans[i].textContent = text;
        return;
      }
    }
    var node = label.firstChild;
    while (node && node.nodeType !== 3) node = node.nextSibling;
    if (node) node.nodeValue = text; else label.insertBefore(document.createTextNode(text), label.firstChild);
  }
  var lastIntakeForYearLevel = null;
  function evaluateIntakeYearDependents() {
    var intake = getValue(FIELD_SELECTORS.intakeYear);
    var yearSelect = q(FIELD_SELECTORS.yearLevel);
    if (yearSelect) {
      yearSelect.disabled = !intake;
      // The answer means "year level in <intake year>" — switching intake
      // (2026 <-> 2027) invalidates it, so force a re-selection.
      var intakeSwitched = !!intake && !!lastIntakeForYearLevel && intake !== lastIntakeForYearLevel;
      if ((!intake || intakeSwitched) && yearSelect.value) {
        yearSelect.value = "";
        yearSelect.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
      setFieldLabelText("yearLevel", intake ? "Year level in " + intake : "Current Year Level");
    }
    lastIntakeForYearLevel = intake || null;
    var schoolInput = q(FIELD_SELECTORS.schoolText);
    if (schoolInput) {
      var location = getValue(FIELD_SELECTORS.location);
      schoolInput.disabled = !intake || !location;
      updateSchoolFieldGraduateMode();
    }
  }
  // Graduated students are asked for their university, not their old high
  // school (Ramodh via Amitav, 18 Aug 2026) — grad classes are split by uni
  // vs gap year. Two quick answers, "Gap Year" and "Not In University", are
  // offered as helper-text links and pinned at the top of the suggestion
  // list. Everything reverts when the year level changes away from
  // Graduated.
  var GRAD_QUICK_VALUE = "Gap Year/Not in University";
  // Older split values, cleared on year-level change like the current one.
  var GRAD_QUICK_LEGACY_VALUES = [GRAD_QUICK_VALUE, "Gap Year", "Not In University", "Gap Year / Not at Uni"];
  function isGraduatedSelected() {
    return getValue(FIELD_SELECTORS.yearLevel) === "Graduated";
  }
  // Set by enhanceSchoolSearch so quick-fill goes through the combobox's own
  // selectSchool() — the exact event sequence (input + change) that clears
  // HubSpot's native "Please complete this required field" error. A bare
  // value write + change event leaves that error stuck.
  var schoolQuickFillHook = null;
  function fillSchoolQuickOption(value) {
    if (schoolQuickFillHook) {
      schoolQuickFillHook(value);
      return;
    }
    var schoolInput = q(FIELD_SELECTORS.schoolText);
    if (!schoolInput) return;
    schoolInput.value = value;
    schoolInput.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    schoolInput.dispatchEvent(new Event("change", {
      bubbles: true
    }));
    var codeInput = q(FIELD_SELECTORS.schoolCode);
    var acaraInput = q(FIELD_SELECTORS.acaraId);
    if (codeInput && codeInput.value) setHiddenValue(FIELD_SELECTORS.schoolCode, "");
    if (acaraInput && acaraInput.value) setHiddenValue(FIELD_SELECTORS.acaraId, "");
  }
  var schoolDescDefault = null;
  function updateSchoolFieldGraduateMode() {
    var input = q(FIELD_SELECTORS.schoolText);
    if (!input) return;
    var wrap = fieldWrapper(input);
    if (!wrap) return;
    var isGraduated = isGraduatedSelected();
    var intake = getValue(FIELD_SELECTORS.intakeYear);
    setFieldLabelText("schoolText", isGraduated ? (intake ? "University in " + intake : "Current University") : intake ? "School in " + intake : "Current School");
    var desc = wrap.querySelector(".hs-field-desc");
    if (!desc) return;
    if (schoolDescDefault === null) schoolDescDefault = desc.textContent;
    if (!isGraduated) {
      desc.textContent = schoolDescDefault;
      if (GRAD_QUICK_LEGACY_VALUES.indexOf(input.value) !== -1) {
        // A gap-year/not-in-uni answer only makes sense for Graduated —
        // clear it so a school gets entered instead.
        input.value = "";
        input.dispatchEvent(new Event("change", {
          bubbles: true
        }));
      }
      return;
    }
    if (!document.getElementById("contour-grad-quick-styles")) {
      var style = document.createElement("style");
      style.id = "contour-grad-quick-styles";
      style.textContent = ".hs-form .contour-grad-quick-link { color: #0C3166; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }" +
        ".hs-form .contour-grad-quick-link:hover { color: #3478F7; }";
      document.head.appendChild(style);
    }
    // Rebuilt each pass (idempotent): plain text with the single quick
    // answer hyperlinked — clicking it fills the field.
    desc.textContent = "";
    desc.appendChild(document.createTextNode("Start typing your university name. Taking a gap year or not at university? Select "));
    var link = document.createElement("a");
    link.className = "contour-grad-quick-link";
    link.setAttribute("role", "button");
    link.setAttribute("tabindex", "0");
    link.textContent = GRAD_QUICK_VALUE;
    link.addEventListener("click", function(e) {
      e.preventDefault();
      fillSchoolQuickOption(GRAD_QUICK_VALUE);
    });
    link.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fillSchoolQuickOption(GRAD_QUICK_VALUE);
      }
    });
    desc.appendChild(link);
    desc.appendChild(document.createTextNode("."));
  }
  function injectDisabledFieldStyles() {
    if (document.getElementById("contour-disabled-field-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-disabled-field-styles";
    style.textContent = ".hs-form select:disabled, .hs-form input:disabled { opacity: 0.55; background-color: #f1f0ec; cursor: not-allowed; }" + ".contour-prefill-offer { margin-top: 8px; padding: 12px; border: 1px solid #d8d5cc; border-radius: 8px; background: #faf9f6; }" + ".contour-prefill-offer__message { margin: 0 0 8px; font-size: 14px; }" + ".contour-prefill-offer__code-row { display: flex; gap: 8px; align-items: center; }" + ".contour-prefill-offer__code-input { max-width: 140px; }" + ".contour-prefill-offer__confirm { cursor: pointer; }" + ".contour-prefill-offer__error { margin: 8px 0 0; color: #b3261e; font-size: 13px; }" + ".contour-prefill-banner { display: flex; align-items: flex-start; gap: 14px; margin: 0 0 24px; padding: 18px 22px; border: 1px solid rgba(12, 49, 102, 0.12); border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(12, 49, 102, 0.06); }" + ".contour-prefill-banner__badge { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; background: #D7FC3D; color: #0C3166; font-size: 15px; font-weight: 700; }" + ".contour-prefill-banner__content { flex: 1; min-width: 0; }" + ".contour-prefill-banner__title { margin: 0 0 2px; font-size: 15px; font-weight: 700; color: #0C3166; }" + ".contour-prefill-banner__text { margin: 0 0 8px; font-size: 13.5px; line-height: 1.45; color: #6b7280; }" + ".contour-prefill-banner__reset { display: inline-block; font-size: 13px; font-weight: 600; color: #0C3166; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }" + ".contour-prefill-banner__reset:hover { color: #0540F2; }" + ".contour-subject-summary { margin: 24px 0; padding: 20px 22px; border: 1px solid rgba(12, 49, 102, 0.12); border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(12, 49, 102, 0.06); }" + ".contour-subject-summary__heading { font-size: 15px; font-weight: 700; color: #0C3166; margin-bottom: 14px; }" + ".contour-subject-summary__grid { display: flex; flex-wrap: wrap; gap: 24px; }" + ".contour-subject-summary__col { flex: 1 1 180px; min-width: 160px; }" + ".contour-subject-summary__col-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }" + ".contour-subject-summary__chips { display: flex; flex-wrap: wrap; gap: 6px; }" + ".contour-subject-chip { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 1.3; }" + ".contour-subject-chip--navy { background: #092749; color: #FFFFFF; }" + ".contour-subject-chip--lime { background: #D7FC3D; color: #0C3166; }" + ".contour-subject-chip--blue { background: #007AFF; color: #FFFFFF; }" + ".contour-welcome-consultation__waitlist-note { margin: 0; padding: 14px 18px; border: 1px solid #f0d9a6; border-radius: 12px; background: #FFF3D6; color: #8a5a00; font-size: 14px; line-height: 1.5; font-weight: 600; }" + ".contour-form-loader { display: flex; flex-direction: column; align-items: center; padding: 60px 0; }" + ".contour-form-loader__spinner { width: 36px; height: 36px; border: 4px solid #e3e0d8; border-top-color: #1a1a2e; border-radius: 50%; animation: contour-spin 0.8s linear infinite; }" + "@keyframes contour-spin { to { transform: rotate(360deg); } }" + ".contour-form-loader__text { margin-top: 12px; font-size: 14px; }";
    document.head.appendChild(style);
  }
  function getClassification(inputEl) {
    if (subjectClassificationCache.has(inputEl)) {
      return subjectClassificationCache.get(inputEl);
    }
    var structuredParsed = parseStructuredSubjectValue(inputEl.value);
    var classification;
    if (structuredParsed) {
      classification = classificationFromStructuredValue(structuredParsed);
    } else {
      console.warn('Contour Form 1 logic: subject option "' + optionLabelText(inputEl) + '" has no valid structured value — always shown until fixed.');
      classification = {
        program: null,
        state: null,
        category: "Other",
        yearsShown: null,
        delivery: "Term",
        intake: null,
        test: false,
        code: null,
        subject: null,
        structured: false
      };
    }
    subjectClassificationCache.set(inputEl, classification);
    return classification;
  }
  var categoryHeaderMap = {};
  function hideInterestedSubjectsFieldLabel() {
    // The "Interested Subjects *" field label is not rendered at all
    // (Amitav's request) — the category headers underneath carry the
    // structure. Injected CSS survives HubSpot re-renders; the inline hide
    // covers wrappers without the hs_<fieldname> class.
    if (!document.getElementById("contour-subjects-label-styles")) {
      var style = document.createElement("style");
      style.id = "contour-subjects-label-styles";
      style.textContent = ".hs-form .hs_web_form__interested_subject > label { display: none; }";
      document.head.appendChild(style);
    }
    var field = q(FIELD_SELECTORS.interestedSubjects);
    var wrap = field ? fieldWrapper(field) : null;
    var label = wrap ? wrap.querySelector("label") : null;
    if (label) label.style.display = "none";
  }
  function enhanceInterestedSubjectsCategories() {
    hideInterestedSubjectsFieldLabel();
    var checkboxes = qAll(FIELD_SELECTORS.interestedSubjects);
    if (checkboxes.length === 0) return;
    var firstWrapper = optionWrapper(checkboxes[0]);
    var listParent = firstWrapper ? firstWrapper.parentNode : null;
    if (!listParent) return;
    var buckets = {};
    checkboxes.forEach(function (inputEl) {
      var classification = getClassification(inputEl);
      var category = classification.category || "Other";
      if (!buckets[category]) buckets[category] = [];
      buckets[category].push(optionWrapper(inputEl));
    });
    // 3/4 subjects sit above their 1/2 counterparts (Amitav's request).
    // Stable partition per category: level-3/4 options (codes ending in 34)
    // first, everything else after in HubSpot order.
    Object.keys(buckets).forEach(function (category) {
      var level34 = [];
      var otherLevels = [];
      buckets[category].forEach(function (li) {
        var input = li ? li.querySelector("input") : null;
        var code = input ? getClassification(input).code : null;
        (code && /34$/.test(code) ? level34 : otherLevels).push(li);
      });
      buckets[category] = level34.concat(otherLevels);
    });
    // Medical Entry list order is UCAT, then Medical & Dental Interviews,
    // then GAMSAT (Nick's request) — HubSpot serves them roughly reversed.
    // Rank sort keeps unknown future codes between Interviews and GAMSAT.
    if (buckets.MedPrep) {
      var medRank = function (li) {
        var input = li ? li.querySelector("input") : null;
        if (!input) return 2;
        var classification = getClassification(input);
        if (isUcatSubject(classification)) return 0;
        if (classification.code === "MD-INT") return 1;
        if (classification.code === "GAMSAT") return 3;
        return 2;
      };
      buckets.MedPrep = buckets.MedPrep.map(function (li, index) {
        return { li: li, rank: medRank(li), index: index };
      }).sort(function (a, b) {
        return a.rank - b.rank || a.index - b.index;
      }).map(function (entry) {
        return entry.li;
      });
    }
    var orderedCategories = CATEGORY_DISPLAY_ORDER.concat(Object.keys(buckets).filter(function (c) {
      return CATEGORY_DISPLAY_ORDER.indexOf(c) === -1;
    }));
    orderedCategories.forEach(function (category) {
      var items = buckets[category];
      if (!items || items.length === 0) return;
      var header = document.createElement("li");
      header.className = "contour-subject-category-header";
      header.textContent = CATEGORY_DISPLAY_NAMES[category] || category;
      listParent.appendChild(header);
      categoryHeaderMap[category] = header;
      items.forEach(function (li) {
        listParent.appendChild(li);
      });
    });
  }
  function evaluateInterestedSubjectsOptions() {
    var location = getValue(FIELD_SELECTORS.location);
    var yearLevel = getValue(FIELD_SELECTORS.yearLevel);
    var selectedPrograms = getCheckedValues(FIELD_SELECTORS.programInterest);
    var selectedIntakeYear = getValue(FIELD_SELECTORS.intakeYear);
    var options = qAll(FIELD_SELECTORS.interestedSubjects);
    var anyVisible = false;
    var anyVisibleByCategory = {};
    options.forEach(function (opt) {
      var classification = getClassification(opt);
      relabelTestPrepSubject(opt, classification);
      stripStateSuffixFromLabel(opt, classification);
      relabelUcatSubject(opt, classification);
      relabelMathematicsToMaths(opt, classification);
      stripRedundantYearSuffix(opt, yearLevel);
      var matrixVerdict = subjectMatchesMatrix(classification, location, yearLevel, selectedIntakeYear);
      var locationOk;
      var yearOk;
      if (matrixVerdict === null) {
        locationOk = subjectMatchesLocation(classification.state, location);
        yearOk = subjectMatchesYearLevel(classification, yearLevel);
      } else {
        locationOk = matrixVerdict;
        yearOk = true;
      }
      var programOk = subjectMatchesPrograms(classification.program, selectedPrograms);
      var deliveryOk = subjectMatchesDelivery(classification);
      var intakeOk = subjectMatchesIntake(classification, selectedIntakeYear);
      var audienceOk = subjectMatchesAudience(classification);
      var shouldShow = !!location && selectedPrograms.length > 0 && locationOk && programOk && yearOk && deliveryOk && intakeOk && audienceOk && !ucatBlockedForIntake(classification, selectedIntakeYear);
      shouldShow ? showOption(opt) : hideOption(opt);
      updateInterviewProgramNote(opt, classification, yearLevel, shouldShow);
      if (shouldShow) {
        anyVisible = true;
        var category = classification.category || "Other";
        anyVisibleByCategory[category] = true;
      }
    });
    Object.keys(categoryHeaderMap).forEach(function (category) {
      categoryHeaderMap[category].style.display = anyVisibleByCategory[category] ? "" : "none";
    });
    toggleFieldWrapper(q(FIELD_SELECTORS.interestedSubjects), anyVisible);
    updateSubjectsRequiredMark(anyVisible);
    evaluateSubjectExclusions();
  }
  // The "(Year 12)" tag on QCE/HSC subject labels is dropped when the
  // student has selected Year 12 — they only see Year 12 subjects, so the
  // tag is noise (Amitav + Wassim, 18 Aug 2026). Year 11 and below keep
  // every label exactly as authored in the planning matrix, including
  // "(Year 11)" tags, so the two levels stay distinguishable side by side.
  // Unlike the other relabels this one is reversible: the pre-strip text is
  // cached per option so changing year level restores the tag.
  var yearSuffixBaseText = new WeakMap();
  function stripRedundantYearSuffix(opt, yearLevel) {
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    var base = yearSuffixBaseText.get(opt);
    if (base === undefined) {
      base = textNode.nodeValue;
      yearSuffixBaseText.set(opt, base);
    }
    var match = base.match(/^(.*?)\s*\(Year 12\)\s*$/);
    var next = match && yearLevel === "Year 12" ? match[1] : base;
    if (textNode.nodeValue !== next) textNode.nodeValue = next;
  }
  function relabelMathematicsToMaths(opt, classification) {
    // Education subject names spell out "Mathematics" ("Year 10 Advanced
    // Mathematics", "VCE Specialist Mathematics 3/4") but the frontend says
    // "Maths" for those (Amitav's request). TestPrep's "Selective Entry
    // Mathematics" keeps its full name. Display-only: the submitted
    // structured value is untouched. Only the leading text node is edited so
    // other injected spans survive.
    if (classification.program !== "Education") return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    var renamed = textNode.nodeValue.replace(/\bMathematics\b/g, "Maths");
    if (renamed !== textNode.nodeValue) textNode.nodeValue = renamed;
  }
  function relabelUcatSubject(opt, classification) {
    // UCAT options carry region and year info in the HubSpot label
    // ("UCAT (ANZ) - Year 10 / Year 11"), but location and year filtering
    // mean a student only ever sees one, so the frontend just says "UCAT"
    // (Amitav's request). Display-only: the submitted structured value is
    // untouched. Only the leading text node is edited so other injected
    // spans survive.
    if (!isUcatSubject(classification)) return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    if (textNode.nodeValue !== "UCAT") textNode.nodeValue = "UCAT";
  }
  function stripStateSuffixFromLabel(opt, classification) {
    // Subjects only ever show to students in a matching location, so the
    // trailing state tag in the HubSpot option label ("Year 8 Science (VIC)")
    // is redundant on screen (Amitav's request). Display-only: the submitted
    // structured value is untouched. Only the leading text node is edited so
    // other injected spans survive.
    if (!classification.state) return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    var pattern = new RegExp("\\s*\\(" + classification.state + "\\)\\s*$");
    var stripped = textNode.nodeValue.replace(pattern, "");
    if (stripped !== textNode.nodeValue) textNode.nodeValue = stripped;
  }
  function relabelTestPrepSubject(opt, classification) {
    // TestPrep options only ever show to students of the matching year level
    // and selected intake year, so the "Year N" and "(2027)" in the HubSpot
    // option label are redundant on screen (Amitav's request): "Selective
    // Entry Year 8 English (2027)" reads "Selective Entry English" — the
    // year-level filter still picks the right code (VSE-EN08 for Year 8,
    // VSE-EN07 for Year 7, etc.). Display-only: the submitted structured
    // value is untouched. Only the leading text node is edited so other
    // injected spans survive.
    if (!classification.code) return;
    var pattern, replacement;
    if (classification.code.indexOf("VSC-") === 0) {
      pattern = /^\s*Year\s+\d+\s+(?=Scholarship\b)/;
      replacement = "";
    } else if (classification.code.indexOf("VSE-") === 0) {
      pattern = /^(\s*Selective Entry)\s+Year\s+\d+\s+/;
      replacement = "$1 ";
    } else {
      return;
    }
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    var stripped = textNode.nodeValue.replace(pattern, replacement).replace(/\s*\(\d{4}\)\s*$/, "");
    if (stripped !== textNode.nodeValue) textNode.nodeValue = stripped;
  }
  // Year 10-11 students can pick Medical & Dental Interviews, but the
  // program only starts for them at the end of Year 12 — a small explainer
  // under the option says so (Amitav/Luke, 18 Aug 2026). Needs its own class
  // and style: the exclusion-note machinery owns
  // .contour-subject-exclusion-note and would hide anything wearing it.
  var INTERVIEW_NOTE_TEXT = "Interview Program will start at the end of Year 12 - we will contact you in Year 12.";
  var INTERVIEW_NOTE_YEAR_LEVELS = ["Year 10", "Year 11"];
  function updateInterviewProgramNote(opt, classification, yearLevel, optionVisible) {
    if (classification.code !== "MD-INT") return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var show = optionVisible && INTERVIEW_NOTE_YEAR_LEVELS.indexOf(yearLevel) !== -1;
    var note = wrap.querySelector(".contour-interview-program-note");
    if (!note) {
      if (!show) return;
      if (!document.getElementById("contour-interview-note-styles")) {
        var style = document.createElement("style");
        style.id = "contour-interview-note-styles";
        style.textContent = ".hs-form .contour-interview-program-note { display: block; font-size: 0.75rem; font-weight: 400; color: #6b7280; margin-top: 0.125rem; margin-left: 1.6rem; }";
        document.head.appendChild(style);
      }
      note = document.createElement("span");
      note.className = "contour-interview-program-note";
      note.textContent = INTERVIEW_NOTE_TEXT;
      wrap.appendChild(note);
    }
    note.style.display = show ? "" : "none";
  }
  function subjectExclusionKey(classification) {
    if (classification.program !== "Education") return null;
    if (!classification.subject) return null;
    return classification.state + "|" + classification.subject;
  }
  function ensureSubjectExclusionNote(opt) {
    var wrap = optionWrapper(opt);
    if (!wrap) return null;
    var note = wrap.querySelector(".contour-subject-exclusion-note");
    if (note) return note;
    note = document.createElement("span");
    note.className = "contour-subject-exclusion-note";
    note.style.display = "none";
    wrap.appendChild(note);
    return note;
  }
  function evaluateSubjectExclusions() {
    var options = qAll(FIELD_SELECTORS.interestedSubjects);
    var checkedByKey = {};
    options.forEach(function (opt) {
      if (!opt.checked) return;
      var key = subjectExclusionKey(getClassification(opt));
      if (key) checkedByKey[key] = opt;
    });
    options.forEach(function (opt) {
      var wrap = optionWrapper(opt);
      var isVisible = wrap && wrap.style.display !== "none";
      var key = subjectExclusionKey(getClassification(opt));
      var blockingOption = key ? checkedByKey[key] : null;
      var blocked = isVisible && !!blockingOption && blockingOption !== opt;
      var note = ensureSubjectExclusionNote(opt);
      opt.disabled = blocked;
      if (wrap) wrap.classList.toggle("contour-subject-option--blocked", blocked);
      if (note) {
        if (blocked) {
          note.textContent = "You can only select one level of this subject";
          note.style.display = "";
        } else {
          note.style.display = "none";
        }
      }
    });
  }
  var campusClassificationCache = new WeakMap;
  function getCampusClassification(inputEl) {
    if (campusClassificationCache.has(inputEl)) {
      return campusClassificationCache.get(inputEl);
    }
    var parsed = parseStructuredCampusValue(inputEl.value);
    var classification;
    if (parsed) {
      classification = classificationFromStructuredCampusValue(parsed);
    } else {
      console.warn('Contour Form 1 logic: campus option "' + optionLabelText(inputEl) + '" has no valid structured value — always shown until fixed.');
      classification = {
        code: null,
        state: null,
        country: null
      };
    }
    campusClassificationCache.set(inputEl, classification);
    return classification;
  }
  function evaluateCampusOptions() {
    var location = getValue(FIELD_SELECTORS.location);
    var selectedPrograms = getCheckedValues(FIELD_SELECTORS.programInterest);
    var options = qAll(FIELD_SELECTORS.campus);
    var isMedPrepOnly = selectedPrograms.length === 1 && selectedPrograms[0] === "MedPrep";
    if (isMedPrepOnly) {
      options.forEach(function (opt) {
        var isOnline = getCampusClassification(opt).code === "ONLINE";
        setCheckboxChecked(opt, isOnline);
      });
      toggleFieldWrapper(q(FIELD_SELECTORS.campus), false);
      updateCampusRequiredMark(false);
      return;
    }
    var fieldShouldShow = selectedPrograms.length > 0;
    options.forEach(function (opt) {
      var classification = getCampusClassification(opt);
      var shouldShow = fieldShouldShow && subjectMatchesLocation(classification.state, location);
      shouldShow ? showOption(opt) : hideOption(opt);
    });
    toggleFieldWrapper(q(FIELD_SELECTORS.campus), fieldShouldShow);
    updateCampusRequiredMark(fieldShouldShow);
  }
  function fixRadioCardClickArea() {
    qAll(".hs-fieldtype-radio .hs-form-radio-display").forEach(function (label) {
      label.addEventListener("click", function (e) {
        var input = label.querySelector('input[type="radio"]');
        if (!input || e.target === input) return;
        e.preventDefault();
        if (!input.checked) input.click();
      }, true);
    });
  }
  function fixCheckboxCardClickArea() {
    qAll(".hs-fieldtype-checkbox .hs-form-checkbox-display").forEach(function (label) {
      label.addEventListener("click", function (e) {
        var input = label.querySelector('input[type="checkbox"]');
        if (!input || e.target === input) return;
        e.preventDefault();
        input.click();
      }, true);
    });
  }
  function fixProgramCardClickArea() {
    qAll(".contour-program-card").forEach(function (label) {
      label.addEventListener("click", function (e) {
        var input = label.querySelector('input[type="checkbox"]');
        if (!input || e.target === input) return;
        e.preventDefault();
        input.click();
      }, true);
    });
  }
  var PREFETCH_ENDPOINT = "https://australia-southeast1-hubspot-signup-form.cloudfunctions.net/contour-form1-prefetch";
  var PREFETCH_OTP_ENABLED = false;
  var STUDENT_ID_PARAM = "student_id";
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var prefetchedTrialSubjectCodes = [];
  var prefetchedEnrolledSubjectCodes = [];
  function startUrlPrefetch() {
    if (!PREFETCH_ENDPOINT) return null;
    var studentId = getUrlParam(STUDENT_ID_PARAM);
    if (!studentId) return null;
    var request = fetch(PREFETCH_ENDPOINT + "/prefetch?studentId=" + encodeURIComponent(studentId)).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).catch(function (err) {
      console.warn("Contour Form 1 logic: URL prefetch failed —", err);
      return null;
    });
    var timeout = new Promise(function (resolve) {
      setTimeout(function () {
        resolve(null);
      }, 8000);
    });
    return Promise.race([request, timeout]);
  }
  var urlPrefetchPromise = startUrlPrefetch();
  function showFormLoader() {
    if (document.getElementById("contour-form-loader")) return;
    var loader = document.createElement("div");
    loader.id = "contour-form-loader";
    loader.className = "contour-form-loader";
    var spinner = document.createElement("div");
    spinner.className = "contour-form-loader__spinner";
    loader.appendChild(spinner);
    var text = document.createElement("p");
    text.className = "contour-form-loader__text";
    text.textContent = "Fetching your details…";
    loader.appendChild(text);
    formRoot.parentNode.insertBefore(loader, formRoot);
    formRoot.style.display = "none";
  }
  function hideFormLoader() {
    var loader = document.getElementById("contour-form-loader");
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    formRoot.style.removeProperty("display");
  }
  function splitMultiValue(raw) {
    if (!raw) return [];
    return String(raw).split(";").map(function (s) {
      return s.trim();
    }).filter(function (s) {
      return s.length > 0;
    });
  }
  function setSelectOrTextValue(selector, value) {
    var el = q(selector);
    if (!el || value === undefined || value === null || value === "") return;
    el.value = value;
    el.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    el.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  function attemptCheckboxValues(selector, values, excludeCodes) {
    if (!values || values.length === 0) return [];
    var remaining = [];
    values.forEach(function (value) {
      if (excludeCodes && excludeCodes.length > 0) {
        var parsed = parseStructuredSubjectValue(value);
        if (parsed && excludeCodes.indexOf(parsed.code) !== -1) return;
      }
      var applied = false;
      qAll(selector).forEach(function (opt) {
        if (applied || opt.value !== value) return;
        var wrap = optionWrapper(opt);
        var visible = !wrap || wrap.style.display !== "none";
        if (opt.disabled || !visible) return;
        setCheckboxChecked(opt, true);
        applied = true;
      });
      if (!applied) remaining.push(value);
    });
    return remaining;
  }
  var pendingPrefill = null;
  var applyingPendingPrefill = false;
  function applyPendingPrefill() {
    if (!pendingPrefill || applyingPendingPrefill) return;
    applyingPendingPrefill = true;
    var excludeCodes = prefetchedTrialSubjectCodes.concat(prefetchedEnrolledSubjectCodes);
    pendingPrefill.programs = attemptCheckboxValues(FIELD_SELECTORS.programInterest, pendingPrefill.programs);
    pendingPrefill.subjects = attemptCheckboxValues(FIELD_SELECTORS.interestedSubjects, pendingPrefill.subjects, excludeCodes);
    pendingPrefill.campuses = attemptCheckboxValues(FIELD_SELECTORS.campus, pendingPrefill.campuses);
    if (pendingPrefill.programs.length === 0 && pendingPrefill.subjects.length === 0 && pendingPrefill.campuses.length === 0) {
      pendingPrefill = null;
    }
    applyingPendingPrefill = false;
  }
  function setTextWhenPresent(selector, value, tries) {
    if (value === undefined || value === null || value === "") return;
    var el = q(selector);
    if (el) {
      setSelectOrTextValue(selector, value);
      return;
    }
    if (tries <= 0) return;
    setTimeout(function () {
      setTextWhenPresent(selector, value, tries - 1);
    }, 150);
  }
  // Complete ITU E.164 country calling codes (longest-prefix order; shared
  // codes map to the primary country: +1 -> us, +7 -> ru, +44 -> gb).
  var PHONE_DIAL_CODES = [["211", "ss"], ["212", "ma"], ["213", "dz"], ["216", "tn"], ["218", "ly"], ["220", "gm"], ["221", "sn"], ["222", "mr"], ["223", "ml"], ["224", "gn"], ["225", "ci"], ["226", "bf"], ["227", "ne"], ["228", "tg"], ["229", "bj"], ["230", "mu"], ["231", "lr"], ["232", "sl"], ["233", "gh"], ["234", "ng"], ["235", "td"], ["236", "cf"], ["237", "cm"], ["238", "cv"], ["239", "st"], ["240", "gq"], ["241", "ga"], ["242", "cg"], ["243", "cd"], ["244", "ao"], ["245", "gw"], ["246", "io"], ["248", "sc"], ["249", "sd"], ["250", "rw"], ["251", "et"], ["252", "so"], ["253", "dj"], ["254", "ke"], ["255", "tz"], ["256", "ug"], ["257", "bi"], ["258", "mz"], ["260", "zm"], ["261", "mg"], ["262", "re"], ["263", "zw"], ["264", "na"], ["265", "mw"], ["266", "ls"], ["267", "bw"], ["268", "sz"], ["269", "km"], ["290", "sh"], ["291", "er"], ["297", "aw"], ["298", "fo"], ["299", "gl"], ["350", "gi"], ["351", "pt"], ["352", "lu"], ["353", "ie"], ["354", "is"], ["355", "al"], ["356", "mt"], ["357", "cy"], ["358", "fi"], ["359", "bg"], ["370", "lt"], ["371", "lv"], ["372", "ee"], ["373", "md"], ["374", "am"], ["375", "by"], ["376", "ad"], ["377", "mc"], ["378", "sm"], ["380", "ua"], ["381", "rs"], ["382", "me"], ["383", "xk"], ["385", "hr"], ["386", "si"], ["387", "ba"], ["389", "mk"], ["420", "cz"], ["421", "sk"], ["423", "li"], ["500", "fk"], ["501", "bz"], ["502", "gt"], ["503", "sv"], ["504", "hn"], ["505", "ni"], ["506", "cr"], ["507", "pa"], ["508", "pm"], ["509", "ht"], ["590", "gp"], ["591", "bo"], ["592", "gy"], ["593", "ec"], ["595", "py"], ["597", "sr"], ["598", "uy"], ["599", "cw"], ["670", "tl"], ["672", "nf"], ["673", "bn"], ["674", "nr"], ["675", "pg"], ["676", "to"], ["677", "sb"], ["678", "vu"], ["679", "fj"], ["680", "pw"], ["681", "wf"], ["682", "ck"], ["683", "nu"], ["685", "ws"], ["686", "ki"], ["687", "nc"], ["688", "tv"], ["689", "pf"], ["690", "tk"], ["691", "fm"], ["692", "mh"], ["850", "kp"], ["852", "hk"], ["853", "mo"], ["855", "kh"], ["856", "la"], ["880", "bd"], ["886", "tw"], ["960", "mv"], ["961", "lb"], ["962", "jo"], ["963", "sy"], ["964", "iq"], ["965", "kw"], ["966", "sa"], ["967", "ye"], ["968", "om"], ["970", "ps"], ["971", "ae"], ["972", "il"], ["973", "bh"], ["974", "qa"], ["975", "bt"], ["976", "mn"], ["977", "np"], ["992", "tj"], ["993", "tm"], ["994", "az"], ["995", "ge"], ["996", "kg"], ["998", "uz"], ["20", "eg"], ["27", "za"], ["30", "gr"], ["31", "nl"], ["32", "be"], ["33", "fr"], ["34", "es"], ["36", "hu"], ["39", "it"], ["40", "ro"], ["41", "ch"], ["43", "at"], ["44", "gb"], ["45", "dk"], ["46", "se"], ["47", "no"], ["48", "pl"], ["49", "de"], ["51", "pe"], ["52", "mx"], ["53", "cu"], ["54", "ar"], ["55", "br"], ["56", "cl"], ["57", "co"], ["58", "ve"], ["60", "my"], ["61", "au"], ["62", "id"], ["63", "ph"], ["64", "nz"], ["65", "sg"], ["66", "th"], ["81", "jp"], ["82", "kr"], ["84", "vn"], ["86", "cn"], ["90", "tr"], ["91", "in"], ["92", "pk"], ["93", "af"], ["94", "lk"], ["95", "mm"], ["98", "ir"], ["1", "us"], ["7", "ru"]];
  function splitE164(value) {
    if (!value || value.charAt(0) !== "+") return null;
    var digits = value.slice(1).replace(/\D/g, "");
    for (var i = 0; i < PHONE_DIAL_CODES.length; i++) {
      var dial = PHONE_DIAL_CODES[i][0];
      if (digits.indexOf(dial) === 0) {
        return {
          dial: dial,
          iso: PHONE_DIAL_CODES[i][1],
          national: digits.slice(dial.length)
        };
      }
    }
    return null;
  }
  function fireInputEvents(inp) {
    inp.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    inp.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  function setPhoneValue(selector, value) {
    if (!value) return;
    var el = q(selector);
    if (!el) return;
    var wrap = fieldWrapper(el) || el.parentElement;
    var select = wrap ? wrap.querySelector("select") : null;
    var parts = splitE164(value);
    if (select && parts) {
      var matched = false;
      Array.prototype.forEach.call(select.options, function (opt) {
        if (matched) return;
        var v = (opt.value || "").toLowerCase();
        if (v === parts.iso || v === parts.dial || v === "+" + parts.dial || v.indexOf(parts.iso + "_") === 0 || v.indexOf("_" + parts.dial) !== -1) {
          select.value = opt.value;
          matched = true;
        }
      });
      if (matched) {
        fireInputEvents(select);
        var inputs = Array.prototype.slice.call(wrap.querySelectorAll("input"));
        var hasHidden = inputs.some(function (inp) {
          return inp.type === "hidden";
        });
        inputs.forEach(function (inp) {
          // HubSpot's own widget: hidden input carries the full E.164 value
          // for submission and the visible one only holds the national number.
          // Our injected widget (see enhanceStudentPhoneField) has no hidden
          // input — the visible input IS the submitted value, so it keeps the
          // dial code.
          if (inp.type === "hidden") {
            inp.value = value;
          } else {
            inp.value = hasHidden ? parts.national : "+" + parts.dial + " " + parts.national;
          }
          fireInputEvents(inp);
        });
        return;
      }
    }
    el.value = value;
    fireInputEvents(el);
    el.dispatchEvent(new Event("blur", {
      bubbles: true
    }));
  }
  // Student Phone Number lives in the Contact Type dependent group, so it can
  // still be absent when the prefetch response lands — same retry shape as
  // setTextWhenPresent, but through the phone-aware setter.
  function setPhoneValueWhenPresent(selector, value, tries) {
    if (!value) return;
    if (q(selector)) {
      setPhoneValue(selector, value);
      return;
    }
    if (tries <= 0) return;
    setTimeout(function () {
      setPhoneValueWhenPresent(selector, value, tries - 1);
    }, 150);
  }
  function applyPrefill(contact, guardian, associatedStudent) {
    var contactType = contact.contact_type;
    // "Parent" records use the same flow as "Guardian" — the form radio only
    // knows Student/Guardian.
    var isGuardianFlow = contactType === "Guardian" || contactType === "Parent";
    if (contactType === "Student" || isGuardianFlow) {
      var radioValue = isGuardianFlow ? "Guardian" : "Student";
      qAll(FIELD_SELECTORS.contactType).forEach(function (radio) {
        if (radio.value === radioValue) setCheckboxChecked(radio, true);
      });
    }
    if (isGuardianFlow) {
      setSelectOrTextValue('[name="firstname"]', contact.firstname);
      setSelectOrTextValue('[name="lastname"]', contact.lastname);
      setSelectOrTextValue(FIELD_SELECTORS.emailTemp, contact.email_2 || contact.email);
      setPhoneValue('[name="phone"]', contact.phone);
      var s = associatedStudent || {
        firstname: contact.student_first_name,
        lastname: contact.student_last_name,
        email: contact.student_email,
        phone: contact.student_phone_number || contact.student_phone
      };
      setTextWhenPresent('[name="student_first_name"]', s.firstname, 10);
      setTextWhenPresent('[name="student_last_name"]', s.lastname, 10);
      setTextWhenPresent('[name="student_email"]', s.email_2 || s.email, 10);
      setPhoneValueWhenPresent(FIELD_SELECTORS.studentPhone, s.phone, 10);
    } else {
      setSelectOrTextValue('[name="firstname"]', contact.firstname);
      setSelectOrTextValue('[name="lastname"]', contact.lastname);
      setSelectOrTextValue(FIELD_SELECTORS.emailTemp, contact.email_2 || contact.email);
      setPhoneValue('[name="phone"]', contact.phone);
    }
    setSelectOrTextValue(FIELD_SELECTORS.location, contact.state_territory_country);
    setSelectOrTextValue(FIELD_SELECTORS.intakeYear, contact.which_year_are_you_interested_in_tutoring_for_);
    setSelectOrTextValue(FIELD_SELECTORS.yearLevel, contact.year_level);
    if (contact.school_text) {
      setSelectOrTextValue(FIELD_SELECTORS.schoolText, contact.school_text);
      setSelectOrTextValue(FIELD_SELECTORS.schoolCode, contact.school_code || "");
      setSelectOrTextValue(FIELD_SELECTORS.acaraId, contact.acara_id || "");
      var schoolInput = q(FIELD_SELECTORS.schoolText);
      if (schoolInput) setTimeout(function () {
        schoolInput.dispatchEvent(new Event("blur"));
      }, 200);
    }
    pendingPrefill = {
      programs: splitMultiValue(contact.program_interest),
      subjects: splitMultiValue(contact.web_form__interested_subject),
      campuses: splitMultiValue(contact.web_form__preferred_campuses)
    };
    applyPendingPrefill();
    setSelectOrTextValue(FIELD_SELECTORS.referral, contact.referral);
  }
  function getUrlParam(name) {
    var match = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }
  function renderPrefillBanner(fullName) {
    var existing = formRoot.querySelector("#contour-prefill-banner");
    if (existing) existing.parentNode.removeChild(existing);
    var banner = document.createElement("div");
    banner.id = "contour-prefill-banner";
    banner.className = "contour-prefill-banner";
    var badge = document.createElement("span");
    badge.className = "contour-prefill-banner__badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="#0C3166" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    banner.appendChild(badge);
    var content = document.createElement("div");
    content.className = "contour-prefill-banner__content";
    var title = document.createElement("p");
    title.className = "contour-prefill-banner__title";
    title.textContent = fullName ? "Welcome back, " + fullName : "Welcome back";
    content.appendChild(title);
    var text = document.createElement("p");
    text.className = "contour-prefill-banner__text";
    text.textContent = "We've prefilled your details from your previous signup — please review them before submitting.";
    content.appendChild(text);
    var resetLink = document.createElement("a");
    resetLink.href = "#";
    resetLink.className = "contour-prefill-banner__reset";
    resetLink.textContent = "Not you, or starting fresh? Clear the form";
    resetLink.addEventListener("click", function (e) {
      e.preventDefault();
      // A DOM-level reset fights HubSpot's internal form state (radios get
      // restored on re-render) — reloading without the student_id param
      // guarantees a pristine blank form.
      window.location.href = window.location.pathname;
    });
    content.appendChild(resetLink);
    banner.appendChild(content);
    formRoot.insertBefore(banner, formRoot.firstChild);
  }
  function defaultContactTypeToStudent(tries) {
    if (tries === undefined) tries = 8;
    // HubSpot's embed hydrates/re-renders right after onFormReady and wipes a
    // synchronous click — select on a delay and verify it stuck, retrying
    // against fresh nodes.
    setTimeout(function () {
      var radios = qAll(FIELD_SELECTORS.contactType);
      if (radios.length === 0 || radios.some(function (r) {
        return r.checked;
      })) return;
      radios.forEach(function (radio) {
        if (radio.value === "Student") setCheckboxChecked(radio, true);
      });
      if (tries > 0) defaultContactTypeToStudent(tries - 1);
    }, 250);
  }
  function initPrefetchFromUrl() {
    if (!urlPrefetchPromise) {
      defaultContactTypeToStudent();
      return;
    }
    showFormLoader();
    urlPrefetchPromise.then(function (data) {
      if (data && data.found && data.contact) {
        prefetchedTrialSubjectCodes = data.trialSubjectCodes || [];
        prefetchedEnrolledSubjectCodes = data.enrolledSubjectCodes || [];
        applyPrefill(data.contact, data.guardian, data.associatedStudent);
        var fullName = ((data.contact.firstname || "") + " " + (data.contact.lastname || "")).trim();
        renderPrefillBanner(fullName);
        if (prefetchedTrialSubjectCodes.length > 0 || prefetchedEnrolledSubjectCodes.length > 0) {
          setFieldLabelText("interestedSubjects", "Additional Subjects");
        }
        renderSubjectSummary();
      }
      // Prefill takes precedence (Guardian/Parent records select Guardian);
      // anything else — no record, unknown contact_type — defaults to Student.
      defaultContactTypeToStudent();
      hideFormLoader();
    });
  }
  function prefetchPost(path, payload) {
    return fetch(PREFETCH_ENDPOINT + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }
  function enhanceEmailPrefill() {
    if (!PREFETCH_ENDPOINT || !PREFETCH_OTP_ENABLED) return;
    var emailInput = q(FIELD_SELECTORS.emailTemp);
    if (!emailInput) return;
    var wrap = fieldWrapper(emailInput) || emailInput.parentElement;
    var box = document.createElement("div");
    box.id = "contour-prefill-offer";
    box.className = "contour-prefill-offer";
    box.style.display = "none";
    var message = document.createElement("p");
    message.className = "contour-prefill-offer__message";
    box.appendChild(message);
    var codeRow = document.createElement("div");
    codeRow.className = "contour-prefill-offer__code-row";
    codeRow.style.display = "none";
    var codeInput = document.createElement("input");
    codeInput.type = "text";
    codeInput.inputMode = "numeric";
    codeInput.maxLength = 6;
    codeInput.placeholder = "6-digit code";
    codeInput.className = "contour-prefill-offer__code-input";
    codeRow.appendChild(codeInput);
    var confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Prefill my details";
    confirmBtn.className = "contour-prefill-offer__confirm";
    codeRow.appendChild(confirmBtn);
    box.appendChild(codeRow);
    var errorEl = document.createElement("p");
    errorEl.className = "contour-prefill-offer__error";
    errorEl.style.display = "none";
    box.appendChild(errorEl);
    wrap.appendChild(box);
    var lastRequestedEmail = null;
    function reset() {
      box.style.display = "none";
      codeRow.style.display = "none";
      errorEl.style.display = "none";
      codeInput.value = "";
    }
    emailInput.addEventListener("input", function () {
      reset();
      lastRequestedEmail = null;
    });
    emailInput.addEventListener("blur", function () {
      var email = emailInput.value.trim();
      if (!EMAIL_SHAPE.test(email) || email === lastRequestedEmail) return;
      lastRequestedEmail = email;
      prefetchPost("/request", {
        email: email
      }).then(function (data) {
        if (!data || !data.found) return;
        if (emailInput.value.trim() !== email) return;
        message.textContent = "Looks like you've signed up with us before. We've emailed a 6-digit code to " + email + " — enter it below to prefill your details.";
        box.style.display = "";
        codeRow.style.display = "";
      }).catch(function (err) {
        console.warn("Contour Form 1 logic: prefetch request failed —", err);
      });
    });
    confirmBtn.addEventListener("click", function () {
      var email = emailInput.value.trim();
      var code = codeInput.value.trim();
      if (!code) return;
      confirmBtn.disabled = true;
      prefetchPost("/confirm", {
        email: email,
        code: code
      }).then(function (data) {
        confirmBtn.disabled = false;
        if (data && data.ok && data.contact) {
          applyPrefill(data.contact);
          message.textContent = "Your details have been prefilled from your previous signup. Please review before submitting.";
          codeRow.style.display = "none";
          errorEl.style.display = "none";
          return;
        }
        errorEl.textContent = "That code didn't match. Please check the email and try again.";
        errorEl.style.display = "";
      }).catch(function (err) {
        confirmBtn.disabled = false;
        errorEl.textContent = "Something went wrong verifying the code. Please try again.";
        errorEl.style.display = "";
        console.warn("Contour Form 1 logic: prefetch confirm failed —", err);
      });
    });
  }
  var CALENDLY_URLS = {
    anz: "https://calendly.com/contourmedprep/welcome-consultation-anz",
    uk: "https://calendly.com/contourmedprep/welcome-consultation-uk"
  };
  function isTestprepSelected() {
    var checkedSubjects = qAll(FIELD_SELECTORS.interestedSubjects + ":checked");
    for (var i = 0; i < checkedSubjects.length; i++) {
      if (getClassification(checkedSubjects[i]).program === "TestPrep") return true;
    }
    return false;
  }
  function isUcatSelected() {
    var checkedSubjects = qAll(FIELD_SELECTORS.interestedSubjects + ":checked");
    for (var i = 0; i < checkedSubjects.length; i++) {
      if (isUcatSubject(getClassification(checkedSubjects[i]))) return true;
      var labelText = optionLabelText(checkedSubjects[i]);
      if (UCAT_UK_PATTERN.test(labelText) || UCAT_ANZ_PATTERN.test(labelText)) return true;
    }
    return false;
  }
  function loadCalendlyScript(callback) {
    if (window.Calendly) {
      callback();
      return;
    }
    var existing = document.getElementById("contour-calendly-script");
    if (existing) {
      existing.addEventListener("load", callback);
      return;
    }
    var script = document.createElement("script");
    script.id = "contour-calendly-script";
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onload = callback;
    document.body.appendChild(script);
  }
  function ensureWelcomeConsultationContainer() {
    var existing = formRoot.querySelector("#contour-welcome-consultation");
    if (existing) return existing;
    var wrapper = document.createElement("div");
    wrapper.id = "contour-welcome-consultation";
    wrapper.style.display = "none";
    var heading = document.createElement("div");
    heading.className = "contour-welcome-consultation__heading";
    heading.textContent = "Book Your Welcome Consultation";
    wrapper.appendChild(heading);
    var copy = document.createElement("p");
    copy.className = "contour-welcome-consultation__copy";
    copy.textContent = "New UCAT students are required to book a Welcome Consultation before a trial can be booked. Please register your consultation below before completing the rest of this form.";
    wrapper.appendChild(copy);
    var waitlistNote = document.createElement("p");
    waitlistNote.className = "contour-welcome-consultation__waitlist-note";
    waitlistNote.style.display = "none";
    wrapper.appendChild(waitlistNote);
    var openSoonNote = document.createElement("p");
    openSoonNote.className = "contour-welcome-consultation__waitlist-note contour-welcome-consultation__open-soon-note";
    openSoonNote.style.display = "none";
    wrapper.appendChild(openSoonNote);
    var widgetContainer = document.createElement("div");
    widgetContainer.className = "contour-welcome-consultation__widget";
    wrapper.appendChild(widgetContainer);
    var campusField = q(FIELD_SELECTORS.campus);
    var campusFieldWrap = campusField ? fieldWrapper(campusField) : null;
    var submitBlock = formRoot.querySelector(".hs-submit");
    if (campusFieldWrap && campusFieldWrap.parentNode) {
      campusFieldWrap.parentNode.insertBefore(wrapper, campusFieldWrap.nextSibling);
    } else if (submitBlock && submitBlock.parentNode) {
      submitBlock.parentNode.insertBefore(wrapper, submitBlock);
    } else {
      formRoot.appendChild(wrapper);
    }
    return wrapper;
  }
  function renderWelcomeConsultation() {
    var wrapper = ensureWelcomeConsultationContainer();
    var ucat = isUcatSelected();
    var testprep = isTestprepSelected();
    // UCAT students can't book a consultation while enrolments are closed —
    // they see the waitlist note instead. Selective Entry is unaffected, so
    // both can be on screen at once when the two are selected together.
    var ucatWaitlisted = ucat && !UCAT_ENROLMENTS_OPEN;
    var audiences = [];
    if (ucat && UCAT_ENROLMENTS_OPEN) audiences.push("UCAT");
    if (testprep) audiences.push("Selective Entry & Scholarship");
    var showScheduler = audiences.length > 0 && WC_BOOKINGS_OPEN;
    var showOpenSoonNote = audiences.length > 0 && !WC_BOOKINGS_OPEN;
    if (!showScheduler && !showOpenSoonNote && !ucatWaitlisted) {
      wrapper.style.display = "none";
      return;
    }
    wrapper.style.display = "";
    var headingEl = wrapper.querySelector(".contour-welcome-consultation__heading");
    var copyEl = wrapper.querySelector(".contour-welcome-consultation__copy");
    var noteEl = wrapper.querySelector(".contour-welcome-consultation__open-soon-note");
    if (noteEl) {
      noteEl.textContent = WC_OPEN_SOON_NOTE;
      noteEl.style.display = showOpenSoonNote ? "" : "none";
    }
    noteEl = wrapper.querySelector(".contour-welcome-consultation__waitlist-note:not(.contour-welcome-consultation__open-soon-note)");
    if (noteEl) {
      noteEl.textContent = UCAT_WAITLIST_NOTE;
      noteEl.style.display = ucatWaitlisted ? "" : "none";
    }
    if (headingEl) headingEl.style.display = showScheduler ? "" : "none";
    if (copyEl) {
      copyEl.style.display = showScheduler ? "" : "none";
      if (showScheduler) {
        copyEl.textContent = "New " + audiences.join(" and ") + " students are required to book a Welcome Consultation before a trial can be booked. Please register your consultation below before completing the rest of this form.";
      }
    }
    var schedulerContainer = wrapper.querySelector(".contour-welcome-consultation__widget");
    if (!showScheduler) {
      schedulerContainer.innerHTML = "";
      schedulerContainer.style.display = "none";
      return;
    }
    schedulerContainer.style.display = "";
    var location = getValue(FIELD_SELECTORS.location);
    var isUk = location === UK_TOKEN;
    var baseUrl = isUk ? CALENDLY_URLS.uk : CALENDLY_URLS.anz;
    var firstname = getValue('[name="firstname"]');
    var lastname = getValue('[name="lastname"]');
    var email = getValue(FIELD_SELECTORS.emailTemp);
    var fullName = (firstname + " " + lastname).trim();
    var params = [];
    if (fullName) params.push("name=" + encodeURIComponent(fullName));
    if (email) params.push("email=" + encodeURIComponent(email));
    var queryString = params.join("&");
    var fullUrl = baseUrl + (queryString ? "?" + queryString : "");
    schedulerContainer.innerHTML = "";
    loadCalendlyScript(function () {
      Calendly.initInlineWidget({
        url: fullUrl,
        parentElement: schedulerContainer
      });
    });
  }
  function subjectCodeToLabel(code) {
    var options = qAll(FIELD_SELECTORS.interestedSubjects);
    for (var i = 0; i < options.length; i++) {
      var parsed = parseStructuredSubjectValue(options[i].value);
      if (parsed && parsed.code === code) return optionLabelText(options[i]);
    }
    return code;
  }
  function ensureSubjectSummary() {
    var existing = formRoot.querySelector("#contour-subject-summary");
    if (existing) return existing;
    var container = document.createElement("div");
    container.id = "contour-subject-summary";
    container.className = "contour-subject-summary";
    container.style.display = "none";
    var heading = document.createElement("div");
    heading.className = "contour-subject-summary__heading";
    heading.textContent = "Your Subjects";
    container.appendChild(heading);
    var grid = document.createElement("div");
    grid.className = "contour-subject-summary__grid";
    container.appendChild(grid);
    var subjectsField = q(FIELD_SELECTORS.interestedSubjects);
    var subjectsWrap = subjectsField ? fieldWrapper(subjectsField) : null;
    if (subjectsWrap && subjectsWrap.parentNode) {
      subjectsWrap.parentNode.insertBefore(container, subjectsWrap.nextSibling);
    } else {
      var submitBlock = formRoot.querySelector(".hs-submit");
      if (submitBlock && submitBlock.parentNode) {
        submitBlock.parentNode.insertBefore(container, submitBlock);
      } else {
        formRoot.appendChild(container);
      }
    }
    return container;
  }
  function renderSubjectSummary() {
    var container = ensureSubjectSummary();
    var grid = container.querySelector(".contour-subject-summary__grid");
    var interested = qAll(FIELD_SELECTORS.interestedSubjects + ":checked").map(function (opt) {
      return optionLabelText(opt);
    });
    var trialing = prefetchedTrialSubjectCodes.map(subjectCodeToLabel);
    var enrolled = prefetchedEnrolledSubjectCodes.map(subjectCodeToLabel);
    var columns = [{
      title: "Interested Subject" + (interested.length === 1 ? "" : "s"),
      items: interested,
      chipClass: "contour-subject-chip--navy"
    }, {
      title: "Trialing Subject" + (trialing.length === 1 ? "" : "s"),
      items: trialing,
      chipClass: "contour-subject-chip--lime"
    }, {
      title: "Enrolled Subject" + (enrolled.length === 1 ? "" : "s"),
      items: enrolled,
      chipClass: "contour-subject-chip--blue"
    }];
    grid.innerHTML = "";
    var anyColumn = false;
    columns.forEach(function (col) {
      if (col.items.length === 0) return;
      anyColumn = true;
      var colEl = document.createElement("div");
      colEl.className = "contour-subject-summary__col";
      var title = document.createElement("div");
      title.className = "contour-subject-summary__col-title";
      title.textContent = col.title;
      colEl.appendChild(title);
      var chips = document.createElement("div");
      chips.className = "contour-subject-summary__chips";
      col.items.forEach(function (label) {
        var chip = document.createElement("span");
        chip.className = "contour-subject-chip " + col.chipClass;
        chip.textContent = label;
        chips.appendChild(chip);
      });
      colEl.appendChild(chips);
      grid.appendChild(colEl);
    });
    container.style.display = anyColumn ? "" : "none";
  }
  function attachListeners() {
    var locationEl = q(FIELD_SELECTORS.location);
    if (locationEl) {
      locationEl.addEventListener("change", function () {
        evaluateProgramInterestOptions();
        evaluateInterestedSubjectsOptions();
        evaluateCampusOptions();
        evaluateYearLevelOptions();
        evaluateSchoolFieldVisibility();
        evaluateIntakeYearDependents();
        renderWelcomeConsultation();
        applyPendingPrefill();
      });
    }
    qAll(FIELD_SELECTORS.programInterest).forEach(function (el) {
      el.addEventListener("change", function () {
        evaluateInterestedSubjectsOptions();
        evaluateCampusOptions();
        renderWelcomeConsultation();
        applyPendingPrefill();
      });
    });
    qAll(FIELD_SELECTORS.interestedSubjects).forEach(function (el) {
      el.addEventListener("change", function () {
        evaluateSubjectExclusions();
        renderWelcomeConsultation();
        renderSubjectSummary();
      });
    });
    var yearLevelEl = q(FIELD_SELECTORS.yearLevel);
    if (yearLevelEl) {
      yearLevelEl.addEventListener("change", function () {
        evaluateProgramInterestOptions();
        evaluateInterestedSubjectsOptions();
        updateSchoolFieldGraduateMode();
        applyPendingPrefill();
      });
    }
    var intakeYearEl = q(FIELD_SELECTORS.intakeYear);
    if (intakeYearEl) {
      intakeYearEl.addEventListener("change", function () {
        evaluateProgramInterestOptions();
        evaluateInterestedSubjectsOptions();
        evaluateYearLevelOptions();
        evaluateIntakeYearDependents();
        applyPendingPrefill();
      });
    }
  }
  var SCHOOL_LIST_URL = "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a58568773b5f6caa95424cc_7250ab944ad1d54f698183343d9a5688_schools_with_codes.txt";
  var schoolListCache = null;
  var schoolListPromise = null;
  function loadSchoolList() {
    if (schoolListCache) return Promise.resolve(schoolListCache);
    if (schoolListPromise) return schoolListPromise;
    schoolListPromise = fetch(SCHOOL_LIST_URL).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (list) {
      schoolListCache = list;
      return list;
    }).catch(function (err) {
      console.warn("Contour Form 1 logic: failed to load school list —", err);
      schoolListCache = [];
      return schoolListCache;
    });
    return schoolListPromise;
  }
  function enhanceSchoolSearch() {
    var input = q(FIELD_SELECTORS.schoolText);
    if (!input) return;
    if (input.closest(".contour-school-search")) return;
    var codeInput = q(FIELD_SELECTORS.schoolCode);
    var acaraInput = q(FIELD_SELECTORS.acaraId);
    var wrapper = document.createElement("div");
    wrapper.className = "contour-school-search";
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    var listbox = document.createElement("ul");
    listbox.className = "contour-school-search__listbox";
    listbox.setAttribute("role", "listbox");
    listbox.id = "contour-school-listbox";
    listbox.hidden = true;
    wrapper.appendChild(listbox);
    input.setAttribute("aria-controls", listbox.id);
    var MIN_CHARS = 2;
    var MAX_RESULTS = 50;
    var activeIndex = -1;
    var currentMatches = [];
    function normalize(s) {
      return s.toLowerCase().trim();
    }
    function matchesQueryAndLocation(school, query, location) {
      if (!location || school.state !== location) return false;
      return normalize(school.name).indexOf(query) !== -1;
    }
    function tokenize(s) {
      return normalize(s).split(/[^a-z0-9]+/).filter(function (w) {
        return w.length > 0;
      });
    }
    function levenshtein(a, b) {
      var m = a.length, n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      var prev = new Array(n + 1);
      var curr = new Array(n + 1);
      for (var j = 0; j <= n; j++) prev[j] = j;
      for (var i = 1; i <= m; i++) {
        curr[0] = i;
        for (var j2 = 1; j2 <= n; j2++) {
          var cost = a.charAt(i - 1) === b.charAt(j2 - 1) ? 0 : 1;
          curr[j2] = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
        }
        var tmp = prev;
        prev = curr;
        curr = tmp;
      }
      return prev[n];
    }
    function typoTolerance(len) {
      if (len <= 3) return 0;
      if (len <= 6) return 1;
      return 2;
    }
    function fuzzyWordMatches(queryWord, nameWord) {
      if (nameWord.indexOf(queryWord) === 0) return true;
      var tolerance = typoTolerance(queryWord.length);
      if (tolerance === 0) return false;
      return levenshtein(queryWord, nameWord) <= tolerance;
    }
    function fuzzyMatchesQueryAndLocation(school, queryWords, location) {
      if (!location || school.state !== location) return false;
      var nameWords = tokenize(school.name);
      return queryWords.every(function (qw) {
        return nameWords.some(function (nw) {
          return fuzzyWordMatches(qw, nw);
        });
      });
    }
    function searchSchools(list, query, location) {
      var exact = list.filter(function (school) {
        return matchesQueryAndLocation(school, query, location);
      });
      if (exact.length > 0) return exact;
      var queryWords = tokenize(query);
      if (queryWords.length === 0) return [];
      return list.filter(function (school) {
        return fuzzyMatchesQueryAndLocation(school, queryWords, location);
      });
    }
    // For Graduated students "Gap Year/Not in University" behaves like a
    // list entry: it appears (first) only when the typed query matches it —
    // never by default.
    function withGradQuickMatch(matches, query) {
      if (!isGraduatedSelected()) return matches;
      var nameNorm = normalize(GRAD_QUICK_VALUE);
      var hit = nameNorm.indexOf(query) !== -1;
      if (!hit) {
        var queryWords = tokenize(query);
        var nameWords = tokenize(GRAD_QUICK_VALUE);
        hit = queryWords.length > 0 && queryWords.every(function (qw) {
          return nameWords.some(function (nw) {
            return fuzzyWordMatches(qw, nw);
          });
        });
      }
      if (!hit) return matches;
      return [{
        name: GRAD_QUICK_VALUE,
        school_code: "",
        acara_id: ""
      }].concat(matches.filter(function (school) {
        return school.name !== GRAD_QUICK_VALUE;
      }));
    }
    function renderResults(matches) {
      listbox.innerHTML = "";
      currentMatches = matches;
      activeIndex = -1;
      if (matches.length === 0) {
        listbox.hidden = true;
        input.setAttribute("aria-expanded", "false");
        return;
      }
      matches.forEach(function (school, i) {
        var li = document.createElement("li");
        li.className = "contour-school-search__option";
        li.id = "contour-school-option-" + i;
        li.setAttribute("role", "option");
        li.setAttribute("aria-selected", "false");
        li.textContent = school.name;
        li.addEventListener("mousedown", function (e) {
          e.preventDefault();
          selectSchool(school);
        });
        listbox.appendChild(li);
      });
      listbox.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    var suppressNextInputEvent = false;
    function closeListbox() {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }
    function setHiddenField(el, value) {
      if (!el) return;
      el.value = value || "";
      el.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      el.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    function selectSchool(school) {
      input.value = school.name;
      setHiddenField(acaraInput, school.acara_id);
      setHiddenField(codeInput, school.school_code);
      closeListbox();
      suppressNextInputEvent = true;
      input.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      input.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    }
    function moveActive(delta) {
      if (currentMatches.length === 0) return;
      activeIndex = (activeIndex + delta + currentMatches.length) % currentMatches.length;
      var options = listbox.querySelectorAll(".contour-school-search__option");
      options.forEach(function (opt, i) {
        opt.setAttribute("aria-selected", i === activeIndex ? "true" : "false");
      });
      input.setAttribute("aria-activedescendant", "contour-school-option-" + activeIndex);
      options[activeIndex].scrollIntoView({
        block: "nearest"
      });
    }
    input.addEventListener("input", function () {
      if (suppressNextInputEvent) {
        suppressNextInputEvent = false;
        return;
      }
      var query = normalize(input.value);
      if (query.length < MIN_CHARS) {
        closeListbox();
        if (codeInput && codeInput.value) setHiddenField(codeInput, "");
        if (acaraInput && acaraInput.value) setHiddenField(acaraInput, "");
        return;
      }
      if (codeInput && codeInput.value) setHiddenField(codeInput, "");
      if (acaraInput && acaraInput.value) setHiddenField(acaraInput, "");
      loadSchoolList().then(function (list) {
        var currentLocation = getValue(FIELD_SELECTORS.location);
        var matches = searchSchools(list, query, currentLocation).slice(0, MAX_RESULTS);
        renderResults(withGradQuickMatch(matches, query));
      });
    });
    input.addEventListener("keydown", function (e) {
      if (listbox.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        var query = normalize(input.value);
        if (query.length >= MIN_CHARS) {
          loadSchoolList().then(function (list) {
            var currentLocation = getValue(FIELD_SELECTORS.location);
            renderResults(withGradQuickMatch(searchSchools(list, query, currentLocation).slice(0, MAX_RESULTS), query));
          });
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveActive(1);
          break;

        case "ArrowUp":
          e.preventDefault();
          moveActive(-1);
          break;

        case "Enter":
          if (activeIndex >= 0 && currentMatches[activeIndex]) {
            e.preventDefault();
            selectSchool(currentMatches[activeIndex]);
          }
          break;

        case "Escape":
          closeListbox();
          break;
      }
    });
    input.addEventListener("blur", function () {
      setTimeout(closeListbox, 100);
    });
    document.addEventListener("click", function (e) {
      if (!wrapper.contains(e.target)) closeListbox();
    });
    // Helper-text quick links fill through the same path as a dropdown pick
    // so HubSpot's native required-field error clears.
    schoolQuickFillHook = function (name) {
      selectSchool({
        name: name,
        school_code: "",
        acara_id: ""
      });
    };
    loadSchoolList();
  }
  function watchSchoolFieldRerender() {
    // HubSpot v2 embeds re-render a field's DOM when native validation fires,
    // destroying the injected combobox — detect that and re-apply.
    var observer = new MutationObserver(function () {
      var input = q(FIELD_SELECTORS.schoolText);
      if (input && !input.closest(".contour-school-search")) {
        enhanceSchoolSearch();
        evaluateIntakeYearDependents();
      }
    });
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  var pendingErrorScrolls = null;
  function scrollErrorIntoView(el) {
    if (!el) return;
    if (pendingErrorScrolls) {
      pendingErrorScrolls.push(el);
      return;
    }
    pendingErrorScrolls = [el];
    setTimeout(function () {
      var best = null;
      var bestTop = null;
      for (var i = 0; i < pendingErrorScrolls.length; i++) {
        var top = pendingErrorScrolls[i].getBoundingClientRect().top;
        if (bestTop === null || top < bestTop) {
          bestTop = top;
          best = pendingErrorScrolls[i];
        }
      }
      pendingErrorScrolls = null;
      if (best && best.scrollIntoView) best.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 0);
  }
  function isFieldWrapVisible(fieldWrap) {
    return fieldWrap.style.display !== "none";
  }
  function schoolFieldSatisfied() {
    var input = q(FIELD_SELECTORS.schoolText);
    return !!input && input.value.trim() !== "";
  }
  function anyProgramInterestOptionEligible() {
    return qAll(FIELD_SELECTORS.programInterest).some(function (opt) {
      return !opt.disabled;
    });
  }
  function enforceFieldRequiredValidation(fieldSelectorKey, errorText, errorClass, isFieldRelevantFn, isFieldSatisfiedFn) {
    var options = qAll(FIELD_SELECTORS[fieldSelectorKey]);
    if (options.length === 0) return;
    var fieldWrap = fieldWrapper(options[0]);
    if (!fieldWrap) return;
    if (hasNativeRequiredMark(fieldWrap)) return;
    function defaultSatisfied() {
      return qAll(FIELD_SELECTORS[fieldSelectorKey]).some(function (opt) {
        return opt.checked;
      });
    }
    var isSatisfied = isFieldSatisfiedFn || defaultSatisfied;
    function isValid() {
      return !isFieldRelevantFn(fieldWrap) || isSatisfied();
    }
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list " + errorClass;
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorLabel.textContent = errorText;
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    fieldWrap.appendChild(errorList);
    function showError() {
      errorList.style.display = "";
      scrollErrorIntoView(fieldWrap);
    }
    function clearError() {
      errorList.style.display = "none";
    }
    options.forEach(function (opt) {
      opt.addEventListener("change", function () {
        if (isValid()) clearError();
      });
      opt.addEventListener("input", function () {
        if (isValid()) clearError();
      });
    });
    if (formRoot) {
      formRoot.addEventListener("submit", function (e) {
        if (!isValid()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showError();
        }
      }, true);
    }
    return {
      isValid: isValid,
      showError: showError,
      clearError: clearError
    };
  }
  // Every selected program card must be backed by at least one selected
  // subject from that program, otherwise submission is blocked (Amitav,
  // 16 Aug 2026): picking Education + MedPrep but only a UCAT subject used
  // to submit with an empty Education signup.
  var PROGRAM_DISPLAY_NAMES = {
    Education: "High School Tutoring",
    TestPrep: "Selective Entry & Scholarship",
    MedPrep: "Medical Entry"
  };
  function enforceProgramSubjectCoverageValidation() {
    var subjectOptions = qAll(FIELD_SELECTORS.interestedSubjects);
    if (subjectOptions.length === 0) return;
    // The error renders as a single line under the program cards (brand
    // section), not inside the subjects list (Amitav's request).
    var programOptions = qAll(FIELD_SELECTORS.programInterest);
    if (programOptions.length === 0) return;
    var fieldWrap = fieldWrapper(programOptions[0]);
    if (!fieldWrap) return;
    function missingPrograms() {
      var selectedPrograms = getCheckedValues(FIELD_SELECTORS.programInterest);
      if (selectedPrograms.length === 0) return [];
      var covered = {};
      qAll(FIELD_SELECTORS.interestedSubjects + ":checked").forEach(function (opt) {
        var program = getClassification(opt).program;
        if (program) covered[program] = true;
      });
      return selectedPrograms.filter(function (programValue) {
        return !covered[programValue];
      });
    }
    function isValid() {
      return missingPrograms().length === 0;
    }
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list contour-program-coverage-error";
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    fieldWrap.appendChild(errorList);
    function showError() {
      var names = missingPrograms().map(function (programValue) {
        return PROGRAM_DISPLAY_NAMES[programValue] || programValue;
      });
      errorLabel.textContent = "Please select a " + names.join(" and ") + " subject, or deselect the program.";
      errorList.style.display = "";
      scrollErrorIntoView(fieldWrap);
    }
    function clearError() {
      errorList.style.display = "none";
    }
    qAll(FIELD_SELECTORS.interestedSubjects).concat(qAll(FIELD_SELECTORS.programInterest)).forEach(function (opt) {
      opt.addEventListener("change", function () {
        if (isValid()) clearError();
      });
    });
    if (formRoot) {
      formRoot.addEventListener("submit", function (e) {
        if (!isValid()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showError();
        }
      }, true);
    }
  }
  function enforceEmailTempValidation() {
    var input = q(FIELD_SELECTORS.emailTemp);
    if (!input) return;
    var EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    function isValid() {
      var value = input.value.trim();
      if (value === "") return true;
      return EMAIL_PATTERN.test(value);
    }
    var wrapper = fieldWrapper(input) || input.parentElement;
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list contour-email-temp-error";
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorLabel.textContent = "Please enter a valid email address.";
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    wrapper.appendChild(errorList);
    function showError() {
      input.classList.add("invalid", "error");
      errorList.style.display = "";
    }
    function clearError() {
      input.classList.remove("invalid", "error");
      errorList.style.display = "none";
    }
    input.addEventListener("blur", function () {
      if (isValid()) clearError(); else showError();
    });
    input.addEventListener("input", function () {
      if (isValid()) clearError();
    });
    if (formRoot) {
      formRoot.addEventListener("submit", function (e) {
        if (!isValid()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showError();
          scrollErrorIntoView(fieldWrapper(input) || input);
          input.focus();
        }
      }, true);
    }
  }
  /* =========================================================
     DUPLICATE EMAIL GUARD — block re-signup with a known email
     -----------------------------------------------------------
     On blur (i.e. as soon as the user moves to the next field) the entered
     email is checked against the prefetch cloud function's /exists route,
     which searches HubSpot contacts across email, email_2 and student_email.
     A hit shows an error under the email box and blocks submission. Results
     are cached per address so blur + submit never double-hit the endpoint.
     Network failures fail open — an outage of the check must never lock
     legitimate signups out.
     ========================================================= */
  function enforceDuplicateEmailValidation() {
    if (!PREFETCH_ENDPOINT) return;
    var input = q(FIELD_SELECTORS.emailTemp);
    if (!input) return;
    var wrapper = fieldWrapper(input) || input.parentElement;
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list contour-duplicate-email-error";
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorLabel.textContent = "This email is already registered. Please contact our team to update your details.";
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    wrapper.appendChild(errorList);
    function showError() {
      input.classList.add("invalid", "error");
      errorList.style.display = "";
    }
    function clearError() {
      input.classList.remove("invalid", "error");
      errorList.style.display = "none";
    }
    var results = {};
    var pending = {};
    function checkEmail(email) {
      if (Object.prototype.hasOwnProperty.call(results, email)) {
        return Promise.resolve(results[email]);
      }
      if (pending[email]) return pending[email];
      var request = fetch(PREFETCH_ENDPOINT + "/exists?email=" + encodeURIComponent(email)).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (data) {
        results[email] = !!(data && data.exists);
        return results[email];
      }).catch(function (err) {
        console.warn("Contour Form 1 logic: duplicate email check failed —", err);
        results[email] = false;
        return false;
      }).then(function (exists) {
        delete pending[email];
        return exists;
      });
      pending[email] = request;
      return request;
    }
    function currentEmail() {
      return input.value.trim().toLowerCase();
    }
    function reflectResult(email, exists) {
      if (currentEmail() !== email) return;
      if (exists) showError(); else clearError();
    }
    input.addEventListener("blur", function () {
      var email = currentEmail();
      if (!EMAIL_SHAPE.test(email)) return;
      checkEmail(email).then(function (exists) {
        reflectResult(email, exists);
      });
    });
    input.addEventListener("input", function () {
      clearError();
    });
    if (formRoot) {
      formRoot.addEventListener("submit", function (e) {
        var email = currentEmail();
        if (!EMAIL_SHAPE.test(email)) return;
        if (results[email] === false) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (results[email] === true) {
          showError();
          scrollErrorIntoView(fieldWrapper(input) || input);
          input.focus();
          return;
        }
        // Verdict still in flight (or blur never fired) — resolve it, then
        // either surface the duplicate error or re-submit; the cached result
        // lets the re-submission pass straight through this gate.
        checkEmail(email).then(function (exists) {
          if (currentEmail() !== email) return;
          if (exists) {
            showError();
            scrollErrorIntoView(fieldWrapper(input) || input);
            input.focus();
            return;
          }
          if (typeof formRoot.requestSubmit === "function") {
            formRoot.requestSubmit();
          } else {
            var submitButton = formRoot.querySelector('input[type="submit"], button[type="submit"]');
            if (submitButton) submitButton.click();
          }
        });
      }, true);
    }
  }
  /* =========================================================
     STUDENT PHONE NUMBER — country code + number segmentation
     -----------------------------------------------------------
     student_phone_number is a HubSpot "phone number" property, but the form
     field carries no useCountryCodeSelect metaData (unlike the guardian
     "phone" field, which also has a 7:20 digit-range validation configured),
     so HubSpot renders it as one plain tel input with no country selector.

     Rather than depend on that per-field toggle being flipped in the HubSpot
     form editor, build the same two-part control here: a country <select>
     plus the original input, which keeps carrying the submitted value in
     "+<dial> <national>" form — the same shape HubSpot's own widget submits.
     If the native toggle IS enabled later, HubSpot renders
     .hs-fieldtype-intl-phone itself and enhanceStudentPhoneField() bails out,
     leaving the native widget untouched.
  ========================================================= */
  // Injected rather than left to form1.css alone: that stylesheet lives in the
  // Webflow page header, so a CSS-only change needs a Webflow edit + publish,
  // while these ship with the form1.js push. Mirrors the "injected country-code
  // selector" and "student/guardian field pairing" blocks in form1.css — keep
  // the two in step. Appended after the header CSS, so it wins on order.
  function injectStudentPhoneStyles() {
    if (document.getElementById("contour-student-phone-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-student-phone-styles";
    // The half-width rule is listed twice, the second time at the same
    // specificity as the header CSS's ".hs-dependent-field > .hs-form-field"
    // full-width default, so it can't lose to it on specificity — only the
    // first selector applies if HubSpot ever nests the field deeper.
    style.textContent = ".hs-form .hs_student_phone_number, .hs-form .hs-dependent-field > .hs_student_phone_number { flex: 0 0 calc(50% - 0.375rem) !important; box-sizing: border-box; margin-bottom: 0 !important; }" + ".hs-form .contour-intl-phone { display: flex; align-items: stretch; gap: 0.5rem; width: 100%; box-sizing: border-box; }" + '.hs-form select.contour-intl-phone__country:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex: 0 0 auto !important; width: auto !important; min-width: 90px; max-width: 130px; }' + '.hs-form input.contour-intl-phone__number:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex: 1 1 auto !important; width: auto !important; min-width: 0; }' + "@media screen and (max-width: 767px) { .hs-form .hs_student_phone_number, .hs-form .hs-dependent-field > .hs_student_phone_number { flex: 0 0 100% !important; } }" + '@media screen and (max-width: 480px) { .hs-form .contour-intl-phone { flex-direction: column; } .hs-form select.contour-intl-phone__country:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { max-width: 100%; width: 100% !important; } }';
    document.head.appendChild(style);
  }
  var STUDENT_PHONE_DEFAULT_ISO = "au";
  var STUDENT_PHONE_MIN_DIGITS = 7;
  var STUDENT_PHONE_MAX_DIGITS = 20;
  var studentPhoneCountries = null;
  function getStudentPhoneCountries() {
    if (studentPhoneCountries) return studentPhoneCountries;
    // Intl.DisplayNames turns the ISO codes already in PHONE_DIAL_CODES into
    // country names ("au" -> "Australia") without shipping a name table;
    // falls back to the uppercased code where it isn't supported.
    var display = null;
    try {
      if (typeof Intl !== "undefined" && Intl.DisplayNames) {
        display = new Intl.DisplayNames(["en"], {
          type: "region"
        });
      }
    } catch (e) {
      display = null;
    }
    studentPhoneCountries = PHONE_DIAL_CODES.map(function (entry) {
      var upper = entry[1].toUpperCase();
      var name = upper;
      if (display) {
        try {
          name = display.of(upper) || upper;
        } catch (e2) {
          name = upper;
        }
      }
      return {
        iso: entry[1],
        dial: entry[0],
        name: name
      };
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    return studentPhoneCountries;
  }
  function studentPhoneDial(select) {
    var opt = select.options[select.selectedIndex];
    return opt ? opt.getAttribute("data-dial") || "" : "";
  }
  function selectStudentPhoneCountry(select, iso) {
    var target = String(iso || "").toLowerCase();
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === target) {
        select.selectedIndex = i;
        return;
      }
    }
  }
  function formatStudentPhone(dial, nationalDigits) {
    // Leading zeros are trunk prefixes (0470… in AU, 07… in the UK) and are
    // never part of the international number.
    var national = String(nationalDigits || "").replace(/\D/g, "").replace(/^0+/, "");
    if (!dial) return national === "" ? "" : "+" + national;
    // The dial code stays in the box even with no number typed yet, so the
    // field reads the same as HubSpot's own phone widget from first render
    // (which seeds "+61" the moment the form loads).
    return national === "" ? "+" + dial + " " : "+" + dial + " " + national;
  }
  function normalizeStudentPhoneInput(select, input) {
    var value = (input.value || "").trim();
    if (value === "") return;
    // A pasted/prefilled international number wins over the current select —
    // sync the dropdown to it instead of prefixing a second dial code.
    var parts = value.charAt(0) === "+" ? splitE164(value) : null;
    if (parts) {
      selectStudentPhoneCountry(select, parts.iso);
      input.value = formatStudentPhone(parts.dial, parts.national);
      return;
    }
    input.value = formatStudentPhone(studentPhoneDial(select), value);
  }
  function enhanceStudentPhoneField() {
    var input = q(FIELD_SELECTORS.studentPhone);
    if (!input || input.type === "hidden") return;
    if (input.closest(".contour-intl-phone")) return;
    if (input.closest(".hs-fieldtype-intl-phone")) return;
    var parent = input.parentElement;
    if (!parent) return;
    var group = document.createElement("div");
    group.className = "contour-intl-phone";
    var select = document.createElement("select");
    select.className = "hs-input contour-intl-phone__country";
    select.setAttribute("aria-label", "Student phone country");
    getStudentPhoneCountries().forEach(function (country) {
      var opt = document.createElement("option");
      opt.value = country.iso;
      opt.setAttribute("data-dial", country.dial);
      opt.textContent = country.name;
      select.appendChild(opt);
    });
    parent.insertBefore(group, input);
    group.appendChild(select);
    group.appendChild(input);
    input.classList.add("contour-intl-phone__number");
    input.type = "tel";
    input.setAttribute("autocomplete", "tel");
    var existing = (input.value || "").trim();
    var existingParts = existing.charAt(0) === "+" ? splitE164(existing) : null;
    selectStudentPhoneCountry(select, existingParts ? existingParts.iso : STUDENT_PHONE_DEFAULT_ISO);
    // Seed the dial code straight away (no input/change events — this isn't the
    // user typing), matching how HubSpot's own widget shows "+61" on load.
    input.value = existing === "" ? formatStudentPhone(studentPhoneDial(select), "") : input.value;
    if (existing !== "") normalizeStudentPhoneInput(select, input);
    var previousDial = studentPhoneDial(select);
    select.addEventListener("change", function () {
      var digits = (input.value || "").replace(/\D/g, "");
      if (previousDial && digits.indexOf(previousDial) === 0) {
        digits = digits.slice(previousDial.length);
      }
      previousDial = studentPhoneDial(select);
      input.value = formatStudentPhone(previousDial, digits);
      fireInputEvents(input);
      updateStudentPhoneError();
    });
    input.addEventListener("input", function () {
      updateStudentPhoneError();
    });
    input.addEventListener("blur", function () {
      // Clearing the box entirely still leaves the dial code behind, so the
      // control never loses the country half of the pair.
      if ((input.value || "").trim() === "") {
        input.value = formatStudentPhone(studentPhoneDial(select), "");
      } else {
        normalizeStudentPhoneInput(select, input);
      }
      previousDial = studentPhoneDial(select);
      fireInputEvents(input);
      updateStudentPhoneError(true);
    });
  }
  function watchStudentPhoneField() {
    // The field sits inside the Contact Type dependent group, so it isn't in
    // the DOM at init, and HubSpot re-renders it whenever native validation
    // fires — the same behaviour watchSchoolFieldRerender() handles.
    // enhanceStudentPhoneField() is idempotent, so the mutations it makes
    // itself just no-op on the next observer callback.
    var observer = new MutationObserver(function () {
      enhanceStudentPhoneField();
    });
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  // "ok" | "empty" | "incomplete" | "invalid". Seeding the dial code means the
  // input is never blank once rendered, so HubSpot's own required-field check
  // always passes — "incomplete" (dial code but no number) is therefore ours to
  // catch, with HubSpot's own wording so the field reads like the rest of them.
  function studentPhoneState() {
    var input = q(FIELD_SELECTORS.studentPhone);
    if (!input) return "ok";
    var wrap = fieldWrapper(input);
    if (wrap && !isFieldWrapVisible(wrap)) return "ok";
    var value = (input.value || "").trim();
    var digits = value.replace(/\D/g, "");
    // Genuinely blank: HubSpot's own required error covers it.
    if (value === "") return "empty";
    var group = input.closest(".contour-intl-phone");
    var select = group ? group.querySelector("select") : null;
    var dial = select ? studentPhoneDial(select) : "";
    var national = dial && digits.indexOf(dial) === 0 ? digits.slice(dial.length) : digits;
    if (national === "") return "incomplete";
    if (digits.length < STUDENT_PHONE_MIN_DIGITS || digits.length > STUDENT_PHONE_MAX_DIGITS) {
      return "invalid";
    }
    return "ok";
  }
  function studentPhoneIsValid() {
    var state = studentPhoneState();
    return state === "ok" || state === "empty";
  }
  function ensureStudentPhoneError() {
    var input = q(FIELD_SELECTORS.studentPhone);
    if (!input) return null;
    var wrap = fieldWrapper(input) || input.parentElement;
    if (!wrap) return null;
    var existing = wrap.querySelector(".contour-student-phone-error");
    if (existing) return existing;
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list contour-student-phone-error";
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    wrap.appendChild(errorList);
    return errorList;
  }
  function updateStudentPhoneError(showWhenInvalid) {
    var input = q(FIELD_SELECTORS.studentPhone);
    var errorList = ensureStudentPhoneError();
    if (!input || !errorList) return;
    var state = studentPhoneState();
    if (state === "ok" || state === "empty") {
      input.classList.remove("invalid", "error");
      errorList.style.display = "none";
      return;
    }
    if (!showWhenInvalid) return;
    var errorLabel = errorList.querySelector(".hs-error-msg");
    if (errorLabel) {
      errorLabel.textContent = state === "incomplete" ? "Please complete this required field." : "Please enter a valid phone number.";
    }
    input.classList.add("invalid", "error");
    errorList.style.display = "";
  }
  function enforceStudentPhoneValidation() {
    if (!formRoot) return;
    formRoot.addEventListener("submit", function (e) {
      if (studentPhoneIsValid()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      updateStudentPhoneError(true);
      var input = q(FIELD_SELECTORS.studentPhone);
      scrollErrorIntoView(fieldWrapper(input) || input);
      if (input) input.focus();
    }, true);
  }
  /* =========================================================
     INTERNAL-ONLY QUESTIONS
     -----------------------------------------------------------
     Questions only staff answer, when they take a signup on someone's
     behalf. Public visitors must never see them; ?type=internal on the
     form URL reveals them and makes them required.

     Each field is deliberately NOT hidden in HubSpot: a hidden field is
     rendered as <input type="hidden"> with the <select> and every option
     dropped from the page (the embed bundle picks the component from the
     hidden flag before it consults the field type), leaving nothing to
     reveal. They are also deliberately NOT required in HubSpot, because a
     native required mark both blocks public visitors on a field they
     can't see and makes enforceFieldRequiredValidation() bail out.
     ========================================================= */
  var INTERNAL_TYPE_PARAM = "type";
  var INTERNAL_TYPE_VALUE = "internal";
  // publicValue is what a normal visitor's submission records while the
  // question is hidden — "" leaves the property blank. A non-empty one is also
  // taken off the menu in internal mode, so staff can't pick the public default.
  var INTERNAL_ONLY_FIELDS = [{
    key: "contactMethod",
    slug: "contact-method",
    publicValue: "Website Sign-Ups",
    errorText: "Please select how they contacted us."
  }, {
    key: "signedUpBy",
    slug: "signed-up-by",
    publicValue: "",
    errorText: "Please select who signed them up.",
    searchable: true,
    searchPlaceholder: "Start typing a name"
  }];
  INTERNAL_ONLY_FIELDS.forEach(function (config) {
    config.errorClass = "contour-" + config.slug + "-error";
    config.updateRequiredMark = createRequiredMarkUpdater(config.key, "contour-" + config.slug + "-required");
    config.cleared = false;
  });
  function isInternalMode() {
    return getUrlParam(INTERNAL_TYPE_PARAM).trim().toLowerCase() === INTERNAL_TYPE_VALUE;
  }
  function selectOptions(select) {
    return Array.prototype.slice.call(select.options);
  }
  // Returns true when it had to create one, which also means HubSpot has just
  // rendered the <select> fresh — without a blank option the browser preselects
  // the first real one, so the caller has to clear that.
  function ensureBlankOption(select) {
    var existing = selectOptions(select).some(function (option) {
      return option.value === "";
    });
    if (existing) return false;
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Please select";
    select.insertBefore(placeholder, select.firstChild);
    return true;
  }
  // setSelectOrTextValue() ignores "" by design, so clearing needs its own path.
  function clearSelectValue(select) {
    if (select.value === "") return;
    select.value = "";
    select.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    select.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  /* ---------------------------------------------------------
     Searchable dropdown
     -----------------------------------------------------------
     Turns a <select> into a type-to-filter combobox for lists too long to
     scan by eye — the same interaction as the school field. The <select>
     itself stays in the DOM as the value HubSpot submits, just visually
     hidden, so the option list needs no duplicating here and grows
     automatically as staff are added in HubSpot.

     The class names are the school combobox's on purpose. The live CSS
     lives in the Webflow page header (css/form1.css is only a reference
     copy), so a fresh set of names would need a Webflow paste and publish
     before it looked right.
     --------------------------------------------------------- */
  var COMBOBOX_CLASS = "contour-school-search";
  var comboboxTargets = new WeakMap();
  function comboboxWrapperOf(select) {
    var previous = select.previousElementSibling;
    if (!previous || !previous.classList.contains(COMBOBOX_CLASS)) return null;
    // When HubSpot re-renders it swaps in a new <select> in the same position, so
    // position alone doesn't prove the combobox belongs to it. A wrapper built
    // for the old element still writes to that now-detached <select>, which would
    // look like it worked while submitting nothing — treat it as absent so the
    // caller rebuilds.
    return comboboxTargets.get(previous) === select ? previous : null;
  }
  function selectableOptions(select) {
    return selectOptions(select).filter(function (option) {
      return option.value !== "" && !option.hidden && !option.disabled;
    });
  }
  function optionLabelFor(select, value) {
    if (!value) return "";
    var chosen = selectOptions(select).filter(function (option) {
      return option.value === value;
    })[0];
    return chosen ? chosen.textContent.trim() : "";
  }
  // Keeps the visible text honest when something else changes the select —
  // evaluateInternalOnlyField() clearing it, or a HubSpot re-render. Skipped
  // while the field has focus so it can't overwrite what is being typed.
  function syncComboboxInput(select) {
    var wrapper = comboboxWrapperOf(select);
    if (!wrapper) return;
    var input = wrapper.querySelector("input");
    if (!input || document.activeElement === input) return;
    input.value = optionLabelFor(select, select.value);
  }
  function enhanceSearchableSelect(select, config) {
    if (comboboxWrapperOf(select)) return;
    var fieldWrap = fieldWrapper(select);
    // A HubSpot re-render can swap the <select> out from under an existing
    // combobox, orphaning it next to an element no longer on the page. Clear any
    // before building a fresh one, so the field never ends up with two.
    if (fieldWrap) {
      Array.prototype.forEach.call(fieldWrap.querySelectorAll("." + COMBOBOX_CLASS), function (stale) {
        if (stale.parentNode) stale.parentNode.removeChild(stale);
      });
    }
    var wrapper = document.createElement("div");
    wrapper.className = COMBOBOX_CLASS;
    comboboxTargets.set(wrapper, select);
    // No name attribute: this input is a filter, never a submitted value.
    var input = document.createElement("input");
    input.type = "text";
    input.className = "hs-input";
    input.id = "contour-" + config.slug + "-search";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");
    if (config.searchPlaceholder) input.placeholder = config.searchPlaceholder;
    var listbox = document.createElement("ul");
    listbox.className = COMBOBOX_CLASS + "__listbox";
    listbox.id = "contour-" + config.slug + "-listbox";
    listbox.setAttribute("role", "listbox");
    listbox.hidden = true;
    input.setAttribute("aria-controls", listbox.id);
    wrapper.appendChild(input);
    wrapper.appendChild(listbox);
    select.parentNode.insertBefore(wrapper, select);
    var label = fieldWrap ? fieldWrap.querySelector("label") : null;
    if (label) label.setAttribute("for", input.id);
    var matches = [];
    var activeIndex = -1;
    function close() {
      listbox.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    }
    function setActive(index) {
      var rendered = listbox.querySelectorAll("[role=option]");
      if (rendered.length === 0) return;
      if (index < 0) index = rendered.length - 1;
      if (index >= rendered.length) index = 0;
      activeIndex = index;
      Array.prototype.forEach.call(rendered, function (li, i) {
        li.setAttribute("aria-selected", i === index ? "true" : "false");
      });
      input.setAttribute("aria-activedescendant", rendered[index].id);
      if (rendered[index].scrollIntoView) rendered[index].scrollIntoView({
        block: "nearest"
      });
    }
    function commit(option) {
      select.value = option.value;
      select.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      select.dispatchEvent(new Event("change", {
        bubbles: true
      }));
      input.value = option.textContent.trim();
      close();
    }
    function render(query) {
      var normalized = query.trim().toLowerCase();
      matches = selectableOptions(select).filter(function (option) {
        return !normalized || option.textContent.toLowerCase().indexOf(normalized) !== -1;
      });
      listbox.innerHTML = "";
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      if (matches.length === 0) {
        var empty = document.createElement("li");
        empty.className = COMBOBOX_CLASS + "__option";
        empty.setAttribute("aria-disabled", "true");
        empty.textContent = "No matches";
        listbox.appendChild(empty);
      } else {
        matches.forEach(function (option, i) {
          var li = document.createElement("li");
          li.className = COMBOBOX_CLASS + "__option";
          li.id = listbox.id + "-option-" + i;
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", "false");
          li.textContent = option.textContent.trim();
          li.addEventListener("mousedown", function (e) {
            // Ahead of blur, so the click isn't lost to the field closing first.
            e.preventDefault();
            commit(option);
          });
          listbox.appendChild(li);
        });
      }
      listbox.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
    input.addEventListener("input", function () {
      render(input.value);
    });
    input.addEventListener("focus", function () {
      input.select();
      render("");
    });
    input.addEventListener("blur", function () {
      // Typing a name without picking it selects nothing, so drop the query
      // rather than leave text that reads like an answer.
      close();
      input.value = optionLabelFor(select, select.value);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (listbox.hidden) {
          render(input.value);
          setActive(0);
          return;
        }
        setActive(activeIndex + (e.key === "ArrowDown" ? 1 : -1));
        return;
      }
      if (e.key === "Enter") {
        if (!listbox.hidden && activeIndex >= 0 && matches[activeIndex]) {
          e.preventDefault();
          commit(matches[activeIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        close();
        input.value = optionLabelFor(select, select.value);
      }
    });
    input.value = optionLabelFor(select, select.value);
  }
  function evaluateInternalOnlyField(config) {
    var select = q(FIELD_SELECTORS[config.key]);
    if (!select) return;
    var internal = isInternalMode();
    toggleFieldWrapper(select, internal);
    config.updateRequiredMark(internal);
    if (!internal) {
      // Force the public value even though the question is hidden: HubSpot
      // preselects the first real option when it renders no blank one, which
      // would otherwise submit a staff-only answer for a public visitor.
      if (!config.publicValue) clearSelectValue(select); else if (select.value !== config.publicValue) {
        setSelectOrTextValue(FIELD_SELECTORS[config.key], config.publicValue);
      }
      return;
    }
    // Take the public default off the menu so staff make a real choice.
    // Hidden + disabled rather than removed: the <select> is React-owned, and
    // detaching a child it still tracks can throw on its next re-render.
    var freshRender = ensureBlankOption(select);
    if (config.publicValue) {
      selectOptions(select).forEach(function (option) {
        if (option.value !== config.publicValue) return;
        option.hidden = true;
        option.disabled = true;
      });
    }
    // Nothing may arrive preselected. Clear on the first pass, on a fresh
    // HubSpot render, and any time the public default is showing — but leave a
    // staff member's own choice alone on subsequent observer callbacks.
    if (freshRender || !config.cleared || config.publicValue && select.value === config.publicValue) {
      clearSelectValue(select);
      config.cleared = true;
    }
    if (config.searchable) {
      // Only built in internal mode — a hidden question needs no combobox, and
      // building one would fight the wrapper being display:none.
      enhanceSearchableSelect(select, config);
      // Re-asserted on every pass rather than once at build time: a re-render
      // that keeps the same <select> node can still drop the inline style, which
      // would leave the native dropdown showing beside the combobox.
      select.style.display = "none";
      syncComboboxInput(select);
    }
  }
  function evaluateInternalOnlyFields() {
    INTERNAL_ONLY_FIELDS.forEach(evaluateInternalOnlyField);
  }
  function watchInternalOnlyFields() {
    // HubSpot re-renders the form after hydration and again when its own
    // validation fires, which restores the default option and the wrapper's
    // display. evaluateInternalOnlyField() is idempotent, so the mutations it
    // makes itself no-op on the next observer callback.
    var observer = new MutationObserver(function () {
      evaluateInternalOnlyFields();
    });
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  function internalOnlyFieldSatisfied(config) {
    return function () {
      var select = q(FIELD_SELECTORS[config.key]);
      if (!select || select.value.trim() === "") return false;
      return !config.publicValue || select.value !== config.publicValue;
    };
  }
  function enforceInternalOnlyFieldValidation() {
    var controllers = [];
    // Registered before the per-field validators below, so it still runs when
    // the first unanswered one calls stopImmediatePropagation(). Staff hit both
    // of these blank on every internal signup, so surfacing both errors at once
    // beats one error per submit attempt.
    if (formRoot) {
      formRoot.addEventListener("submit", function () {
        controllers.forEach(function (controller) {
          if (!controller.isValid()) controller.showError();
        });
      }, true);
    }
    INTERNAL_ONLY_FIELDS.forEach(function (config) {
      var controller = enforceFieldRequiredValidation(config.key, config.errorText, config.errorClass, isInternalMode, internalOnlyFieldSatisfied(config));
      if (controller) controllers.push(controller);
    });
  }
  // Grey helper note under the intake year dropdown clarifying when the
  // 2027 program actually starts (Amitav's request).
  var INTAKE_YEAR_NOTE_TEXT = "Our 2027 program begins in November 2026 with a two-week free trial.";
  function ensureIntakeYearNote() {
    var fieldEl = q(FIELD_SELECTORS.intakeYear);
    if (!fieldEl) return;
    var wrap = fieldWrapper(fieldEl);
    if (!wrap) return;
    if (wrap.querySelector(".contour-intake-year-note")) return;
    var note = document.createElement("div");
    note.className = "hs-field-desc contour-intake-year-note";
    note.textContent = INTAKE_YEAR_NOTE_TEXT;
    wrap.appendChild(note);
  }
  function ensureDividerBefore(fieldEl, id) {
    if (!fieldEl) return;
    var wrap = fieldWrapper(fieldEl);
    if (!wrap || !wrap.parentNode) return;
    if (formRoot.querySelector("#" + id)) return;
    var divider = document.createElement("hr");
    divider.id = id;
    divider.className = "contour-section-divider";
    wrap.parentNode.insertBefore(divider, wrap);
  }
  function init(formElement) {
    formRoot = formElement;
    enhanceProgramInterestCards();
    enhanceInterestedSubjectsCategories();
    injectDisabledFieldStyles();
    enhanceSchoolSearch();
    watchSchoolFieldRerender();
    enhanceCampusLabels();
    ensureIntakeYearNote();
    ensureDividerBefore(q(FIELD_SELECTORS.programInterest), "contour-divider-program-interest");
    // Sits between the "Your Subjects" summary box and Preferred Campuses —
    // the summary is inserted directly after the subjects field, so a
    // divider before the campus field lands right after it (Amitav).
    ensureDividerBefore(q(FIELD_SELECTORS.campus), "contour-divider-campus");
    ensureDividerBefore(q(FIELD_SELECTORS.referral), "contour-divider-referral");
    fixRadioCardClickArea();
    fixCheckboxCardClickArea();
    fixProgramCardClickArea();
    enforceContactTypeLayoutIfPresent();
    enhanceContactTypeIllustrations();
    enforceEmailTempValidation();
    enforceDuplicateEmailValidation();
    enhanceEmailPrefill();
    injectStudentPhoneStyles();
    enhanceStudentPhoneField();
    watchStudentPhoneField();
    enforceStudentPhoneValidation();
    enforceFieldRequiredValidation("programInterest", "Please select a program.", "contour-program-interest-error", anyProgramInterestOptionEligible);
    enforceFieldRequiredValidation("campus", "Please select a campus.", "contour-campus-error", isFieldWrapVisible);
    enforceFieldRequiredValidation("interestedSubjects", "Please select at least one subject.", "contour-subjects-error", isFieldWrapVisible);
    enforceProgramSubjectCoverageValidation();
    enforceFieldRequiredValidation("schoolText", "Please enter your school.", "contour-school-error", isFieldWrapVisible, schoolFieldSatisfied);
    enforceInternalOnlyFieldValidation();
    attachListeners();
    evaluateProgramInterestOptions();
    evaluateInterestedSubjectsOptions();
    evaluateCampusOptions();
    evaluateYearLevelOptions();
    evaluateSchoolFieldVisibility();
    evaluateIntakeYearDependents();
    evaluateInternalOnlyFields();
    watchInternalOnlyFields();
    renderWelcomeConsultation();
    renderSubjectSummary();
    initPrefetchFromUrl();
  }
  return {
    init: init
  };
}();