/* Contour Form 1 logic — source of truth: github.com/contour-tech/contour-education-signup-form-hubspot */
var ContourForm1Logic = function () {
  "use strict";
  var FIELD_SELECTORS = {
    contactType: '[name="web_form_contact_type"]',
    intakeYear: '[name="which_year_are_you_interested_in_tutoring_for_"]',
    location: '[name="state_territory_country"]',
    region: '[name="state"]',
    country: '[name="country_dropdown"]',
    programInterest: '[name="program_interest"]',
    interestedSubjects: '[name="web_form__interested_subject"]',
    campus: '[name="web_form__preferred_campuses"]',
    yearLevel: '[name="year_level"]',
    schoolText: '[name="school_text"]',
    schoolCode: '[name="school_code"]',
    acaraId: '[name="acara_id"]',
    canAddMoreSubjects: '[name="can_add_more_subjects"]',
    firstName: '[name="firstname"]',
    lastName: '[name="lastname"]',
    studentFirstName: '[name="student_first_name"]',
    studentLastName: '[name="student_last_name"]',
    emailTemp: '[name="email_2"]',
    studentEmail: '[name="student_email"]',
    guardianPhone: '[name="phone"]',
    studentPhone: '[name="student_phone_number"]',
    noProgramWaitlist: '[name="join_no_program_waitlist"]',
    referral: '[name="referral"]',
    contactMethod: '[name="how_did_they_contact_us"]',
    signedUpBy: '[name="signed_up_by"]'
  };
  var FIELD_WRAPPER_CLASS = "hs-form-field";
  /* =========================================================
     FEATURE FLAGS
     -----------------------------------------------------------
     Flip a default below and push, or override per page without a deploy by
     setting the global before the form initialises:

       <script>window.ContourForm1Config = { progressiveSections: true };</script>

     which is worth having while the staging and production embeds still read
     the same file.
     ========================================================= */
  var FEATURE_DEFAULTS = {
    // Discloses the form a section at a time, each one arriving as the one
    // before it is answered. Switched on 22 Aug 2026 (Angad/Amitav liked the
    // brand-section reveal and asked for the section-by-section flow; Amrit),
    // and off again 23 Aug in favour of stepSections below — a form that
    // grows as you answer it never shows how much is left. The trigger is
    // parked, not deleted: flip this back on per page to compare.
    progressiveSections: false,
    // The stepper. Every section card is on the page from first paint, so the
    // length of the form is visible; the ones not yet reached are greyed and
    // shut, and exactly one card — the first unanswered one — is open. Angad,
    // 23 Aug 2026. Mutually exclusive with progressiveSections in practice:
    // if both are on, disclosure hides the very cards this wants to show.
    stepSections: true,
    // Headings above each section. Parked rather than deleted: the only one
    // actually wanted is the Student / Guardian split, and that ships as
    // personGroups below (Amrit, 20 Aug 2026).
    sectionHeaders: false,
    // Groups the contact fields into one "Contact Information" container
    // with a Student / Guardian tab strip on its top edge, so the labels
    // stop repeating whose field is whose (Luke, 19 Aug 2026; tab design
    // finalised by Amrit, 21 Aug 2026 — see PERSON GROUPS below).
    personGroups: true,
    // Which end of the segment band carries "Student Details" / "Guardian
    // Details". Left by default: it lands on the same grid line as the field
    // labels under it, so the band reads as a heading for the rows rather than
    // a note tucked into the corner (Angad, 25 Aug 2026). On puts it back on
    // the right, and the rule's taper turns round with it.
    personLabelRight: false,
    // The "This is you" pill on the segment header of whoever is filling the
    // form in. Off: the band is a name and a rule, which is quieter, and the
    // rule takes the room the pill used to (Angad, 25 Aug 2026). On restores
    // the pill and the rule starts past it, measured.
    personYouPill: false,
    // Renders the Interested Subjects checkboxes as selectable tiles in the
    // program-card language — navy fill and a blue tick when picked. Off
    // restores the plain native checkboxes (Angad's "dopeify" round, 22 Aug
    // 2026; the earlier wall-of-boxes concern is gone now that the matrix
    // filters the list down per student).
    subjectTiles: true,
    // Wraps the Study / Programs / Campus / Finish sections in card
    // containers, and auto-collapses a completed section to a one-line
    // summary with an Edit affordance once a later section has opened.
    // Contact fields keep their existing personGroups box; the Student /
    // Guardian question stays bare as the form's opening line.
    sectionBoxes: true,
    // Section card headers in navy with the text knocked out white, instead
    // of the grey band with navy text. On by default (Amrit, 22 Aug); turn
    // off per page via window.ContourForm1Config if it doesn't land.
    sectionHeaderTheme2: true,
    // Raises the page's 768px cap on the form to 880px, so the widest campus
    // address fits one line in a half-width tile (Amrit, 23 Aug 2026).
    widerForm: true,
    // Ticks the program when only one is available for the location and year
    // level. Off: a program the student did not choose still reads as a
    // choice they made, and the tick landed while they were still filling the
    // section above — the handover code below stays for whoever turns this
    // back on (Amrit, 23 Aug 2026).
    autoSelectSingleProgram: false,
    // Mirrors the answers into localStorage as they are given and offers them
    // back on the next visit from the same browser. On by default — see the
    // LOCAL DRAFT CACHE block for what is deliberately never stored.
    localDraft: true,
    // A pre-fill link already knows who the person is, so the "Are you a
    // Student / Guardian" question is answered before the page renders.
    // Hides it (keeping the answer) rather than showing a decision that has
    // already been made for them (Amrit, 22 Aug 2026).
    hideContactTypeOnPrefill: true,
    // Locks Location and Year Level on a pre-fill link the way the email box
    // is locked — only where the record actually supplied one, and only until
    // the form itself clears it. See PREFILLED FIELD LOCK (Amrit, 22 Aug 2026).
    lockPrefilledStudyFields: true,
    // Checks the addresses this submission would create a contact for against
    // HubSpot before letting the form go. Parked with the DUPLICATE EMAIL
    // GUARD block — deduplication is moving to the backend, and this comes
    // back as the "email me my pre-fill link" enhancement.
    // duplicateEmailCheck: true
  };
  function featureEnabled(name) {
    var overrides = window.ContourForm1Config;
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, name)) return !!overrides[name];
    return !!FEATURE_DEFAULTS[name];
  }
  var VALID_LOCATIONS = ["VIC", "NSW", "QLD", "SA", "ACT", "TAS", "WA", "NT", "United Kingdom", "New Zealand", "Overseas"];
  // "Your Region" (the HubSpot `state` property) is a single-line text field
  // that opens when Your Location is United Kingdom. HubSpot can't render a
  // dropdown for a text property, so the options are built here from the
  // is_region rows of the Locations & Regions sheet in the 2027 Curriculum
  // Planning Matrix, and the code — not the name — is what gets submitted, so
  // the value joins straight back onto that sheet.
  //
  // Keyed by the Your Location value so a second region set (New Zealand) is a
  // data addition here plus a matching conditional in the HubSpot form editor.
  var REGIONS_BY_LOCATION = {
    "United Kingdom": [
      { code: "UK-LON", name: "London" },
      { code: "UK-SE", name: "South East" },
      { code: "UK-SW", name: "South West" },
      { code: "UK-EM", name: "East Midlands" },
      { code: "UK-WM", name: "West Midlands" },
      { code: "UK-EE", name: "East of England" },
      { code: "UK-NW", name: "North West" },
      { code: "UK-NE", name: "North East" },
      { code: "UK-YH", name: "Yorkshire and the Humber" },
      { code: "UK-WAL", name: "Wales" },
      { code: "UK-SCT", name: "Scotland" },
      { code: "UK-NIR", name: "Northern Ireland" }
    ]
  };
  // The twelve UK rows tile the whole country, so nobody living in the UK is
  // missing from the list. This is the escape hatch for the Crown dependencies
  // that sit outside it (Isle of Man, Jersey, Guernsey) and for a student who
  // doesn't know which region they're in — better a known sentinel than a
  // guess, and better than free text, which would drift away from the codes.
  var REGION_OTHER_CODE = "UK-OTH";
  var REGION_OTHER_NAME = "My region isn't listed";
  var REGION_PLACEHOLDER = "Please Select";
  // Hover keeps the Contour-blue accent (logo tint, border); the selected
  // state is a solid navy fill with white knockout content, styled in
  // injectProgramCardAccentStyles. accentSoft/accentContrast are unused by
  // the navy treatment but stay wired in case a wash returns.
  var PROGRAM_CARD_CONFIG = [{
    match: /education|tutoring/i,
    title: "High School Tutoring",
    description: "Expert tutoring to maximise your subject scores & ATAR",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbf0cd57f2b816bcc79fb_Final%20EDUCATION%20horizontal%20logo.svg",
    // Right-side clip of the hover tint so only the icon + "contour"
    // wordmark colours in, never the brand suffix. Measured per SVG: the
    // wordmark ends at x=362 and the suffix starts at x=380 in every logo,
    // so the clip sits at the x=371 midpoint of that gap over each width.
    logoTintRight: "45.4%",
    accent: "#3478F7",
    accentSoft: "rgba(215, 252, 61, 0.18)",
    accentContrast: "#0C3166"
  }, {
    match: /test\s*prep|selective/i,
    title: "Selective Entry & Scholarship",
    description: "Prep for the Victorian selective entry & scholarship exams",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbed5fdbd2c829b5e4e7c_Final%20TESTPREP%20Charcoal%20horizontal%20logo.svg",
    logoTintRight: "41.8%",
    accent: "#3478F7",
    accentSoft: "rgba(215, 252, 61, 0.18)",
    accentContrast: "#0C3166"
  }, {
    match: /med\s*prep|ucat/i,
    title: "Medical Entry",
    description: "UCAT tutoring & interview prep for entry into medical/dental school",
    logoUrl: "https://cdn.prod.website-files.com/696ed06d2e62378f0a51f2d4/6a0bbed5058c7ec65b1a454e_Final%20MEDPREP%20Charcoal%20horizontal%20logo.svg",
    logoTintRight: "39.9%",
    accent: "#3478F7",
    accentSoft: "rgba(215, 252, 61, 0.18)",
    accentContrast: "#0C3166"
  }];
  var UK_TOKEN = "United Kingdom";
  var UCAT_UK_PATTERN = /UCAT\s*\(UK\)/i;
  var UCAT_ANZ_PATTERN = /UCAT\s*\(ANZ\)/i;
  // 2027 Curriculum Planning Matrix (Wassim, 7 Aug 2026): region x year level
  // -> subject codes shown for intake 2027. Intake 2026 keeps the structured-
  // value logic (the matrix is a 2027 planning view and omits 2026-only
  // subjects like VSE Core).
  // Keyed by intake year — the matrix is the single authority for which
  // subjects a location/year-level sees, for every intake it covers. The
  // structured year:/state: tokens on option values are only a fallback for
  // intakes with no grid here (e.g. a future intake added in HubSpot before
  // this file learns about it). 2027 comes from the Curriculum Planning
  // Matrix tab; 2026 mirrors the pre-rollout dropdown values
  // (the vetted 2026 behaviour) — edit the grid, not tokens.
  // Keyed by intake year — the matrix is the single authority for which
  // subjects a location/year-level sees, for every intake it covers. The
  // structured year:/state: tokens on option values are only a fallback for
  // intakes with no grid here (e.g. a future intake added in HubSpot before
  // this file learns about it). 2027 comes from the Curriculum Planning
  // Matrix tab; 2026 was generated from the 2026 option tokens on
  // 2026-08-21 so behaviour stayed identical — edit the grid, not tokens.
  var SUBJECT_MATRIX = { "2026": { "VIC": { "Year 6": ["VIC-MA07", "VSE-FOEN", "VSE-FOMA", "VSE-FOWR"], "Year 7": ["VIC-MA07", "VIC-MA08", "VSE-COEN", "VSE-COMA", "VSE-COWR"], "Year 8": ["VIC-MA08", "VIC-MA09", "VSE-MAEN", "VSE-MAMA", "VSE-MAWR"], "Year 9": ["VIC-MA09", "VIC-MA10", "VIC-MA1A"], "Year 10": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-CH12", "VCE-EL12", "VCE-EN12", "VCE-MM12", "VCE-PH12", "VCE-SM12", "VIC-MA10", "VIC-MA1A"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-BI34", "VCE-CH12", "VCE-CH34", "VCE-EL12", "VCE-EL34", "VCE-EN12", "VCE-EN34", "VCE-MM12", "VCE-MM34", "VCE-PH12", "VCE-PH34", "VCE-SM12", "VCE-SM34"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST", "VCE-BI34", "VCE-CH34", "VCE-EL34", "VCE-EN34", "VCE-MM34", "VCE-PH34", "VCE-SM34"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "QLD": { "Year 6": ["QLD-MA07"], "Year 7": ["QLD-MA07", "QLD-MA08"], "Year 8": ["QLD-MA08", "QLD-MA09"], "Year 9": ["QLD-MA09", "QLD-MA1A"], "Year 10": ["MD-INT", "QCE-BI12", "QCE-CH12", "QCE-MM12", "QCE-PH12", "QCE-SM12", "QLD-MA1A", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "QCE-BI12", "QCE-BI34", "QCE-CH12", "QCE-CH34", "QCE-MM12", "QCE-MM34", "QCE-PH12", "QCE-PH34", "QCE-SM12", "QCE-SM34", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "QCE-BI34", "QCE-CH34", "QCE-MM34", "QCE-PH34", "QCE-SM34", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "WA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "SA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "NSW": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "TAS": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "ACT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "NT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "NZ": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] }, "UK": { "Year 10": ["MD-INT", "UCAT-UK-CORE"], "Year 11": ["MD-INT", "UCAT-UK-CORE"], "Year 12": ["MD-INT", "UCAT-UK-MAST"], "Year 13": ["MD-INT", "UCAT-UK-MAST"], "Graduated": ["MD-INT", "UCAT-UK-MAST"] }, "INTERNATIONAL": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["MD-INT", "UCAT-ANZ-MAST"] } }, "2027": { "VIC": { "Year 5": ["VSC-EN05", "VSC-MA05", "VSC-WR05"], "Year 6": ["VIC-EN07", "VIC-EN08", "VIC-MA07", "VIC-MA08", "VIC-SC07", "VIC-SC08", "VSE-EN06", "VSE-MA06", "VSE-WR06"], "Year 7": ["VIC-EN07", "VIC-EN08", "VIC-EN09", "VIC-MA07", "VIC-MA08", "VIC-MA9A", "VIC-SC07", "VIC-SC08", "VIC-SC09", "VSE-EN07", "VSE-MA07", "VSE-WR07"], "Year 8": ["VIC-EN08", "VIC-EN09", "VIC-EN10", "VIC-MA08", "VIC-MA1A", "VIC-MA9A", "VIC-SC08", "VIC-SC09", "VIC-SC10", "VSE-EN08", "VSE-MA08", "VSE-WR08"], "Year 9": ["VCE-BI12", "VCE-CH12", "VCE-EL12", "VCE-EN12", "VCE-MM12", "VCE-PH12", "VCE-SM12", "VIC-EN09", "VIC-EN10", "VIC-MA1A", "VIC-MA9A", "VIC-SC09", "VIC-SC10"], "Year 10": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-BI34", "VCE-CH12", "VCE-CH34", "VCE-EL12", "VCE-EL34", "VCE-EN12", "VCE-EN34", "VCE-MM12", "VCE-MM34", "VCE-PH12", "VCE-PH34", "VCE-SM12", "VCE-SM34", "VIC-EN10", "VIC-MA1A", "VIC-SC10"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE", "VCE-BI12", "VCE-BI34", "VCE-CH12", "VCE-CH34", "VCE-EL12", "VCE-EL34", "VCE-EN12", "VCE-EN34", "VCE-MM12", "VCE-MM34", "VCE-PH12", "VCE-PH34", "VCE-SM12", "VCE-SM34"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST", "VCE-BI34", "VCE-CH34", "VCE-EL34", "VCE-EN34", "VCE-MM34", "VCE-PH34", "VCE-SM34"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "QLD": { "Year 6": ["QLD-EN07", "QLD-EN08", "QLD-MA07", "QLD-MA08", "QLD-SC07", "QLD-SC08"], "Year 7": ["QLD-EN07", "QLD-EN08", "QLD-EN09", "QLD-MA07", "QLD-MA08", "QLD-MA09", "QLD-SC07", "QLD-SC08", "QLD-SC09"], "Year 8": ["QLD-EN08", "QLD-EN09", "QLD-EN10", "QLD-MA08", "QLD-MA09", "QLD-MA1A", "QLD-SC08", "QLD-SC09", "QLD-SC10"], "Year 9": ["QCE-BI12", "QCE-CH12", "QCE-MM12", "QCE-PH12", "QCE-SM12", "QLD-EN09", "QLD-EN10", "QLD-MA09", "QLD-MA1A", "QLD-SC09", "QLD-SC10"], "Year 10": ["MD-INT", "QCE-BI12", "QCE-BI34", "QCE-CH12", "QCE-CH34", "QCE-MM12", "QCE-MM34", "QCE-PH12", "QCE-PH34", "QCE-SM12", "QCE-SM34", "QLD-EN10", "QLD-MA1A", "QLD-SC10", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "QCE-BI12", "QCE-BI34", "QCE-CH12", "QCE-CH34", "QCE-MM12", "QCE-MM34", "QCE-PH12", "QCE-PH34", "QCE-SM12", "QCE-SM34", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "QCE-BI34", "QCE-CH34", "QCE-MM34", "QCE-PH34", "QCE-SM34", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "WA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "SA": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NSW": { "Year 6": ["NSW-EN07", "NSW-EN08", "NSW-MA07", "NSW-MA08", "NSW-SC07", "NSW-SC08"], "Year 7": ["NSW-EN07", "NSW-EN08", "NSW-EN09", "NSW-MA07", "NSW-MA08", "NSW-MA09", "NSW-SC07", "NSW-SC08", "NSW-SC09"], "Year 8": ["NSW-EN08", "NSW-EN09", "NSW-EN10", "NSW-MA08", "NSW-MA09", "NSW-MA10", "NSW-SC08", "NSW-SC09", "NSW-SC10"], "Year 9": ["NSW-EN09", "NSW-EN10", "NSW-MA09", "NSW-MA10", "NSW-SC09", "NSW-SC10", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS"], "Year 10": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "NSW-EN10", "NSW-MA10", "NSW-SC10", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS", "UCAT-ANZ-CORE"], "Year 11": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "PRE-BIOL", "PRE-CHEM", "PRE-MADV", "PRE-MAE1", "PRE-PHYS", "UCAT-ANZ-CORE"], "Year 12": ["HSC-BIOL", "HSC-CHEM", "HSC-MADV", "HSC-MAE1", "HSC-MAE2", "HSC-PHYS", "MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "TAS": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "ACT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NT": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "NZ": { "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-CORE"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] }, "UK": { "Year 10": ["MD-INT", "UCAT-UK-MAST"], "Year 11": ["MD-INT", "UCAT-UK-MAST"], "Year 12": ["MD-INT", "UCAT-UK-MAST"], "Year 13": ["MD-INT", "UCAT-UK-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-UK-MAST"] }, "INTERNATIONAL": { "Year 10": ["MD-INT", "UCAT-ANZ-CORE"], "Year 11": ["MD-INT", "UCAT-ANZ-CORE"], "Year 12": ["MD-INT", "UCAT-ANZ-MAST"], "Year 13": ["MD-INT", "UCAT-ANZ-MAST"], "Graduated": ["GAMSAT", "MD-INT", "UCAT-ANZ-MAST"] } } };
  // UCAT enrolments are closed until later in September 2026 (Ramodh via Luke,
  // 12 Aug 2026). While closed, the Welcome Consultation scheduler is hidden
  // for UCAT students. Flip UCAT_ENROLMENTS_OPEN back to true when enrolments
  // reopen — nothing else needs changing.
  var UCAT_ENROLMENTS_OPEN = false;
  var UCAT_SUBJECT_CODES = ["UCAT-ANZ-CORE", "UCAT-ANZ-MAST", "UCAT-UK-CORE", "UCAT-UK-MAST"];
  // Only the 2026 intake gets a notice (Ramodh via Amitav, 19 Aug 2026). The
  // 2026 program has closed, so a 2026 UCAT signup is really a 2027 one and
  // needs explaining. A 2027 UCAT signup is an ordinary waitlist registration
  // like any other subject, so it gets no notice at all. Mastery is already
  // blocked on the 2026 intake, so only the Core cohort ever sees this.
  var UCAT_NOTICE_INTAKE = "2026";
  var UCAT_INTAKE_NOTE = "Our 2026 UCAT Program is now closed, and our 2027 UCAT Program starts in November. We will email you in October to book a free 35-minute 1-on-1 with a MedPrep Consultant (current med/dent student), where we'll get to know you, explain how our program works, and schedule your free trial classes for our 2027 UCAT Program!";
  // Welcome Consultation bookings are switched off for the AY27 intake while
  // consults are not live yet (Amitav, 16 Aug 2026). MedPrep and TestPrep
  // students see the yellow "open soon" note instead of the Calendly
  // scheduler. Flip WC_BOOKINGS_OPEN back to true to restore the scheduler —
  // nothing else needs changing.
  var WC_BOOKINGS_OPEN = false;
  var WC_OPEN_SOON_NOTE = "Welcome Consultation bookings open soon. You can still submit this form now. We'll be in touch once bookings open.";
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
    if (!classification.code || !location || !yearLevel) return null;
    var byLocation = SUBJECT_MATRIX[selectedIntakeYear];
    if (!byLocation) return null;
    var byYear = byLocation[matrixLocationKey(location)];
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
    // Term-only exists to keep the VCE "3/4 Intensive" duplicates of
    // Education subjects off the public form. MedPrep genuinely delivers
    // intensives (MD-INT flipped to delivery:Intensive with the 2027 matrix
    // rollout) and the planning matrix still lists them, so that brand is
    // exempt.
    if (classification.program === "MedPrep") return true;
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
  // Category tokens drifted with the 2027 Curriculum Planning Matrix rollout:
  // TestPrep rows now carry category:English/Mathematics and MedPrep rows
  // carry category:Medical, which scattered Selective Entry options into the
  // Education blocks and rendered a raw "Medical" header. On-page grouping is
  // by brand, so program decides the bucket for TestPrep/MedPrep; Education
  // keeps the authored subject category (Mathematics/Science/English).
  function normalizeCategory(program, rawCategory) {
    if (program === "TestPrep") return "TestPrep";
    if (program === "MedPrep") return "MedPrep";
    if (rawCategory === "Medical") return "MedPrep";
    return rawCategory || program;
  }
  function classificationFromStructuredValue(parsed) {
    var state = !parsed.state || parsed.state === "ALL" ? null : parsed.state;
    var intake = parsed.intake ? parsed.intake.split(",").map(function (s) {
      return s.trim();
    }) : null;
    return {
      program: parsed.program,
      state: state,
      category: normalizeCategory(parsed.program, parsed.category),
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
    if (!wrap) return;
    // Only on the transition: these run on every re-evaluation, and a field
    // that re-announces itself each time someone types is a nuisance.
    var wasHidden = wrap.style.display === "none";
    wrap.style.removeProperty("display");
    releaseEmptyFieldset(wrap);
    if (wasHidden) playReveal(wrap);
  }
  function hideFieldWrapper(el) {
    var wrap = fieldWrapper(el);
    if (!wrap) return;
    wrap.style.display = "none";
    collapseEmptyFieldset(wrap);
  }
  // HubSpot wraps each row in a fieldset of its own. Hiding the only field
  // inside one leaves the fieldset standing with its own line box — the strip
  // of dead space above "Student Details" on a pre-fill link, where the "Are
  // you a" question is hidden (Amrit, 23 Aug). Reversed by showFieldWrapper,
  // so a question that comes back brings its row with it.
  function collapseEmptyFieldset(wrap) {
    // The wrapper is not a direct child of the fieldset — HubSpot puts a
    // dependent-field div in between — so walk up to the row it belongs to.
    var fieldset = wrap && wrap.closest ? wrap.closest("fieldset[class*=form-columns-]") : null;
    if (!fieldset || fieldsetHasVisibleField(fieldset)) return;
    fieldset.style.display = "none";
    fieldset.setAttribute("data-contour-empty-fieldset", "1");
  }
  function fieldsetHasVisibleField(fieldset) {
    var fields = fieldset.querySelectorAll(".hs-form-field");
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].style.display !== "none") return true;
    }
    return false;
  }
  // Fields arrive after the fieldset was emptied: the Student Information
  // group renders into the same row a beat after the contact type is set. A
  // row that has been given something to show gets its height back.
  function syncEmptyFieldsets() {
    if (!formRoot) return;
    qAll("fieldset[data-contour-empty-fieldset]").forEach(function (fieldset) {
      if (fieldsetHasVisibleField(fieldset)) releaseEmptyFieldset(fieldset);
    });
  }
  function releaseEmptyFieldset(wrapOrFieldset) {
    var fieldset = wrapOrFieldset && wrapOrFieldset.closest ? wrapOrFieldset.closest("fieldset[data-contour-empty-fieldset]") : null;
    if (!fieldset) return;
    fieldset.style.removeProperty("display");
    fieldset.removeAttribute("data-contour-empty-fieldset");
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
  // Depth counter, not a boolean: the setters below nest (a location change
  // re-evaluates the subject list, which unticks options, each of which fires
  // its own events). Anything raised while this is non-zero is the form
  // editing itself — see the LOCAL DRAFT CACHE block for why that has to be
  // told apart from a keystroke.
  var programmaticEditDepth = 0;
  function isProgrammaticEdit() {
    return programmaticEditDepth > 0;
  }
  function asProgrammaticEdit(fn) {
    programmaticEditDepth++;
    try {
      return fn();
    } finally {
      programmaticEditDepth--;
    }
  }
  function setCheckboxChecked(inputEl, checked) {
    if (!inputEl) return;
    if (inputEl.checked !== checked) {
      // click() runs the browser's own activation behaviour, and the input and
      // change events that come out of it are the user agent's — they arrive
      // with isTrusted true, indistinguishable from a real tick without the
      // counter above.
      asProgrammaticEdit(function () {
        inputEl.click();
      });
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
    var injected = clone.querySelectorAll(".contour-subject-exclusion-note, .contour-info-tip");
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
      // Inline because the live page only takes CSS shipped from this script.
      mainSpan.style.fontWeight = "700";
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
      // Breathing room between the "Select all that apply" helper and the
      // card row (Angad) — the helper's own 8px margin was too tight.
      ".hs-form .hs-form-field ul.contour-program-card-list { margin-top: 16px; }" +
      // Card background: transparent on hover — the translucent highlighter
      // tint fades in only while the card is selected.
      ".hs-form .contour-program-card::before { content: \"\"; position: absolute; inset: 0; border-radius: inherit; background: var(--contour-card-accent-soft, transparent); opacity: 0; transition: opacity 0.5s ease; pointer-events: none; }" +
      // #005FCC rather than the navy: stacked navy cards inside a navy-banded
      // card read as one mass, and the fill is the only thing saying which
      // brand was picked. On trial — one value to put back (Amrit, 25 Aug 2026).
      ".hs-form .contour-program-card--selected::before { opacity: 1; background: #005FCC; }" +
      // The edge goes with the fill; a navy outline round a blue card was the
      // old colour still showing through.
      // The navy fill is a positioned layer, so in-flow card content needs a
      // stacking context of its own to paint above it.
      ".hs-form .contour-program-card__body { position: relative; z-index: 1; }" +
      // Hover: just the logo and the outline light up in Contour blue.
      ".hs-form .contour-program-card:hover { border-color: var(--contour-card-accent, #3478F7); }" +
      // Selected: solid navy fill with the content knocked out in white.
      // The :hover variants keep these rules ahead of the blue hover rules
      // (which otherwise win on specificity) while the cursor sits on a
      // selected card.
      // Edge and ring both follow the fill. The ring is what was actually
      // showing navy round a blue card — border-color alone never reached it.
      ".hs-form .contour-program-card--selected, .hs-form .contour-program-card--selected:hover { border-color: #005FCC; box-shadow: 0 0 0 2px #005FCC; }" +
      ".hs-form .contour-program-card--selected .contour-program-card__title { color: #FFFFFF; }" +
      ".hs-form .contour-program-card--selected .contour-program-card__description { color: rgba(255, 255, 255, 0.78); }" +
      ".hs-form .contour-program-card__title, .hs-form .contour-program-card__description { transition: color 0.3s ease; }" +
      // Badge: always green, centred SVG tick, pinned half-out on the
      // top-right corner of the outline with a white ring so it never
      // overlaps the card content.

      // Logo: Contour-blue copy stacked on the charcoal original, wiped in
      // from the left via clip-path. Filter chain recolours the charcoal SVG
      // to #3478F7 (brightness(0) first, then rotate to the blue).
      ".hs-form .contour-program-card__logo-placeholder--has-logo { position: relative; }" +
      ".hs-form .contour-program-card__logo-tint { position: absolute; top: 0; left: 0; height: 100%; width: auto; max-width: 100%; object-fit: contain; pointer-events: none; filter: brightness(0) saturate(100%) invert(42%) sepia(85%) saturate(3550%) hue-rotate(211deg) brightness(100%) contrast(94%); clip-path: inset(0 100% 0 0); transition: clip-path 0.7s ease; }" +
      ".hs-form .contour-program-card:hover .contour-program-card__logo-tint, .hs-form .contour-program-card--selected .contour-program-card__logo-tint { clip-path: inset(0 var(--contour-logo-tint-right, 0%) 0 0); }" +
      // Selected: the whole logo (suffix included) flips to white over the
      // navy, covering the charcoal original entirely.
      ".hs-form .contour-program-card--selected .contour-program-card__logo-tint, .hs-form .contour-program-card--selected:hover .contour-program-card__logo-tint { filter: brightness(0) invert(1); clip-path: inset(0 0 0 0); }";
    document.head.appendChild(style);
  }
  function injectSubjectTileStyles() {
    if (!featureEnabled("subjectTiles")) return;
    if (document.getElementById("contour-subject-tile-styles")) return;
    // The page stylesheet flattens these to plain checkboxes with !important
    // (the old card look drowned at 70+ options). This tag is appended after
    // it, so equally-important rules here win on order — and the matrix now
    // filters the list per student, so tiles no longer mean a wall of boxes.
    var style = document.createElement("style");
    style.id = "contour-subject-tile-styles";
    var opt = ".hs-form .hs_web_form__interested_subject li.hs-form-checkbox";
    style.textContent = "" +
      // The pill keeps its own content height whatever its row neighbour
      // does; the one-level note hangs below it, outside the pill.
      opt + " { display: flex; flex-direction: column; gap: 6px; }" +
      // Unselected tiles take the page body colour like the input wells, so
      // white is left to mean "card chrome" and navy to mean "chosen"; a
      // disabled level greys out flat (Amrit, 22 Aug).
      opt + " label { position: relative; flex: 0 0 auto; display: flex !important; align-items: center !important; gap: 10px !important; width: 100% !important; box-sizing: border-box !important; min-height: 0 !important; padding: 11px 14px !important; border: 1px solid rgba(12, 49, 102, 0.16) !important; border-radius: 12px !important; background: #FFF9F1 !important; font-weight: 600 !important; color: #212121 !important; cursor: pointer !important; transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease; }" +
      opt + " label:hover { border-color: #3478F7 !important; background: #FFFFFF !important; }" +
      opt + " label:has(input:disabled) { background: #F1F0EC !important; border-color: rgba(12, 49, 102, 0.10) !important; color: #9ca3af !important; cursor: not-allowed !important; }" +
      opt + " label:has(input:disabled):hover { border-color: rgba(12, 49, 102, 0.10) !important; background: #F1F0EC !important; }" +
      opt + " label:has(input:disabled)::before { background-color: #F1F0EC; border-color: rgba(12, 49, 102, 0.18); }" +
      opt + " label > span { flex: 1 1 auto; }" +
      // The native checkbox stays in the tab order but hands its face to the
      // ::before marker drawn in its place.
      opt + ' input[type="checkbox"] { position: absolute !important; opacity: 0 !important; width: 20px !important; height: 20px !important; margin: 0 !important; left: 14px; }' +
      // Marker and tick are one element: the tick is a background SVG, so it
      // is always dead-centre in the disc at any zoom.
      opt + ' label::before { content: ""; flex: 0 0 auto; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid rgba(12, 49, 102, 0.3); background: #FFFFFF center / 0 0 no-repeat; box-sizing: border-box; transition: background-color 0.16s ease, border-color 0.16s ease; }' +
      opt + " label:has(input:checked) { background: #0C3166 !important; border-color: #0C3166 !important; }" +
      opt + ' label:has(input:checked)::before { background-color: #007AFF; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M20 6.5L9 17.5l-5-5\' fill=\'none\' stroke=\'%23FFFFFF\' stroke-width=\'4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E"); background-size: 11px 11px; border-width: 2px; border-color: #FFFFFF; }' +
      opt + " label:has(input:checked) span { color: #FFFFFF !important; }" +
      opt + " label:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(52, 120, 247, 0.35); }" +
      // The one-level note hangs under the pill, indented past the marker.
      ".hs-form .hs_web_form__interested_subject .contour-subject-exclusion-note { margin: 0 4px 0 34px !important; font-size: 12px; }" +
      ".hs-form .hs_web_form__interested_subject .hs-error-msgs { margin-top: 8px !important; }";
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
      var cardList = nativeWrapper.closest("ul");
      if (cardList) cardList.classList.add("contour-program-card-list");
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
      // No corner tick: the navy fill with the white knockout logo already
      // says "selected", and the collapsed-section status mark is the form's
      // one remaining tick (Amrit, 22 Aug).
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
  // With Guardian selected, the form asks for two people at once: the student
  // (their own labelled fields) and the person filling it in. "Your First Name"
  // directly under "Student First Name" reads ambiguously, so the second set is
  // relabelled "Guardian ..." (Amitav). Student flow keeps "Your ...", since
  // there is only one person then. Location stays untouched: it is the
  // student's location in both flows.
  var GUARDIAN_RELABEL_FIELDS = [
    { selector: '[name="firstname"]', your: "Your First Name", guardian: "Guardian First Name" },
    { selector: '[name="lastname"]', your: "Your Last Name", guardian: "Guardian Last Name" },
    { selector: '[name="email_2"]', your: "Your Email", guardian: "Guardian Email" },
    { selector: '[name="phone"]', your: "Your Phone number", guardian: "Guardian Phone number" }
  ];
  function isGuardianContactType() {
    var checked = qAll(FIELD_SELECTORS.contactType).filter(function (radio) {
      return radio.checked;
    })[0];
    if (!checked) return false;
    return checked.value === "Guardian" || checked.value === "Parent";
  }
  /* Every "the flow changed" listener goes through here.

     setCheckboxChecked() selects a radio by clicking it — that is how the
     default Student selection is made, and how a prefilled Guardian record
     applies — and the browser's own activation behaviour raises input and
     change events from that click with isTrusted true. A change listener
     therefore cannot tell the form selecting a radio for itself from the
     student switching flow, and a handler that stands messages down on a
     switch was standing them down a quarter of a second after page load.

     Both places that select a radio programmatically do the state work they
     need directly on the next line (updateGuardianFieldLabels()), so a
     listener registered here is only ever interested in the real thing.
     ========================================================= */
  function onContactTypeChange(handler) {
    qAll(FIELD_SELECTORS.contactType).forEach(function (radio) {
      radio.addEventListener("change", function (e) {
        if (isProgrammaticEdit()) return;
        handler(e);
      });
    });
  }
  function setLabelTextForField(selector, text) {
    var field = q(selector);
    var wrap = field ? fieldWrapper(field) : null;
    if (!wrap) return;
    var label = wrap.querySelector("label");
    if (!label) return;
    var spans = label.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (!/hs-form-required/.test(spans[i].className)) {
        spans[i].textContent = text;
        // This write clobbers any person-group label state (visible text plus
        // hidden prefix span), so the marker saying it is applied goes too —
        // otherwise updatePersonGroups() would skip re-shortening the label.
        spans[i].removeAttribute("data-contour-label-mode");
        return;
      }
    }
    var node = label.firstChild;
    while (node && node.nodeType !== 3) node = node.nextSibling;
    if (node) node.nodeValue = text;
  }
  function updateGuardianFieldLabels() {
    var guardian = isGuardianContactType();
    GUARDIAN_RELABEL_FIELDS.forEach(function (config) {
      setLabelTextForField(config.selector, guardian ? config.guardian : config.your);
    });
    updatePersonGroups();
  }
  /* =========================================================
     PRE-FILL LINK PRESENTATION
     -----------------------------------------------------------
     A `?student_id=` link resolves to a HubSpot record, so "Are you a
     Student or a Guardian?" is answered before the page renders — and
     showing a question whose answer is already fixed invites an edit that
     would put the form out of step with the record it is mirroring. The
     radio keeps its value and its wrapper is hidden, the same shape as the
     locked email box: the answer stands, the control goes.

     Sticky for the page's life, and carried in the draft: the student's
     first edit ends the *live mirror* of the record (prefillSessionLive)
     and takes student_id off the URL, but it does not turn them back into
     someone who has not said who they are, and a question reappearing
     mid-form would read as a bug.
     ========================================================= */
  var prefillLinkSession = false;
  function beginPrefillLinkSession() {
    prefillLinkSession = true;
    enforcePrefillLinkPresentation();
  }
  // Re-asserted from updatePersonGroups, which the contact-field
  // MutationObserver already runs — a HubSpot re-render swaps in a fresh,
  // visible radio group otherwise.
  function enforcePrefillLinkPresentation() {
    syncEmptyFieldsets();
    if (!prefillLinkSession) return;
    if (!featureEnabled("hideContactTypeOnPrefill")) return;
    var radio = q(FIELD_SELECTORS.contactType);
    // Hidden on the field wrapper, not on the dependent container HubSpot
    // renders around it — the Student Information group lives in there too.
    if (radio) hideFieldWrapper(radio);
  }
  /* =========================================================
     STUDENT / GUARDIAN PERSON GROUP CARDS
     -----------------------------------------------------------
     On the Guardian flow the form collects two people, and prefixing all
     eight field labels ("Student First Name", "Guardian First Name", ...)
     reads as a wall of repetition (Luke, 19 Aug 2026). Instead, each
     person's four fields are grouped into a card headed "Student" or
     "Guardian" once, and the labels inside drop their prefix.

     Two constraints shape the implementation:
     - Nodes are never moved or wrapped: HubSpot re-renders swap nodes
       mid-flow, so the "card" is a header element inserted BEFORE the
       group plus classes painted ON the existing rows — the student rows
       are the field wrappers themselves (direct flex children of
       .hs-dependent-field), the guardian rows are top-level fieldsets.
     - The prefix stays in the DOM for screen readers and the error
       summary: the visible label is "First Name" but the label element
       reads "Student First Name" via a visually-hidden prefix span, so
       two bare "First Name" chips can never appear in the error rollup.

     Rendered as one "Contact Information" container on BOTH flows. Two
     renderings share the container and its pill-labelled top edge,
     selected via personGroupsVariant in window.ContourForm1Config:
     - "stacked" (default): both people visible at once — a "Guardian"
       segment header, the four guardian fields, a "Student" segment
       header, the four student fields, one continuous box. The team
       preferred seeing both over switching (Angad, 21 Aug 2026);
       guardian-first so the visitor leads with their own details
       (Amrit, 1 Sep 2026).
     - "tabs": the same box with a Student / Guardian tab strip, one
       person visible at a time. Parked for possible reuse, not deleted
       (Amrit, 21 Aug 2026). Tabs hide required fields, so the error
       summary work below auto-switches to the tab holding an error and
       marks it — that machinery no-ops while stacked is on.

     Four earlier renderings (per-person cards, separator headings in
     three alignments) were built and rejected in screenshot reviews
     before these — see the session changelog for that trail.
     ========================================================= */
  var PERSON_GROUPS_VARIANT_DEFAULT = "stacked";
  function personGroupsVariant() {
    var overrides = window.ContourForm1Config;
    var variant = overrides && overrides.personGroupsVariant;
    if (variant === "stacked" || variant === "tabs") return variant;
    return PERSON_GROUPS_VARIANT_DEFAULT;
  }
  var PERSON_CARD_ROW_CLASS = "contour-person-card__row";
  var PERSON_GROUPS = [{
    id: "student",
    title: "Student",
    // On desktop the last TWO rows are the card's bottom edge (email and
    // phone sit side by side); the mobile stylesheet stands the email
    // field's bottom border down again when the tiles stack.
    bottomCount: 2,
    fields: [
      { selector: FIELD_SELECTORS.studentFirstName, prefix: "Student", visible: "First Name" },
      { selector: FIELD_SELECTORS.studentLastName, prefix: "Student", visible: "Last Name" },
      { selector: FIELD_SELECTORS.studentEmail, prefix: "Student", visible: "Email" },
      { selector: FIELD_SELECTORS.studentPhone, prefix: "Student", visible: "Phone Number" }
    ]
  }, {
    id: "guardian",
    title: "Guardian",
    bottomCount: 1,
    fields: [
      { selector: FIELD_SELECTORS.firstName, prefix: "Guardian", visible: "First Name" },
      { selector: FIELD_SELECTORS.lastName, prefix: "Guardian", visible: "Last Name" },
      { selector: FIELD_SELECTORS.emailTemp, prefix: "Guardian", visible: "Email" },
      { selector: FIELD_SELECTORS.guardianPhone, prefix: "Guardian", visible: "Phone Number" }
    ]
  }];
  function findLabelSpan(selector) {
    var field = q(selector);
    var wrap = field ? fieldWrapper(field) : null;
    var label = wrap ? wrap.querySelector("label") : null;
    if (!label) return null;
    var spans = label.querySelectorAll("span");
    for (var i = 0; i < spans.length; i++) {
      if (!/hs-form-required/.test(spans[i].className)) return spans[i];
    }
    return null;
  }
  // Idempotent on purpose: this runs from a childList MutationObserver, so a
  // write that re-creates identical nodes would retrigger the observer forever.
  // prefixOverride swaps the hidden screen-reader prefix — the guardian
  // fields belong to the visitor themselves on the Student flow, where their
  // full name is "Your First Name", not "Guardian First Name".
  function setPersonFieldLabel(config, shortened, prefixOverride) {
    var span = findLabelSpan(config.selector);
    if (!span) return;
    var prefix = prefixOverride || config.prefix;
    var mode = (shortened ? "short:" : "full:") + prefix;
    // The marker only ever arrives together with the matching content, and a
    // HubSpot re-render replaces the whole span, marker included — so the
    // marker alone says whether this span is already in the requested state.
    if (span.getAttribute("data-contour-label-mode") === mode) return;
    span.setAttribute("data-contour-label-mode", mode);
    if (!shortened) {
      span.textContent = prefix + " " + config.visible;
      return;
    }
    span.textContent = "";
    var sr = document.createElement("span");
    sr.className = "contour-sr-only";
    sr.textContent = prefix + " ";
    span.appendChild(sr);
    span.appendChild(document.createTextNode(config.visible));
  }
  // A group row is the node whose siblings lay out vertically: the field
  // wrapper itself for the student fields (direct children of HubSpot's
  // .hs-dependent-field container) and the enclosing top-level fieldset for
  // the guardian pair rows.
  function personGroupRow(fieldEl) {
    var wrap = fieldEl ? fieldWrapper(fieldEl) : null;
    if (!wrap) return null;
    var row = wrap;
    // The section card's content wrapper is a stop like formRoot: walking
    // past it would hand back the whole card as the "row" and anchor the
    // person band outside its own section.
    while (row.parentElement && row.parentElement !== formRoot && !(row.parentElement.classList && (row.parentElement.classList.contains("hs-dependent-field") || row.parentElement.classList.contains("contour-section-box__content-inner")))) {
      row = row.parentElement;
    }
    return row.parentElement ? row : null;
  }
  function personGroupRows(group) {
    var rows = [];
    group.fields.forEach(function (config) {
      var row = personGroupRow(q(config.selector));
      if (row && rows.indexOf(row) === -1) rows.push(row);
    });
    return rows;
  }
  function clearPersonGroupClasses(group) {
    qAll("." + PERSON_CARD_ROW_CLASS + "--" + group.id).forEach(function (node) {
      node.classList.remove(PERSON_CARD_ROW_CLASS, PERSON_CARD_ROW_CLASS + "--" + group.id, PERSON_CARD_ROW_CLASS + "--bottom");
    });
  }
  function applyPersonGroupRowClasses(group, rows, bottomCountOverride) {
    // bottomCountOverride = 0 keeps a group's rows open-ended — stacked
    // rendering runs the box straight through the student rows into the
    // guardian segment, so only the last group closes the container.
    var bottomCount = bottomCountOverride === undefined ? group.bottomCount : bottomCountOverride;
    clearPersonGroupClasses(group);
    rows.forEach(function (row, index) {
      row.classList.add(PERSON_CARD_ROW_CLASS, PERSON_CARD_ROW_CLASS + "--" + group.id);
      if (index >= rows.length - bottomCount) row.classList.add(PERSON_CARD_ROW_CLASS + "--bottom");
    });
  }
  function clearPersonGroupHost() {
    qAll(".contour-person-group-host").forEach(function (node) {
      node.classList.remove("contour-person-group-host");
    });
  }
  function updatePersonGroups() {
    if (!formRoot) return;
    injectPersonGroupStyles();
    // Piggybacks on this function's coverage (init, prefill, radio change,
    // and the contact-field MutationObserver): the native phone widget's
    // country list gets its non-ASCII parentheticals stripped so both phone
    // selects name countries the same way.
    normalizeNativePhoneCountryNames();
    // A re-render repair as much as a first-paint decision, and this function
    // already runs everywhere one is needed: init, prefill, the radio change,
    // and the contact-field MutationObserver.
    enforcePrefillLinkPresentation();
    var guardian = isGuardianContactType();
    var enabled = featureEnabled("personGroups");
    var variant = personGroupsVariant();
    if (!enabled || variant !== "tabs") teardownPersonTabs(guardian);
    if (!enabled || variant !== "stacked") teardownPersonStacked();
    if (!enabled) {
      // The flag also owns the label state: with the grouping gone the
      // student fields go back to their native full labels. Guardian fields
      // belong to the Your/Guardian relabel table, restored by the teardowns.
      PERSON_GROUPS[0].fields.forEach(function (config) {
        setPersonFieldLabel(config, false);
      });
      return;
    }
    if (variant === "tabs") updatePersonTabs(guardian); else updatePersonStacked(guardian);
  }
  /* =========================================================
     PERSON GROUP STACKED SEGMENTS — the "stacked" variant
     -----------------------------------------------------------
     The same Contact Information container as the tabs, with both people
     visible at once: a static "Guardian" segment header on the box's top
     edge, the guardian fields, a "Student" segment header partway down,
     the student fields, one continuous box (guardian first — the visitor
     leads with their own details; Amrit, 1 Sep 2026). No fields are ever
     hidden, so none of the tab error machinery is needed — it gates
     itself on the tab strip existing.
     ========================================================= */
  function ensurePersonStaticHeader(id, anchorRow, withCorner, isVisitor) {
    var existing = formRoot.querySelector('[data-contour-person-static="' + id + '"]');
    if (!anchorRow || !anchorRow.parentNode) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (!existing) {
      existing = document.createElement("div");
      existing.setAttribute("data-contour-person-static", id);
      existing.className = "contour-person-tabs contour-person-tabs--static";
      // Plain small-caps headers, no pills — "Student Contact Information" /
      // "Guardian Contact Information" say everything the pill plus corner
      // label used to (Amrit's review, 21 Aug 2026).
      var title = document.createElement("span");
      title.className = "contour-person-tabs__heading";
      // The label is its own span (not a bare text node) so the centred
      // separator rule can paint behind the band and mask out under the text.
      var label = document.createElement("span");
      label.className = "contour-person-tabs__label";
      label.textContent = (id === "student" ? "Student" : "Guardian") + " Details";
      title.appendChild(label);
      existing.appendChild(title);
    }
    // Which band leads the box swaps with the flow (the guardian's own
    // segment heads the Guardian flow), so the mid-box treatment is a
    // per-pass toggle rather than a fact fixed at creation.
    existing.classList.toggle("contour-person-tabs--mid", !withCorner);
    // "You" leads the segment belonging to whoever is filling the form in —
    // the guardian on the Guardian flow, the student on their own. The student
    // header serves both flows (their own fields on one, the child's on the
    // other), so the marker is synced on every pass rather than written once
    // at creation, and the heading's own text is never rewritten under it.
    var heading = existing.querySelector(".contour-person-tabs__heading");
    var marker = heading.querySelector(".contour-person-tabs__you");
    var wantsMarker = isVisitor && featureEnabled("personYouPill");
    if (wantsMarker && !marker) {
      marker = document.createElement("span");
      marker.className = "contour-person-tabs__you";
      // "This is you" over plain "You": Amrit wants the pill to carry some
      // width so it reads as a band element, not a stray dot (Amrit, 22 Aug).
      marker.textContent = "This is you";
      heading.insertBefore(marker, heading.firstChild);
    } else if (!wantsMarker && marker) {
      marker.parentNode.removeChild(marker);
      marker = null;
    }
    // Only a badged heading spreads across the band: the badge takes the
    // left edge (landing on the same grid line as the field labels below it)
    // and the title keeps the right. A heading without a badge must stay
    // wholly right-aligned, so the modifier goes on and off with the badge.
    heading.classList.toggle("contour-person-tabs__heading--split", !!marker);
    var labelLeft = !featureEnabled("personLabelRight");
    existing.classList.toggle("contour-person-tabs--label-left", labelLeft);
    // The separator starts past the pill, and the pill's width is copy —
    // "This is you" is three times "You". So the offset is measured, not
    // hardcoded: a fixed 46px left the wider pill sitting on top of the
    // gradient's fade-in, and the rule broke out from behind it at full
    // strength with a hard edge (Amrit, 22 Aug). Skipped while the pill is
    // laid out at zero width (hidden guardian segment) — a later pass, once
    // it is on screen, sets the real number.
    // Whatever leads the band decides where the rule may start: the pill on a
    // right-aligned band, and the whole heading — pill and label together — on
    // a left-aligned one, where the label is what the rule has to clear.
    var leader = labelLeft ? heading : marker;
    var leadWidth = leader ? leader.offsetWidth : 0;
    // Measured off this band's own heading, so each rule sits the same 10px
    // after its own label whatever that label says. Sharing one start across
    // the bands lines the rules up but leaves the shorter label with a longer
    // gap, which is the thing that looked wrong (Amrit, 25 Aug 2026).
    if (leadWidth > 0) existing.style.setProperty("--contour-seg-rule-start", (leadWidth + 10) + "px"); else existing.style.removeProperty("--contour-seg-rule-start");
    if (existing.nextSibling !== anchorRow) anchorRow.parentNode.insertBefore(existing, anchorRow);
    var precededByVisible = false;
    var prev = existing.previousElementSibling;
    while (prev) {
      if (prev.getBoundingClientRect && prev.getBoundingClientRect().height > 0) {
        precededByVisible = true;
        break;
      }
      prev = prev.previousElementSibling;
    }
    existing.classList.toggle("contour-person-tabs--flush", !precededByVisible);
    // On the Guardian flow HubSpot renders the dependent group inside the
    // contact-type field's own fieldset, so the band lands beside the question
    // rather than after the fieldset wrapping it — and misses that fieldset's
    // bottom margin, sitting 20px closer to the Student/Guardian cards than it
    // does on the Student flow. Same question, same gap, so it is made up here
    // (Amrit, 25 Aug 2026).
    var besideQuestion = !!(prev && prev.classList && prev.classList.contains("hs_web_form_contact_type"));
    existing.classList.toggle("contour-person-tabs--beside-question", besideQuestion);
  }
  // The Guardian-first order is a DOM move, not paint: the two guardian
  // fieldsets step inside the dependent host, between the contact-type
  // question and the student rows, and step back out to their native
  // top-level spot when the Student flow needs them to be the visitor's own
  // rows again (guardian details lead, Amrit, 1 Sep 2026). Idempotent —
  // every pass checks the order before touching the tree, or the childList
  // observer that re-runs updatePersonGroups would loop on its own moves.
  function positionGuardianSegment(guardian, studentRows, guardianRows) {
    if (guardianRows.length === 0) return;
    if (guardian) {
      var anchor = studentRows[0];
      var ordered = guardianRows.every(function (fs) {
        return fs.parentElement === anchor.parentElement && !!(fs.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      if (ordered) return;
      guardianRows.forEach(function (fs) {
        anchor.parentNode.insertBefore(fs, anchor);
      });
      return;
    }
    var contact = q(FIELD_SELECTORS.contactType);
    var wrap = contact ? fieldWrapper(contact) : null;
    var host = wrap ? wrap.parentElement : null;
    var outer = host && host.classList.contains("hs-dependent-field") ? host.parentElement : null;
    if (!outer || !outer.parentNode || !outer.contains(guardianRows[0])) return;
    var ref = outer.nextSibling;
    guardianRows.forEach(function (fs) {
      outer.parentNode.insertBefore(fs, ref);
    });
  }
  function teardownPersonStacked() {
    var headers = qAll("[data-contour-person-static]");
    // The move outlives the bands, so it is unwound whether or not any
    // band is still standing.
    positionGuardianSegment(false, [], personGroupRows(PERSON_GROUPS[1]));
    if (headers.length === 0) return;
    headers.forEach(function (node) {
      if (node.parentNode) node.parentNode.removeChild(node);
    });
    setPersonTabBridge(false);
  }
  function updatePersonStacked(guardian) {
    var studentRows = guardian ? personGroupRows(PERSON_GROUPS[0]) : [];
    var guardianRows = personGroupRows(PERSON_GROUPS[1]);
    // Mid-render (the dependent group joins the DOM a beat after the radio
    // changes): leave everything as is, the MutationObserver re-runs this.
    if (guardianRows.length === 0 || guardian && studentRows.length === 0) return;
    positionGuardianSegment(guardian, studentRows, guardianRows);
    // The Guardian segment heads the box on the Guardian flow — the visitor's
    // own details lead, the student's follow (Amrit, 1 Sep 2026). On the
    // Student flow the visitor's fields are the only segment, and the
    // Student band keeps the top edge over them.
    ensurePersonStaticHeader("guardian", guardian ? guardianRows[0] : null, true, true);
    ensurePersonStaticHeader("student", guardian ? studentRows[0] : guardianRows[0], !guardian, !guardian);
    clearPersonGroupHost();
    if (guardian) {
      // The student rows close the box now that they sit under the guardian
      // segment, so they keep their native bottomCount.
      applyPersonGroupRowClasses(PERSON_GROUPS[0], studentRows);
      if (studentRows[0].parentElement && studentRows[0].parentElement.classList.contains("hs-dependent-field")) {
        studentRows[0].parentElement.classList.add("contour-person-group-host");
      }
    } else {
      clearPersonGroupClasses(PERSON_GROUPS[0]);
    }
    // bottomCount 0 on the Guardian flow: the box does not close after the
    // guardian rows — the Student segment continues it.
    applyPersonGroupRowClasses(PERSON_GROUPS[1], guardianRows, guardian ? 0 : undefined);
    setPersonTabBridge(guardian);
    if (guardian) {
      PERSON_GROUPS[0].fields.forEach(function (config) {
        setPersonFieldLabel(config, true);
      });
    }
    PERSON_GROUPS[1].fields.forEach(function (config) {
      setPersonFieldLabel(config, true, guardian ? null : "Your");
    });
  }
  /* =========================================================
     PERSON GROUP TABS — the "tabs" variant
     -----------------------------------------------------------
     One "Contact Information" container whose top edge is a tab strip.
     Guardian flow: Student and Guardian tabs, one person's four fields
     visible at a time. Student flow: a single Student tab over the
     visitor's own fields. The strip is an injected element and the
     "container" is paint on the existing rows, so nodes still never
     move; switching tabs toggles display on the other person's rows
     (marked, so only displays this code set are ever unwound).

     Tabs hide required fields, so three safeguards keep errors visible:
     the error summary auto-switches to the tab that holds errors, its
     field chips switch tabs before scrolling, and a tab with errors in
     it carries a red badge.
     ========================================================= */
  var activePersonTab = "student";
  var lastPersonTabFlow = null;
  function personTabStrip() {
    return formRoot ? formRoot.querySelector("[data-contour-person-tabs]") : null;
  }
  function personGroupIdForWrap(wrap) {
    if (!wrap) return null;
    for (var g = 0; g < PERSON_GROUPS.length; g++) {
      for (var f = 0; f < PERSON_GROUPS[g].fields.length; f++) {
        var el = q(PERSON_GROUPS[g].fields[f].selector);
        if (el && wrap.contains(el)) return PERSON_GROUPS[g].id;
      }
    }
    return null;
  }
  // Chips in the error summary call this before scrolling: a field on the
  // hidden tab has no box to scroll to until its tab is brought forward.
  function revealPersonTabForWrap(wrap) {
    if (!personTabStrip() || !isGuardianContactType()) return;
    var id = personGroupIdForWrap(wrap);
    if (id && id !== activePersonTab) {
      activePersonTab = id;
      updatePersonGroups();
    }
  }
  // Called when the error summary renders: badge each tab that holds a
  // blocked field, and if every blocked contact field sits on the hidden
  // tab, bring that tab forward rather than pointing at an invisible error.
  function updatePersonTabErrorState(wraps) {
    var strip = personTabStrip();
    if (!strip) return;
    var counts = { student: 0, guardian: 0 };
    (wraps || []).forEach(function (wrap) {
      var id = personGroupIdForWrap(wrap);
      if (id) counts[id]++;
    });
    Array.prototype.slice.call(strip.querySelectorAll("[data-person-tab]")).forEach(function (btn) {
      btn.classList.toggle("is-errored", counts[btn.getAttribute("data-person-tab")] > 0);
    });
    if (isGuardianContactType() && counts[activePersonTab] === 0) {
      var other = activePersonTab === "student" ? "guardian" : "student";
      if (counts[other] > 0) {
        activePersonTab = other;
        updatePersonGroups();
      }
    }
  }
  function clearPersonTabErrorState() {
    var strip = personTabStrip();
    if (!strip) return;
    Array.prototype.slice.call(strip.querySelectorAll("[data-person-tab]")).forEach(function (btn) {
      btn.classList.remove("is-errored");
    });
  }
  function ensurePersonTabStrip(anchorRow, guardian) {
    var strip = personTabStrip();
    if (!strip) {
      strip = document.createElement("div");
      strip.className = "contour-person-tabs";
      strip.setAttribute("data-contour-person-tabs", "1");
      strip.addEventListener("click", function (event) {
        var btn = event.target && event.target.closest ? event.target.closest("[data-person-tab]") : null;
        if (!btn) return;
        var id = btn.getAttribute("data-person-tab");
        if (id && id !== activePersonTab) {
          activePersonTab = id;
          updatePersonGroups();
        }
      });
    }
    var mode = guardian ? "dual" : "single";
    if (strip.getAttribute("data-contour-tabs-mode") !== mode) {
      strip.setAttribute("data-contour-tabs-mode", mode);
      strip.innerHTML = "";
      var tabs = guardian ? ["student", "guardian"] : ["student"];
      tabs.forEach(function (id) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "contour-person-tab";
        btn.setAttribute("data-person-tab", id);
        btn.appendChild(document.createTextNode(id === "student" ? "Student" : "Guardian"));
        // Both people are compulsory — the asterisk says so in the same
        // voice as the field labels.
        var req = document.createElement("span");
        req.className = "contour-person-tab__req";
        req.setAttribute("aria-hidden", "true");
        req.textContent = "*";
        btn.appendChild(req);
        strip.appendChild(btn);
      });
      var title = document.createElement("span");
      title.className = "contour-person-tabs__title";
      strip.appendChild(title);
    }
    Array.prototype.slice.call(strip.querySelectorAll("[data-person-tab]")).forEach(function (btn) {
      var selected = btn.getAttribute("data-person-tab") === activePersonTab;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    // The corner label names the tab being looked at, so it reads as the
    // container's heading: "Student Contact Information".
    var titleEl = strip.querySelector(".contour-person-tabs__title");
    var titleText = (activePersonTab === "guardian" ? "Guardian" : "Student") + " Details";
    if (titleEl && titleEl.textContent !== titleText) titleEl.textContent = titleText;
    if (strip.nextSibling !== anchorRow) anchorRow.parentNode.insertBefore(strip, anchorRow);
  }
  function setPersonTabBridge(on) {
    // With the Guardian tab forward, the strip (inside HubSpot's dependent
    // container) and the guardian fieldsets (top-level siblings after it)
    // must sit flush so the container reads as one box — the margins between
    // them are stood down.
    qAll(".contour-person-tabbridge").forEach(function (node) {
      node.classList.remove("contour-person-tabbridge");
    });
    if (!on) return;
    var field = q(FIELD_SELECTORS.studentFirstName);
    var wrap = field ? fieldWrapper(field) : null;
    var host = wrap ? wrap.parentElement : null;
    if (!host || !host.classList.contains("hs-dependent-field")) return;
    host.classList.add("contour-person-tabbridge");
    var row = host;
    // Stop at the section card's content as well as formRoot — walking on
    // would tag the card itself and zero out the 20px gap under it.
    while (row.parentElement && row.parentElement !== formRoot && !(row.parentElement.classList && row.parentElement.classList.contains("contour-section-box__content-inner"))) row = row.parentElement;
    if (row !== host) row.classList.add("contour-person-tabbridge");
  }
  function teardownPersonTabs(guardian) {
    var strip = personTabStrip();
    qAll("[data-contour-tab-hidden]").forEach(function (node) {
      node.removeAttribute("data-contour-tab-hidden");
      node.style.removeProperty("display");
    });
    if (!strip) return;
    // The bridge is shared with the stacked rendering, so it only comes
    // down here as part of dismantling an actual tab strip.
    setPersonTabBridge(false);
    if (strip.parentNode) strip.parentNode.removeChild(strip);
    // The other variants re-apply their own label state right after this,
    // but the guardian fields on the Student flow are theirs to restore
    // here — no other path rewrites "Your ..." until the radio changes.
    PERSON_GROUPS[1].fields.forEach(function (config) {
      setPersonFieldLabel(config, false, guardian ? null : "Your");
    });
    lastPersonTabFlow = null;
  }
  function updatePersonTabs(guardian) {
    if (lastPersonTabFlow !== guardian) {
      // Flow changed — always greet a fresh flow on its first tab.
      activePersonTab = "student";
      lastPersonTabFlow = guardian;
    }
    var studentRows = guardian ? personGroupRows(PERSON_GROUPS[0]) : [];
    var guardianRows = personGroupRows(PERSON_GROUPS[1]);
    // Mid-render (the dependent group joins the DOM a beat after the radio
    // changes): leave everything as is, the MutationObserver re-runs this.
    if (guardianRows.length === 0 || guardian && studentRows.length === 0) return;
    if (activePersonTab !== "student" && activePersonTab !== "guardian") activePersonTab = "student";
    var showStudent = guardian && activePersonTab === "student";
    var visibleGroup = showStudent ? PERSON_GROUPS[0] : PERSON_GROUPS[1];
    var visibleRows = showStudent ? studentRows : guardianRows;
    var hiddenRows = !guardian ? [] : showStudent ? guardianRows : studentRows;
    ensurePersonTabStrip(guardian ? studentRows[0] : guardianRows[0], guardian);
    qAll("[data-contour-tab-hidden]").forEach(function (node) {
      if (hiddenRows.indexOf(node) === -1) {
        node.removeAttribute("data-contour-tab-hidden");
        node.style.removeProperty("display");
      }
    });
    hiddenRows.forEach(function (row) {
      if (row.getAttribute("data-contour-tab-hidden") !== "1") {
        row.setAttribute("data-contour-tab-hidden", "1");
        row.style.display = "none";
      }
    });
    PERSON_GROUPS.forEach(function (group) {
      if (group !== visibleGroup) clearPersonGroupClasses(group);
    });
    applyPersonGroupRowClasses(visibleGroup, visibleRows);
    clearPersonGroupHost();
    if (showStudent && visibleRows[0].parentElement && visibleRows[0].parentElement.classList.contains("hs-dependent-field")) {
      visibleRows[0].parentElement.classList.add("contour-person-group-host");
    }
    setPersonTabBridge(guardian && !showStudent);
    if (guardian) {
      PERSON_GROUPS[0].fields.forEach(function (config) {
        setPersonFieldLabel(config, true);
      });
    }
    PERSON_GROUPS[1].fields.forEach(function (config) {
      setPersonFieldLabel(config, true, guardian ? null : "Your");
    });
  }
  function injectPersonGroupStyles() {
    if (document.getElementById("contour-person-group-styles")) return;
    var line = "rgba(12, 49, 102, 0.12)";
    var cardBg = "#FFFFFF";
    var style = document.createElement("style");
    style.id = "contour-person-group-styles";
    style.textContent = "" +
      ".contour-sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }" +
      // --- tab strip: the container's top edge --------------------------------
      ".hs-form .contour-person-tabs { display: flex; align-items: center; gap: 8px; box-sizing: border-box; width: 100%; flex: 0 0 100%; grid-column: 1 / -1; margin: 12px 0 0; padding: 14px 20px; background: " + cardBg + "; border: 1px solid " + line + "; border-bottom-color: rgba(12, 49, 102, 0.08); border-radius: 16px 16px 0 0; }" +
      // With the Student tab forward the host container's row-gap is zeroed
      // for the tile paint, which would also eat the gap above the strip — the
      // margin makes the strip sit 32px under the radio cards in every state
      // (12px + the 1.25rem gap it loses).
      ".hs-form .contour-person-group-host > .contour-person-tabs { margin: 32px 0 0; }" +
      ".hs-form button.contour-person-tab, .hs-form span.contour-person-tab { display: inline-block; appearance: none; -webkit-appearance: none; border: 1px solid transparent; background: transparent; color: #0C3166; font: inherit; font-size: 14px; font-weight: 700; line-height: 1.3; padding: 7px 18px; border-radius: 999px; cursor: pointer; transition: background-color .15s ease, color .15s ease; }" +
      ".hs-form button.contour-person-tab:not(.is-active):hover { background: rgba(12, 49, 102, 0.06); }" +
      ".hs-form button.contour-person-tab.is-active, .hs-form span.contour-person-tab.is-active { background: #0C3166; color: #FFFFFF; cursor: default; }" +
      ".hs-form button.contour-person-tab:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(12, 49, 102, 0.25); }" +
      // Static segment pills (stacked rendering): labels, not controls.
      ".hs-form .contour-person-tab--static { pointer-events: none; }" +
      // The Guardian segment header partway down the stacked box: square
      // shoulders, hairlines above and below, flush against both segments.
      ".hs-form .contour-person-tabs--mid { margin: 0; border-radius: 0; border-top-color: rgba(12, 49, 102, 0.08); }" +
      // The host's 30px bottom margin ends the box on the tabs' Student view,
      // but the stacked box runs on into the Guardian segment below it.
      ".hs-form .hs-dependent-field.contour-person-group-host.contour-person-tabbridge { margin-bottom: 0 !important; }" +
      ".hs-form .contour-person-tab__req { margin-left: 3px; font-weight: 700; }" +
      // A resting tab holding blocked fields takes the error chips' colours —
      // the active tab shows its errors inline, so it stays as it is.
      ".hs-form button.contour-person-tab.is-errored:not(.is-active) { border-color: rgba(200, 16, 46, 0.30); background: rgba(200, 16, 46, 0.05); color: #8A0C22; }" +
      ".hs-form button.contour-person-tab.is-errored:not(.is-active):hover { background: rgba(200, 16, 46, 0.10); }" +
      ".hs-form .contour-person-tabs__title { margin-left: auto; font-size: 11.5px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: rgba(12, 49, 102, 0.55); }" +
      // Static segment headings (stacked rendering): right-aligned in the
      // form's theme navy rather than the corner label's muted tint (Amrit's
      // review, 21 Aug 2026 — a per-segment left rail was also considered and
      // dropped: with no wrapper nodes it needs a positioned overlay that
      // drifts whenever validation errors change a segment's height).
      ".hs-form .contour-person-tabs--static { justify-content: flex-end; }" +
      ".hs-form .contour-person-tabs--static.contour-person-tabs--label-left { justify-content: flex-start; }" +
      // inline-flex so the "You" badge sits optically centred against the
      // heading's cap height rather than on its baseline.
      // min-height is the badge's own height, so a band carrying the badge and
      // a band carrying only text come out the same depth — otherwise the two
      // segment bands on the Guardian flow differ by 5px.
      ".hs-form .contour-person-tabs__heading { display: inline-flex; align-items: center; gap: 8px; min-height: 18px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: #0C3166; }" +
      // The bands are edges, not rows: the static headers hold one short line,
      // so they take tighter padding than the tab strip's touch targets.
      ".hs-form .contour-person-tabs--static { padding: 10px 24px; }" +
      // Highlighter lime behind the segment names so they stand out from the
      // field labels below them (Amrit, 1 Sep 2026); navy on lime holds
      // ~10:1 where lime text on white was 1.2:1. A marker stroke rather
      // than a printed chip (Amrit's second pass, 1 Sep): a shorter band
      // riding the lower half of the letters, faded overall, tapering out
      // at both ends, faint diagonal streaks for ink texture, and a tiny
      // tilt so it reads as drawn on. z-index: 0 pins a stacking context so
      // the stroke's -1 stays inside the label, above the band's paint.
      ".hs-form .contour-person-tabs--static .contour-person-tabs__label { position: relative; z-index: 0; color: #0C3166; padding: 2px 10px; }" +
      '.hs-form .contour-person-tabs--static .contour-person-tabs__label::before { content: ""; position: absolute; z-index: -1; left: 0; right: 0; top: 54%; height: 12px; transform: translateY(-50%) rotate(-1.2deg); border-radius: 6px 3px 7px 2px; background: repeating-linear-gradient(115deg, rgba(255, 255, 255, 0.16) 0 3px, rgba(255, 255, 255, 0) 3px 7px), linear-gradient(90deg, rgba(215, 252, 61, 0) 0, rgba(215, 252, 61, 0.5) 7%, rgba(215, 252, 61, 0.82) 22%, rgba(215, 252, 61, 0.82) 78%, rgba(215, 252, 61, 0.5) 93%, rgba(215, 252, 61, 0) 100%); }' +
      // The negative margin puts the text back on the grid line while the
      // stroke's taper bleeds into the gutter.
      ".hs-form .contour-person-tabs--static.contour-person-tabs--label-left .contour-person-tabs__label { margin-left: -10px; }" +
      // "You" leads the segment belonging to whoever is filling the form in,
      // as a navy badge with the highlighter lime knocked out of it — the one
      // legible way to put the lime on this white band (10.9:1, where lime as
      // text on white is 1.2:1). Right padding runs a touch short of the left
      // to absorb the trailing space uppercase letter-spacing leaves after
      // the final letter.
      ".hs-form .contour-person-tabs__heading--split { flex: 1 1 auto; justify-content: space-between; }" +
      '.hs-form .contour-person-tabs__you { background: #0C3166; color: #D7FC3D; font-size: 10px; letter-spacing: 0.08em; line-height: 1; padding: 4px 7px 4px 8px; border-radius: 999px; }' +
      // With the Guardian tab forward, the boundary between HubSpot's
      // dependent-field fieldset (holding the strip) and the guardian
      // fieldsets below it must close up so the box reads as one.
      ".hs-form .contour-person-tabbridge { margin-bottom: 0 !important; }" +
      // --- student tiles: flex children of .hs-dependent-field ----------------
      // Gaps are zeroed and the tiles widened to an exact 50% so their painted
      // backgrounds meet; the spacing the gaps provided moves into padding.
      // margin-bottom matches the guardian bottom fieldset's 30px — with the
      // Student tab forward this container ends the box, and its native
      // 1.25rem margin left less room under the box than the Guardian tab.
      ".hs-form .hs-dependent-field.contour-person-group-host { column-gap: 0 !important; row-gap: 0 !important; margin-bottom: 30px !important; }" +
      ".hs-form .contour-person-group-host > .hs_student_first_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_last_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_email.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_phone_number.contour-person-card__row { flex: 0 0 50% !important; box-sizing: border-box; background: transparent; margin: 0 !important; padding: 12px 24px 20px; }" +
      ".hs-form .contour-person-group-host > .hs_student_first_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_email.contour-person-card__row { border-left: 1px solid " + line + "; padding-right: 12px; }" +
      ".hs-form .contour-person-group-host > .hs_student_last_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_phone_number.contour-person-card__row { border-right: 1px solid " + line + "; padding-left: 12px; }" +
      ".hs-form .contour-person-card__row--student.contour-person-card__row--bottom { border-bottom: 1px solid " + line + "; }" +
      // padding-bottom rides on these two, not the shared rule above — the
      // 50%-tile rule outweighs the shared one and its 20px would win.
      ".hs-form .contour-person-group-host > .hs_student_email.contour-person-card__row--bottom { border-radius: 0 0 0 16px; padding-bottom: 24px; }" +
      ".hs-form .contour-person-group-host > .hs_student_phone_number.contour-person-card__row--bottom { border-radius: 0 0 16px 0; padding-bottom: 24px; }" +
      // --- guardian rows: whole top-level fieldsets ---------------------------
      // The fieldsets take the same flex geometry as the student tiles —
      // HubSpot's own form-columns-2 layout (floats, 95% inputs, field
      // margins) gave the Guardian tab different gutters and bottom padding
      // than the Student tab.
      ".hs-form fieldset.contour-person-card__row--guardian { display: flex; flex-wrap: wrap; box-sizing: border-box; background: transparent; border-left: 1px solid " + line + "; border-right: 1px solid " + line + "; margin: 0 !important; max-width: none; padding: 0; }" +
      // On the Guardian flow the fieldsets live inside the dependent host
      // (guardian segment first), where the host's flex layout would size
      // them like the 50% student tiles — each fieldset is a full row.
      ".hs-form .contour-person-group-host > fieldset.contour-person-card__row--guardian { flex: 0 0 100%; width: 100%; max-width: 100%; }" +
      ".hs-form fieldset.contour-person-card__row--guardian > .hs-form-field { float: none !important; flex: 0 0 50%; width: 50% !important; box-sizing: border-box; margin: 0 !important; padding: 12px 12px 20px 24px; }" +
      ".hs-form fieldset.contour-person-card__row--guardian > .hs-form-field + .hs-form-field { padding: 12px 24px 20px 12px; }" +
      ".hs-form fieldset.contour-person-card__row--guardian .hs-input:not([type=\"checkbox\"]):not([type=\"radio\"]):not(.contour-intl-phone__country):not(.contour-intl-phone__number) { width: 100% !important; }" +
      // HubSpot's intl-phone widget carries a clearfix ::after; in its column
      // flex layout that pseudo-element is a flex item and adds one phantom
      // 8px gap under the number box, pushing the guardian tab's bottom
      // padding out of step with the student tab's.
      '.hs-form fieldset.contour-person-card__row--guardian .hs-fieldtype-intl-phone::after { content: none; }' +
      ".hs-form fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom { border-bottom: 1px solid " + line + "; border-radius: 0 0 16px 16px; margin-bottom: 30px !important; }" +
      ".hs-form fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom > .hs-form-field { padding-bottom: 24px; }" +
      // --- mobile: tiles stack, so side borders and the bottom edge move ------
      "@media screen and (max-width: 767px) {" +
      " .hs-form .contour-person-tabs { padding: 12px 14px; gap: 6px; }" +
      // The static bands keep the field rows' 20px mobile gutter, so the
      // badge stays on the same grid line as the labels beneath it.
      " .hs-form .contour-person-tabs--static { padding: 12px 20px; }" +
      " .hs-form button.contour-person-tab { padding: 6px 14px; font-size: 13.5px; }" +
      " .hs-form .contour-person-tabs__title { display: none; }" +
      " .hs-form .contour-person-group-host > .hs_student_first_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_last_name.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_email.contour-person-card__row, .hs-form .contour-person-group-host > .hs_student_phone_number.contour-person-card__row { flex: 0 0 100% !important; border-left: 1px solid " + line + "; border-right: 1px solid " + line + "; padding: 10px 20px 16px; }" +
      " .hs-form fieldset.contour-person-card__row--guardian > .hs-form-field, .hs-form fieldset.contour-person-card__row--guardian > .hs-form-field + .hs-form-field { flex: 0 0 100%; width: 100% !important; padding: 10px 20px 16px; }" +
      " .hs-form fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom > .hs-form-field { padding-bottom: 16px; }" +
      " .hs-form .contour-person-group-host > .hs_student_email.contour-person-card__row--bottom { border-bottom: none; border-radius: 0; padding-bottom: 16px; }" +
      " .hs-form .contour-person-group-host > .hs_student_phone_number.contour-person-card__row--bottom { border-radius: 0 0 16px 16px; padding-bottom: 16px; }" +
      " .hs-form fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom > .hs-form-field { padding-bottom: 16px; }" +
      "}";
    document.head.appendChild(style);
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
    if (featureEnabled("autoSelectSingleProgram") && eligibleOptions.length === 1 && !anyChecked) {
      setCheckboxChecked(eligibleOptions[0], true);
      // The form just answered a question on the visitor's behalf, which the
      // section machinery would otherwise read as "they have moved on" — the
      // Academic Details card folds, the page reflows, and the caret is left
      // wherever the fold put it. Instead the handover is made explicit:
      // Programs is pinned open, and focus lands on its first subject, which
      // is the thing they actually still have to answer (Amrit, 23 Aug).
      handleAutoSelectedProgram();
    }
    showFieldWrapper(q(FIELD_SELECTORS.programInterest));
    updateProgramInterestLocationHint(!location || !yearLevel || !intakeYear);
    updateProgramInterestRequiredMark(anyEligible);
    updateNoProgramsAvailableMessage(location, yearLevel, intakeYear, anyEligible);
  }
  var autoProgramHandoffDone = false;
  function handleAutoSelectedProgram() {
    if (autoProgramHandoffDone) return;
    autoProgramHandoffDone = true;
    if (!sectionFlowActive() || isInternalMode()) return;
    lastInteractedSectionId = "programs";
    sectionBoxManualOpen.programs = true;
    delete sectionBoxManualCollapsed.programs;
    scheduleSectionEval();
    // The subject list is rebuilt from the program that was just ticked, and
    // the matrix filters it a beat later still, so the handover is retried
    // until there is something to hand over to.
    handOverToSubjects(14);
  }
  // The caret cannot stay on the program the form ticked itself: Space is a
  // scroll reflex, and on a checked checkbox it unticks the only program the
  // student is eligible for. So focus moves to the first subject — the thing
  // they actually still have to answer — as soon as there is one to move to.
  //
  // "There is one" means an option that is on screen: the matrix hides the
  // options that do not apply, and a hidden option cannot take focus, so
  // focus() on one silently does nothing and the caret stays on the
  // checkbox. Hence the visibility test on the option's own row, and the
  // check afterwards that the caret really did land (Amrit, 23 Aug).
  function isTypingInTextField() {
    var el = document.activeElement;
    if (!el || !formRoot || !formRoot.contains(el)) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    return el.type !== "checkbox" && el.type !== "radio" && el.type !== "submit" && el.type !== "button";
  }
  function firstVisibleSubjectOption() {
    var options = qAll(FIELD_SELECTORS.interestedSubjects);
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      if (opt.disabled || !opt.isConnected) continue;
      var row = opt.closest("li") || opt;
      if (row.getClientRects && row.getClientRects().length === 0) continue;
      if (!isFieldWrapVisible(fieldWrapper(opt))) continue;
      return opt;
    }
    return null;
  }
  function handOverToSubjects(tries) {
    if (tries <= 0) return;
    setTimeout(function () {
      // Mid-word in a box of their own: the caret is theirs. This is how the
      // hand-over used to fold Academic Details out from under someone still
      // typing their school name.
      if (isTypingInTextField()) return;
      var subject = firstVisibleSubjectOption();
      if (!subject) {
        handOverToSubjects(tries - 1);
        return;
      }
      // The option itself, not the group around it: HubSpot's embed moves
      // focus from a field wrapper onto its first control anyway, and the
      // option carries a visible focus ring. Space on a subject ticks a
      // subject — the thing being asked for, and visibly undoable — where
      // Space on the auto-ticked program silently removed it.
      focusQuietly(subject);
      if (document.activeElement !== subject) {
        handOverToSubjects(tries - 1);
        return;
      }
      var target = subject.closest("li") || subject;
      if (prefersReducedMotion() || !target.scrollIntoView) return;
      noteIntentionalScroll();
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 220);
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
    if (shouldHide) setSchoolNotFoundHint(false);
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
    setDisabledHint(yearSelect, intake ? "" : "Pick the year you are interested in tutoring for first.");
    var schoolInput = q(FIELD_SELECTORS.schoolText);
    if (schoolInput) {
      var location = getValue(FIELD_SELECTORS.location);
      schoolInput.disabled = !intake || !location;
      setDisabledHint(schoolInput, schoolInput.disabled ? "Pick your location and intake year first." : "");
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
  // HubSpot's shipped helper text is replaced wholesale with this shorter copy
  // (Angad): one instruction up front, and the "can't find it" advice moves to
  // the not-found hint below the input so it appears exactly when relevant.
  var schoolDescDefault = "Type your school's full name.";
  function schoolNoun() {
    return isGraduatedSelected() ? "university" : "school";
  }
  function schoolTypeMoreHint() {
    return "Keep typing to see your " + schoolNoun() + ".";
  }
  function schoolNotFoundHint() {
    return "Can't find it? Leave the full name as you've typed it and continue.";
  }
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
    link.addEventListener("click", function (e) {
      e.preventDefault();
      fillSchoolQuickOption(GRAD_QUICK_VALUE);
    });
    link.addEventListener("keydown", function (e) {
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
    style.textContent = ".hs-form select:disabled, .hs-form input:disabled, .hs-form input.contour-prefill-locked[readonly] { opacity: 0.55; background-color: #f1f0ec; cursor: not-allowed; }" + ".hs-form select.contour-prefill-locked { opacity: 0.55; background-color: #f1f0ec; cursor: not-allowed; pointer-events: none; }" + ".contour-prefill-banner { display: flex; align-items: flex-start; gap: 14px; margin: 0 0 24px; padding: 18px 22px; border: 1px solid rgba(12, 49, 102, 0.12); border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(12, 49, 102, 0.06); }" + ".contour-prefill-banner__badge { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; box-sizing: border-box; border: 2px solid #0C3166; border-radius: 50%; background: #007AFF; color: #FFFFFF; font-size: 15px; font-weight: 700; }" + ".contour-prefill-banner__content { flex: 1; min-width: 0; }" + ".contour-prefill-banner__title { margin: 0 0 2px; font-size: 15px; font-weight: 700; color: #0C3166; }" + ".contour-prefill-banner__text { margin: 0 0 8px; font-size: 13.5px; line-height: 1.45; color: #6b7280; }" + ".contour-prefill-banner__reset { display: inline-block; font-size: 13px; font-weight: 600; color: #0C3166; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }" + ".contour-prefill-banner__reset:hover { color: #0540F2; }" + ".contour-subject-summary { margin: 24px 0; padding: 20px 22px; border: 1px solid rgba(12, 49, 102, 0.12); border-radius: 16px; background: #FFF9F1; box-shadow: 0 1px 3px rgba(12, 49, 102, 0.06); }" + ".contour-subject-summary__heading { font-size: 15px; font-weight: 700; color: #0C3166; margin-bottom: 14px; }" + ".contour-subject-summary__grid { display: flex; flex-wrap: wrap; gap: 24px; }" + ".contour-subject-summary__col { flex: 1 1 180px; min-width: 160px; }" + ".contour-subject-summary__col-title { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; }" + ".contour-subject-summary__chips { display: flex; flex-wrap: wrap; gap: 6px; }" + ".contour-subject-chip { display: inline-block; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; line-height: 1.3; }" + ".contour-subject-chip--navy { background: #092749; color: #FFFFFF; }" + ".contour-subject-chip--lime { background: #D7FC3D; color: #0C3166; }" + ".contour-subject-chip--blue { background: #007AFF; color: #FFFFFF; }" + ".contour-ucat-intake-note { margin: 24px 0; }" + ".contour-welcome-consultation__waitlist-note { margin: 0; padding: 14px 18px; border: 1px solid #f0d9a6; border-radius: 12px; background: #FFF3D6; color: #8a5a00; font-size: 14px; line-height: 1.5; font-weight: 600; }" + ".contour-form-loader { display: flex; flex-direction: column; align-items: center; padding: 60px 0; }" + ".contour-form-loader__spinner { width: 36px; height: 36px; border: 4px solid #e3e0d8; border-top-color: #1a1a2e; border-radius: 50%; animation: contour-spin 0.8s linear infinite; }" + "@keyframes contour-spin { to { transform: rotate(360deg); } }" + ".contour-form-loader__text { margin-top: 12px; font-size: 14px; }";
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
    // Subject ordering (Amitav + Amrit, 18 Aug 2026): same subjects club
    // together and everything runs in descending level order. Each option is
    // ranked by the highest year in its structured year list (+0.5 for 3/4
    // codes so 3/4 always beats 1/2 at the same year); options group by
    // their structured subject name; groups sort by their best rank, items
    // descend within the group, and all ties keep HubSpot order. Renders
    // e.g. Methods 3/4, Methods 1/2, Specialist 3/4, Specialist 1/2,
    // Year 10 Maths — and HSC/Prelim or QCE (Year 12)/(Year 11) pairs
    // side by side in the two-column grid. MedPrep keeps its own explicit
    // order below.
    function subjectLevelRank(input) {
      var classification = getClassification(input);
      var rank = 0;
      if (classification.yearsShown) {
        for (var i = 0; i < classification.yearsShown.length; i++) {
          var label = classification.yearsShown[i];
          var year = label === "Graduated" ? 13 : parseInt(label.replace("Year ", ""), 10);
          if (year > rank) rank = year;
        }
      }
      if (classification.code && /34$/.test(classification.code)) rank += 0.5;
      return rank;
    }
    // Only senior sequence codes club by subject name — the 1/2 & 3/4 pairs
    // (VCE/QCE) and the Prelim/HSC pairs (NSW) are the same subject taught
    // across two years, so they belong side by side. Junior year-level codes
    // share a structured subject with their senior sequence (VIC-EN10 and
    // VCE-EN12/34 are all subject:English), and clubbing them lifted Year 10
    // English up to the VCE English group's rank — it rendered above VCE
    // English Language. Junior options therefore group alone and sort purely
    // on their own year rank.
    function isSeniorSequenceCode(code) {
      if (!code) return false;
      return /(?:12|34)$/.test(code) || /^(?:HSC|PRE)-/.test(code);
    }
    function subjectGroupKey(classification, index) {
      if (!classification || !classification.subject) return "#" + index;
      if (isSeniorSequenceCode(classification.code)) return classification.subject;
      return classification.subject + "|" + (classification.code || index);
    }
    Object.keys(buckets).forEach(function (category) {
      if (category === "MedPrep") return;
      var entries = buckets[category].map(function (li, index) {
        var input = li ? li.querySelector("input") : null;
        var classification = input ? getClassification(input) : null;
        return {
          li: li,
          index: index,
          rank: input ? subjectLevelRank(input) : 0,
          group: subjectGroupKey(classification, index)
        };
      });
      var groupRank = {};
      var groupFirst = {};
      entries.forEach(function (entry) {
        if (!(entry.group in groupRank) || entry.rank > groupRank[entry.group]) groupRank[entry.group] = entry.rank;
        if (!(entry.group in groupFirst)) groupFirst[entry.group] = entry.index;
      });
      entries.sort(function (a, b) {
        if (groupRank[a.group] !== groupRank[b.group]) return groupRank[b.group] - groupRank[a.group];
        if (groupFirst[a.group] !== groupFirst[b.group]) return groupFirst[a.group] - groupFirst[b.group];
        if (a.rank !== b.rank) return b.rank - a.rank;
        return a.index - b.index;
      });
      buckets[category] = entries.map(function (entry) {
        return entry.li;
      });
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
    // Subjects the student already trials or is enrolled in (URL prefetch)
    // don't render at all — nor does the other level of the same subject,
    // per the one-level rule. The summary card shows them instead, and a
    // category whose options all fall away takes its header with it
    // (Mani, 21 Aug 2026).
    var prefetchCodes = prefetchedTrialSubjectCodes.concat(prefetchedEnrolledSubjectCodes);
    var prefetchedKeys = {};
    if (prefetchCodes.length > 0) {
      options.forEach(function (opt) {
        var classification = getClassification(opt);
        if (!classification.code || prefetchCodes.indexOf(classification.code) === -1) return;
        var key = subjectExclusionKey(classification);
        if (key) prefetchedKeys[key] = true;
      });
    }
    options.forEach(function (opt) {
      var classification = getClassification(opt);
      applySignupName(opt, classification);
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
      var alreadyHeld = prefetchCodes.length > 0 && !!classification.code && prefetchCodes.indexOf(classification.code) !== -1;
      var prefetchBlocked = alreadyHeld || prefetchCodes.length > 0 && !!(subjectExclusionKey(classification) && prefetchedKeys[subjectExclusionKey(classification)]);
      var shouldShow = !prefetchBlocked && !!location && selectedPrograms.length > 0 && locationOk && programOk && yearOk && deliveryOk && intakeOk && audienceOk && !ucatBlockedForIntake(classification, selectedIntakeYear);
      // The submission overwrites the Web Form - Interested Subject property
      // wholesale, so a subject the record already holds must keep travelling
      // in it — otherwise adding one subject through the prefill link drops
      // the rest from the property, and the email built on that property
      // misreports the signup (Mani, 29 Aug 2026). It stays ticked in its
      // hidden input; on screen the summary card is what represents it.
      if (alreadyHeld && !opt.checked) setCheckboxChecked(opt, true);
      // A tick that predates the prefetch response on the other level of a
      // held subject would still submit from a hidden input — clear it while
      // the input is still clickable.
      if (prefetchBlocked && !alreadyHeld && opt.checked) setCheckboxChecked(opt, false);
      if (alreadyHeld) {
        // hideOption clears the tick as it hides — a held subject hides bare
        // so its tick survives to submission.
        var heldWrap = optionWrapper(opt);
        if (heldWrap) heldWrap.style.display = "none";
      } else {
        shouldShow ? showOption(opt) : hideOption(opt);
      }
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
    updateCanAddMoreSubjects();
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
  // Subject display names come from the 'Subjects' sheet of the 2027
  // Curriculum Planning Matrix (signup_name column; Wassim, 18 Aug 2026) —
  // the sheet is the central reference for what students see. Applied
  // before the heuristic relabels, which stay as fallback for unmapped
  // codes. Display-only: submitted structured values are untouched.
  var SUBJECT_SIGNUP_NAMES = { "GAMSAT": "GAMSAT", "HSC-BIOL": "HSC Biology (Year 12)", "HSC-CHEM": "HSC Chemistry (Year 12)", "HSC-MADV": "HSC Maths Advanced (Year 12)", "HSC-MAE1": "HSC Maths Extension 1 (Year 12)", "HSC-MAE2": "HSC Maths Extension 2 (Year 12)", "HSC-PHYS": "HSC Physics (Year 12)", "MD-INT": "Medical & Dental Interviews", "NSW-EN07": "Year 7 English", "NSW-EN08": "Year 8 English", "NSW-EN09": "Year 9 English", "NSW-EN10": "Year 10 English", "NSW-MA07": "Year 7 Maths", "NSW-MA08": "Year 8 Maths", "NSW-MA09": "Year 9 Maths", "NSW-MA10": "Year 10 Maths", "NSW-SC07": "Year 7 Science", "NSW-SC08": "Year 8 Science", "NSW-SC09": "Year 9 Science", "NSW-SC10": "Year 10 Science", "PRE-BIOL": "Prelim Biology (Year 11)", "PRE-CHEM": "Prelim Chemistry (Year 11)", "PRE-MADV": "Prelim Maths Advanced (Year 11)", "PRE-MAE1": "Prelim Maths Extension 1 (Year 11)", "PRE-PHYS": "Prelim Physics (Year 11)", "QCE-BI12": "QCE Biology (Year 11)", "QCE-BI34": "QCE Biology (Year 12)", "QCE-CH12": "QCE Chemistry (Year 11)", "QCE-CH34": "QCE Chemistry (Year 12)", "QCE-MM12": "QCE Methods (Year 11)", "QCE-MM34": "QCE Methods (Year 12)", "QCE-PH12": "QCE Physics (Year 11)", "QCE-PH34": "QCE Physics (Year 12)", "QCE-SM12": "QCE Specialist Maths (Year 11)", "QCE-SM34": "QCE Specialist Maths (Year 12)", "QLD-EN07": "Year 7 English", "QLD-EN08": "Year 8 English", "QLD-EN09": "Year 9 English", "QLD-EN10": "Year 10 English", "QLD-MA07": "Year 7 Maths", "QLD-MA08": "Year 8 Maths", "QLD-MA09": "Year 9 Maths", "QLD-MA1A": "Year 10 Maths", "QLD-SC07": "Year 7 Science", "QLD-SC08": "Year 8 Science", "QLD-SC09": "Year 9 Science", "QLD-SC10": "Year 10 Science", "UCAT-ANZ-CORE": "UCAT", "UCAT-ANZ-MAST": "UCAT", "UCAT-UK-CORE": "UCAT", "UCAT-UK-MAST": "UCAT", "VCE-BI12": "VCE Biology 1/2", "VCE-BI34": "VCE Biology 3/4", "VCE-BI34-INT2": "-", "VCE-BI34-INT3": "-", "VCE-CH12": "VCE Chemistry 1/2", "VCE-CH34": "VCE Chemistry 3/4", "VCE-CH34-INT2": "-", "VCE-CH34-INT3": "-", "VCE-EL12": "VCE English Language 1/2", "VCE-EL34": "VCE English Language 3/4", "VCE-EN12": "VCE English 1/2", "VCE-EN34": "VCE English 3/4", "VCE-MM12": "VCE Methods 1/2", "VCE-MM34": "VCE Methods 3/4", "VCE-MM34-INT2": "VCE Mathematical Methods 3/4 Intensive", "VCE-MM34-INT3": "VCE Mathematical Methods 3/4 Intensive", "VCE-PH12": "VCE Physics 1/2", "VCE-PH34": "VCE Physics 3/4", "VCE-PH34-INT2": "-", "VCE-PH34-INT3": "-", "VCE-SM12": "VCE Specialist Maths 1/2", "VCE-SM34": "VCE Specialist Maths 3/4", "VCE-SM34-INT2": "VCE Specialist Mathematics 3/4 Intensive", "VCE-SM34-INT3": "VCE Specialist Mathematics 3/4 Intensive", "VIC-EN07": "Year 7 English", "VIC-EN08": "Year 8 English", "VIC-EN09": "Year 9 English", "VIC-EN10": "Year 10 English", "VIC-MA07": "Year 7 Maths", "VIC-MA08": "Year 8 Maths", "VIC-MA09": "Year 9 Maths", "VIC-MA1A": "Year 10 Advanced Maths", "VIC-MA9A": "Year 9 Advanced Maths", "VIC-SC07": "Year 7 Science", "VIC-SC08": "Year 8 Science", "VIC-SC09": "Year 9 Science", "VIC-SC10": "Year 10 Science", "VSC-EN05": "Scholarship English", "VSC-MA05": "Scholarship Maths", "VSC-WR05": "Scholarship Writing", "VSE-COEN": "Selective Entry English", "VSE-COMA": "Selective Entry Maths", "VSE-COWR": "Selective Entry Writing", "VSE-EN06": "Selective Entry English", "VSE-EN07": "Selective Entry English", "VSE-EN08": "Selective Entry English", "VSE-MA06": "Selective Entry Maths", "VSE-MA07": "Selective Entry Maths", "VSE-MA08": "Selective Entry Maths", "VSE-WR06": "Selective Entry Writing", "VSE-WR07": "Selective Entry Writing", "VSE-WR08": "Selective Entry Writing" };
  function applySignupName(opt, classification) {
    var name = classification.code && SUBJECT_SIGNUP_NAMES[classification.code];
    if (!name) return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var span = wrap.querySelector("input + span") || wrap;
    var textNode = span.firstChild;
    if (!textNode || textNode.nodeType !== 3) return;
    if (textNode.nodeValue !== name) textNode.nodeValue = name;
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
  // program only starts for them at the end of Year 12 — an info icon beside
  // the subject explains this in a tooltip that opens on hover anywhere over
  // the option, or on focusing the icon (Amitav/Luke, 18 Aug 2026; tooltip
  // form per Amrit).
  var INTERVIEW_NOTE_TEXT = "Interview Program will start at the end of Year 12 - we will get in touch with you in Year 12.";
  var INTERVIEW_NOTE_YEAR_LEVELS = ["Year 10", "Year 11"];
  function updateInterviewProgramNote(opt, classification, yearLevel, optionVisible) {
    if (classification.code !== "MD-INT") return;
    var wrap = optionWrapper(opt);
    if (!wrap) return;
    var show = optionVisible && INTERVIEW_NOTE_YEAR_LEVELS.indexOf(yearLevel) !== -1;
    var tip = wrap.querySelector(".contour-info-tip");
    if (!tip) {
      if (!show) return;
      if (!document.getElementById("contour-info-tip-styles")) {
        var style = document.createElement("style");
        style.id = "contour-info-tip-styles";
        style.textContent = "" +
          ".hs-form .contour-info-tip { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; margin-left: 6px; border-radius: 50%; background: #9aa5b1; color: #FFFFFF; font-size: 10.5px; font-weight: 700; line-height: 1; vertical-align: middle; cursor: default; }" +
          ".hs-form .contour-info-tip__bubble { position: absolute; bottom: calc(100% + 9px); left: 50%; transform: translateX(-50%); width: 240px; padding: 10px 12px; border-radius: 8px; background: #0C3166; color: #FFFFFF; font-size: 12.5px; font-weight: 500; line-height: 1.45; text-align: left; opacity: 0; visibility: hidden; transition: opacity 0.15s ease; pointer-events: none; z-index: 5; }" +
          ".hs-form .contour-info-tip__bubble::after { content: \"\"; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 6px solid transparent; border-top-color: #0C3166; }" +
          // Hovering anywhere on the option (or focusing the icon) opens it.
          ".hs-form .contour-has-info-tip:hover .contour-info-tip__bubble, .hs-form .contour-info-tip:focus .contour-info-tip__bubble { opacity: 1; visibility: visible; }";
        document.head.appendChild(style);
      }
      tip = document.createElement("span");
      tip.className = "contour-info-tip";
      tip.setAttribute("tabindex", "0");
      tip.setAttribute("role", "img");
      tip.setAttribute("aria-label", INTERVIEW_NOTE_TEXT);
      tip.appendChild(document.createTextNode("i"));
      var bubble = document.createElement("span");
      bubble.className = "contour-info-tip__bubble";
      bubble.setAttribute("role", "tooltip");
      bubble.textContent = INTERVIEW_NOTE_TEXT;
      tip.appendChild(bubble);
      var labelSpan = wrap.querySelector("input + span") || wrap;
      labelSpan.appendChild(tip);
    }
    tip.style.display = show ? "inline-flex" : "none";
    wrap.classList.toggle("contour-has-info-tip", show);
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
  // Manual ticks only: subjects already trialled/enrolled (URL prefetch) are
  // filtered out of the option list itself in evaluateInterestedSubjectsOptions,
  // together with their one-level siblings, so they never reach here.
  /* =========================================================
     CAN ADD MORE SUBJECTS — a hidden yes/no for the sales team
     -----------------------------------------------------------
     Answers "is there anything left for this student to add?", so a signup
     with one subject can be read as either "they picked one of many" or
     "one was all we had for them" (Amrit, 23 Aug 2026).

     It counts what the student COULD still take, not what is on screen: a
     subject under a program they have not ticked still counts, because
     ticking it is one click away. What does not count is anything the
     matrix rules out for their location, year level and intake, anything
     they already trial or are enrolled in, whatever they have already
     ticked, and the other level of a subject they have ticked — that one is
     the case this field exists for, where Education is the only eligible
     program, it offers two levels of one subject, and taking either rules
     out the other.

     Undetermined reads as yes: before the location, year level and intake
     are answered there is nothing to judge, and a false "we had nothing for
     them" is the more expensive mistake of the two.
     ========================================================= */
  function canAddMoreSubjects() {
    var location = getValue(FIELD_SELECTORS.location);
    var yearLevel = getValue(FIELD_SELECTORS.yearLevel);
    var intakeYear = getValue(FIELD_SELECTORS.intakeYear);
    if (!location || !yearLevel || !intakeYear) return true;
    var options = qAll(FIELD_SELECTORS.interestedSubjects);
    if (options.length === 0) return true;
    var prefetchCodes = prefetchedTrialSubjectCodes.concat(prefetchedEnrolledSubjectCodes);
    // One level per subject: a ticked or already-held option closes the door
    // on every other level of the same subject, which is exactly what
    // evaluateSubjectExclusions does on screen.
    var closedKeys = {};
    options.forEach(function (opt) {
      var classification = getClassification(opt);
      var key = subjectExclusionKey(classification);
      if (!key) return;
      if (opt.checked) closedKeys[key] = true;
      if (classification.code && prefetchCodes.indexOf(classification.code) !== -1) closedKeys[key] = true;
    });
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      if (opt.checked) continue;
      var classification = getClassification(opt);
      if (classification.code && prefetchCodes.indexOf(classification.code) !== -1) continue;
      var key = subjectExclusionKey(classification);
      if (key && closedKeys[key]) continue;
      if (!subjectMatchesAudience(classification)) continue;
      // Same eligibility the option list is built from, minus the test for
      // which programs are ticked.
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
  // Written to whichever shape the field takes: HubSpot renders a hidden
  // single checkbox as a plain hidden input on some forms and as a checkbox
  // with display:none on others. Absent field, nothing to do — the flag is
  // still a draft on the form at the time of writing.
  function updateCanAddMoreSubjects() {
    var fields = qAll(FIELD_SELECTORS.canAddMoreSubjects);
    if (fields.length === 0) return;
    var value = canAddMoreSubjects();
    fields.forEach(function (el) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked === value) return;
        asProgrammaticEdit(function () {
          el.checked = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        });
        return;
      }
      var text = value ? "true" : "false";
      if ((el.value || "") === text) return;
      asProgrammaticEdit(function () {
        el.value = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
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
    // Ticking a subject closes the door on its other level, so the answer to
    // "is there anything left?" changes here too. The full option pass above
    // does not re-run on a subject tick, only this one does.
    updateCanAddMoreSubjects();
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
  // The section divider above the campus field only makes sense while the
  // field itself renders (it hides for MedPrep-only signups).
  function toggleCampusDivider(shouldShow) {
    var divider = formRoot.querySelector("#contour-divider-campus");
    if (divider) divider.style.display = shouldShow ? "" : "none";
  }
  /* Medical Entry runs online and nowhere else, so Online is not a campus
     choice for it — it is a consequence of picking the program. It was only
     being forced when MedPrep was the *only* program picked, and that case
     hides the campus question outright; pick Medical Entry alongside High
     School Tutoring and the question appeared with Online free to be unticked,
     which is what Angad hit (23 Aug 2026).

     Forced and explained, rather than forced quietly: a tick nobody made is
     worth a line saying who made it. */
  var CAMPUS_NOTE_CLASS = "contour-campus-note";
  var CAMPUS_NOTE_TEXT = "Online is selected for you because Medical Entry (UCAT) is delivered online. You can still add campuses for your other programs.";
  function renderCampusOnlineNote(show) {
    var field = q(FIELD_SELECTORS.campus);
    var wrap = field ? fieldWrapper(field) : null;
    if (!wrap) return;
    var note = wrap.querySelector("." + CAMPUS_NOTE_CLASS);
    if (!show) {
      if (note && note.parentNode) note.parentNode.removeChild(note);
      return;
    }
    if (!note) {
      /* No badge. The amber already says "notice", so the icon was saying it
         twice — and the school hint's badge works because that hint is one
         short line, where it reads as a bullet; beside two lines of prose it
         reads as decoration (Amrit, 25 Aug 2026).

         It also leaves the two notes differing in shape and not only colour:
         a blue badge over one line means "do this next", an amber block of
         prose means "this was done for you". That is a stronger distinction
         than the same shape in two colours, and it is the one that matters,
         since the second kind is easy to mistake for an error. */
      note = document.createElement("p");
      note.className = CAMPUS_NOTE_CLASS;
      note.setAttribute("role", "status");
      note.setAttribute("aria-live", "polite");
      note.textContent = CAMPUS_NOTE_TEXT;
      wrap.appendChild(note);
      return;
    }
    // Kept last: HubSpot appends its own error list on a re-render, and the
    // note explaining a tick belongs under the ticks, not under the error.
    if (note !== wrap.lastElementChild) wrap.appendChild(note);
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
      toggleCampusDivider(false);
      updateCampusRequiredMark(false);
      // Nothing on screen to explain.
      renderCampusOnlineNote(false);
      return;
    }
    var fieldShouldShow = selectedPrograms.length > 0;
    // MedPrep alongside something else: the question is asked, and Online is
    // answered for them.
    var medPrepWithOthers = selectedPrograms.indexOf("MedPrep") !== -1;
    options.forEach(function (opt) {
      var classification = getCampusClassification(opt);
      var shouldShow = fieldShouldShow && subjectMatchesLocation(classification.state, location);
      shouldShow ? showOption(opt) : hideOption(opt);
      if (medPrepWithOthers && classification.code === "ONLINE" && shouldShow && !opt.checked) setCheckboxChecked(opt, true);
    });
    renderCampusOnlineNote(fieldShouldShow && medPrepWithOthers);
    toggleFieldWrapper(q(FIELD_SELECTORS.campus), fieldShouldShow);
    toggleCampusDivider(fieldShouldShow);
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
  // Shared by the school search and by the completeness test that decides
  // whether Academic Details is finished.
  var SCHOOL_MIN_SEARCH_CHARS = 2;
  var STUDENT_ID_PARAM = "student_id";
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var prefetchedTrialSubjectCodes = [];
  var prefetchedEnrolledSubjectCodes = [];
  // A held subject (already trialling/enrolled per the prefill fetch) stays
  // ticked in a hidden input purely so the submission carries it — see
  // evaluateInterestedSubjectsOptions. UI that reacts to "what the visitor
  // picked this session" must leave those ticks out.
  function isHeldSubjectOption(opt) {
    if (prefetchedTrialSubjectCodes.length === 0 && prefetchedEnrolledSubjectCodes.length === 0) return false;
    var code = getClassification(opt).code;
    if (!code) return false;
    return prefetchedTrialSubjectCodes.indexOf(code) !== -1 || prefetchedEnrolledSubjectCodes.indexOf(code) !== -1;
  }
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
    asProgrammaticEdit(function () {
      el.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      el.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    });
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
  // "Country" is HubSpot's own 250-option select, conditional on Your Location
  // being International, and its option values are the country names rather
  // than codes. A stored value can arrive in any casing, and assigning a select
  // a value it has no option for leaves it silently blank on a required field,
  // so resolve against the options and only set on a match.
  function setCountryWhenPresent(value, tries) {
    if (value === undefined || value === null || value === "") return;
    var el = q(FIELD_SELECTORS.country);
    if (el) {
      var wanted = String(value).trim().toLowerCase();
      for (var i = 0; i < el.options.length; i++) {
        var opt = el.options[i];
        if (opt.value.trim().toLowerCase() === wanted || opt.textContent.trim().toLowerCase() === wanted) {
          setSelectOrTextValue(FIELD_SELECTORS.country, opt.value);
          return;
        }
      }
      return;
    }
    if (tries <= 0) return;
    setTimeout(function () {
      setCountryWhenPresent(value, tries - 1);
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
    asProgrammaticEdit(function () {
      inp.dispatchEvent(new Event("input", {
        bubbles: true
      }));
      inp.dispatchEvent(new Event("change", {
        bubbles: true
      }));
    });
  }
  // Both phone selects answer to this: the student widget's options carry the
  // bare ISO while HubSpot's own have worn several shapes ("au", "AU_61"), so
  // the match tries every one rather than betting on today's format.
  function selectPhoneCountryOption(select, parts) {
    var matched = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      if (matched) return;
      var v = (opt.value || "").toLowerCase();
      if (v === parts.iso || v === parts.dial || v === "+" + parts.dial || v.indexOf(parts.iso + "_") === 0 || v.indexOf("_" + parts.dial) !== -1) {
        select.value = opt.value;
        matched = true;
      }
    });
    return matched;
  }
  function setPhoneValue(selector, value) {
    if (!value) return;
    value = String(value).trim();
    if (!value) return;
    var el = q(selector);
    if (!el) return;
    // A prefill can land before the widgets exist (the student control is
    // built from an observer callback); both builders are idempotent, so
    // raising them here lets the write below reach every box in one pass
    // instead of leaning on a later sync to carry it over.
    enhanceStudentPhoneField();
    enhancePhoneBoxes();
    var wrap = fieldWrapper(el) || el.parentElement;
    var select = wrap ? wrap.querySelector("select") : null;
    var parts = splitE164(value);
    if (select && parts && selectPhoneCountryOption(select, parts)) {
      fireInputEvents(select);
      Array.prototype.forEach.call(wrap.querySelectorAll("input"), function (inp) {
        // HubSpot's own widget: the hidden input carries the full E.164 value
        // for submission. The visible proxy shows the national number alone —
        // never a dial code, that lives on the select — and its input event
        // recomposes "+dial national" onto the real box, so the direct write
        // to the real box is the same value the sync settles on.
        if (inp.type === "hidden") {
          inp.value = value;
        } else if (inp.classList.contains(PHONE_PROXY_CLASS)) {
          inp.value = parts.national;
        } else {
          inp.value = "+" + parts.dial + " " + parts.national;
        }
        fireInputEvents(inp);
      });
      return;
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
  // PREFILLED FIELD LOCK — a student_id link resolves to a HubSpot record by
  // its email address; letting that address be edited would point the whole
  // submission (and every check built on the email) at a different record than
  // the one the link named. Locked with readOnly rather than disabled because
  // HubSpot's serializer drops disabled inputs, which would strip the value
  // from the submission and trip the required-field gate on a field the
  // student can no longer type into. The injected :disabled styling is shared
  // so it still reads as untouchable. Only fields the prefetch actually filled
  // are locked — an empty student email stays editable. HubSpot re-renders
  // replace the node, so the watchContactFields observer re-asserts the lock.
  // Each lock remembers the address that belongs in the box, not just which
  // box to lock. HubSpot's React embed can re-render an input after the
  // single-shot fill, swapping in a fresh blank node — and the observer that
  // re-asserts the lock would otherwise seal that blank in as an uneditable
  // empty required field. With the value stored, enforcement heals the box
  // first; and a box that still holds nothing is never locked at all.
  //
  // Location and Year Level are locked the same way (Amrit, 22 Aug 2026), but
  // a <select> needs different handling in two places, so each lock reads its
  // kind off the live node rather than carrying one:
  //
  //   - readOnly does nothing to a <select> and disabled would drop the value
  //     from the submission, so a locked select is taken out of reach instead
  //     — pointer-events off, out of the tab order, aria-disabled — with a
  //     change guard that puts a *trusted* change back. Untrusted changes are
  //     the form's own (see below), and those are allowed through;
  //   - it is never healed. The email heal exists because HubSpot re-renders
  //     blank the box, but a blank select is usually deliberate:
  //     evaluateIntakeYearDependents clears the year level when the intake
  //     year switches, and evaluateYearLevelOptions clears an answer that has
  //     stopped being eligible. Healing would put an invalid answer straight
  //     back. So a blank merely unlocks, and the lock retires for good only
  //     once the box holds something the link did not put there — otherwise
  //     re-locking would seal in whatever the student picked instead.
  var prefilledFieldLocks = [];
  // True while the form on screen is a live mirror of the HubSpot record the
  // URL named. The student's first own edit ends that: the form now shows
  // *their* state, the draft carries it, and student_id comes off the URL so
  // a refresh restores the edits instead of re-fetching the record over them.
  var prefillSessionLive = false;
  var SELECT_LOCK_BOUND_ATTR = "data-contour-select-lock";
  function recordPrefilledFieldLock(selector, value) {
    value = String(value || "").trim();
    if (!value) return;
    for (var i = 0; i < prefilledFieldLocks.length; i++) {
      if (prefilledFieldLocks[i].selector === selector) {
        prefilledFieldLocks[i].value = value;
        return;
      }
    }
    prefilledFieldLocks.push({ selector: selector, value: value });
  }
  function unlockPrefilledInput(input, lock) {
    lock.active = false;
    if (input.readOnly) {
      input.readOnly = false;
      input.removeAttribute("aria-readonly");
    }
    input.removeAttribute("aria-disabled");
    input.removeAttribute("tabindex");
    input.classList.remove("contour-prefill-locked");
  }
  // A locked select still has to submit its value, so it cannot be disabled —
  // it is put out of reach instead. The change guard is belt and braces behind
  // that, and stands down whenever the lock is not currently holding: a select
  // the form cleared is the student's to answer, and snapping their answer
  // back to the record's would be the worst version of this feature.
  function lockPrefilledSelect(select, lock) {
    if (select.getAttribute(SELECT_LOCK_BOUND_ATTR) !== "1") {
      select.setAttribute(SELECT_LOCK_BOUND_ATTR, "1");
      select.addEventListener("change", function (e) {
        // The form's own writes arrive untrusted (this file dispatches them by
        // hand) and are allowed to land — that is how the intake-year switch
        // clears a year level that has stopped being answerable.
        if (!e.isTrusted || !lock.active) return;
        if ((select.value || "") === lock.value) return;
        setSelectOrTextValue(lock.selector, lock.value);
      });
    }
    lock.active = true;
    if (select.classList.contains("contour-prefill-locked")) return;
    select.setAttribute("aria-disabled", "true");
    select.setAttribute("tabindex", "-1");
    select.classList.add("contour-prefill-locked");
  }
  function enforcePrefilledFieldLock() {
    prefilledFieldLocks.forEach(function (lock) {
      if (lock.released) return;
      var input = q(lock.selector);
      if (!input) return;
      var current = (input.value || "").trim();
      if (input.tagName === "SELECT") {
        // Blank only unlocks, and never releases: a React re-render can empty
        // a select for a beat, and releasing on that would drop the lock for
        // the rest of the visit. It comes back the moment the value does.
        if (current === "") {
          unlockPrefilledInput(input, lock);
          return;
        }
        // Holding something other than what the link supplied means the
        // answer is now the student's — after an intake switch cleared it, or
        // from a restored draft. Retire the lock rather than seal theirs in.
        if (current !== lock.value) {
          lock.released = true;
          unlockPrefilledInput(input, lock);
          return;
        }
        lockPrefilledSelect(input, lock);
        return;
      }
      if (current === "") {
        // A re-render emptied the box (or the fill never landed on this
        // node). Put the address back before deciding anything about
        // locking — events included, so HubSpot's own state follows.
        setSelectOrTextValue(lock.selector, lock.value);
        current = ((q(lock.selector) || input).value || "").trim();
      }
      // Never lock a blank box: an uneditable empty required field is a
      // dead end nobody can type their way out of.
      if (current === "") {
        unlockPrefilledInput(input, lock);
        return;
      }
      if (input.readOnly) return;
      lock.active = true;
      input.readOnly = true;
      input.setAttribute("aria-readonly", "true");
      input.classList.add("contour-prefill-locked");
    });
  }
  function applyPrefill(contact, guardian, associatedStudent, lockPrefilled) {
    var contactType = contact.contact_type;
    // "Parent" records use the same flow as "Guardian" — the form radio only
    // knows Student/Guardian.
    var isGuardianFlow = contactType === "Guardian" || contactType === "Parent";
    if (contactType === "Student" || isGuardianFlow) {
      var radioValue = isGuardianFlow ? "Guardian" : "Student";
      qAll(FIELD_SELECTORS.contactType).forEach(function (radio) {
        if (radio.value === radioValue) setCheckboxChecked(radio, true);
      });
      updateGuardianFieldLabels();
    }
    // Emails fill from the canonical `email` property ONLY. `email_2` is just
    // whatever the form's visible email box carried in the last submission —
    // a guardian-flow submission writes the GUARDIAN's address into the
    // student record's email_2 — so it can't be trusted as anyone's own
    // address, and locking it would bind the submission to the wrong record
    // (Faraz's + Amrit's reports, 22 Aug 2026). An empty email leaves the
    // field blank and editable: recordPrefilledFieldLock skips empty values.
    if (isGuardianFlow) {
      setSelectOrTextValue('[name="firstname"]', contact.firstname);
      setSelectOrTextValue('[name="lastname"]', contact.lastname);
      setSelectOrTextValue(FIELD_SELECTORS.emailTemp, contact.email);
      setPhoneValue('[name="phone"]', contact.phone);
      var s = associatedStudent || {
        firstname: contact.student_first_name,
        lastname: contact.student_last_name,
        email: contact.student_email,
        phone: contact.student_phone_number || contact.student_phone
      };
      setTextWhenPresent('[name="student_first_name"]', s.firstname, 10);
      setTextWhenPresent('[name="student_last_name"]', s.lastname, 10);
      setTextWhenPresent('[name="student_email"]', s.email, 10);
      setPhoneValueWhenPresent(FIELD_SELECTORS.studentPhone, s.phone, 10);
      if (lockPrefilled) {
        recordPrefilledFieldLock(FIELD_SELECTORS.emailTemp, contact.email);
        recordPrefilledFieldLock(FIELD_SELECTORS.studentEmail, s.email);
      }
    } else {
      setSelectOrTextValue('[name="firstname"]', contact.firstname);
      setSelectOrTextValue('[name="lastname"]', contact.lastname);
      setSelectOrTextValue(FIELD_SELECTORS.emailTemp, contact.email);
      setPhoneValue('[name="phone"]', contact.phone);
      if (lockPrefilled) {
        recordPrefilledFieldLock(FIELD_SELECTORS.emailTemp, contact.email);
      }
    }
    setSelectOrTextValue(FIELD_SELECTORS.location, contact.state_territory_country);
    // Conditional on the location above, so it lands a beat later — retry the
    // way the other dependent fields do. The injected select mirrors it.
    setTextWhenPresent(FIELD_SELECTORS.region, contact.state, 10);
    setCountryWhenPresent(contact.country_dropdown, 10);
    setSelectOrTextValue(FIELD_SELECTORS.intakeYear, contact.which_year_are_you_interested_in_tutoring_for_);
    setSelectOrTextValue(FIELD_SELECTORS.yearLevel, contact.year_level);
    // Location and Year Level come from the record the link named, and the
    // whole page below them — eligible programs, the subject list, the campus
    // list, whether a school is asked for at all — is derived from that pair.
    // Intake Year is deliberately left open: it is the one thing a returning
    // student is most likely to be here to change.
    if (lockPrefilled && featureEnabled("lockPrefilledStudyFields")) {
      recordPrefilledFieldLock(FIELD_SELECTORS.location, contact.state_territory_country);
      recordPrefilledFieldLock(FIELD_SELECTORS.yearLevel, contact.year_level);
    }
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
    enforcePrefilledFieldLock();
  }
  var prefillWantsSectionsOpen = false;
  function openSectionsForPrefill() {
    if (!prefillWantsSectionsOpen) return;
    if (!sectionsReady) return;
    revealAllSections({
      pinOpen: true,
      // The link goes to students who have already signed up and is there to
      // add subjects, so that is the card it opens on. The rest of the form is
      // theirs to correct — every card unlocks, none is forced open, and
      // anything the record left blank is still caught at submission
      // (Angad, 23 Aug 2026).
      stepOpenId: "programs"
    });
  }
  function stripStudentIdFromUrl() {
    if (!window.history || typeof window.history.replaceState !== "function") return;
    // Only the student_id pair goes; anything else on the URL (?type=internal,
    // campaign tags) must survive.
    var remaining = window.location.search.replace(/^\?/, "").split("&").filter(function (pair) {
      return pair !== "" && pair.split("=")[0] !== STUDENT_ID_PARAM;
    });
    var url = window.location.pathname + (remaining.length ? "?" + remaining.join("&") : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }
  function getUrlParam(name) {
    var match = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
  }
  function renderRestoreBanner(options) {
    var existing = formRoot.querySelector("#contour-prefill-banner");
    if (existing) existing.parentNode.removeChild(existing);
    var banner = document.createElement("div");
    banner.id = "contour-prefill-banner";
    banner.className = "contour-prefill-banner";
    var badge = document.createElement("span");
    badge.className = "contour-prefill-banner__badge";
    badge.setAttribute("aria-hidden", "true");
    badge.innerHTML = '<svg viewBox="0 0 16 16" width="15" height="15" xmlns="http://www.w3.org/2000/svg"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    banner.appendChild(badge);
    var content = document.createElement("div");
    content.className = "contour-prefill-banner__content";
    var title = document.createElement("p");
    title.className = "contour-prefill-banner__title";
    title.textContent = options.title;
    content.appendChild(title);
    var text = document.createElement("p");
    text.className = "contour-prefill-banner__text";
    text.textContent = options.text;
    content.appendChild(text);
    var resetLink = document.createElement("a");
    resetLink.href = "#";
    resetLink.className = "contour-prefill-banner__reset";
    resetLink.textContent = options.linkText;
    resetLink.addEventListener("click", function (e) {
      e.preventDefault();
      resetToBlankForm();
    });
    content.appendChild(resetLink);
    banner.appendChild(content);
    formRoot.insertBefore(banner, formRoot.firstChild);
  }
  // A DOM-level reset fights HubSpot's internal form state (radios get
  // restored on re-render) — reloading without the student_id param
  // guarantees a pristine blank form. The saved draft goes with it, or the
  // reload would put the same answers straight back.
  function resetToBlankForm() {
    draftLocked = true;
    clearDraft();
    window.location.href = window.location.pathname;
  }
  function renderPrefillBanner(fullName) {
    renderRestoreBanner({
      title: fullName ? "Welcome back, " + fullName : "Welcome back",
      text: "We've filled in your details from your last signup. Please check them before you submit.",
      linkText: "Not you, or starting fresh? Clear the form"
    });
  }
  // The local draft's own banner. Worded to say where the answers came from
  // and that nothing has been sent: a form that fills itself in with no
  // explanation reads either as a bug or as us knowing more than we should.
  function firstNameFromDraft(values) {
    var name = values && values.firstname;
    if (Array.isArray(name)) name = name[0];
    return String(name || "").trim();
  }
  function renderDraftBanner(firstName) {
    renderRestoreBanner({
      title: firstName ? "Picked up where you left off, " + firstName : "Picked up where you left off",
      text: "We saved what you'd started on this device and filled it back in. Nothing has been sent to us yet, so take a look and finish whenever you're ready.",
      linkText: "Starting fresh? Clear the form"
    });
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
      updateGuardianFieldLabels();
      if (tries > 0) defaultContactTypeToStudent(tries - 1);
    }, 250);
  }
  // Disclosure starts only once the form is settled and in its final shape:
  // before the prefetch resolves every field is still empty, and opening on
  // that would collapse a returning student's fully answered form.
  function startFormPresentation() {
    startSections();
    playFormEntrance();
  }
  function initPrefetchFromUrl() {
    if (!urlPrefetchPromise) {
      // No record to fetch, so a local draft is the best answer we have.
      // Restore before the default is applied: a stored contact type has to
      // win over the Student fallback.
      initDraftRestore();
      defaultContactTypeToStudent();
      startFormPresentation();
      return;
    }
    showFormLoader();
    urlPrefetchPromise.then(function (data) {
      var prefilled = !!(data && data.found && data.contact);
      if (prefilled) {
        prefillSessionLive = true;
        beginPrefillLinkSession();
        prefetchedTrialSubjectCodes = data.trialSubjectCodes || [];
        prefetchedEnrolledSubjectCodes = data.enrolledSubjectCodes || [];
        applyPrefill(data.contact, data.guardian, data.associatedStudent, true);
        // The record filled the whole form in one go, so every card opens and
        // stays open — see revealAllSections. Set here rather than inside
        // applyPrefill, which the draft restore also calls: a restored draft
        // brings its own remembered open/folded state and must keep it.
        prefillWantsSectionsOpen = true;
        // Whose ANSWERS win is settled — the record's. Which cards are open
        // is a separate question, and the answer to that one is still the
        // visitor's: a card they folded on the last visit through this same
        // link stays folded, because pinOpen stands down for anything in the
        // hand-collapsed map (Amrit, 23 Aug).
        restoreSectionBoxStateFromDraft();
        openSectionsForPrefill();
        var fullName = ((data.contact.firstname || "") + " " + (data.contact.lastname || "")).trim();
        renderPrefillBanner(fullName);
        if (prefetchedTrialSubjectCodes.length > 0 || prefetchedEnrolledSubjectCodes.length > 0) {
          setFieldLabelText("interestedSubjects", "Additional Subjects");
        }
        // The same React-settle refresh the draft path needs (see
        // refreshDerivedFieldState) — it also folds the trialling/enrolled
        // codes into the subject list now that they are known.
        refreshDerivedFieldState();
        scheduleDerivedStateRefresh();
      } else {
        if (data && !data.found) {
          // The server answered and the record is definitively gone, so the
          // link is a dud. Take the parameter off the URL (no reload) so a
          // refresh or a copied address behaves as a normal visit instead of
          // re-asking for a contact that is not there. A network failure or
          // timeout keeps the parameter: the record may exist, and a refresh
          // should get to try again.
          stripStudentIdFromUrl();
        }
        // The link named a contact we could not fetch. Fall back to whatever
        // was typed on this browser rather than to a blank form.
        initDraftRestore();
      }
      // Prefill takes precedence (Guardian/Parent records select Guardian);
      // anything else — no record, unknown contact_type — defaults to Student.
      defaultContactTypeToStudent();
      hideFormLoader();
      startFormPresentation();
    });
  }
  /* =========================================================
     LOCAL DRAFT CACHE — the form remembers what was typed
     ---------------------------------------------------------
     Answers are mirrored into localStorage as they are given, and put back on
     the next visit from the same browser. A form this long gets abandoned
     part-way on a phone — a tab dies, a link is followed, the page is
     refreshed — and until now that meant starting from the first question
     again (Amrit, 20 Aug 2026).

     Three rules keep it honest:
       - only the student's own typing is saved, which takes both `isTrusted`
         (to rule out the events this file dispatches by hand) and the
         programmatic-edit counter (to rule out the browser's own events, which
         setCheckboxChecked raises through click()). Without the pair, the URL
         prefetch's answers would be written straight back as a local draft;
       - a HubSpot record beats a local draft. A student_id link is a
         deliberate "this is who I am", so the draft stands aside for it;
       - consent is never remembered, and internal sessions are never saved at
         all — a shared reception browser must not carry one family's details
         into the next signup.
     ========================================================= */
  var DRAFT_STORAGE_KEY = "contour_form1_draft";
  // Bumped when the stored shape changes, which discards every draft written
  // by an older build rather than trying to interpret it.
  var DRAFT_VERSION = 1;
  // Long enough for "I'll finish this once I've asked Mum", short enough that
  // a shared laptop isn't still offering it a month later.
  var DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  var DRAFT_SAVE_DEBOUNCE_MS = 400;
  // Ticking the consent box is a legal act and has to be done afresh every
  // time; the two internal questions only exist for staff, whose sessions are
  // not saved anyway.
  // can_add_more_subjects is derived from the answers, never given, so it is
  // recomputed on restore rather than carried in the draft.
  var DRAFT_SKIP_FIELDS = ["tos_privacy_consent", "how_did_they_contact_us", "signed_up_by", "can_add_more_subjects"];
  // Everything applyPrefill already knows how to put back, so the draft can
  // reuse it wholesale instead of keeping a second copy of the same wiring
  // (the phone widgets and the dependent selects especially).
  var DRAFT_PREFILL_FIELDS = ["web_form_contact_type", "firstname", "lastname", "email_2", "phone", "student_first_name", "student_last_name", "student_email", "student_phone_number", "state_territory_country", "state", "country_dropdown", "which_year_are_you_interested_in_tutoring_for_", "year_level", "school_text", "school_code", "acara_id", "program_interest", "web_form__interested_subject", "web_form__preferred_campuses", "referral"];
  var draftLocked = false;
  var draftUserTouched = false;
  var draftSaveTimer = null;
  var draftFieldNamesCache = null;
  var draftStorageResolved = false;
  var draftStorageRef = null;
  // Read off SECTION_DEFS rather than keeping a list of its own: that is
  // already the maintained inventory of every field on the form, so a field
  // added there is remembered without a second edit here.
  function draftFieldNames() {
    if (draftFieldNamesCache) return draftFieldNamesCache;
    var names = [];
    SECTION_DEFS.forEach(function (def) {
      def.fields.forEach(function (name) {
        if (DRAFT_SKIP_FIELDS.indexOf(name) !== -1) return;
        if (names.indexOf(name) === -1) names.push(name);
      });
    });
    draftFieldNamesCache = names;
    return names;
  }
  // Safari in private mode, and any browser with site storage blocked, throws
  // on access rather than handing back an empty store — and a quota of zero
  // only shows up on the write. Probe once and remember the answer.
  function draftStorage() {
    if (draftStorageResolved) return draftStorageRef;
    draftStorageResolved = true;
    try {
      var store = window.localStorage;
      var probe = DRAFT_STORAGE_KEY + "__probe";
      store.setItem(probe, "1");
      store.removeItem(probe);
      draftStorageRef = store;
    } catch (err) {
      draftStorageRef = null;
    }
    return draftStorageRef;
  }
  function draftCacheEnabled() {
    return featureEnabled("localDraft") && !isInternalMode() && !!draftStorage();
  }
  function readDraft() {
    var store = draftStorage();
    if (!store) return null;
    var raw;
    try {
      raw = store.getItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      return null;
    }
    if (!raw) return null;
    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parsed = null;
    }
    if (!parsed || parsed.v !== DRAFT_VERSION || !parsed.values || !parsed.savedAt) {
      clearDraft();
      return null;
    }
    if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      clearDraft();
      return null;
    }
    return parsed;
  }
  // The parts of a prefilled session the values alone cannot carry: which
  // email boxes are locked, and which subjects the student already has. A
  // draft started on a prefill link stores them so a refresh keeps the email
  // uneditable and the trialled subjects hidden — without them the restored
  // form would reopen both doors the prefill deliberately closed. Absent for
  // ordinary drafts, and old drafts without the key read the same way.
  function draftPrefillMeta() {
    if (!prefillLinkSession && prefilledFieldLocks.length === 0 && prefetchedTrialSubjectCodes.length === 0 && prefetchedEnrolledSubjectCodes.length === 0) {
      return null;
    }
    return {
      // The presentation a pre-fill link put the form into — the contact-type
      // question hidden — outlives the locks and the subject codes: a record
      // with neither still arrived through a link, and a refresh must not
      // hand back the question it answered.
      link: prefillLinkSession,
      // A retired lock is not carried into the draft: the answer in the box is
      // the student's now, and replaying the lock would put the record's back.
      locks: prefilledFieldLocks.filter(function (lock) {
        return !lock.released;
      }).map(function (lock) {
        return { s: lock.selector, v: lock.value };
      }),
      trial: prefetchedTrialSubjectCodes.slice(),
      enrolled: prefetchedEnrolledSubjectCodes.slice()
    };
  }
  // Which cards the visitor had open is part of what they left behind, and it
  // is not derivable from the answers: a completed section collapses by
  // default, so a refresh used to shut a card that had been deliberately
  // reopened. Only the hand-set states are stored — everything else stays
  // derived, so a draft never freezes the automatic behaviour (Amrit, 23 Aug).
  function draftSectionBoxState() {
    var open = Object.keys(sectionBoxManualOpen);
    var collapsed = Object.keys(sectionBoxManualCollapsed);
    if (open.length === 0 && collapsed.length === 0) return null;
    return { open: open, collapsed: collapsed };
  }
  // Reads only the card states out of a stored draft, for the prefill path,
  // where the record supplies the values and the draft is otherwise ignored.
  function restoreSectionBoxStateFromDraft() {
    if (!draftCacheEnabled()) return;
    var entry = readDraft();
    if (entry) restoreSectionBoxState(entry.boxes);
  }
  function restoreSectionBoxState(boxes) {
    // Step mode works out which card is open from the answers themselves, so
    // a remembered open/folded map has nothing to add and plenty to fight:
    // a card stored open is one the rule would fold, and the two would take
    // turns. The refresh lands on the first unanswered card, which is where
    // the visitor left off anyway.
    if (stepModeEnabled()) return;
    if (!boxes) return;
    (boxes.open || []).forEach(function (id) {
      if (SECTION_BOX_IDS[id]) sectionBoxManualOpen[id] = true;
    });
    (boxes.collapsed || []).forEach(function (id) {
      if (SECTION_BOX_IDS[id] && !sectionBoxManualOpen[id]) sectionBoxManualCollapsed[id] = true;
    });
  }
  function writeDraft(values) {
    var store = draftStorage();
    if (!store) return;
    var payload = {
      v: DRAFT_VERSION,
      savedAt: Date.now(),
      values: values
    };
    var prefill = draftPrefillMeta();
    if (prefill) payload.prefill = prefill;
    var boxes = draftSectionBoxState();
    if (boxes) payload.boxes = boxes;
    try {
      store.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // Quota, or storage revoked mid-session. Losing the draft is not worth
      // interrupting the form over.
    }
  }
  function clearDraft() {
    var store = draftStorage();
    if (!store) return;
    try {
      store.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) { }
  }
  // A field that is not in the DOM is left out rather than written as empty:
  // the Student block, the region select and the campus list all come and go
  // with earlier answers, and a field that is currently absent must not erase
  // what was stored for it.
  function collectDraftValues() {
    var values = {};
    draftFieldNames().forEach(function (name) {
      var nodes = qAll('[name="' + name + '"]');
      if (nodes.length === 0) return;
      var togglable = nodes.filter(function (node) {
        return node.type === "checkbox" || node.type === "radio";
      });
      if (togglable.length > 0) {
        var checked = [];
        togglable.forEach(function (node) {
          if (node.checked) checked.push(node.value);
        });
        if (checked.length > 0) values[name] = checked;
        return;
      }
      // For the guardian phone this [name] node is HubSpot's hidden mirror,
      // which is the one holding the full +61… value — exactly what
      // setPhoneValue wants back. Our injected student widget has no mirror
      // and keeps the dial code on the visible input, so both round-trip.
      var value = (nodes[0].value || "").trim();
      if (value === "") return;
      if (name === "phone" || name === "student_phone_number") {
        var parts = splitE164(value);
        // Both phone widgets pre-seed a dial code, so a bare "+61" is the
        // empty state rather than an answer.
        if (parts && parts.national === "") return;
      }
      values[name] = value;
    });
    return values;
  }
  // Contact type alone is not an answer worth restoring — it is ticked for the
  // student by default, so a draft holding only that would offer to bring back
  // nothing at all.
  function draftHasAnswers(values) {
    for (var name in values) {
      if (!Object.prototype.hasOwnProperty.call(values, name)) continue;
      if (name !== "web_form_contact_type") return true;
    }
    return false;
  }
  function saveDraftNow() {
    if (draftLocked) return;
    // After a submit HubSpot swaps the form out for its thank-you message.
    // Reading a detached tree would collect nothing and clear a live draft.
    if (!formRoot || (formRoot.isConnected === false)) return;
    var values = collectDraftValues();
    if (draftHasAnswers(values)) writeDraft(values); else clearDraft();
  }
  function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(function () {
      draftSaveTimer = null;
      saveDraftNow();
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }
  function flushDraftSave() {
    if (!draftUserTouched) return;
    if (draftSaveTimer) {
      clearTimeout(draftSaveTimer);
      draftSaveTimer = null;
    }
    saveDraftNow();
  }
  function draftValuesToContact(values) {
    function first(name) {
      var value = values[name];
      return Array.isArray(value) ? value[0] : value;
    }
    function joined(name) {
      var value = values[name];
      return Array.isArray(value) ? value.join(";") : value;
    }
    return {
      contact_type: first("web_form_contact_type"),
      firstname: values.firstname,
      lastname: values.lastname,
      // applyPrefill reads the canonical email key; the box is named email_2.
      email: values.email_2,
      phone: values.phone,
      student_first_name: values.student_first_name,
      student_last_name: values.student_last_name,
      student_email: values.student_email,
      student_phone_number: values.student_phone_number,
      state_territory_country: values.state_territory_country,
      state: values.state,
      country_dropdown: values.country_dropdown,
      which_year_are_you_interested_in_tutoring_for_: values.which_year_are_you_interested_in_tutoring_for_,
      year_level: values.year_level,
      school_text: values.school_text,
      school_code: values.school_code,
      acara_id: values.acara_id,
      program_interest: joined("program_interest"),
      web_form__interested_subject: joined("web_form__interested_subject"),
      web_form__preferred_campuses: joined("web_form__preferred_campuses"),
      referral: values.referral
    };
  }
  // Anything SECTION_DEFS lists that applyPrefill has no home for — today only
  // the no-program waitlist tick.
  function applyDraftValue(name, value) {
    if (value === undefined || value === null || value === "") return;
    var selector = '[name="' + name + '"]';
    if (Array.isArray(value)) {
      attemptCheckboxValues(selector, value);
      return;
    }
    setTextWhenPresent(selector, value, 10);
  }
  function restoreDraft(values) {
    applyPrefill(draftValuesToContact(values), null, null);
    draftFieldNames().forEach(function (name) {
      if (DRAFT_PREFILL_FIELDS.indexOf(name) !== -1) return;
      applyDraftValue(name, values[name]);
    });
  }
  /* Restoring values into HubSpot's selects is not enough on its own. The
     embed is a React app: assigning .value and dispatching change updates one
     field's state, but React re-renders the form between assignments, so any
     evaluator that fires during the restore reads the OTHER selects as empty
     — verified on staging, where the three change-driven evaluator runs each
     saw exactly one of location/intake/year level. React then commits the
     real values, but nothing runs the evaluators again, leaving the school
     box and the program cards disabled behind filled-in answers until a
     manual change fired one. So the whole derived layer is re-run on a
     settle timer after any bulk fill, the same retry pattern
     defaultContactTypeToStudent() uses for the same hydration reason. Each
     pass is idempotent, so passes that land early or twice are harmless. */
  /* HubSpot's intl-phone select lists country names alone, so "+61" only
     appears once it has been chosen — inside the number box, where Angad
     rightly read it as part of the number rather than as the country's code
     (25 Aug 2026). The code goes on the country, where it belongs, and the
     select takes the width to carry it.

     Labels only. The dial code inside the number box is HubSpot's widget
     writing it there, and it puts it straight back if it is removed — the
     value it composes for submission is read off that box, so taking the
     prefix out means owning the submitted number, which is not a thing to do
     without asking.

     PHONE_DIAL_CODES maps a code to its primary country, so countries sharing
     one (+1 for Canada, +44 for Jersey) are not in it. Those keep their plain
     name: a missing code reads as ordinary, a wrong one does not. */
  var phoneDialByIso = null;
  function dialCodeForIso(iso) {
    if (!phoneDialByIso) {
      phoneDialByIso = {};
      for (var i = 0; i < PHONE_DIAL_CODES.length; i++) phoneDialByIso[PHONE_DIAL_CODES[i][1].toUpperCase()] = PHONE_DIAL_CODES[i][0];
    }
    return phoneDialByIso[String(iso || "").toUpperCase()] || null;
  }
  var PHONE_LABELLED_ATTR = "data-contour-dial-labelled";
  var PHONE_FULL_LABEL_ATTR = "data-contour-country-label";
  /* A native select's closed box shows the selected option's own text, and
     "Australia (+61)" needs 170px where the box has 131. So the text changes
     with the state: the full name while the list is open, where there is room
     and the name is what you are scanning for, and "AU +61" once chosen, where
     all that is left to say is which country this number belongs to.

     The ISO code rather than the dial code alone, because dial codes are not
     unique — +1 is the United States and Canada both, +44 is the UK and
     Jersey. "AU" answers "which country" in a way "+61" cannot.

     On a phone the ISO goes too: the country box shares one row with the
     number box at a third of maybe 300px, and "AU (+61)" crowds it where
     "+61" sits with room. The ambiguity the ISO guards against is accepted
     there — the open list still shows full names, so the pick itself is
     never blind (Amrit, 29 Aug 2026). */
  var phoneNarrowViewport = window.matchMedia ? window.matchMedia("(max-width: 480px)") : null;
  function shortCountryLabel(opt) {
    var dial = dialCodeForIso(opt.value);
    var iso = String(opt.value || "").toUpperCase();
    if (!dial) return opt.getAttribute(PHONE_FULL_LABEL_ATTR) || opt.textContent;
    if (phoneNarrowViewport && phoneNarrowViewport.matches) return "+" + dial;
    return iso + " (+" + dial + ")";
  }
  function setCountryLabelsExpanded(select, expanded) {
    Array.prototype.forEach.call(select.options, function (opt) {
      var full = opt.getAttribute(PHONE_FULL_LABEL_ATTR);
      if (!full) return;
      var wanted = expanded || !opt.selected ? full : shortCountryLabel(opt);
      if (opt.textContent !== wanted) opt.textContent = wanted;
    });
  }
  function labelPhoneCountryOptions() {
    if (!formRoot) return;
    Array.prototype.forEach.call(formRoot.querySelectorAll(".hs-fieldtype-intl-phone select, .contour-intl-phone select"), function (select) {
      // Re-applied after a HubSpot re-render rebuilds the options, but not on
      // every pass over the same ones — 200 labels is not free.
      if (select.getAttribute(PHONE_LABELLED_ATTR) !== "1") {
        select.setAttribute(PHONE_LABELLED_ATTR, "1");
        Array.prototype.forEach.call(select.options, function (opt) {
          if (!opt.value) return;
          var dial = dialCodeForIso(opt.value);
          if (!dial) return;
          var name = (opt.textContent || "").replace(/\s*\(\+\d+\)\s*$/, "");
          opt.setAttribute(PHONE_FULL_LABEL_ATTR, name + " (+" + dial + ")");
        });
        // Full names back while the list is being read, short again once it
        // closes. focus covers the keyboard, pointerdown the mouse — the list
        // renders after both, so it is never caught mid-swap.
        select.addEventListener("focus", function () {
          setCountryLabelsExpanded(select, true);
        });
        select.addEventListener("pointerdown", function () {
          setCountryLabelsExpanded(select, true);
        });
        select.addEventListener("blur", function () {
          setCountryLabelsExpanded(select, false);
        });
        select.addEventListener("change", function () {
          setCountryLabelsExpanded(select, false);
        });
      }
      if (document.activeElement !== select) setCountryLabelsExpanded(select, false);
    });
  }
  // A rotation across the 480px line changes what the short label should
  // say, and nothing else would revisit an already-labelled select.
  if (phoneNarrowViewport && phoneNarrowViewport.addEventListener) {
    phoneNarrowViewport.addEventListener("change", function () {
      labelPhoneCountryOptions();
    });
  }
  /* The dial code sat inside the number box because HubSpot's widget puts it
     there, and it puts it straight back when removed — the value it composes
     for submission is read off that box. So the box is not fought: it is taken
     off the screen, and one of ours stands in front of it.

     One direction only. Ours holds the national number and writes
     "+<dial> <national>" through to HubSpot's, which then normalises it
     however it likes — invisibly, and without anything of ours having to be
     right about the format. There is nothing to race, because nothing is
     being contested (Amrit, 25 Aug 2026).

     HubSpot's box stays in the document rather than being removed: it is what
     the widget composes from, what carries the field name on the student's
     control, and what every check in this file already reads. It is only
     hidden, and kept out of the tab order so nobody lands in a box they
     cannot see. */
  var PHONE_PROXY_CLASS = "contour-phone-proxy";
  var PHONE_PROXY_ATTR = "data-contour-phone-proxied";
  function phoneGroupParts(group) {
    return {
      real: group.querySelector('input[type="tel"]:not(.' + PHONE_PROXY_CLASS + ')'),
      proxy: group.querySelector("." + PHONE_PROXY_CLASS),
      select: group.querySelector("select")
    };
  }
  function pushProxyThrough(group) {
    var parts = phoneGroupParts(group);
    if (!parts.real || !parts.proxy) return;
    // A pasted full international number wins over the current select: its
    // country moves onto the dropdown and only the national digits stay in
    // the box, rather than composing a second dial code in front of it.
    var pasted = (parts.proxy.value || "").trim();
    if (pasted.charAt(0) === "+" && parts.select) {
      var pastedParts = splitE164(pasted);
      if (pastedParts && selectPhoneCountryOption(parts.select, pastedParts)) {
        parts.proxy.value = pastedParts.national;
        fireInputEvents(parts.select);
      }
    }
    var dial = parts.select ? dialCodeForIso(parts.select.value) : null;
    // Read as a national number even if something put a dial code in our box:
    // whatever seeds it, only one code goes into the composed value.
    var typed = phoneNationalDigits((parts.proxy.value || "").trim());
    // Leading zeros are trunk prefixes (0412… in AU, 07… in the UK) and are
    // never part of the international number the real box carries.
    if (dial) typed = typed.replace(/^0+/, "");
    // Empty stays empty: a box holding nothing but a dial code is what made
    // "+91" read as an answered phone number in the first place.
    var next = typed === "" ? "" : (dial ? "+" + dial + " " : "") + typed;
    if (parts.real.value === next) return;
    parts.real.value = next;
    parts.real.dispatchEvent(new Event("input", { bubbles: true }));
    parts.real.dispatchEvent(new Event("change", { bubbles: true }));
  }
  // The other way — but only once, when the proxy is first built, to seed it
  // from whatever was already there: HubSpot's geo seed, a value HubSpot kept
  // across its own re-render, a draft restored before the proxy existed.
  // Never on later passes: HubSpot recomposes its own box on country switches
  // and re-renders, sometimes with the dial code doubled ("+880 880…"), and
  // pulling that back into view is what kept painting the country code into
  // the visible field on every subject click (Amrit, 1 Sep 2026).
  function pullProxyFromReal(group) {
    var parts = phoneGroupParts(group);
    if (!parts.real || !parts.proxy) return;
    if (document.activeElement === parts.proxy) return;
    var national = phoneNationalDigits(parts.real.value || "");
    if ((parts.proxy.value || "").replace(/\D/g, "") === national) return;
    parts.proxy.value = national;
  }
  var PHONE_SELECT_BOUND_ATTR = "data-contour-phone-select-bound";
  function enhancePhoneBoxes() {
    if (!formRoot) return;
    // Found by shape rather than by container class: a select next to a tel
    // box is a phone widget whoever built it. The guardian's is HubSpot's
    // .hs-fieldtype-intl-phone and the student's is a .contour-intl-phone
    // assembled elsewhere on the page, and keying off those names left the
    // student's untouched on the Guardian flow — the dial code still sitting
    // in the box, and the restored draft putting it back (Amrit, 25 Aug 2026).
    Array.prototype.forEach.call(formRoot.querySelectorAll('input[type="tel"]'), function (real) {
      if (real.classList.contains(PHONE_PROXY_CLASS)) return;
      var group = real.parentElement;
      var select = group && group.querySelector("select");
      if (!group || !select) return;
      var proxy = group.querySelector("." + PHONE_PROXY_CLASS);
      // Tagging the widget's box and building ours are separate jobs: HubSpot
      // rebuilds that box whenever the country changes, so it arrives untagged
      // again and has to be re-hidden — while the proxy beside it is still the
      // same element the visitor is typing in, and must not be replaced under
      // them (Amrit, 25 Aug 2026).
      // Unconditional, not guarded by the attribute: the widget rewrites this
      // box's class list on a country change while leaving our attribute on
      // it, so a guard here let it come back into view with the flag still
      // saying it had been dealt with. All three writes are idempotent.
      real.setAttribute(PHONE_PROXY_ATTR, "1");
      if (!real.classList.contains("contour-phone-real")) real.classList.add("contour-phone-real");
      if (real.getAttribute("tabindex") !== "-1") real.setAttribute("tabindex", "-1");
      if (real.getAttribute("aria-hidden") !== "true") real.setAttribute("aria-hidden", "true");
      var created = false;
      if (!proxy) {
        created = true;
        proxy = document.createElement("input");
        proxy.type = "tel";
        /* Deliberately NOT carrying contour-intl-phone__number. That class is
           the page's own, and the page's script is what seeds a dial code
           into the box wearing it — so borrowing it for the styling had the
           page seeding ours as well, and the write-through then put a second
           dial code in front of that. "+91 +91 123456789" fails HubSpot's own
           character check, which is the error that showed under the student's
           phone on the Guardian flow (Amrit, 25 Aug 2026). */
        proxy.className = "hs-input " + PHONE_PROXY_CLASS;
        proxy.setAttribute("inputmode", "tel");
        proxy.setAttribute("autocomplete", "tel-national");
        if (real.placeholder) proxy.placeholder = real.placeholder;
        var wrap = fieldWrapper(real);
        var label = wrap && wrap.querySelector("label");
        if (label && label.id) proxy.setAttribute("aria-labelledby", label.id);
        else if (label) proxy.setAttribute("aria-label", (label.textContent || "Phone Number").replace(/\*/g, "").trim());
        proxy.addEventListener("input", function () {
          pushProxyThrough(group);
        });
        proxy.addEventListener("change", function () {
          pushProxyThrough(group);
        });
      }
      // Kept immediately after the widget's box wherever that box has moved to.
      if (proxy.previousElementSibling !== real) real.parentNode.insertBefore(proxy, real.nextSibling);
      if (select.getAttribute(PHONE_SELECT_BOUND_ATTR) !== "1") {
        select.setAttribute(PHONE_SELECT_BOUND_ATTR, "1");
        // The dial code moved, so the composed value has to move with it —
        // after the widget has finished reseeding the box it is about to
        // rebuild.
        select.addEventListener("change", function () {
          setTimeout(function () {
            enhancePhoneBoxes();
            pushProxyThrough(group);
          }, 0);
        });
      }
      if (created) {
        pullProxyFromReal(group);
      } else if ((proxy.value || "").trim() !== "") {
        // One-way from here on: the proxy is the only box the visitor types
        // in, so every later pass re-asserts its compose over the real box —
        // undoing whatever HubSpot's re-render seeded there — instead of
        // pulling the widget's own recompositions back into view. An empty
        // proxy leaves the real box alone mid-session (the geo seed stays
        // readable); the submit sweep settles that case at the door.
        pushProxyThrough(group);
      }
    });
  }
  // SUBMIT-TIME SWEEP — the last word on what the phone fields carry out the
  // door. Mid-session HubSpot's widget may re-seed or recompose its own box
  // behind the proxy; nothing the visitor can see, and nothing worth fighting
  // over turn by turn. What must never happen is that state leaving with the
  // submission: recompose every group from its proxy, trim, and write the
  // result onto the real box and HubSpot's hidden mirror alike. An empty
  // proxy leaves an empty field — never a bare "+61 " — so a dial-only value
  // cannot land in the CRM and HubSpot's own required check keeps its voice.
  function normalizePhoneValuesForSubmit() {
    if (!formRoot) return;
    Array.prototype.forEach.call(formRoot.querySelectorAll("." + PHONE_PROXY_CLASS), function (proxy) {
      var group = proxy.parentElement;
      var parts = group ? phoneGroupParts(group) : null;
      if (!parts || !parts.real || !parts.proxy) return;
      pushProxyThrough(group);
      var composed = (parts.real.value || "").trim();
      if (parts.real.value !== composed) {
        parts.real.value = composed;
        fireInputEvents(parts.real);
      }
      var mirror = group.querySelector('input[type="hidden"]');
      if (mirror && mirror.value !== composed) {
        mirror.value = composed;
        fireInputEvents(mirror);
      }
    });
  }
  function refreshDerivedFieldState() {
    labelPhoneCountryOptions();
    enhancePhoneBoxes();
    evaluateProgramInterestOptions();
    evaluateInterestedSubjectsOptions();
    evaluateCampusOptions();
    evaluateYearLevelOptions();
    evaluateSchoolFieldVisibility();
    evaluateIntakeYearDependents();
    applyPendingPrefill();
    renderWelcomeConsultation();
    renderSubjectSummary();
    renderUcatIntakeNote();
  }
  function scheduleDerivedStateRefresh(tries) {
    if (tries === undefined) tries = 6;
    if (tries <= 0) return;
    setTimeout(function () {
      refreshDerivedFieldState();
      scheduleDerivedStateRefresh(tries - 1);
    }, 250);
  }
  function initDraftRestore() {
    if (!draftCacheEnabled()) return false;
    var entry = readDraft();
    var values = entry && entry.values;
    if (!values || !draftHasAnswers(values)) return false;
    // The prefill context comes back before the values do, so the evaluators
    // the restore fires already see the trialled subjects as taken and the
    // observer re-locks the email boxes as HubSpot re-renders them.
    if (entry.prefill) {
      // Any prefill meta at all means this draft was started on a pre-fill
      // link, so the question stays answered and hidden through the restore.
      beginPrefillLinkSession();
      prefetchedTrialSubjectCodes = entry.prefill.trial || [];
      prefetchedEnrolledSubjectCodes = entry.prefill.enrolled || [];
      (entry.prefill.locks || []).forEach(function (lock) {
        // Drafts written before the locks carried values stored bare
        // selectors; the address then comes from the draft values by name.
        var selector = typeof lock === "string" ? lock : lock.s;
        var value = typeof lock === "string" ? "" : lock.v;
        if (!value) {
          var nameMatch = /\[name="([^"]+)"\]/.exec(selector || "");
          if (nameMatch) value = values[nameMatch[1]];
          if (Array.isArray(value)) value = value[0];
        }
        recordPrefilledFieldLock(selector, value);
      });
      if (prefetchedTrialSubjectCodes.length > 0 || prefetchedEnrolledSubjectCodes.length > 0) {
        setFieldLabelText("interestedSubjects", "Additional Subjects");
      }
    }
    // Ahead of restoreDraft: the values it puts back trigger the first
    // section pass, and that pass has to see the hand-set states or it
    // collapses the cards on its own before they can be applied.
    restoreSectionBoxState(entry.boxes);
    restoreDraft(values);
    enforcePrefilledFieldLock();
    renderDraftBanner(firstNameFromDraft(values));
    scheduleDerivedStateRefresh();
    return true;
  }
  function initDraftCache() {
    if (!draftCacheEnabled()) return;
    // Only the student's own input starts a draft. Every prefill in this file
    // dispatches its own events, and those arrive with isTrusted false, so
    // this one test keeps restored and prefetched answers from being written
    // straight back as if they had been typed.
    function onUserEdit(e) {
      // Two tests, because neither is sufficient on its own: isTrusted rules
      // out this file's hand-dispatched events, and the counter rules out the
      // browser's own input/change events raised by our setCheckboxChecked
      // calling click().
      if (!e.isTrusted || isProgrammaticEdit()) return;
      draftUserTouched = true;
      if (prefillSessionLive) {
        // The form has just diverged from the record, so the URL must stop
        // claiming to be it. The draft that starts saving now carries the
        // prefill context (email locks, trialling codes) — see
        // draftPrefillMeta — so the refresh this enables loses nothing.
        prefillSessionLive = false;
        stripStudentIdFromUrl();
      }
      scheduleDraftSave();
    }
    formRoot.addEventListener("input", onUserEdit);
    formRoot.addEventListener("change", onUserEdit);
    // A backgrounded or closed tab would otherwise lose whatever is still
    // sitting in the debounce. pagehide is the one that fires reliably on iOS.
    window.addEventListener("pagehide", flushDraftSave);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushDraftSave();
    });
  }
  var CALENDLY_URLS = {
    anz: "https://calendly.com/contourmedprep/welcome-consultation-anz",
    uk: "https://calendly.com/contourmedprep/welcome-consultation-uk"
  };
  // Held subjects are skipped in both: a student already trialling UCAT has
  // had their Welcome Consultation, so their hidden tick must not resurrect
  // the Calendly block or the TestPrep booking restriction on a prefill visit.
  function isTestprepSelected() {
    var checkedSubjects = qAll(FIELD_SELECTORS.interestedSubjects + ":checked");
    for (var i = 0; i < checkedSubjects.length; i++) {
      if (isHeldSubjectOption(checkedSubjects[i])) continue;
      if (getClassification(checkedSubjects[i]).program === "TestPrep") return true;
    }
    return false;
  }
  function isUcatSelected() {
    var checkedSubjects = qAll(FIELD_SELECTORS.interestedSubjects + ":checked");
    for (var i = 0; i < checkedSubjects.length; i++) {
      if (isHeldSubjectOption(checkedSubjects[i])) continue;
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
  // The open-soon note renders at the UCAT intake note's anchor — directly
  // above the subjects summary — not in the scheduler's slot after Campus,
  // so the two yellow notes always sit in the same place (Amrit, 22 Aug).
  function ensureWcOpenSoonNote() {
    var existing = formRoot.querySelector("#contour-wc-open-soon-note");
    if (existing) return existing;
    var summary = ensureSubjectSummary();
    var note = document.createElement("p");
    note.id = "contour-wc-open-soon-note";
    note.className = "contour-welcome-consultation__waitlist-note contour-ucat-intake-note contour-welcome-consultation__open-soon-note";
    note.style.display = "none";
    summary.parentNode.insertBefore(note, summary);
    return note;
  }
  function renderWelcomeConsultation() {
    var wrapper = ensureWelcomeConsultationContainer();
    var ucat = isUcatSelected();
    var testprep = isTestprepSelected();
    // UCAT students can't book a consultation while enrolments are closed —
    // they see the waitlist note instead. Selective Entry is unaffected, so
    // both can be on screen at once when the two are selected together.
    var audiences = [];
    if (ucat && UCAT_ENROLMENTS_OPEN) audiences.push("UCAT");
    if (testprep) audiences.push("Selective Entry & Scholarship");
    var showScheduler = audiences.length > 0 && WC_BOOKINGS_OPEN;
    var showOpenSoonNote = audiences.length > 0 && !WC_BOOKINGS_OPEN;
    var noteEl = ensureWcOpenSoonNote();
    if (noteEl) {
      noteEl.textContent = WC_OPEN_SOON_NOTE;
      noteEl.style.display = showOpenSoonNote ? "" : "none";
    }
    if (!showScheduler) {
      wrapper.style.display = "none";
      var idleWidget = wrapper.querySelector(".contour-welcome-consultation__widget");
      if (idleWidget) {
        idleWidget.innerHTML = "";
        idleWidget.style.display = "none";
      }
      return;
    }
    wrapper.style.display = "";
    var headingEl = wrapper.querySelector(".contour-welcome-consultation__heading");
    var copyEl = wrapper.querySelector(".contour-welcome-consultation__copy");
    if (headingEl) headingEl.style.display = "";
    if (copyEl) {
      copyEl.style.display = "";
      copyEl.textContent = "New " + audiences.join(" and ") + " students are required to book a Welcome Consultation before a trial can be booked. Please register your consultation below before completing the rest of this form.";
    }
    var schedulerContainer = wrapper.querySelector(".contour-welcome-consultation__widget");
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
  // The UCAT note used to sit inside the Welcome Consultation block, below the
  // subject summary. Amitav asked for it above "Your Subjects", so it is its
  // own element anchored to the summary — it has to be inserted before the
  // summary exists, hence ensureSubjectSummary() runs first.
  //
  // It stays a block note rather than an info tooltip like the Interview
  // Program one: it runs to several sentences, it tells the student what
  // submitting does rather than annotating a single subject, and a hover-only
  // bubble would never open on touch devices.
  function ensureUcatIntakeNote() {
    var existing = formRoot.querySelector("#contour-ucat-intake-note");
    if (existing) return existing;
    var summary = ensureSubjectSummary();
    var note = document.createElement("p");
    note.id = "contour-ucat-intake-note";
    note.className = "contour-welcome-consultation__waitlist-note contour-ucat-intake-note";
    note.style.display = "none";
    summary.parentNode.insertBefore(note, summary);
    return note;
  }
  function renderUcatIntakeNote() {
    var note = ensureUcatIntakeNote();
    var intake = getValue(FIELD_SELECTORS.intakeYear);
    var show = isUcatSelected() && !UCAT_ENROLMENTS_OPEN && intake === UCAT_NOTICE_INTAKE;
    note.textContent = UCAT_INTAKE_NOTE;
    note.style.display = show ? "" : "none";
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
    heading.textContent = "Subjects Summary";
    container.appendChild(heading);
    var grid = document.createElement("div");
    grid.className = "contour-subject-summary__grid";
    container.appendChild(grid);
    var subjectsField = q(FIELD_SELECTORS.interestedSubjects);
    var subjectsWrap = subjectsField ? fieldWrapper(subjectsField) : null;
    // Anchored after the whole fieldset row, not after the field inside it:
    // when every option is held the row collapses (collapseEmptyFieldset),
    // and a summary sitting inside it vanished with the row even though the
    // trialing and enrolled chips are exactly what should still show there
    // (Amrit, 31 Aug 2026).
    var subjectsRow = subjectsWrap && subjectsWrap.closest ? subjectsWrap.closest("fieldset[class*=form-columns-]") : null;
    var summaryAnchor = subjectsRow || subjectsWrap;
    if (summaryAnchor && summaryAnchor.parentNode) {
      summaryAnchor.parentNode.insertBefore(container, summaryAnchor.nextSibling);
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
    var interested = qAll(FIELD_SELECTORS.interestedSubjects + ":checked").filter(function (opt) {
      // Held subjects already sit in the Trialing/Enrolled columns below;
      // their hidden submission tick must not duplicate them up here.
      return !isHeldSubjectOption(opt);
    }).map(function (opt) {
      return optionLabelText(opt);
    });
    var trialing = prefetchedTrialSubjectCodes.map(subjectCodeToLabel);
    var enrolled = prefetchedEnrolledSubjectCodes.map(subjectCodeToLabel);
    var columns = [{
      title: "Your Interested Subject" + (interested.length === 1 ? "" : "s"),
      items: interested,
      chipClass: "contour-subject-chip--navy"
    }, {
      title: "Your Trialing Subject" + (trialing.length === 1 ? "" : "s"),
      items: trialing,
      chipClass: "contour-subject-chip--lime"
    }, {
      title: "Your Enrolled Subject" + (enrolled.length === 1 ? "" : "s"),
      items: enrolled,
      chipClass: "contour-subject-chip--blue"
    }];
    grid.innerHTML = "";
    var visibleColumns = columns.filter(function (col) {
      return col.items.length > 0;
    });
    // One column: its title is the box heading and the per-column subheader
    // would just repeat it, so only the chips render. From two columns up
    // the box reverts to "Subjects Summary" with a subheader per section.
    // Re-evaluated every render, so a prefilled box (trialing/enrolled only)
    // grows headers the moment picking a subject adds a second column.
    var heading = container.querySelector(".contour-subject-summary__heading");
    heading.textContent = visibleColumns.length === 1 ? visibleColumns[0].title : "Subjects Summary";
    visibleColumns.forEach(function (col) {
      var colEl = document.createElement("div");
      colEl.className = "contour-subject-summary__col";
      if (visibleColumns.length > 1) {
        var title = document.createElement("div");
        title.className = "contour-subject-summary__col-title";
        title.textContent = col.title;
        colEl.appendChild(title);
      }
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
    container.style.display = visibleColumns.length ? "" : "none";
  }
  function attachListeners() {
    var locationEl = q(FIELD_SELECTORS.location);
    if (locationEl) {
      locationEl.addEventListener("change", function () {
        clearRegionWhenNotApplicable();
        enhanceRegionField();
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
        renderUcatIntakeNote();
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
        renderSubjectSummary();
        renderUcatIntakeNote();
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
  function ensureSchoolNotFoundHint() {
    var input = q(FIELD_SELECTORS.schoolText);
    var wrap = input ? fieldWrapper(input) : null;
    if (!wrap) return null;
    var existing = wrap.querySelector("#contour-school-not-found");
    if (existing) return existing;
    if (!document.getElementById("contour-school-hint-styles")) {
      var style = document.createElement("style");
      style.id = "contour-school-hint-styles";
      style.textContent = ".hs-form .contour-school-not-found { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0 0; padding: 10px 12px; border: 1px solid #cfe0ff; border-radius: 10px; background: #F2F7FF; color: #0C3166; font-size: 13px; line-height: 1.45; font-weight: 600; }" +
        ".hs-form .contour-school-not-found__icon { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-top: 1px; border-radius: 50%; background: #3478F7; color: #FFFFFF; font-size: 11px; font-weight: 700; line-height: 1; }";
      document.head.appendChild(style);
    }
    var hint = document.createElement("p");
    hint.id = "contour-school-not-found";
    hint.className = "contour-school-not-found";
    hint.style.display = "none";
    // Announced politely so a screen reader hears it when a search dead-ends,
    // without stealing focus from the input mid-typing.
    hint.setAttribute("role", "status");
    hint.setAttribute("aria-live", "polite");
    var icon = document.createElement("span");
    icon.className = "contour-school-not-found__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "i";
    hint.appendChild(icon);
    var text = document.createElement("span");
    text.className = "contour-school-not-found__text";
    hint.appendChild(text);
    var searchWrap = input.closest(".contour-school-search");
    var anchor = searchWrap || input;
    if (anchor.parentNode) anchor.parentNode.insertBefore(hint, anchor.nextSibling);
    else wrap.appendChild(hint);
    return hint;
  }
  // mode: "typing" while the query is too short to search, "notfound" once a
  // search came back empty, false to hide. Both messages push the student to
  // keep typing — stopping at a few characters and giving up is the case this
  // is here to prevent.
  function setSchoolNotFoundHint(mode) {
    var hint = ensureSchoolNotFoundHint();
    if (!hint) return;
    if (mode) {
      hint.querySelector(".contour-school-not-found__text").textContent =
        mode === "notfound" ? schoolNotFoundHint() : schoolTypeMoreHint();
    }
    hint.style.display = mode ? "" : "none";
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
    var MIN_CHARS = SCHOOL_MIN_SEARCH_CHARS;
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
        // Nothing matched — this is the moment the fallback instruction is
        // actually useful, so surface it under the field.
        setSchoolNotFoundHint("notfound");
        return;
      }
      setSchoolNotFoundHint(false);
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
      setSchoolNotFoundHint(false);
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
        setSchoolNotFoundHint(query.length > 0 ? "typing" : false);
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
  /* =========================================================
     YOUR REGION — dropdown over a single-line text property
     -----------------------------------------------------------
     `state` is a text property, so the HubSpot form editor can only render it
     as a free-text box. Free text would drift away from the region codes the
     matrix keys on, so the text input stays as the value carrier (HubSpot
     serialises and validates it exactly as before) and a <select> is injected
     in front of it. Picking an option writes the code into the input and
     fires input/change, which is what keeps HubSpot's own state — and its
     required-field error — in step.
  ========================================================= */
  function injectRegionStyles() {
    if (document.getElementById("contour-region-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-region-styles";
    // The input is visually hidden rather than display:none so it stays a
    // real, focusable form control: HubSpot focuses it when its required
    // error fires, and enhanceRegionField() bounces that focus to the select.
    // The header CSS sizes .hs-input with !important, so every dimension here
    // has to match it — without that the input stays a full-width, clipped but
    // still clickable overlay sitting on top of the select.
    style.textContent = ".hs-form .contour-region { width: 100%; box-sizing: border-box; }" + '.hs-form select.contour-region__select:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { width: 100% !important; }' + '.hs-form input.contour-region__value:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { position: absolute !important; width: 1px !important; height: 1px !important; min-width: 0 !important; min-height: 0 !important; padding: 0 !important; margin: -1px !important; border: 0 !important; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; pointer-events: none; }';
    document.head.appendChild(style);
  }
  function regionsForLocation(location) {
    return REGIONS_BY_LOCATION[location] || null;
  }
  function regionOptionsForLocation(location) {
    var regions = regionsForLocation(location);
    if (!regions) return null;
    return regions.concat([{
      code: REGION_OTHER_CODE,
      name: REGION_OTHER_NAME
    }]);
  }
  // Prefilled and hand-entered values arrive as either a code or a region
  // name, so accept both and normalise to the code.
  function regionCodeForValue(options, value) {
    var wanted = String(value || "").trim().toLowerCase();
    if (!wanted) return "";
    for (var i = 0; i < options.length; i++) {
      if (options[i].code.toLowerCase() === wanted) return options[i].code;
      if (options[i].name.toLowerCase() === wanted) return options[i].code;
    }
    return "";
  }
  function setRegionValue(input, value) {
    input.value = value || "";
    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));
    input.dispatchEvent(new Event("change", {
      bubbles: true
    }));
  }
  function enhanceRegionField() {
    var input = q(FIELD_SELECTORS.region);
    if (!input || input.type === "hidden") return;
    var location = getValue(FIELD_SELECTORS.location);
    var options = regionOptionsForLocation(location);
    var group = input.closest(".contour-region");
    if (group) {
      // Already enhanced. Rebuild only when the location moved to a different
      // region set, so the options match the country that's now selected.
      if (group.getAttribute("data-contour-region-location") === location) return;
      group.parentNode.insertBefore(input, group);
      group.parentNode.removeChild(group);
      input.classList.remove("contour-region__value");
    }
    // No region list for this location: leave HubSpot's own text input alone.
    if (!options) return;
    var parent = input.parentElement;
    if (!parent) return;
    group = document.createElement("div");
    group.className = "contour-region";
    group.setAttribute("data-contour-region-location", location);
    var select = document.createElement("select");
    select.className = "hs-input contour-region__select";
    select.setAttribute("aria-label", "Your Region");
    var placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = REGION_PLACEHOLDER;
    // Disabled, like the placeholder on every HubSpot select on this form: it
    // is what the closed box reads before a choice is made, not a choice.
    placeholder.disabled = true;
    select.appendChild(placeholder);
    options.forEach(function (region) {
      var opt = document.createElement("option");
      opt.value = region.code;
      opt.textContent = region.name;
      select.appendChild(opt);
    });
    parent.insertBefore(group, input);
    group.appendChild(select);
    group.appendChild(input);
    input.classList.add("contour-region__value");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("tabindex", "-1");
    function syncSelectFromInput() {
      var code = regionCodeForValue(options, input.value);
      select.value = code;
      // A name (or anything unrecognised) came in from elsewhere — rewrite it
      // as the code so what gets submitted always matches the matrix.
      if (code !== (input.value || "").trim()) setRegionValue(input, code);
    }
    syncSelectFromInput();
    select.addEventListener("change", function () {
      setRegionValue(input, select.value);
    });
    // Prefill writes straight into the input; mirror it onto the select.
    input.addEventListener("change", syncSelectFromInput);
    input.addEventListener("focus", function () {
      // The carrier input is clipped to 1px on top of the select, so the page
      // is already in the right place — bouncing without preventScroll adds a
      // second, redundant jump.
      focusQuietly(select);
    });
  }
  function watchRegionField() {
    // The field is conditional on Your Location, so it isn't in the DOM at
    // init, and HubSpot re-renders it whenever native validation fires — the
    // same behaviour watchSchoolFieldRerender() handles. enhanceRegionField()
    // is idempotent, so its own mutations no-op on the next callback.
    var observer = new MutationObserver(function () {
      enhanceRegionField();
    });
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  // Switching away from a location that has regions leaves a stale code on a
  // field the student can no longer see, so blank it on the way out.
  function clearRegionWhenNotApplicable() {
    var input = q(FIELD_SELECTORS.region);
    if (!input || !input.value) return;
    if (regionsForLocation(getValue(FIELD_SELECTORS.location))) return;
    setRegionValue(input, "");
  }
  /* =========================================================
     ERROR FOCUS AND SCROLL
     -----------------------------------------------------------
     Each submit gate below blocks the form on its own, so without a single
     owner for "where does the page go now" they contradict each other: the
     scroll batch picks the topmost error while whichever gate happens to be
     registered last wins the focus() call, leaving the caret in a different
     field from the one on screen. A bare focus() also scrolls its element
     into view instantly, so the smooth scroll a tick later starts from the
     wrong place and glides away from where it just jumped.

     reportFieldError() takes both halves together, batches every gate that
     fires on the same submit, and moves the page exactly once: to the first
     error in document order, caret in that same field, scroll suppressed on
     the focus so the only movement is the one smooth scroll.
     ========================================================= */
  var pendingErrorReports = null;
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function focusQuietly(el) {
    if (!el || !el.focus) return;
    // Browsers that ignore the options object simply scroll as before rather
    // than throwing; the catch is for the ones that do throw on it.
    try {
      el.focus({
        preventScroll: true
      });
    } catch (e) {
      el.focus();
    }
  }
  // The control the caret should land on for a field. Not just the first
  // input in the wrapper: the school field, the internal-only dropdowns and
  // the region field all keep their real control in the DOM but off screen
  // behind an injected combobox or select, and focusing one of those looks
  // exactly like the form ignoring the click.
  function focusTargetIn(wrap) {
    if (!wrap || !wrap.querySelectorAll) return null;
    var candidates = wrap.querySelectorAll("input, select, textarea");
    var fallback = null;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.disabled || el.type === "hidden") continue;
      if (!fallback) fallback = el;
      if (el.getClientRects && el.getClientRects().length === 0) continue;
      return el;
    }
    // Nothing reported a box — an environment without layout rather than a
    // field with nothing focusable in it. Focusing the first candidate is
    // still better than leaving the caret where the submit button was.
    return fallback;
  }
  // Centring a field taller than the screen puts the message that explains
  // the problem below the fold — the subjects grid does exactly that. Centre
  // the message itself in that case, which still keeps the field in shot.
  function scrollTargetFor(anchor) {
    if (!anchor || !anchor.getBoundingClientRect) return anchor;
    var viewport = window.innerHeight || 0;
    if (!viewport || anchor.getBoundingClientRect().height <= viewport * 0.8) return anchor;
    var lists = anchor.querySelectorAll(".hs-error-msgs");
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].getClientRects().length > 0) return lists[i];
    }
    return anchor;
  }
  function reportFieldError(anchorEl, focusEl) {
    var anchor = anchorEl || focusEl;
    if (!anchor) return;
    var report = {
      anchor: anchor,
      focus: focusEl || null
    };
    if (pendingErrorReports) {
      pendingErrorReports.push(report);
      return;
    }
    pendingErrorReports = [report];
    setTimeout(function () {
      var reports = pendingErrorReports;
      pendingErrorReports = null;
      var best = reports[0];
      for (var i = 1; i < reports.length; i++) {
        // Document order, not viewport position: "the first problem on the
        // page" is the same answer wherever the student is currently
        // scrolled to, and two errors can share a scroll offset.
        if (best.anchor.compareDocumentPosition(reports[i].anchor) & Node.DOCUMENT_POSITION_PRECEDING) {
          best = reports[i];
        }
      }
      var target = scrollTargetFor(best.anchor);
      noteIntentionalScroll();
      if (target && target.scrollIntoView) target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "center"
      });
      focusQuietly(best.focus);
    }, 0);
  }
  /* =========================================================
     FORM-LEVEL ERROR SUMMARY
     -----------------------------------------------------------
     HubSpot's "Please complete all required fields." rollup renders with the
     same .hs-error-msgs markup as a single field's error, so at the bottom of
     a column of red lines it reads as one more of them rather than as the
     summary of them all. Restyled into an alert card — badge, tinted panel,
     heavier text — so it separates from the field errors it is summarising
     (Amrit, 20 Aug 2026).

     Tagged from JS rather than styled straight off HubSpot's own class name:
     the rollup is the only .hs-error-msgs list that sits outside a field
     wrapper, and that structural test survives the embed bundle renaming
     things. .hs_error_rollup is still trusted first where it is present.
     ========================================================= */
  var ERROR_ROLLUP_CLASS = "contour-error-rollup";
  function injectErrorRollupStyles() {
    if (document.getElementById("contour-error-rollup-styles")) return;
    var card = ".hs-form ." + ERROR_ROLLUP_CLASS;
    var style = document.createElement("style");
    style.id = "contour-error-rollup-styles";
    style.textContent = "" + card + " { display: flex; align-items: center; gap: 12px; box-sizing: border-box; margin: 1.5rem 0 0 !important; padding: 14px 18px !important; border: 1px solid rgba(200, 16, 46, 0.22); border-left: 4px solid #c8102e; border-radius: 12px; background: #FDF3F4; box-shadow: 0 1px 3px rgba(200, 16, 46, 0.08); list-style: none; }" + card + "::before { content: \"!\"; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #c8102e; color: #FFFFFF; font-size: 13px; font-weight: 700; line-height: 1; }" + card + " ul, " + card + " .hs-error-msgs { margin: 0 !important; padding: 0 !important; list-style: none; }" +
      // The page header sets .hs-form .hs-error-msgs li { display: block;
      // width: 100% } with !important, which would push the badge out of a flex
      // row, so the width has to be handed back explicitly.
      card + " li, " + card + " label { width: auto !important; flex: 1 1 auto; margin: 0 !important; padding: 0 !important; color: #8A0C22 !important; font-size: 0.95rem !important; font-weight: 600 !important; line-height: 1.4 !important; }" + "@media (prefers-reduced-motion: no-preference) { " + card + " { animation: contour-rollup-in 0.22s ease-out; } }" + "@keyframes contour-rollup-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }";
    document.head.appendChild(style);
  }
  function tagErrorRollup() {
    if (!formRoot) return;
    var lists = formRoot.querySelectorAll(".hs-error-msgs");
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      var host = list.closest(".hs_error_rollup");
      // A field's own error always lives inside that field's wrapper, whether
      // HubSpot rendered it or one of the gates above appended it. Anything
      // left over is the form-level rollup.
      if (!host && list.closest("." + FIELD_WRAPPER_CLASS)) continue;
      var card = host || list;
      if (!card.classList.contains(ERROR_ROLLUP_CLASS)) card.classList.add(ERROR_ROLLUP_CLASS);
      // HubSpot only draws this after a post came back rejected, so it is also
      // the signal that the button should stop saying "Submitting…". Our own
      // summary stands down so the two can never stack.
      markSubmitBusy(false);
      hideFormErrorSummary();
    }
  }
  function watchErrorRollup() {
    // HubSpot builds the rollup fresh on each failed submit and drops it again
    // on the next render, so the class is re-applied rather than set once.
    // Only childList is observed, so adding the class cannot re-trigger this.
    tagErrorRollup();
    var observer = new MutationObserver(tagErrorRollup);
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  /* =========================================================
     SUBMIT GATE — one pass, every error at once
     -----------------------------------------------------------
     Each check used to own a submit listener that called
     stopImmediatePropagation(), so the first failure killed every later check
     as well as HubSpot's own validation. A student with three problems was
     shown them one submit at a time, and HubSpot's required-field messages
     could never appear in the same round as ours — which also meant the form
     level summary never rendered when one of our checks was the blocker.

     Every check registers here instead. One capture-phase listener runs all
     of them, shows all their errors, and blocks once. HubSpot's own required
     fields join the same pass: they are found from the native asterisk and
     nudged into drawing their message with a synthetic blur/focusout, which
     is how HubSpot renders it normally — confirmed against the live staging
     form, where it needs no submit to fire.
     ========================================================= */
  var submitValidators = [];
  var submitGateBound = false;
  // { isValid: fn -> bool, showError: fn, anchor: fn -> field wrapper }
  function registerSubmitValidator(validator) {
    submitValidators.push(validator);
    if (submitGateBound || !formRoot) return;
    submitGateBound = true;
    formRoot.addEventListener("submit", runSubmitGate, true);
  }
  // Real visibility, not just this element's own inline flag: a field inside a
  // section that has not been disclosed yet is display:none two levels up, and
  // every check has to read that as absent rather than as unanswered.
  function isElementVisible(el) {
    if (!el) return false;
    // A field resting behind the inactive person tab is hidden presentation,
    // not an absent field — it still has to be answered, and the error
    // summary brings its tab forward. Without this the gate would wave an
    // empty Student tab through.
    if (el.closest && el.closest("[data-contour-tab-hidden]")) return true;
    if (el.getClientRects && el.getClientRects().length > 0) return true;
    if (el.offsetParent) return true;
    // Nothing has layout in a headless harness, so fall back to walking the
    // inline display flags this file sets itself.
    for (var node = el; node && node.style; node = node.parentElement) {
      if (node.style.display === "none" || node.hidden) return false;
    }
    return true;
  }
  // Judged on the controls that actually carry a submitted value. The school
  // combobox's search box holds display text with no name, and HubSpot's
  // intl-phone group pairs the number with a country select that always has a
  // value, so both would otherwise read as answered while empty.
  /* The school box is a search, not a text field: every keystroke leaves a
     value behind, and the generic "has a value" test read the first letter as
     an answer — enough to mark Academic Details finished, fold it, and file
     the summary as "VIC · Year 9 · 2026 intake · d" (Amrit, 23 Aug).

     It counts as answered once the student has landed on something: a school
     picked from the list (which fills the hidden code), or a name long enough
     to search on that they have since moved on from. While the caret is still
     in the box they are mid-word, whatever is in there. Submission is
     unchanged — any non-empty name is still accepted, since plenty of schools
     are not on the list. */
  function schoolAnswerSettled(input) {
    // The visible box has the last word. HubSpot ships this form with
    // school_code defaulted to "NULL" and acara_id to "1", so the hidden
    // mirrors read as an answered school from first paint — which marked
    // Academic Details complete before anyone had typed a character. They
    // still settle the question early for a picked suggestion, but only over
    // a name that is actually on screen (Amrit, 23 Aug 2026).
    var typed = (input.value || "").trim();
    if (typed === "") return false;
    if (getValue(FIELD_SELECTORS.schoolCode) || getValue(FIELD_SELECTORS.acaraId)) return true;
    if (typed.length < SCHOOL_MIN_SEARCH_CHARS) return false;
    return document.activeElement !== input;
  }
  /* "Answered" and "answered acceptably" are different questions. HubSpot
     draws its verdict on a field into the field's own error list, and it does
     so synchronously on blur — so a visible message IS the verdict, with no
     race to beat. Completeness reads it: a card holding a rejected answer is
     not a finished card, however non-empty its fields are. Without this, an
     email of "ahsdj" folded Contact Information behind a lime tick with
     HubSpot's own "Please enter a valid email address." still inside it
     (Angad, 24 Aug 2026). display is read rather than geometry so the check
     keeps working inside a folded card. */
  function fieldWrapperInvalid(wrap) {
    if (!wrap || !wrap.querySelectorAll) return false;
    var lists = wrap.querySelectorAll(".hs-error-msgs");
    for (var i = 0; i < lists.length; i++) {
      if (lists[i].style.display === "none") continue;
      if ((lists[i].textContent || "").trim() === "") continue;
      return true;
    }
    return false;
  }
  function fieldWrapperAnswered(wrap) {
    if (!wrap || !wrap.querySelectorAll) return true;
    var school = wrap.querySelector('input[name="school_text"]');
    if (school) return schoolAnswerSettled(school);
    var tel = wrap.querySelector('input[type="tel"]');
    if (tel) {
      // The hidden mirror carries what actually gets submitted, so it settles
      // this outright when HubSpot has accepted a number.
      var mirror = wrap.querySelector('input[type="hidden"][name]');
      if (mirror && (mirror.value || "").trim() !== "") return true;
      // Otherwise judge the visible box on its national digits: the intl-phone
      // widget seeds it with the dial code, so an untouched field reads "+61 "
      // rather than empty and would count as answered. phoneNationalDigits()
      // takes the longest matching code off the front, which beats guessing at
      // a length — +1, +61 and +212 are all real.
      return phoneNationalDigits((tel.value || "").trim()) !== "";
    }
    var boxes = wrap.querySelectorAll('input[name][type="checkbox"], input[name][type="radio"]');
    if (boxes.length > 0) {
      for (var i = 0; i < boxes.length; i++) {
        if (boxes[i].checked) return true;
      }
      return false;
    }
    var controls = wrap.querySelectorAll("input[name], select[name], textarea[name]");
    for (var j = 0; j < controls.length; j++) {
      if (controls[j].disabled) continue;
      if ((controls[j].value || "").trim() !== "") return true;
    }
    return false;
  }
  function nativeRequiredFailures() {
    if (!formRoot) return [];
    var out = [];
    var wraps = formRoot.querySelectorAll("." + FIELD_WRAPPER_CLASS);
    for (var i = 0; i < wraps.length; i++) {
      var wrap = wraps[i];
      if (!hasNativeRequiredMark(wrap)) continue;
      if (!isElementVisible(wrap)) continue;
      if (fieldWrapperAnswered(wrap)) continue;
      out.push(wrap);
    }
    return out;
  }
  function nudgeNativeValidation(wrap) {
    var control = wrap.querySelector('input[type="tel"]') || wrap.querySelector("input[name]:not([type=hidden]), select[name], textarea[name]");
    if (!control || control.disabled) return;
    try {
      control.dispatchEvent(new FocusEvent("blur", {
        bubbles: false
      }));
      control.dispatchEvent(new FocusEvent("focusout", {
        bubbles: true
      }));
    } catch (err) {
      /* A browser without the FocusEvent constructor simply keeps the old
         behaviour of HubSpot's message arriving on the next submit. */
    }
  }
  var NATIVE_FALLBACK_CLASS = "contour-required-fallback";
  // HubSpot draws its own message from a blur handler for most field types,
  // but not for the consent checkbox, which it only validates during a submit
  // it now never gets to run. Anything still unmarked shortly after the nudge
  // gets our message instead, so a field named in the summary is never left
  // looking fine on the form itself.
  function ensureNativeRequiredFallback(wrap) {
    var hubspotSpoke = Array.prototype.some.call(wrap.querySelectorAll(".hs-error-msgs"), function (el) {
      return el.style.display !== "none" && !el.classList.contains(NATIVE_FALLBACK_CLASS);
    });
    var own = wrap.querySelector("." + NATIVE_FALLBACK_CLASS);
    if (hubspotSpoke) {
      if (own) own.style.display = "none";
      return;
    }
    if (!own) {
      own = document.createElement("ul");
      own.className = "no-list hs-error-msgs inputs-list " + NATIVE_FALLBACK_CLASS;
      own.setAttribute("role", "alert");
      var item = document.createElement("li");
      var label = document.createElement("label");
      label.className = "hs-error-msg hs-main-font-element";
      label.textContent = "Please complete this required field.";
      item.appendChild(label);
      own.appendChild(item);
      wrap.appendChild(own);
    }
    own.style.removeProperty("display");
  }
  // At most one message per field, and never the same sentence twice.
  //
  // The standby message above is written when HubSpot has said nothing shortly
  // after the nudge — but HubSpot renders its own required message on a *real*
  // blur, which a synthetic one does not reproduce on a text input. So a
  // student who submits, then tabs through the fields they missed, collects
  // HubSpot's message underneath ours, word for word.
  //
  // Reconciling on a timer could never close that: the second message arrives
  // whenever the person happens to touch the field. This runs instead from the
  // observer already watching the form, so HubSpot inserting a message is
  // itself what retires ours.
  function dedupeFieldErrors() {
    if (!formRoot) return;
    Array.prototype.forEach.call(formRoot.querySelectorAll("." + FIELD_WRAPPER_CLASS), function (wrap) {
      var visible = [];
      Array.prototype.forEach.call(wrap.querySelectorAll(".hs-error-msgs"), function (list) {
        if (list.style.display !== "none") visible.push(list);
      });
      if (visible.length < 2) return;
      var real = visible.filter(function (list) {
        return !list.classList.contains(NATIVE_FALLBACK_CLASS);
      });
      // The standby only ever existed to cover for a message that never came.
      // Anything else on the field makes it redundant, whatever it says.
      if (real.length > 0) {
        visible.forEach(function (list) {
          if (list.classList.contains(NATIVE_FALLBACK_CLASS)) list.style.display = "none";
        });
      }
      // Beyond that, only collapse messages that read identically — two checks
      // with genuinely different things to say must both be allowed to speak.
      var seen = {};
      (real.length > 0 ? real : visible).forEach(function (list) {
        var text = (list.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (!text) return;
        if (seen[text]) {
          list.style.display = "none";
          return;
        }
        seen[text] = true;
      });
    });
  }
  function clearAnsweredRequiredFallbacks() {
    if (!formRoot) return;
    Array.prototype.forEach.call(formRoot.querySelectorAll("." + NATIVE_FALLBACK_CLASS), function (el) {
      var wrap = el.closest("." + FIELD_WRAPPER_CLASS);
      if (wrap && fieldWrapperAnswered(wrap)) el.style.display = "none";
    });
  }
  function documentOrder(a, b) {
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }
  function runSubmitGate(e) {
    hideFormErrorSummary();
    // Recomputed here as well as on every pass: this is the value that
    // actually leaves with the submission, and it must match the answers as
    // they stand at this moment.
    updateCanAddMoreSubjects();
    // Before any validator looks: the phone values are recomposed from the
    // visible boxes and trimmed, so both the checks below and the submission
    // itself see the settled value, never HubSpot's mid-session reseeding.
    normalizePhoneValuesForSubmit();
    // Enter in a text box reaches the gate before progressive disclosure has
    // opened every section. Nobody should be told to fix a field they cannot
    // see, so any submit attempt opens the whole form first.
    //
    // Step mode keeps its locks instead. Everything the form has not asked yet
    // is already visible as a pending card, so there is nothing hidden to
    // reveal — and taking the locks off turned a submit on an empty form into
    // thirteen red fields, most of them questions nobody had been asked. It
    // reports what the visitor can act on now, and marks the cards holding it.
    if (!stepModeEnabled()) revealAllSections();
    var failures = [];
    for (var i = 0; i < submitValidators.length; i++) {
      var valid = true;
      try {
        valid = submitValidators[i].isValid();
      } catch (err) {
        // A check that throws must not be able to wedge the form shut.
        valid = true;
      }
      if (!valid) failures.push(submitValidators[i]);
    }
    var native = nativeRequiredFailures();
    if (failures.length === 0 && native.length === 0) {
      markSubmitBusy(true);
      // The answers are on their way, so the draft has done its job. Not
      // locked: if HubSpot rejects the post the values are still in the DOM
      // and the next edit starts a fresh draft.
      clearDraft();
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    // The decision to block used the unfiltered lists — an unreachable field
    // still stops the form. Only the reporting narrows.
    if (stepModeEnabled()) {
      failures = failures.filter(function (validator) {
        var wrap = null;
        try {
          wrap = validator.anchor();
        } catch (err) { }
        return stepSectionReportable(wrap);
      });
      native = native.filter(stepSectionReportable);
    }
    var flagged = [];
    failures.forEach(function (validator) {
      try {
        validator.showError();
      } catch (err) { }
      var wrap = null;
      try {
        wrap = validator.anchor();
      } catch (err) { }
      if (wrap && flagged.indexOf(wrap) === -1) flagged.push(wrap);
    });
    native.forEach(function (wrap) {
      // Skip anything one of our own checks has already spoken for, so a
      // single field never collects two messages.
      if (flagged.indexOf(wrap) !== -1) return;
      nudgeNativeValidation(wrap);
      reportFieldError(wrap, focusTargetIn(wrap));
      flagged.push(wrap);
    });
    if (stepModeEnabled()) {
      submitAttempted = true;
      lastStepReportKey = null;
      flagStepSections(flagged);
    }
    showFormErrorSummary(flagged);
    // HubSpot renders a nudged message on its own schedule. Two passes: the
    // first fills in anything it declined to mark, the second stands our
    // message down again if it turned out to be merely slow.
    [160, 650].forEach(function (delay) {
      setTimeout(function () {
        native.forEach(ensureNativeRequiredFallback);
        dedupeFieldErrors();
        syncFieldErrorAria();
      }, delay);
    });
  }
  /* =========================================================
     ERROR SUMMARY — the blocked fields, as links
     -----------------------------------------------------------
     Replaces HubSpot's "Please complete all required fields." for the rounds
     we block, which is now most of them. On a form this long, naming the
     fields and letting the student jump straight to one is the difference
     between the summary being decoration and being the fastest way through.
     ========================================================= */
  var ERROR_SUMMARY_ID = "contour-error-summary";
  // Read off the live label wherever possible, so the guardian relabelling is
  // picked up for free. Only the fields whose label is hidden or unhelpful
  // need naming here.
  var FIELD_SUMMARY_NAMES = {
    web_form__interested_subject: "Interested Subjects",
    tos_privacy_consent: "Terms of Service and Privacy Policy",
    join_no_program_waitlist: "Programs waitlist"
  };
  function fieldSummaryLabel(wrap) {
    var named = wrap ? wrap.querySelector("[name]") : null;
    if (named && FIELD_SUMMARY_NAMES[named.name]) return FIELD_SUMMARY_NAMES[named.name];
    var label = wrap ? wrap.querySelector("label") : null;
    var text = label ? label.textContent.replace(/\s+/g, " ").trim() : "";
    text = text.replace(/\s*\*\s*$/, "").trim();
    if (!text) return "This field";
    return text.length > 52 ? text.slice(0, 49).replace(/\s+\S*$/, "") + "…" : text;
  }
  function showFormErrorSummary(wraps) {
    if (!formRoot || !wraps || wraps.length === 0) return;
    var ordered = wraps.slice().sort(documentOrder);
    var box = document.getElementById(ERROR_SUMMARY_ID);
    if (!box) {
      box = document.createElement("div");
      box.id = ERROR_SUMMARY_ID;
      box.className = "contour-error-rollup contour-error-rollup--list";
      box.setAttribute("role", "alert");
      // Pinned to the closing section so progressive disclosure keeps it with
      // the submit button rather than stranding it in a collapsed group.
      box.setAttribute("data-contour-section", "finish");
      var submitWrap = formRoot.querySelector(".hs_submit");
      if (submitWrap && submitWrap.parentNode) submitWrap.parentNode.insertBefore(box, submitWrap); else formRoot.appendChild(box);
    }
    box.innerHTML = "";
    var body = document.createElement("div");
    body.className = "contour-error-summary__body";
    var title = document.createElement("p");
    title.className = "contour-error-summary__title";
    title.textContent = ordered.length === 1 ? "One field needs your attention before you can submit" : ordered.length + " fields need your attention before you can submit";
    body.appendChild(title);
    var list = document.createElement("ul");
    list.className = "contour-error-summary__list";
    ordered.forEach(function (wrap) {
      var item = document.createElement("li");
      // A button, not an anchor: it must never navigate, and Enter and Space
      // both have to work for a keyboard user reading the summary.
      var link = document.createElement("button");
      link.type = "button";
      link.className = "contour-error-summary__link";
      link.textContent = fieldSummaryLabel(wrap);
      link.addEventListener("click", function () {
        // A field on the hidden person tab or in a collapsed card must be
        // brought forward before there is anything to scroll to.
        revealPersonTabForWrap(wrap);
        expandSectionBoxForWrap(wrap);
        reportFieldError(wrap, focusTargetIn(wrap));
      });
      item.appendChild(link);
      list.appendChild(item);
    });
    body.appendChild(list);
    box.appendChild(body);
    box.style.removeProperty("display");
    updatePersonTabErrorState(ordered);
    playReveal(box);
  }
  function hideFormErrorSummary() {
    var box = document.getElementById(ERROR_SUMMARY_ID);
    if (box) box.style.display = "none";
    clearPersonTabErrorState();
  }
  /* =========================================================
     SUBMIT BUTTON BUSY STATE
     -----------------------------------------------------------
     HubSpot leaves the button untouched while it posts, so a slow network
     reads as a dead button and invites a second click. Pointer events are
     dropped rather than the button disabled: the submit is already in flight
     through HubSpot's own handler, and disabling a control mid-dispatch is a
     good way to find out which browsers cancel it.
     ========================================================= */
  var submitBusyTimer = null;
  function submitButtonEl() {
    return formRoot ? formRoot.querySelector('input[type="submit"], button[type="submit"]') : null;
  }
  function markSubmitBusy(busy) {
    var btn = submitButtonEl();
    if (!btn) return;
    if (busy) {
      if (btn.getAttribute("data-contour-busy") === "1") return;
      btn.setAttribute("data-contour-busy", "1");
      btn.setAttribute("data-contour-label", btn.tagName === "INPUT" ? btn.value : btn.textContent);
      if (btn.tagName === "INPUT") btn.value = "Submitting…"; else btn.textContent = "Submitting…";
      btn.classList.add("contour-submit--busy");
      btn.setAttribute("aria-busy", "true");
      // A busy state that never lifts is worse than none, so it always expires
      // even if HubSpot neither submits nor reports back.
      if (submitBusyTimer) clearTimeout(submitBusyTimer);
      submitBusyTimer = setTimeout(function () {
        markSubmitBusy(false);
      }, 12000);
      return;
    }
    if (submitBusyTimer) clearTimeout(submitBusyTimer);
    submitBusyTimer = null;
    if (btn.getAttribute("data-contour-busy") !== "1") return;
    btn.removeAttribute("data-contour-busy");
    var label = btn.getAttribute("data-contour-label") || "Submit";
    if (btn.tagName === "INPUT") btn.value = label; else btn.textContent = label;
    btn.classList.remove("contour-submit--busy");
    btn.removeAttribute("aria-busy");
  }
  /* =========================================================
     MOTION
     -----------------------------------------------------------
     One vocabulary for everything that moves: 420ms for a section or a field
     arriving, 200ms for a message, 160ms for a control responding to the
     pointer, all on the same ease. Nothing travels more than about 10px.

     playReveal() is the single entry point. It strips its own class on the
     way out, because an element left mid-animation carries an opacity of its
     own, which would fight anything that later tries to hide it.
     ========================================================= */
  var REVEAL_CLASS = "contour-reveal";
  var REVEAL_EASE = "cubic-bezier(.22,.61,.36,1)";
  function playReveal(el, delayMs) {
    if (!el || !el.classList || prefersReducedMotion()) return;
    var delay = delayMs || 0;
    el.classList.remove(REVEAL_CLASS);
    // Reading layout between the remove and the add is what lets the same
    // animation replay on an element that has already been revealed once.
    void el.offsetWidth;
    if (delay) el.style.setProperty("animation-delay", delay + "ms");
    el.classList.add(REVEAL_CLASS);
    var settle = function () {
      el.classList.remove(REVEAL_CLASS);
      el.style.removeProperty("animation-delay");
      el.removeEventListener("animationend", settle);
    };
    el.addEventListener("animationend", settle);
    // animationend never fires on a node hidden mid-flight, so the class comes
    // off on a timer regardless.
    setTimeout(settle, 1200 + delay);
  }
  function injectMotionStyles() {
    if (document.getElementById("contour-motion-styles")) return;
    var notBox = ':not([type="checkbox"]):not([type="radio"]):not([type="file"])';
    var style = document.createElement("style");
    style.id = "contour-motion-styles";
    style.textContent = "" +
      // --- motion primitives -------------------------------------------------
      "@keyframes contour-reveal-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }" + "@keyframes contour-form-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }" + "@keyframes contour-error-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }" + "@keyframes contour-badge-in { from { opacity: 0; transform: scale(0.4); } 70% { transform: scale(1.12); } to { opacity: 1; transform: scale(1); } }" +
      "@media (prefers-reduced-motion: no-preference) {" + "  .contour-reveal { animation: contour-reveal-in 420ms " + REVEAL_EASE + " both; }" + "  .contour-form-enter { animation: contour-form-in 380ms " + REVEAL_EASE + " both; }" + "  .hs-form .hs-error-msgs:not(.contour-error-rollup) { animation: contour-error-in 200ms ease-out both; }" + "}" +
      // --- controls responding to the pointer and the keyboard ---------------
      // The page header styles fields with a three-:not() selector, which
      // outranks a plain class, so every contested property repeats the trio.
      ".hs-form .hs-input" + notBox + " { transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease !important; }" + ".hs-form .hs-input" + notBox + ":hover:not(:disabled) { border-color: rgba(12, 49, 102, 0.34) !important; }" +
      // :focus-visible rather than :focus, so the ring is there for a keyboard
      // and absent for a mouse click.
      ".hs-form .hs-input" + notBox + ":focus-visible { outline: none !important; border-color: #0540F2 !important; box-shadow: 0 0 0 3px rgba(5, 64, 242, 0.18) !important; }" + ".hs-form .hs-input" + notBox + ":focus:not(:focus-visible) { outline: none !important; box-shadow: none !important; }" + ".hs-form .hs-input.invalid" + notBox + ", .hs-form .hs-input.error" + notBox + " { border-color: #c8102e !important; box-shadow: 0 0 0 3px rgba(200, 16, 46, 0.10) !important; }" + ".hs-form select:disabled, .hs-form input:disabled { transition: opacity .16s ease, background-color .16s ease; }" +
      // Selectable cards: the tick is animated above, the surface eases here.
      ".hs-form .hs-form-checkbox-display, .hs-form .hs-form-radio-display, .hs-form .contour-program-card { transition: background-color .16s ease, border-color .16s ease, box-shadow .16s ease, transform .16s ease; }" + ".hs-form .hs-form-checkbox-display:active, .hs-form .hs-form-radio-display:active { transform: scale(0.985); }" + ".hs-form .hs-button:active { transform: translateY(0) scale(0.99); }" +
      // --- submit button busy state ------------------------------------------
      ".hs-form .hs-button.contour-submit--busy { pointer-events: none; opacity: 0.7; }" + '.hs-form .hs-button.contour-submit--busy::before { content: ""; width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(12, 49, 102, 0.3); border-top-color: #0C3166; animation: contour-spin 0.7s linear infinite; }' +
      // --- section headers ----------------------------------------------------
      // Widths are stated because the Guardian flow puts this header inside
      // HubSpot's dependent-field container, which lays its children out in
      // columns — without them the heading sits beside the first field.
      // The title sits on the right as a pill, with the rule line filling the
      // space to its left — the line IS the section divider, so the header
      // carries no border of its own and the hr dividers below stand down
      // whenever headers are on (Amrit, 21 Aug 2026).
      ".hs-form .contour-section-header { display: flex; align-items: center; justify-content: flex-end; gap: 14px; box-sizing: border-box; width: 100%; flex: 0 0 100%; grid-column: 1 / -1; margin: 34px 0 20px; }" + ".hs-form .contour-section-header:first-child { margin-top: 0; }" + '.hs-form .contour-section-header::before { content: ""; flex: 1 1 auto; height: 1px; background: linear-gradient(90deg, rgba(12, 49, 102, 0), rgba(12, 49, 102, 0.18)); }' + ".hs-form .contour-section-header__title { flex: 0 0 auto; font-size: 12px; font-weight: 700; letter-spacing: 0.10em; text-transform: uppercase; color: #0C3166; padding: 6px 14px; border: 1px solid rgba(12, 49, 102, 0.16); border-radius: 999px; background: #FFFFFF; }" +
      // The three rules predate the headers and would double up with them.
      ".hs-form.contour-section-headers-on hr.contour-section-divider { display: none !important; }" +
      // --- helper note under a field that is waiting on an earlier answer -----
      ".hs-form .contour-disabled-hint { margin-top: 6px; font-size: 12.5px; line-height: 1.4; color: #6b7280; }" +
      // --- error summary ------------------------------------------------------
      // The summary stands between the last card and the submit button as a
      // block of its own, so it needs the gap under it that the cards give
      // themselves.
      "#" + ERROR_SUMMARY_ID + " { margin-bottom: 20px !important; }" + ".hs-form .contour-error-rollup--list { align-items: flex-start; }" + ".hs-form .contour-error-rollup--list::before { margin-top: 1px; }" + ".hs-form .contour-error-summary__body { flex: 1 1 auto; min-width: 0; }" + ".hs-form .contour-error-summary__title { margin: 0 0 9px !important; padding: 0 !important; font-size: 0.95rem !important; font-weight: 700 !important; line-height: 1.35 !important; color: #8A0C22 !important; }" + ".hs-form .contour-error-summary__list { display: flex; flex-wrap: wrap; gap: 7px 8px; margin: 0 !important; padding: 0 !important; list-style: none; }" + ".hs-form .contour-error-summary__list li { width: auto !important; flex: 0 0 auto !important; margin: 0 !important; padding: 0 !important; }" + ".hs-form .contour-error-summary__link { display: inline-block; appearance: none; -webkit-appearance: none; border: 1px solid rgba(200, 16, 46, 0.30); border-radius: 999px; background: #FFFFFF; color: #8A0C22; padding: 5px 12px; font: inherit; font-size: 12.5px; font-weight: 600; line-height: 1.3; cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease; }" + ".hs-form .contour-error-summary__link:hover { background: #c8102e; border-color: #c8102e; color: #FFFFFF; }" + ".hs-form .contour-error-summary__link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(200, 16, 46, 0.25); }";
    document.head.appendChild(style);
  }
  /* =========================================================
     PROGRESSIVE SECTIONS
     -----------------------------------------------------------
     The form is long enough that opening it in full reads as a wall. It is
     disclosed a section at a time instead: answer everything required in the
     section you are on and the next one arrives (Amrit, 20 Aug 2026).

     Three rules keep it from becoming a cage:
       - a section that has opened never closes again, so clearing a field
         can never take the submit button away mid-form;
       - a section with nothing visible in it is skipped rather than treated
         as unanswered, which is what makes the Guardian-only student block,
         the conditional campus field and the internal-only questions behave;
       - any submit attempt opens everything, so nobody is ever told to fix a
         field they cannot see.

     Nodes are never moved. Each top-level child of the form is assigned to a
     section on the fly from the field names inside it, so a HubSpot re-render
     or a dependent group appearing mid-flow lands in the right place with no
     bookkeeping to go stale.
     ========================================================= */
  var SECTION_HEADER_CLASS = "contour-section-header";
  var SECTION_DEFS = [{
    // One section from "Are you a" down through both people's fields — the
    // Student rows live inside the contact-type dependent group anyway, so
    // splitting them made the first card impossible to draw (Amrit, 22 Aug).
    id: "contact",
    title: "Contact Information",
    fields: ["web_form_contact_type", "student_first_name", "student_last_name", "student_email", "student_phone_number", "firstname", "lastname", "email_2", "phone"]
  }, {
    id: "study",
    title: "Academic Details",
    fields: ["state_territory_country", "state", "country_dropdown", "which_year_are_you_interested_in_tutoring_for_", "year_level", "school_text", "school_code", "acara_id"]
  }, {
    id: "programs",
    title: "Programs and Subjects",
    fields: ["program_interest", "join_no_program_waitlist", "web_form__interested_subject"]
  }, {
    id: "campus",
    title: "Preferred Campuses",
    fields: ["web_form__preferred_campuses"]
  }, {
    id: "finish",
    title: "Final Details",
    fields: ["referral", "how_did_they_contact_us", "signed_up_by", "tos_privacy_consent"]
  }];
  var SECTION_INDEX_BY_FIELD = {};
  SECTION_DEFS.forEach(function (def, index) {
    def.fields.forEach(function (name) {
      SECTION_INDEX_BY_FIELD[name] = index;
    });
  });
  var revealedSections = {};
  var sectionsReady = false;
  var sectionEvalQueued = false;
  function sectionIndexById(id) {
    for (var i = 0; i < SECTION_DEFS.length; i++) {
      if (SECTION_DEFS[i].id === id) return i;
    }
    return -1;
  }
  // Every section a node has a field for. An empty list means it carries no
  // field of its own — a divider, an injected explainer, the subject summary —
  // and inherits whichever section it was rendered into.
  function sectionIndicesIn(node) {
    if (node.getAttribute) {
      var pinned = node.getAttribute("data-contour-section");
      if (pinned) {
        var index = sectionIndexById(pinned);
        return index === -1 ? [] : [index];
      }
    }
    if (node.classList && node.classList.contains("hs_submit")) return [SECTION_DEFS.length - 1];
    if (!node.querySelectorAll) return [];
    var found = [];
    var named = node.querySelectorAll("[name]");
    for (var i = 0; i < named.length; i++) {
      var at = SECTION_INDEX_BY_FIELD[named[i].name];
      if (at === undefined || found.indexOf(at) !== -1) continue;
      found.push(at);
    }
    return found.sort(function (a, b) {
      return a - b;
    });
  }
  // HubSpot renders the Contact Type dependent group *inside* the contact type
  // field's own fieldset, so on the Guardian flow one top-level child holds
  // both "Are you a" and the four Student Information fields. Descend until
  // every node belongs to exactly one section rather than trying to place a
  // node that straddles two.
  function collectSectionNodes(parent, groups, state) {
    Array.prototype.forEach.call(parent.children, function (node) {
      if (node.classList && node.classList.contains(SECTION_HEADER_CLASS)) return;
      var indices = sectionIndicesIn(node);
      var splittable = node.children && node.children.length > 0 && !(node.classList && node.classList.contains(FIELD_WRAPPER_CLASS));
      if (indices.length > 1 && splittable) {
        collectSectionNodes(node, groups, state);
        return;
      }
      var index = indices.length > 0 ? indices[0] : -1;
      if (index === -1) index = state.current; else state.current = index;
      groups[index].push(node);
    });
  }
  function sectionGroups() {
    var groups = SECTION_DEFS.map(function () {
      return [];
    });
    collectSectionNodes(formRoot, groups, {
      current: 0
    });
    return groups;
  }
  // A field counts as required when its asterisk is on screen. Native marks
  // carry no inline display; the ones this file injects are toggled as the
  // field becomes relevant, so reading the mark covers both.
  function fieldIsRequired(wrap) {
    var marks = wrap.querySelectorAll("label .hs-form-required");
    for (var i = 0; i < marks.length; i++) {
      if (marks[i].style.display !== "none") return true;
    }
    return false;
  }
  function groupFieldWraps(nodes) {
    var entries = [];
    nodes.forEach(function (node) {
      if (!node.querySelectorAll) return;
      if (node.classList && node.classList.contains(FIELD_WRAPPER_CLASS)) entries.push({
        wrap: node,
        section: node
      });
      Array.prototype.forEach.call(node.querySelectorAll("." + FIELD_WRAPPER_CLASS), function (wrap) {
        entries.push({
          wrap: wrap,
          section: node
        });
      });
    });
    return entries;
  }
  // Deliberately not isElementVisible(): a closed section is display:none on
  // its top-level node, so reading that back would make the section look empty
  // the moment it closed — and an empty section is one this code re-opens.
  // The walk therefore stops at the section rather than going to the document.
  function fieldVisibleInSection(entry) {
    for (var node = entry.wrap; node && node !== entry.section; node = node.parentElement) {
      if (node.hidden) return false;
      // A node this code collapsed reports the display it had beforehand, so
      // a closed section never reads as an empty one — which is what would
      // re-open it on the next pass.
      if (node.getAttribute && node.getAttribute(SECTION_HIDDEN_ATTR) === "1") {
        if ((node.getAttribute(SECTION_PREV_DISPLAY_ATTR) || "") === "none") return false;
        continue;
      }
      if (node.style && node.style.display === "none") return false;
    }
    return true;
  }
  function groupHasVisibleField(nodes) {
    var entries = groupFieldWraps(nodes);
    for (var i = 0; i < entries.length; i++) {
      if (fieldVisibleInSection(entries[i])) return true;
    }
    return false;
  }
  function groupHasVisibleError(nodes) {
    var entries = groupFieldWraps(nodes);
    for (var i = 0; i < entries.length; i++) {
      if (!fieldVisibleInSection(entries[i])) continue;
      if (fieldWrapperInvalid(entries[i].wrap)) return true;
    }
    return false;
  }
  function groupComplete(nodes) {
    var entries = groupFieldWraps(nodes);
    for (var i = 0; i < entries.length; i++) {
      if (!fieldVisibleInSection(entries[i])) continue;
      // Ahead of the required check: an optional field holding a rejected
      // answer still stops the section — wrong beats missing.
      if (fieldWrapperInvalid(entries[i].wrap)) return false;
      if (!fieldIsRequired(entries[i].wrap)) continue;
      if (!fieldWrapperAnswered(entries[i].wrap)) return false;
    }
    return true;
  }
  function sectionTitle(def) {
    // The person-tabs band inside the card carries the Student/Guardian
    // split; the card header stays constant.
    return def.title;
  }
  function ensureSectionHeader(def, firstNode) {
    var title = featureEnabled("sectionHeaders") ? sectionTitle(def) : null;
    var existing = formRoot.querySelector('[data-contour-section-header="' + def.id + '"]');
    if (!title || !firstNode || !firstNode.parentNode) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return null;
    }
    if (!existing) {
      existing = document.createElement("div");
      existing.className = SECTION_HEADER_CLASS;
      existing.setAttribute("data-contour-section-header", def.id);
      var label = document.createElement("span");
      label.className = SECTION_HEADER_CLASS + "__title";
      existing.appendChild(label);
    }
    if (existing.firstChild.textContent !== title) existing.firstChild.textContent = title;
    // Re-seated rather than left where it was: HubSpot inserting a dependent
    // group can land fields above a header that used to sit on top of them.
    if (existing.nextSibling !== firstNode) firstNode.parentNode.insertBefore(existing, firstNode);
    return existing;
  }
  // Only ever unwinds a display this code set. HubSpot ships its own hidden
  // nodes at the end of the form — the tracking iframe carries an inline
  // display:none — and blanket-clearing display on a section's members put
  // an empty bordered box under the submit button.
  var SECTION_HIDDEN_ATTR = "data-contour-section-hidden";
  var SECTION_PREV_DISPLAY_ATTR = "data-contour-prev-display";
  function setNodeSectionHidden(node, hidden) {
    if (!node || !node.style) return;
    if (hidden) {
      if (node.getAttribute(SECTION_HIDDEN_ATTR) === "1") return;
      node.setAttribute(SECTION_HIDDEN_ATTR, "1");
      node.setAttribute(SECTION_PREV_DISPLAY_ATTR, node.style.display || "");
      node.style.display = "none";
      return;
    }
    if (node.getAttribute(SECTION_HIDDEN_ATTR) !== "1") return;
    var previous = node.getAttribute(SECTION_PREV_DISPLAY_ATTR) || "";
    if (previous) node.style.display = previous; else node.style.removeProperty("display");
    node.removeAttribute(SECTION_HIDDEN_ATTR);
    node.removeAttribute(SECTION_PREV_DISPLAY_ATTR);
  }
  function firstVisibleNode(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (groupHasVisibleField([nodes[i]])) return nodes[i];
    }
    return nodes[0] || null;
  }
  function evaluateSections(options) {
    if (!sectionsReady || !formRoot) return;
    var initial = !!(options && options.initial);
    var groups = sectionGroups();
    // Moving nodes into their cards stales the groups just computed.
    if (adoptSectionBoxNodes(groups)) groups = sectionGroups();
    var open = true;
    var revealedNow = [];
    SECTION_DEFS.forEach(function (def, index) {
      var nodes = groups[index];
      var wasRevealed = !!revealedSections[def.id];
      var empty = !groupHasVisibleField(nodes);
      // An empty section is transparent: it neither shows a header nor holds
      // the rest of the form shut behind it.
      var show = !empty && (open || wasRevealed);
      if (empty) {
        nodes.forEach(function (node) {
          setNodeSectionHidden(node, false);
        });
        ensureSectionHeader({
          id: def.id,
          title: null
        }, null);
      } else if (show) {
        var header = ensureSectionHeader(def, firstVisibleNode(nodes));
        nodes.forEach(function (node) {
          setNodeSectionHidden(node, false);
        });
        if (header) header.style.removeProperty("display");
        if (!wasRevealed) {
          revealedSections[def.id] = true;
          revealedNow.push({
            header: header,
            nodes: nodes
          });
        }
      } else {
        ensureSectionHeader({
          id: def.id,
          title: null
        }, null);
        nodes.forEach(function (node) {
          setNodeSectionHidden(node, true);
        });
      }
      if (!empty && !groupComplete(nodes)) open = false;
    });
    updateSectionBoxStates(groups);
    updateStudentSegmentCascade();
    if (initial || revealedNow.length === 0) return;
    revealedNow.forEach(function (entry, i) {
      // Several sections open at once only on a prefilled return, where a
      // short cascade reads as the form filling itself in.
      var delay = i * 90;
      if (entry.header) playReveal(entry.header, delay);
      entry.nodes.forEach(function (node) {
        playReveal(node, delay);
      });
    });
    if (revealedNow.length === 1) scrollSectionIntoView(revealedNow[0]);
  }
  // Only nudges the page when the new section is genuinely off screen, and
  // never while someone is typing — being scrolled away from a half-finished
  // answer is worse than not being shown the next question straight away.
  function scrollSectionIntoView(entry, force) {
    if (prefersReducedMotion()) return;
    if (lastInteractionWasMultiSelect && !force) return;
    var active = document.activeElement;
    if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT" && active.type !== "checkbox" && active.type !== "radio" && active.type !== "submit")) return;
    var target = entry.header || entry.nodes[0];
    if (!target || !target.getBoundingClientRect) return;
    var viewport = window.innerHeight || 0;
    if (!viewport) return;
    // Off screen in either direction counts: a fold above the new section
    // can leave it stranded past the top of the viewport, not just below
    // the bottom.
    var top = target.getBoundingClientRect().top;
    if (top >= 0 && top < viewport - 48) return;
    noteIntentionalScroll();
    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
  // pinOpen keeps the cards open against the automatic rule, for the one case
  // where the whole form arrives at once: a pre-fill link. The visitor did not
  // fill those sections, so collapsing them on arrival hides answers they have
  // never seen and asks them to trust a summary line. They stay open until the
  // visitor folds one, and that choice is then remembered (Amrit, 23 Aug).
  function revealAllSections(options) {
    if (!sectionsReady) return;
    var pinOpen = !!(options && options.pinOpen);
    var stepOpenId = options && options.stepOpenId;
    if (stepModeEnabled() && stepOpenId && SECTION_BOX_IDS[stepOpenId]) stepPinnedId = stepOpenId;
    SECTION_DEFS.forEach(function (def) {
      revealedSections[def.id] = true;
      if (stepModeEnabled()) return;
      if (!pinOpen || !SECTION_BOX_IDS[def.id]) return;
      if (sectionBoxManualCollapsed[def.id]) return;
      sectionBoxManualOpen[def.id] = true;
    });
    // Anything asking for the whole form (submit attempt, staff mode,
    // prefill) needs the collapsed cards open too, student segment and
    // submit button included — an Enter-key submit attempt must never end
    // with the form open but its button missing.
    studentSegmentRevealed = true;
    submitRevealed = true;
    expandAllSectionBoxes(pinOpen);
    evaluateSections({
      initial: true
    });
  }
  function scheduleSectionEval() {
    if (sectionEvalQueued) return;
    sectionEvalQueued = true;
    setTimeout(function () {
      sectionEvalQueued = false;
      evaluateSections();
      labelPhoneCountryOptions();
      enhancePhoneBoxes();
      clearAnsweredRequiredFallbacks();
      dedupeFieldErrors();
      syncFieldErrorAria();
    }, 0);
  }
  function startSections() {
    if (sectionsReady || !formRoot) return;
    sectionsReady = true;
    if (featureEnabled("sectionHeaders")) formRoot.classList.add("contour-section-headers-on");
    // Staff take signups over the phone out of order, so they get the lot —
    // as does everyone when disclosure is switched off, since a section marked
    // revealed is one this code will not close. The listeners below stay bound
    // either way: they also drive the aria wiring and the fallback messages.
    if (!featureEnabled("progressiveSections") || isInternalMode()) {
      SECTION_DEFS.forEach(function (def) {
        revealedSections[def.id] = true;
      });
    } else {
      formRoot.classList.add("contour-sections-on");
    }
    formRoot.addEventListener("change", function (e) {
      // isTrusted: every prefill in this file dispatches its own events, and
      // those must not count as the visitor having started.
      // Answering is the visitor moving on from choosing where to be, so the
      // pin stands down and the ordinary rules take the card from here.
      if (e.isTrusted) stepInteracted = stepUserActed = true, stepPinnedId = null;
      noteSectionInteraction(e.target);
      scheduleSectionEval();
    });
    formRoot.addEventListener("input", function (e) {
      if (e.isTrusted) stepInteracted = stepUserActed = true, stepPinnedId = null;
      noteSectionInteraction(e.target);
      scheduleSectionEval();
    });
    /* Enter in a text box is "implicit submission" — the browser submits the
       form, and half-filled that meant the gate, an error walk, and the next
       card lighting up while someone was still typing a school name. In step
       mode Enter now reads as "done with this answer": the field is blurred
       and the ordinary hand-over decides — a finished card advances, an
       unfinished one shows what is wrong and stays. Once every card is
       complete Enter is a real submit again. The school picker's Enter (a
       highlighted suggestion) has already preventDefaulted by the time this
       runs, so a pick is never stolen (Angad, 24 Aug 2026). */
    formRoot.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      if (!stepModeEnabled()) return;
      var t = e.target;
      if (!t || t.tagName !== "INPUT" && t.tagName !== "SELECT") return;
      var type = (t.type || "").toLowerCase();
      if (type === "submit" || type === "button") return;
      if (stepFormReady()) return;
      e.preventDefault();
      // Enter is the visitor saying they are done here — it outranks the
      // holds that keep a card open while they might still be in it.
      attentionSectionId = null;
      attentionAt = Date.now();
      try {
        t.blur();
      } catch (err) { }
    });
    // Tabbing or being focused into a collapsed card (error links, drafts)
    // opens it — nobody should be typing into a folded box.
    formRoot.addEventListener("focusin", function (e) {
      noteSectionInteraction(e.target);
      noteAttention(e.target);
      expandSectionBoxForWrap(e.target);
    });
    // On the document, not the form: a click that lands outside every card is
    // what releases the open one, and that click is often not on the form at
    // all. Capture, so nothing downstream can stop it being seen.
    //
    // Read on the way down, acted on the way out. The press has to be read
    // before it can move focus, but a card folding between press and release
    // would shift the page under the pointer and land the click somewhere the
    // visitor never aimed — the hazard withScrollAnchor exists for.
    document.addEventListener("pointerdown", function (e) {
      // A press on the form is the visitor taking charge, whether or not it
      // lands on something that produces a value.
      if (e.isTrusted && formRoot && formRoot.contains(e.target)) stepUserActed = true;
      var pressId = sectionIdForNode(e.target);
      // A press anywhere but the pinned card is the visitor leaving it. The
      // header's own handler re-pins if that is where they went.
      if (stepPinnedId && pressId !== stepPinnedId) stepPinnedId = null;
      noteAttention(e.target);
      // A locked card's header does nothing when the click arrives, so a
      // press on one is not a press the hand-over needs to wait for.
      pressedSectionId = pressId && SECTION_BOX_IDS[pressId] && sectionUnlocked[pressId] ? pressId : null;
      // A press while the page is still gliding to an opened card freezes
      // the glide where it is — the visitor is aiming at something, and a
      // page that keeps moving under the pointer lands the click somewhere
      // they never meant. Re-issuing the current position is how a native
      // smooth scroll is cancelled.
      if (pressScrollUntil && Date.now() < pressScrollUntil) {
        pressScrollUntil = 0;
        window.scrollTo(window.pageXOffset, window.pageYOffset);
      }
    }, true);
    // Released is released even when no click follows — a drag off the
    // header, a cancelled touch. The attention window covers the sliver
    // between this and the click event itself.
    document.addEventListener("pointerup", function () {
      pressedSectionId = null;
    }, true);
    document.addEventListener("pointercancel", function () {
      pressedSectionId = null;
    }, true);
    document.addEventListener("click", function (e) {
      if (stepModeEnabled() && pressWasOnPendingCard(e.target)) return;
      scheduleSectionEval();
    }, true);
    // Leaving a card is the step mode's hand-over cue — a finished card holds
    // while the caret is still in it, so something has to run the pass once
    // the caret is gone. Deliberately not noteSectionInteraction: leaving a
    // section is not working in it.
    formRoot.addEventListener("focusout", function (e) {
      // The report's own blur nudge fires this. It is not the visitor leaving.
      if (stepNudging) return;
      var to = e.relatedTarget;
      if (!to || !formRoot.contains(to)) releaseAttentionOnBlur();
      scheduleSectionEval();
    });
    evaluateSections({
      initial: true
    });
    // A pre-fill link resolves before the sections exist, so its request to
    // open everything is replayed here, once there is something to open.
    openSectionsForPrefill();
    // defaultContactTypeToStudent() ticks the radio through HubSpot, which
    // settles a tick later — without a second pass the form would open on the
    // contact-type question alone and then visibly expand.
    scheduleSectionEval();
    // HubSpot rebuilds fields on its own validation and inserts the Contact
    // Type dependent group mid-flow. Re-assigning is idempotent, so the
    // header this makes itself no-ops on the next callback.
    var observer = new MutationObserver(scheduleSectionEval);
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  /* =========================================================
     SECTION BOXES — card containers with collapse-to-summary
     -----------------------------------------------------------
     Study / Programs / Campus / Finish each live in a white card with the
     section title as its header. A completed section collapses to a
     one-line answer summary with an Edit link once a later section has
     opened; expanding is a click (or just focusing anything inside). The
     submit button stays outside the Finish card as the page-level CTA.

     The section walker never needed nodes to move — groups are recomputed
     from the live DOM each pass — so adoption happens inside
     evaluateSections: any top-level node belonging to a boxed section is
     re-seated into that section's card, and the MutationObserver already
     re-runs the pass when HubSpot inserts nodes elsewhere. Collapse is a
     grid-rows squeeze (never display:none), so fieldVisibleInSection and
     the completeness checks keep reading collapsed fields as present.
     ========================================================= */
  var SECTION_BOX_IDS = {
    contact: true,
    study: true,
    programs: true,
    campus: true,
    finish: true
  };
  var sectionBoxes = {};
  // Someone who opened or closed a card by hand has answered the question of
  // where they want it — auto-collapse stands down for that card. Manual
  // state is authoritative: the auto rule below never overrides either map.
  var sectionBoxManualOpen = {};
  var sectionBoxManualCollapsed = {};
  // The section the person is currently working in (last change/input/focus)
  // never auto-folds, even once it reads complete — picking a second subject
  // must not close the card mid-reach.
  var lastInteractedSectionId = null;
  function noteSectionInteraction(target) {
    if (!target || !target.closest) return;
    if (target.closest(".contour-section-box__header")) return;
    var el = target.closest("[data-contour-section]");
    if (el) lastInteractedSectionId = el.getAttribute("data-contour-section");
    // Kept for scroll anchoring: the thing they just touched is the thing
    // that must not move under them when a card folds.
    if (target.getBoundingClientRect) lastInteractedEl = target;
    // Ticking one subject is not "finished with subjects": the list is a
    // multi-select and most people take two or three. Moving the page to the
    // next section on the first tick reads as the form snatching the list
    // away mid-choice, so a reveal triggered by one of these stays put and
    // the visitor scrolls when they are done (Amrit, 23 Aug).
    var name = target.getAttribute ? target.getAttribute("name") : null;
    lastInteractionWasMultiSelect = name === "web_form__interested_subject" || name === "web_form__preferred_campuses" || name === "program_interest";
  }
  var lastInteractionWasMultiSelect = false;
  var lastInteractedEl = null;
  /* Folding a card above the viewport takes its height out of the page, and
     everything below jumps up — the tile under the cursor is suddenly a
     different tile, and a click lands on the wrong subject. So every pass
     that can change a card's height runs inside this: pick whatever the
     visitor is working on, note where it sits on screen, and put it back
     there afterwards by scrolling the same distance the layout moved
     (Amrit, 23 Aug). */
  // Climbs to something that actually occupies space. The tile checkboxes and
  // radios are visually hidden in favour of their labels, so the element that
  // was clicked measures zero and would anchor the page to a point with no
  // position of its own.
  function laidOutAncestor(el) {
    var viewport = window.innerHeight || 0;
    var hops = 0;
    while (el && hops < 5) {
      if (el.getBoundingClientRect) {
        var rect = el.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom > 0 && rect.top < viewport) return el;
      }
      el = el.parentElement;
      hops += 1;
    }
    return null;
  }
  function scrollAnchorElement() {
    // The thing they just touched comes first, ahead of whatever holds the
    // caret: focus is often left in an earlier section (a text field they
    // tabbed out of), and that section is usually the one about to fold, so
    // anchoring to it measures a card that is collapsing rather than the
    // content that is moving.
    var candidates = [lastInteractedEl, document.activeElement];
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el || el === document.body || !el.isConnected) continue;
      if (!formRoot || !formRoot.contains(el)) continue;
      // An anchor inside a folded card has no position of its own, and one
      // inside a card that is mid-fold reports the height it is leaving.
      if (el.closest && el.closest(".contour-section-box--collapsed")) continue;
      var found = laidOutAncestor(el);
      if (found) return found;
    }
    // Nothing to go on (a pass triggered by the form itself): hold whichever
    // card the viewport is looking at, so the page still does not lurch.
    var viewport = window.innerHeight || 0;
    var boxes = qAll(".contour-section-box");
    for (var j = 0; j < boxes.length; j++) {
      var r = boxes[j].getBoundingClientRect();
      if (r.height > 0 && r.bottom > 0 && r.top < viewport) return boxes[j];
    }
    return null;
  }
  /* The fold is animated, so the height does not leave the page in the same
     tick the class is set — measuring straight after the pass shows nothing
     moved, and the jump arrives over the next few frames. So the anchor is
     held for the length of the transition: every frame, whatever distance the
     anchor has drifted is scrolled back. It gives way to a deliberate scroll
     (a newly revealed section, an error) and to the visitor's own, since
     fighting either would be worse than the jump. */
  var COLLAPSE_ANIM_MS = 420;
  var anchorPin = null;
  var intentionalScrollAt = 0;
  function noteIntentionalScroll() {
    intentionalScrollAt = Date.now();
  }
  // preferred: an element the caller knows is the right thing to hold still,
  // with the position it held before the change. A header the visitor just
  // pressed beats anything guessed from focus.
  function withScrollAnchor(fn, preferred) {
    var anchor = preferred && preferred.el && preferred.el.isConnected ? preferred.el : scrollAnchorElement();
    var before = anchor === (preferred && preferred.el) ? preferred.top : anchor ? anchor.getBoundingClientRect().top : null;
    var changed = fn();
    if (!changed || !anchor || before === null || !anchor.isConnected) return;
    pinScrollAnchor(anchor, before);
  }
  function pinScrollAnchor(anchor, before) {
    if (!window.requestAnimationFrame) return;
    var now = Date.now();
    // A press landing inside the previous fold's animation window retargets
    // the running pin rather than being dropped: the newest press is the
    // thing the visitor chose to look at, and a fold with no anchor at all
    // leaves the page wherever the browser's own focus scroll threw it.
    if (anchorPin) {
      anchorPin.anchor = anchor;
      anchorPin.before = before;
      anchorPin.deadline = now + COLLAPSE_ANIM_MS;
      anchorPin.startedAt = now;
      return;
    }
    var pin = anchorPin = {
      anchor: anchor,
      before: before,
      deadline: now + COLLAPSE_ANIM_MS,
      startedAt: now
    };
    var cancelled = false;
    function cancel() {
      cancelled = true;
    }
    // A hand on the wheel outranks anything this function wants.
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    function stop() {
      anchorPin = null;
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
    }
    function frame() {
      if (cancelled || Date.now() > pin.deadline || !pin.anchor.isConnected) return stop();
      // A reveal or an error report asked for the page to move on purpose.
      if (intentionalScrollAt > pin.startedAt) return stop();
      var rect = pin.anchor.getBoundingClientRect();
      if (rect.height === 0) return stop();
      // An anchor inside a folded card has left the screen and means nothing.
      // Its header has not — a folding card's header is the one part of it
      // that stays put, which makes it the best anchor a fold can have.
      if (pin.anchor.closest && !pin.anchor.closest(".contour-section-box__header") && pin.anchor.closest(".contour-section-box--collapsed")) return stop();
      var delta = rect.top - pin.before;
      if (Math.abs(delta) >= 1) {
        var yBefore = window.scrollY;
        window.scrollBy(0, delta);
        // The page ran out of room: scrollBy against the top does nothing,
        // and a pin that can no longer hold its anchor has nothing left to
        // do but fight whoever scrolls next.
        if (window.scrollY === yBefore) return stop();
      }
      window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }
  function sectionBoxesEnabled() {
    return featureEnabled("sectionBoxes");
  }
  // The stepper needs cards to step through, and staff take signups out of
  // order — they get the whole form open, as with every other rule here.
  function stepModeEnabled() {
    return featureEnabled("stepSections") && sectionBoxesEnabled() && !isInternalMode();
  }
  // "Some form of staged disclosure is running." Both modes want the guardian
  // segment to arrive once the student rows are answered rather than landing
  // on the visitor all at once.
  function sectionFlowActive() {
    return featureEnabled("progressiveSections") || stepModeEnabled();
  }
  // The page caps the form at 768px, which put the longest campus address
  // ("Level 1/75-77 Railway Parade or Level 1/6-10 Kingsway") onto two lines
  // in a half-width tile. 880px gives the tiles the ~50px each they were
  // short of, and stays well inside the page's own 1296px content width. Only
  // the cap moves, so every narrower screen is untouched (Amrit, 23 Aug).
  function injectFormWidthStyles() {
    if (!featureEnabled("widerForm")) return;
    if (document.getElementById("contour-form-width-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-form-width-styles";
    style.textContent =
      ".container-form { max-width: 880px; }" +
      ".hs-form { max-width: 880px; }";
    document.head.appendChild(style);
  }
  function injectSectionBoxStyles() {
    if (document.getElementById("contour-section-box-styles")) return;
    var style = document.createElement("style");
    style.id = "contour-section-box-styles";
    var box = ".hs-form .contour-section-box";
    style.textContent = "" +
      box + " { margin: 0 0 20px; border: 1px solid rgba(12, 49, 102, 0.12); border-radius: 16px; background: #FFFFFF; box-shadow: 0 1px 3px rgba(12, 49, 102, 0.06); }" +
      box + "--empty { display: none; }" +
      // The page's nav is sticky, so a card scrolled hard to the top would
      // sit under it. 96px cleared the nav but read as too tight on the live
      // page — the card wants a strip of daylight under the bar, not to butt
      // against it (Akshay, 31 Aug 2026).
      box + " { scroll-margin-top: 125px; }" +
      // The header is a slim band in the person-tabs voice — small caps on a
      // faint navy wash — so it reads as the section's chrome, one tier above
      // the field labels inside, rather than a second bold label.
      box + "__header { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 12px 22px; background: rgba(12, 49, 102, 0.045); border: 0; border-bottom: 1px solid rgba(12, 49, 102, 0.07); text-align: left; font: inherit; color: inherit; cursor: default; border-radius: 16px 16px 0 0; }" +
      box + "--collapsed .contour-section-box__header { border-radius: 16px; border-bottom-color: transparent; }" +
      box + "__header--togglable { cursor: pointer; }" +
      box + "--collapsed .contour-section-box__header:hover { background: rgba(12, 49, 102, 0.08); }" +
      // Blue disc + white tick — the same mark as the subject tiles, the one
      // confirmation glyph the design keeps. It was lime until the highlighter
      // was reserved for CTAs, where it does the most work (Angad, 25 Aug
      // 2026); the prefill banner's badge is still lime, being a badge rather
      // than a confirmation.
      // No ring on the band either way: the disc has enough contrast against
      // the navy to carry itself, and it goes one step larger than the tiles'
      // so the tick reads at this size (Amrit, 22 Aug).
      box + '__status { flex: 0 0 auto; display: none; align-items: center; justify-content: center; width: 24px; height: 24px; box-sizing: border-box; border-radius: 50%; border: 2px solid #FFFFFF; background: #007AFF; color: #FFFFFF; }' +
      box + "__status svg { display: block; }" +
      box + "--collapsed .contour-section-box__status { display: flex; }" +
      box + "__title { flex: 0 0 auto; font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0C3166; }" +
      box + "__summary { flex: 1 1 auto; min-width: 0; display: none; font-size: 13.5px; font-weight: 500; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }" +
      box + "--collapsed .contour-section-box__summary { display: block; }" +
      box + "__action { flex: 0 0 auto; display: none; align-items: center; justify-content: center; width: 28px; height: 28px; margin-left: auto; border-radius: 50%; color: #0C3166; transition: background-color 0.15s ease; }" +
      box + "--collapsed .contour-section-box__action { display: inline-flex; }" +
      box + "--collapsed .contour-section-box__header:hover .contour-section-box__action { background: rgba(12, 49, 102, 0.10); }" +
      box + "__action svg { display: block; }" +
      // 1fr/0fr squeeze instead of display:none: the fields stay "visible" to
      // every walker, and the height animates without measuring it.
      box + "__content { display: grid; grid-template-rows: 1fr; }" +
      // overflow stays visible while open: the school suggestion list drops
      // out of its box. The collapsed class clips, which the 0fr squeeze
      // needs anyway.
      box + "__content-inner { min-height: 0; padding: 16px 22px 20px; }" +
      box + "--collapsed .contour-section-box__content { grid-template-rows: 0fr; }" +
      // visibility keeps collapsed fields out of the tab order; expansion
      // hooks (header, focusin, error links) bring them back first.
      box + "--collapsed .contour-section-box__content-inner { overflow: hidden; padding-top: 0; padding-bottom: 0; visibility: hidden; opacity: 0; }" +
      "@media (prefers-reduced-motion: no-preference) { " + box + "__content { transition: grid-template-rows 0.3s ease; } " + box + "__content-inner { transition: padding 0.3s ease, visibility 0.3s, opacity 0.25s ease; } }" +
      // Text-like inputs and every select (HubSpot's own and injected ones,
      // e.g. the phone widget's country box) take the page body colour
      // (#FFF9F1) so the fields read as wells cut into the white card; they
      // lift to white with focus.
      box + " select, " + box + ' input.hs-input:not([type="checkbox"]):not([type="radio"]) { background-color: #FFF9F1 !important; }' +
      box + " select:focus, " + box + ' input.hs-input:not([type="checkbox"]):not([type="radio"]):focus { background-color: #FFFFFF !important; }' +
      // The unselected "Are you a" card sits in the same well colour as the
      // inputs; selection still fills navy over it. Selector mirrors the page
      // stylesheet's radio-card rule — anything lighter loses on specificity.
      ".hs-form .contour-section-box .hs-fieldtype-radio .input > ul.inputs-list > li.hs-form-radio label.hs-form-radio-display:not(:has(input:checked)):not(:hover) { background-color: #FFF9F1 !important; }" +
      ".hs-form .contour-student-seg-hidden { display: none !important; }" +
      // Inside a card the person "box" (per-row borders + band headers)
      // flattens: fields sit directly on the card, and each segment is
      // announced by a hairline header — "You"-pill + label over a rule —
      // instead of a box within a box where everything blended white.
      // Alignment stays with the base rules: label on the right edge, and a
      // badged heading spreads so the YOU pill holds the left (Amrit, 22 Aug).
      // The separator runs through the text line rather than under it — the
      // label masks it with the card's white, the pill rides it with a white
      // ring, and the rule ties the two ends of the band together.
      // Height pinned rather than left to content: 6 + 18 + 6. The rule below
      // is then placed at a whole 15px instead of at 50% of whatever each band
      // happened to measure, so the two bands cannot round to different device
      // rows — which is what had one reading heavier than the other (Amrit,
      // 25 Aug 2026).
      box + " .contour-person-tabs--static { background: none; border: 0; border-radius: 0; position: relative; box-sizing: border-box; height: 30px; padding: 6px 0 !important; margin: 24px 0 2px; }" +
      box + " .contour-person-tabs--static .contour-person-tabs__heading { min-height: 18px; line-height: 18px; }" +
      // On a pre-fill link the "Are you a" row above this is gone, so the
      // band leads the card and the 24px that separated it from the question
      // becomes dead space at the top (Amrit, 23 Aug).
      /* A true hairline where the screen can draw one. 1px of CSS is two
         device pixels on a retina display, which is why the rule reads heavier
         than a hairline should; 0.5px there is one device pixel and cannot be
         rounded away, because the rule sits at a whole 15px. Left at 1px below
         2dppx, where half a pixel is not a thing a screen can draw and asking
         for it risks the line vanishing (Amrit, 25 Aug 2026). */
      "@media (min-resolution: 2dppx) { " + box + " .contour-person-tabs--static::before { height: 0.5px; } }" +
      box + " .contour-person-tabs--static.contour-person-tabs--flush { margin-top: 2px; }" +
      box + " .contour-person-tabs--static.contour-person-tabs--beside-question { margin-top: 44px; }" +
      // With no pill beside it the rule starts at the band's own left edge and
      // takes its time coming up: it has the room the pill used to occupy, and
      // a longer taper is what keeps it from reading as a hard line drawn
      // across the card (Angad, 25 Aug 2026).
      box + ' .contour-person-tabs--static::before { content: ""; position: absolute; left: 0; right: 0; top: 15px; height: 1px; background: linear-gradient(to right, rgba(12, 49, 102, 0), rgba(12, 49, 102, 0) 60px, rgba(12, 49, 102, 0.85) 260px, rgba(12, 49, 102, 0.85)); }' +
      // A step up from the base 11.5/700 so the segment names read as
      // headers, while staying under the card band's 12.5px.
      // Level with the card's own band rather than a step under it: left-
      // aligned, this label now leads the rows beneath it instead of sitting
      // in the corner, so it carries a heading's weight (Amrit, 25 Aug 2026).
      box + " .contour-person-tabs__heading { font-size: 13px; font-weight: 800; }" +
      box + " .contour-person-tabs--static .contour-person-tabs__heading { position: relative; }" +
      // The lime marker stroke behind the label comes from the base person
      // group styles — the white mask that used to live here is gone with
      // it (the label-left rule below starts the separator past the label,
      // so nothing needs masking).
      box + " .contour-person-tabs--static .contour-person-tabs__you { position: relative; }" +
      // A band carrying the pill starts its rule past the pill instead of
      // running underneath it — the gradient's fade-in becomes the taper.
      // The offset comes from the measured pill width (set in
      // ensurePersonStaticHeader); the fallback keeps the rule clear of the
      // shortest sensible pill if a pass runs before it can be measured.
      box + ' .contour-person-tabs--static:has(.contour-person-tabs__you)::before { left: var(--contour-seg-rule-start, 46px); background: linear-gradient(to right, rgba(12, 49, 102, 0), rgba(12, 49, 102, 0.85) 48px, rgba(12, 49, 102, 0.85) calc(100% - 48px), rgba(12, 49, 102, 0)); }' +
      // Label on the left: the rule starts past it, measured, and the taper
      // turns round — short coming up out of the label, long going away at the
      // far edge. Last of the three, so it wins the tie on source order over
      // the two above, which it deliberately shares specificity with.
      // The solid run is the brand navy rather than the 0.14 wash it was — on
      // trial, so the number to put back is 0.14 in all six stops if it reads
      // too heavy (Amrit, 25 Aug 2026).
      // Solid where it leaves the label, tapering only at the far end. A rule
      // that fades in as well has two soft ends and reads as floating; the end
      // beside the text is where it is anchored, so it starts at full strength
      // and only the end going nowhere fades out (Amrit, 25 Aug 2026).
      // A 200px fade finishing 60px short of the edge. The 120px one ending
      // 10px short still read as a line that stopped rather than one that ran
      // out — a taper needs enough run to be seen as a taper, and enough clear
      // space after it that the eye is not looking for more (Amrit, 25 Aug).
      box + ' .contour-person-tabs--static.contour-person-tabs--label-left::before { left: var(--contour-seg-rule-start, 130px); background: linear-gradient(to right, rgba(12, 49, 102, 0.85), rgba(12, 49, 102, 0.85) calc(100% - 260px), rgba(12, 49, 102, 0) calc(100% - 60px), rgba(12, 49, 102, 0)); }' +
      box + " .contour-person-tabs--mid { margin-top: 26px; border-top: 0; }" +
      box + " .contour-person-group-host { margin-bottom: 0 !important; }" +
      box + " .contour-person-group-host > .contour-person-card__row { border: 0 !important; border-radius: 0 !important; }" +
      box + " .contour-person-group-host > .hs_student_first_name.contour-person-card__row, " + box + " .contour-person-group-host > .hs_student_email.contour-person-card__row { padding: 12px 12px 18px 0 !important; }" +
      box + " .contour-person-group-host > .hs_student_last_name.contour-person-card__row, " + box + " .contour-person-group-host > .hs_student_phone_number.contour-person-card__row { padding: 12px 0 18px 12px !important; }" +
      box + " fieldset.contour-person-card__row--guardian, " + box + " fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom { border: 0 !important; border-radius: 0 !important; margin-bottom: 0 !important; }" +
      box + " fieldset.contour-person-card__row--guardian > .hs-form-field { padding: 12px 12px 18px 0 !important; }" +
      box + " fieldset.contour-person-card__row--guardian > .hs-form-field + .hs-form-field { padding: 12px 0 18px 12px !important; }" +
      box + " fieldset.contour-person-card__row--guardian.contour-person-card__row--bottom > .hs-form-field { padding-bottom: 16px !important; }" +
      "@media screen and (max-width: 767px) {" +
      " " + box + " .contour-person-tabs--static { padding: 6px 2px 8px !important; }" +
      " " + box + " .contour-person-group-host > .contour-person-card__row { border: 0 !important; padding: 10px 0 14px !important; }" +
      " " + box + " fieldset.contour-person-card__row--guardian > .hs-form-field, " + box + " fieldset.contour-person-card__row--guardian > .hs-form-field + .hs-form-field { padding: 10px 0 14px !important; }" +
      "}" +
      // "Preferred Campuses" under the "Preferred Campus" band and "Program
      // Interest" under "Programs and Subjects" said the same thing twice —
      // the bands carry it. sr-only keeps both announced.
      box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses > label, ' + box + '[data-contour-section="programs"] .hs_program_interest > label { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }' +
      (featureEnabled("sectionHeaderTheme2") ?
        // Theme 2: the header band flips to navy with the text knocked out
        // white — Edit takes the highlighter, the summary a soft white. The
        // grey-band rules above still ship so a page can flip back with
        // window.ContourForm1Config = { sectionHeaderTheme2: false }.
        box + "__header { background: #0C3166; border-bottom-color: rgba(255, 255, 255, 0.10); }" +
        box + "--collapsed .contour-section-box__header:hover { background: #123B73; }" +
        box + "__title { color: #FFFFFF; }" +
        box + "__summary { color: rgba(255, 255, 255, 0.72); }" +
        // White pencil: the blue disc stays the band's one accent, and the
        // icon sits in the same voice as the title text (Amrit, 22 Aug).
        box + "__action { color: #FFFFFF; }" +
        box + "--collapsed .contour-section-box__header:hover .contour-section-box__action { background: rgba(255, 255, 255, 0.12); }" +
        ""
        : "") +
      // The country box now carries its dial code, so it needs the room; the
      // number box has it to spare, being one national number wide.
      // The :not() chain is the page stylesheet's own, repeated so this wins
      // the cascade against it — both rules carry !important, so it comes down
      // to specificity, and three attribute selectors are worth more than the
      // extra class this adds.
      /* 33% of the row, Amrit's number after seeing 44%. At 397px that is
         131px, and "Australia (+61)" measures 170, so the label clips — the
         country name is what goes, since the code is at the end. Called out
         rather than quietly widened: the closed box of a native select shows
         the selected option's own text, so the only way to keep the code
         visible at this width is to put it first ("+61 Australia"), which is
         a copy decision rather than a CSS one.

         Both widgets: the guardian's box is HubSpot's .hs-fieldtype-intl-phone
         and the student's is the .contour-intl-phone this file builds, and
         only the first had been done (Angad, 25 Aug 2026).

         The group is a flex row and the page caps the country box at 130px
         with flex: 0 0 auto, so width alone changes nothing — the basis and
         the cap have to go with it, and the :not() chain is the page
         stylesheet's own, repeated to win the cascade against it. */
      box + ' .hs-fieldtype-intl-phone select.hs-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), ' + box + ' .contour-intl-phone select.hs-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex: 0 0 33% !important; width: 33% !important; max-width: none !important; min-width: 0 !important; }' +
      box + ' input.hs-input[type="tel"]:not(.contour-phone-real):not([type="checkbox"]):not([type="radio"]) { flex: 1 1 auto !important; width: auto !important; min-width: 0 !important; }' +
      // The guardian row forces 100% on every .hs-input that is not one of the
      // page's own phone parts; ours is not one of those by design, so it says
      // so here instead of borrowing the class that would have it seeded.
      ".hs-form fieldset.contour-person-card__row--guardian input.contour-phone-proxy { width: auto !important; flex: 1 1 auto !important; min-width: 0 !important; }" +
      // A question, not a verdict: the form's own quiet helper-text voice, with
      // the correction as the only thing asking to be pressed.
      box + " .contour-email-suggest { margin-top: 6px; font-size: 13px; color: #6b7280; }" +
      box + " .contour-email-suggest__fix { appearance: none; -webkit-appearance: none; border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: #0C3166; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }" +
      box + " .contour-email-suggest__fix:hover { color: #007AFF; }" +
      // Hidden, not removed: the widget still composes from it, it still
      // carries the field name on the student's control, and every check in
      // this file still reads it. clip rather than display:none, so the widget
      // has a laid-out box to work with.
      box + ' input.hs-input.contour-phone-real:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { position: absolute !important; flex: 0 0 0 !important; width: 1px !important; min-width: 0 !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0 !important; opacity: 0 !important; }' +
      /* Campus tiles. Unpicked they take the page's own cream, so the card
         reads as a surface with wells cut into it rather than white boxes on
         white; picked they take #005FCC, which separates a chosen campus from
         the navy band above it in a way navy-on-navy cannot (Amrit, 25 Aug
         2026). :not(:has(input:checked)) mirrors the "Are you a" rule above —
         the page stylesheet's own shape, so this wins on specificity. */
      box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses li.hs-form-checkbox label.hs-form-checkbox-display:not(:has(input:checked)) { background-color: #FFF9F1 !important; }' +
      box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses li.hs-form-checkbox label.hs-form-checkbox-display:has(input:checked) { background-color: #005FCC !important; border-color: #005FCC !important; }' +
      box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses li.hs-form-checkbox label.hs-form-checkbox-display:has(input:checked) span, ' + box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses li.hs-form-checkbox label.hs-form-checkbox-display:has(input:checked) .contour-campus-name, ' + box + '[data-contour-section="campus"] .hs_web_form__preferred_campuses li.hs-form-checkbox label.hs-form-checkbox-display:has(input:checked) .contour-campus-address { color: #FFFFFF !important; }' +
      // Why Online is ticked when nobody ticked it.
      // 500 rather than the hint's 600: two lines of bold amber is a raised
      // voice for a sentence that is explaining a convenience.
      // 22px above rather than 14: the note follows a row of tall tiles, not a
      // line of text, so it needs the same air between it and the last tile
      // that the tiles have between their own rows.
      box + " .contour-campus-note { margin: 22px 0 0; padding: 11px 14px; border: 1px solid #f0d9a6; border-radius: 10px; background: #FFF3D6; color: #8a5a00; font-size: 13px; line-height: 1.5; font-weight: 500; }" +
      // The one remaining native control joins the palette.
      box + ' input[type="checkbox"][name="tos_privacy_consent"] { accent-color: #0C3166; }' +
      // The hr separators earned their keep on the flat form; cards make
      // their own edges.
      box + ' .contour-section-divider { display: none !important; }' +
      // The CTA holds the full card width — the finale of the cascade reads
      // at the same scale as the sections above it (Amrit, 22 Aug).
      ".hs-form .hs_submit.contour-submit-pending, .hs-form .hs-submit.contour-submit-pending { display: none; }" +
      ".hs-form .hs_submit .hs-button, .hs-form .hs-submit .hs-button { display: block; width: 100%; }" +
      // A card whose turn has not come. Present, measurable, obviously not
      // yet live: the navy band drops back to the grey wash it had before
      // theme 2, the whole card sits at half strength, and nothing on it
      // offers to be clicked. Three classes deep, so it wins over the theme-2
      // rules above wherever they overlap.
      // Not faded out — a card at half strength read as broken rather than as
      // waiting its turn. It keeps a navy edge, a navy title at reading
      // weight, a hollow ring where the finished card has its tick, and
      // the word PENDING in the slot the summary will fill (Angad, 23 Aug).
      box + "--locked { border-color: rgba(12, 49, 102, 0.22); }" +
      box + "--locked .contour-section-box__header, " + box + "--locked .contour-section-box__header:hover { background: rgba(12, 49, 102, 0.04); border-bottom-color: transparent; cursor: default; }" +
      box + "--locked .contour-section-box__title { color: rgba(12, 49, 102, 0.66); }" +
      box + "--locked .contour-section-box__status { display: flex; background: transparent; border-color: rgba(12, 49, 102, 0.28); }" +
      box + "--locked .contour-section-box__status svg { display: none; }" +
      // The state word, wherever it is used: set small against the far edge of
      // the band so it never reads as one of the answers.
      box + '--collapsed[data-contour-pending="1"] .contour-section-box__summary { display: block; text-align: right; font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; }' +
      box + '--locked[data-contour-pending="1"] .contour-section-box__summary { color: rgba(12, 49, 102, 0.4); }' +
      // No pencil on a card there is no way into.
      box + "--locked .contour-section-box__action { display: none; }" +
      // A card a submit attempt found a problem in. The band takes the error
      // red so the mark is on the section, not only on the fields inside it,
      // and the tick disc becomes an exclamation.
      box + "--flagged { border-color: rgba(200, 16, 46, 0.35); }" +
      box + "--flagged .contour-section-box__header { background: #8A0C22; border-bottom-color: rgba(255, 255, 255, 0.12); }" +
      box + "--flagged .contour-section-box__header:hover { background: #A11029; }" +
      box + "--flagged .contour-section-box__title { color: #FFFFFF; }" +
      box + "--flagged .contour-section-box__summary { color: rgba(255, 255, 255, 0.75); }" +
      box + "--flagged .contour-section-box__action { color: #FFFFFF; }" +
      box + "--flagged .contour-section-box__status { display: flex; background: #FFFFFF; border-color: #FFFFFF; color: #8A0C22; }" +
      box + "--flagged .contour-section-box__status svg { display: none; }" +
      box + '--flagged .contour-section-box__status::after { content: "!"; font-size: 13px; font-weight: 800; line-height: 1; }' +
      // The disc used to show on every folded card, which was safe when only
      // a finished card could fold. In step mode any non-active card folds,
      // so an unfinished one wore a tick it had not earned — an empty
      // Academic Details reading as done (Angad, 24 Aug 2026). Unfinished and
      // folded now wears the same hollow ring as a pending card; the tick is
      // reserved for complete.
      box + '--collapsed[data-contour-complete="0"]:not(.contour-section-box--flagged) .contour-section-box__status { background: transparent; border-color: rgba(12, 49, 102, 0.28); }' +
      box + '--collapsed[data-contour-complete="0"]:not(.contour-section-box--flagged) .contour-section-box__status svg { display: none; }' +
      // On a navy band the navy ring is invisible, and the state word has to
      // hold its own against knocked-out white.
      box + '--collapsed[data-contour-complete="0"]:not(.contour-section-box--flagged):not(.contour-section-box--locked) .contour-section-box__status { border-color: rgba(255, 255, 255, 0.45); }' +
      box + '--collapsed[data-contour-pending="1"]:not(.contour-section-box--flagged):not(.contour-section-box--locked) .contour-section-box__summary { color: rgba(255, 255, 255, 0.55); }' +
      // Belt to the collapsed state's braces: the content is already clipped
      // and visibility:hidden, and a stray pointer cannot reach into it.
      box + "--locked .contour-section-box__content-inner { pointer-events: none; }" +
      // The CTA before the form is ready: still there, still clickable so the
      // gate can say what is missing, plainly not the live button yet.
      ".hs-form .hs_submit .hs-button.contour-submit--waiting, .hs-form .hs-submit .hs-button.contour-submit--waiting { background-color: rgba(12, 49, 102, 0.10) !important; border-color: transparent !important; color: rgba(12, 49, 102, 0.45) !important; box-shadow: none !important; }" +
      // The band's padding is the same on all four sides whether the card is
      // open or folded — the old "16px 16px 0" left the title pressed against
      // the band's bottom edge on an open card (Amrit, 29 Aug 2026).
      // 14px on top of the content rather than 6: the first question needs
      // the same air below the band that the band's own text has inside it.
      // The phone widgets stay a row on a phone: the page header's stylesheet
      // stands the guardian's into a column under 480px, and a full-width
      // country box over a full-width number box reads as two answers to one
      // question. The country box holds a bare "+61" at this width (see
      // shortCountryLabel), so a third of the row fits it. The :not() chain
      // is the page rule's own, repeated so this wins the cascade against
      // it — both carry !important, so it comes down to specificity.
      "@media (max-width: 767px) { " + box + "__header { padding: 14px 16px; } " + box + "__content-inner { padding: 14px 16px 18px; } " + box + ' .hs-fieldtype-intl-phone.hs-input:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex-direction: row !important; } ' + box + " .contour-intl-phone { flex-direction: row !important; } }";
    document.head.appendChild(style);
  }
  function ensureSectionBox(def, firstNode) {
    var existing = sectionBoxes[def.id];
    if (existing) return existing;
    if (!firstNode || !firstNode.parentNode) return null;
    injectSectionBoxStyles();
    var el = document.createElement("div");
    el.className = "contour-section-box";
    // The pin makes sectionIndicesIn place the whole card, contents and all,
    // in this section — even on a pass where its fields are mid-render.
    el.setAttribute("data-contour-section", def.id);
    var header = document.createElement("button");
    header.type = "button";
    header.className = "contour-section-box__header";
    header.setAttribute("aria-expanded", "true");
    var status = document.createElement("span");
    status.className = "contour-section-box__status";
    status.setAttribute("aria-hidden", "true");
    status.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" focusable="false"><path d="M20 6.5L9 17.5l-5-5" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var title = document.createElement("span");
    title.className = "contour-section-box__title";
    var summary = document.createElement("span");
    summary.className = "contour-section-box__summary";
    var action = document.createElement("span");
    action.className = "contour-section-box__action";
    // Icon-only affordance; the sr-only text keeps "Edit" announced.
    action.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" focusable="false" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="contour-sr-only">Edit</span>';
    header.appendChild(status);
    header.appendChild(title);
    header.appendChild(summary);
    header.appendChild(action);
    var content = document.createElement("div");
    content.className = "contour-section-box__content";
    var inner = document.createElement("div");
    inner.className = "contour-section-box__content-inner";
    content.appendChild(inner);
    el.appendChild(header);
    el.appendChild(content);
    firstNode.parentNode.insertBefore(el, firstNode);
    header.addEventListener("click", function () {
      toggleSectionBox(def.id);
    });
    sectionBoxes[def.id] = {
      el: el,
      header: header,
      title: title,
      summary: summary,
      content: inner
    };
    return sectionBoxes[def.id];
  }
  function setSectionBoxCollapsed(id, collapsed) {
    var box = sectionBoxes[id];
    if (!box) return false;
    var was = box.el.classList.contains("contour-section-box--collapsed");
    box.el.classList.toggle("contour-section-box--collapsed", collapsed);
    // Write-if-changed: setAttribute records a mutation even when the value
    // is identical, and the section MutationObserver watches this subtree —
    // an unconditional write here kept evaluateSections looping forever.
    var expanded = collapsed ? "false" : "true";
    if (box.header.getAttribute("aria-expanded") !== expanded) box.header.setAttribute("aria-expanded", expanded);
    // Tab runs field to field. A collapsed card's header is the only way back
    // into it, so it belongs in the tab order; an open card's header only
    // folds what is already on screen, and having it interrupt every jump
    // between sections is a tax on keyboard filling (Amrit, 23 Aug).
    var tab = collapsed ? 0 : -1;
    if (box.header.tabIndex !== tab) box.header.tabIndex = tab;
    return was !== collapsed;
  }
  function toggleSectionBox(id) {
    var box = sectionBoxes[id];
    if (!box) return;
    if (stepModeEnabled()) {
      // A locked header is furniture: it shows the visitor how much form is
      // left and nothing more.
      if (!sectionUnlocked[id]) return;
      if (draftCacheEnabled()) {
        draftUserTouched = true;
        scheduleDraftSave();
      }
      // Whichever way this click goes, the visitor has just chosen where they
      // want to be — the pre-fill pin has had its say, and so has the window
      // where the form gets to pick the open card for itself.
      stepPinnedId = null;
      stepUserActed = true;
      if (id === activeSectionId) {
        // The card being worked in does not fold — an unanswered question
        // must not be hideable. A finished one folds back to its summary and
        // the form returns to whatever it still needs, which is what the next
        // pass works out.
        if (box.el.getAttribute("data-contour-complete") !== "1") return;
        setActiveSection(null);
      } else {
        sectionVisited[id] = true;
        // Pinned, not just held. Until now a hand-opened card stayed open
        // because several conditions happened to agree — the card is
        // unfinished, or the caret is in it, or nothing has been pressed since
        // it opened. Any one of those failing on a browser or a timing this
        // was not tested against, and the form takes the card back and opens
        // its own next step instead, which is a press on one section opening
        // another. A press is a decision; it outranks the step until the
        // visitor makes another one (Angad, 24 Aug 2026).
        stepPinnedId = id;
        stepPressAnchor = box.header.getBoundingClientRect ? {
          el: box.header,
          top: box.header.getBoundingClientRect().top
        } : null;
        setActiveSection(id);
        // The click is an interaction with the section too: it keeps the card
        // open through the pass that follows, rather than the form deciding
        // mid-click that a finished card should hand over again.
        lastInteractedSectionId = id;
        setSectionBoxCollapsed(id, false);
        // Focus is what holds a finished card open, and Safari does not focus
        // a button on click — without this the pencil would open the card and
        // the very next pass would hand straight back to the form's own step.
        // Quietly: the browser's own focus scroll teleports the page to the
        // header and the anchor pin then drags it back, a visible jerk on
        // every jump between sections. Holding position is the pin's job.
        focusQuietly(box.header);
        // Once the fold has settled, glide the chosen card to the top of the
        // view. From here rather than the pass: the toggle has already made
        // this card active, so the pass's openBefore comparison cannot see a
        // press-open happened at all (Akshay, 31 Aug 2026).
        var pressOpenedId = id;
        setTimeout(function () {
          if (activeSectionId === pressOpenedId) scrollPressedSectionIntoView(pressOpenedId);
        }, COLLAPSE_ANIM_MS + 120);
      }
      scheduleSectionEval();
      return;
    }
    // Opening or folding a card by hand is worth remembering across a
    // refresh, and it is the visitor's own doing, so it starts a draft the
    // same way typing does.
    if (draftCacheEnabled()) {
      draftUserTouched = true;
      scheduleDraftSave();
    }
    if (box.el.classList.contains("contour-section-box--collapsed")) {
      sectionBoxManualOpen[id] = true;
      delete sectionBoxManualCollapsed[id];
      // The click is also an interaction with the section: with the header
      // focused and this id marked current, the working-here guard holds the
      // card open even if a pass lands before the manual maps are read.
      lastInteractedSectionId = id;
      setSectionBoxCollapsed(id, false);
      return;
    }
    // Collapsing by hand only works on a finished section — a half-answered
    // one stays open so the missing answer stays on screen. The click still
    // pins the card open: reaching the header at all means the person wants
    // it where it is, and without the pin a click that raced a transient
    // auto-open would fold the card right back (the "flicker" Amrit hit).
    if (box.el.getAttribute("data-contour-complete") !== "1") {
      sectionBoxManualOpen[id] = true;
      delete sectionBoxManualCollapsed[id];
      return;
    }
    sectionBoxManualCollapsed[id] = true;
    delete sectionBoxManualOpen[id];
    setSectionBoxCollapsed(id, true);
  }
  // respectManualCollapse is for the pre-fill path, which opens the cards as a
  // courtesy rather than a necessity: a card the visitor folded themselves
  // stays folded. A submit attempt passes nothing and opens everything —
  // there is no arguing with "you cannot fix an error you cannot see".
  function expandAllSectionBoxes(respectManualCollapse) {
    if (stepModeEnabled()) {
      // Step mode has no "all open" state to reach for — one card is open at
      // a time by design. What a whole-form handover actually needs is the
      // locks off, so every card can be opened and every error inside one can
      // be reached; which card is open is then the ordinary rule's business.
      unlockAllSectionSteps();
      scheduleSectionEval();
      return;
    }
    Object.keys(sectionBoxes).forEach(function (id) {
      if (respectManualCollapse && sectionBoxManualCollapsed[id]) return;
      sectionBoxManualOpen[id] = true;
      delete sectionBoxManualCollapsed[id];
      setSectionBoxCollapsed(id, false);
    });
  }
  function expandSectionBoxForWrap(wrap) {
    if (!wrap || !wrap.closest) return;
    // The header runs its own toggle; going through here as well would
    // expand on its focusin and then collapse again on its click.
    if (wrap.closest(".contour-section-box__header")) return;
    var el = wrap.closest(".contour-section-box--collapsed");
    if (!el) return;
    var id = el.getAttribute("data-contour-section");
    if (!id) return;
    if (stepModeEnabled()) {
      // Being focused into a folded card means an error link or a draft sent
      // the visitor there. It becomes the open one, and it unlocks: the only
      // way focus reaches a locked card is a submit attempt, which has taken
      // the locks off already.
      sectionUnlocked[id] = true;
      sectionVisited[id] = true;
      setActiveSection(id);
      lastInteractedSectionId = id;
      // Opened here and now rather than on the queued pass: the field being
      // focused is inside this card, and a tick spent focused into something
      // with visibility:hidden is a tick the caret is nowhere.
      setSectionBoxCollapsed(id, false);
      scheduleSectionEval();
      return;
    }
    sectionBoxManualOpen[id] = true;
    delete sectionBoxManualCollapsed[id];
    setSectionBoxCollapsed(id, false);
  }
  // Top-level nodes that belong to a boxed section move into its card. The
  // submit button is deliberately left out: the CTA belongs to the page, not
  // to the Finish card. Returns whether anything moved so the caller knows
  // its groups are stale.
  function adoptSectionBoxNodes(groups) {
    if (!sectionBoxesEnabled()) return false;
    var moved = false;
    SECTION_DEFS.forEach(function (def, index) {
      if (!SECTION_BOX_IDS[def.id]) return;
      var box = sectionBoxes[def.id];
      var outside = groups[index].filter(function (node) {
        if (node.classList && node.classList.contains("hs_submit")) return false;
        // Page-level furniture rides above the cards, whatever section the
        // context walk files it under.
        // The error summary is pinned to the closing section so disclosure
        // keeps it with the submit button, but it is not part of that card —
        // adopted, it ended up nested inside Final Details, which read as the
        // whole form's problem being that one section's.
        if (node.id === ERROR_SUMMARY_ID) return false;
        if (node.id === "contour-prefill-banner" || node.id === "contour-form-loader" || node.classList && node.classList.contains("contour-restore-banner")) return false;
        return !box || node !== box.el && !box.el.contains(node);
      });
      if (outside.length === 0) return;
      box = ensureSectionBox(def, outside[0]);
      if (!box) return;
      outside.forEach(function (node) {
        // The card's visibility carries the section state from here — a
        // stale per-node mark would read as a hidden field forever.
        setNodeSectionHidden(node, false);
        box.content.appendChild(node);
        moved = true;
      });
    });
    // The person band anchors itself before the first person row; once that
    // row moves into the contact card the band must follow, and its own
    // re-seat only runs inside updatePersonGroups.
    if (moved) updatePersonGroups();
    return moved;
  }
  function sectionBoxSummary(def) {
    if (def.id === "contact") {
      var name = [getValue('[name="firstname"]'), getValue('[name="lastname"]')].filter(Boolean).join(" ");
      var parts = [name, getValue(FIELD_SELECTORS.emailTemp)];
      if (isGuardianContactType()) {
        var student = [getValue('[name="student_first_name"]'), getValue('[name="student_last_name"]')].filter(Boolean).join(" ");
        if (student) parts.push("Student: " + student);
      }
      return parts.filter(Boolean).join(" \u00b7 ");
    }
    if (def.id === "study") {
      var intake = getValue(FIELD_SELECTORS.intakeYear);
      return [getValue(FIELD_SELECTORS.location), getValue(FIELD_SELECTORS.yearLevel), intake ? intake + " intake" : "", getValue(FIELD_SELECTORS.schoolText)].filter(Boolean).join(" \u00b7 ");
    }
    if (def.id === "programs") {
      var parts = [];
      qAll(FIELD_SELECTORS.programInterest).forEach(function (opt, index) {
        if (!opt.checked) return;
        var config = matchCardConfig(opt, index);
        parts.push(config ? config.title : optionLabelText(opt));
      });
      var subjects = qAll(FIELD_SELECTORS.interestedSubjects).filter(function (opt) {
        return opt.checked;
      }).length;
      if (subjects) parts.push(subjects === 1 ? "1 subject" : subjects + " subjects");
      // Where nothing runs for the location and year level there is nothing to
      // pick, so the card folds complete with nothing to show for itself — a
      // tick over a blank line. It reports what actually happened.
      if (parts.length === 0) {
        var waitlist = q('input[name="join_no_program_waitlist"]');
        var offered = waitlist && isElementVisible(fieldWrapper(waitlist));
        if (waitlist && waitlist.checked) return "Waitlist joined";
        if (offered) return "No programs available yet";
      }
      return parts.join(" \u00b7 ");
    }
    if (def.id === "finish") {
      var referral = getValue(FIELD_SELECTORS.referral);
      // Read the box rather than assert it. This line was unconditional, so a
      // folded Final Details claimed the terms had been agreed before anyone
      // had ticked anything (Angad, 24 Aug 2026).
      var consent = q('input[name="tos_privacy_consent"]');
      return [referral, consent && consent.checked ? "Terms agreed" : ""].filter(Boolean).join(" \u00b7 ");
    }
    if (def.id === "campus") {
      return qAll(FIELD_SELECTORS.campus).filter(function (opt) {
        return opt.checked;
      }).map(function (opt) {
        // Suburb only — enhanceCampusLabels split the label into name and
        // address spans, so the address never carries brackets to strip on.
        var label = opt.closest("label");
        var name = label && label.querySelector(".contour-campus-name");
        return (name ? name.textContent : optionLabelText(opt).replace(/\s*\(.*$/, "")).trim();
      }).join(", ");
    }
    return "";
  }
  /* On the Guardian flow the card opens on the Guardian segment alone — the
     visitor leads with their own details — and the Student band and rows
     slide in once the guardian rows are answered — the same cascade the
     sections play, one level down (order flipped with the segments, Amrit,
     1 Sep 2026). Reveal-once, like sections: emptying a guardian field
     later never yanks filled student rows off the screen. */
  var studentSegmentRevealed = false;
  var STUDENT_SEG_HIDDEN_CLASS = "contour-student-seg-hidden";
  function studentSegmentNodes() {
    var nodes = qAll('[data-contour-person-static="student"]');
    return nodes.concat(personGroupRows(PERSON_GROUPS[0]));
  }
  // Data on screen outranks the cascade: a prefill link or restored draft
  // that already holds the student's details must never hide them behind
  // the reveal — rows that already hold an answer disappearing looks like
  // the form ate them (Amrit, 22 Aug).
  function studentSegmentHasAnswer() {
    var fields = PERSON_GROUPS[0].fields;
    for (var i = 0; i < fields.length; i++) {
      var el = q(fields[i].selector);
      var wrap = el ? fieldWrapper(el) : null;
      if (wrap && fieldWrapperAnswered(wrap)) return true;
    }
    return false;
  }
  function guardianSegmentComplete() {
    var fields = PERSON_GROUPS[1].fields;
    for (var i = 0; i < fields.length; i++) {
      // The phone never gates the reveal: the intl widget's validity is the
      // flakiest thing on the card, and a guardian midway through their own
      // number would face a card that refuses to grow. It stays required
      // for submission.
      if (fields[i].selector === FIELD_SELECTORS.guardianPhone) continue;
      var el = q(fields[i].selector);
      var wrap = el ? fieldWrapper(el) : null;
      if (!wrap) continue;
      if (fieldWrapperInvalid(wrap)) return false;
      if (!fieldIsRequired(wrap)) continue;
      if (!fieldWrapperAnswered(wrap)) return false;
    }
    return true;
  }
  function updateStudentSegmentCascade() {
    var nodes = studentSegmentNodes();
    if (nodes.length === 0) return;
    // Off the Guardian flow the Student band heads the visitor's own fields,
    // so the cascade has to hand it back on the way out rather than return
    // early and leave the hidden class on (the Guardian-era version of this
    // blanked the contact card that way; Amrit, 22 Aug). Reveal-once still
    // holds per flow, so Student -> Guardian -> Student doesn't replay the
    // slide-in for rows already seen.
    if (!isGuardianContactType()) {
      nodes.forEach(function (node) {
        node.classList.remove(STUDENT_SEG_HIDDEN_CLASS);
      });
      return;
    }
    // Everything shows at once when disclosure is off, for staff, and after
    // anything that reveals the whole form (submit attempt, prefill).
    var show = studentSegmentRevealed || !sectionFlowActive() || isInternalMode() || studentSegmentHasAnswer() || guardianSegmentComplete();
    nodes.forEach(function (node) {
      if (!show) {
        node.classList.add(STUDENT_SEG_HIDDEN_CLASS);
        return;
      }
      if (!node.classList.contains(STUDENT_SEG_HIDDEN_CLASS)) return;
      node.classList.remove(STUDENT_SEG_HIDDEN_CLASS);
      if (studentSegmentRevealed) return;
      playReveal(node);
    });
    if (show) studentSegmentRevealed = true;
  }
  // "Started" = any visible field in the group holds an answer. Auto-collapse
  // waits for a later section to be started, not merely revealed — revealing
  // is the form's doing, an answer is the student's, and only the second one
  // means they have moved on.
  function groupStarted(nodes) {
    var entries = groupFieldWraps(nodes);
    for (var i = 0; i < entries.length; i++) {
      if (!fieldVisibleInSection(entries[i])) continue;
      if (fieldWrapperAnswered(entries[i].wrap)) return true;
    }
    return false;
  }
  /* =========================================================
     STEP MODE — every card on the page, one of them open
     -----------------------------------------------------------
     The cascade showed the form growing; this shows the whole shape of it up
     front and walks through it. All five cards render from first paint. The
     ones whose turn has not come are greyed and shut. Exactly one card is
     open — the first one still missing an answer — and it cannot be folded
     while it is still missing one.

     Two rules carry the whole thing:

       - a card unlocks when every card above it reads complete, and never
         re-locks. Editing an earlier answer must not take away a card the
         visitor has already been through;
       - the open card gives way once it is complete AND focus has left it.
         The focus half is what stops the subject list folding on the first
         tick of a three-tick answer.

     Locked cards are not openable, and that is deliberate rather than
     cautious: Year Level is disabled until the intake year is picked, School
     until location and intake are both in, and the subject list is built by
     the matrix from location + year + intake. A card opened out of turn shows
     fields that cannot answer yet or a subject list filtered against nothing.
     The fields inside keep no disabled attribute of their own — HubSpot drops
     disabled inputs from the submission and rebuilds these nodes on every
     re-render, so the lock lives on the card (Amrit, 23 Aug 2026).
     ========================================================= */
  var STEP_LOCKED_CLASS = "contour-section-box--locked";
  var STEP_FLAGGED_CLASS = "contour-section-box--flagged";
  var STEP_PENDING_LABEL = "Pending";
  var sectionUnlocked = {};
  var activeSectionId = null;
  // Which cards a submit attempt found something wrong in. Cleared per attempt
  // and per card as the card is put right, so the mark never outlives the
  // problem it is pointing at.
  var sectionFlagged = {};
  function sectionIdForNode(node) {
    var box = node && node.closest ? node.closest(".contour-section-box") : null;
    return box ? box.getAttribute("data-contour-section") : null;
  }
  // A field inside a card the form has not opened yet is not the visitor's
  // mistake — it is a question they have not been asked.
  function stepSectionReportable(wrap) {
    if (!wrap) return true;
    var id = sectionIdForNode(wrap);
    if (!id || !SECTION_BOX_IDS[id]) return true;
    return !!sectionUnlocked[id];
  }
  function setStepFlags(wraps) {
    sectionFlagged = {};
    wraps.forEach(function (wrap) {
      var id = sectionIdForNode(wrap);
      if (id && SECTION_BOX_IDS[id]) sectionFlagged[id] = true;
    });
  }
  function flagStepSections(wraps) {
    setStepFlags(wraps);
    // Applied here rather than left to the queued pass: this is the answer to
    // a button the visitor has just pressed, and a beat of nothing happening
    // reads as the press not having landed.
    Object.keys(sectionBoxes).forEach(function (id) {
      if (sectionBoxes[id]) sectionBoxes[id].el.classList.toggle(STEP_FLAGGED_CLASS, !!sectionFlagged[id]);
    });
    scheduleSectionEval();
  }
  /* Once a submit attempt has been turned down, the form stays in "here is
     what is missing" mode and the report follows the visitor forward. Without
     this the summary froze on the first card's problems: the four contact
     fields stayed listed long after they were filled, while the section that
     actually still needed answers carried no mark at all — so the next card
     read as done (Angad, 24 Aug 2026).

     The list is every field still missing from a card the form has actually
     opened, recomputed each pass. So it grows as cards unlock, drops each
     section as it is answered, and empties itself — hiding the block — when
     nothing is left. Cards the form has not reached stay out of it, which is
     the whole reason the report was narrowed in the first place. */
  var submitAttempted = false;
  var lastStepReportKey = null;
  var STEP_NUDGED_ATTR = "data-contour-step-nudged";
  var stepNudging = false;
  /* The band and the summary say a card is short of answers; the fields
     themselves have to say which ones. HubSpot draws its message from its own
     blur handler, so each reported field gets one synthetic blur — once, and
     only in the card that is open. A folded card full of red is what the
     narrowing was for (Angad, 24 Aug 2026). */
  function nudgeStepReport(wraps) {
    var pending = [];
    wraps.forEach(function (wrap) {
      if (!wrap.getAttribute || wrap.getAttribute(STEP_NUDGED_ATTR) === "1") return;
      if (sectionIdForNode(wrap) !== activeSectionId) return;
      // Once per field: the nudge dispatches focusout, which runs the section
      // pass, which would arrive back here and nudge it again.
      wrap.setAttribute(STEP_NUDGED_ATTR, "1");
      pending.push(wrap);
    });
    if (pending.length === 0) return;
    stepNudging = true;
    pending.forEach(nudgeNativeValidation);
    stepNudging = false;
    // HubSpot renders on its own schedule, and never validates the consent
    // checkbox outside a submit it no longer gets to run.
    [160, 650].forEach(function (delay) {
      setTimeout(function () {
        pending.forEach(ensureNativeRequiredFallback);
        dedupeFieldErrors();
        syncFieldErrorAria();
      }, delay);
    });
  }
  function refreshStepReport() {
    if (!submitAttempted) return;
    var wraps = [];
    function consider(wrap) {
      if (!wrap || wraps.indexOf(wrap) !== -1) return;
      if (!stepSectionReportable(wrap)) return;
      wraps.push(wrap);
    }
    for (var i = 0; i < submitValidators.length; i++) {
      var valid = true;
      try {
        valid = submitValidators[i].isValid();
      } catch (err) {
        valid = true;
      }
      if (valid) continue;
      try {
        consider(submitValidators[i].anchor());
      } catch (err) { }
    }
    nativeRequiredFailures().forEach(consider);
    // Rejected answers as well as missing ones. A field HubSpot has turned
    // down is answered, so nativeRequiredFailures never sees it — which left
    // a card that could not be submitted carrying no mark and contributing
    // nothing to the list, while its own message sat inside it.
    Array.prototype.forEach.call(formRoot.querySelectorAll("." + FIELD_WRAPPER_CLASS), function (wrap) {
      if (!fieldWrapperInvalid(wrap)) return;
      if (!isElementVisible(wrap)) return;
      consider(wrap);
    });
    wraps.sort(documentOrder);
    setStepFlags(wraps);
    nudgeStepReport(wraps);
    // The summary rewrites its own subtree and this pass runs from a
    // MutationObserver over the form, so rebuilding it on an unchanged list
    // would have the two feeding each other forever.
    var key = wraps.map(fieldSummaryLabel).join("|");
    if (key === lastStepReportKey) return;
    lastStepReportKey = key;
    if (wraps.length === 0) {
      hideFormErrorSummary();
      return;
    }
    showFormErrorSummary(wraps);
  }
  // An empty section is transparent here for the same reason it is to the
  // reveal walker: Preferred Campuses carries no field until a program that
  // has campuses is picked, and a section with nothing to answer must not be
  // the thing holding the rest of the form shut.
  function boxedSectionComplete(groups, index) {
    var nodes = groups[index];
    if (!groupHasVisibleField(nodes)) return true;
    return groupComplete(nodes);
  }
  /* A card gets its turn if it still needs an answer OR if it has never been
     opened. The second half matters more than it looks: a section can read
     complete without ever asking anything. Where no program runs for the
     location and year level, Program Interest drops its required mark and the
     card holds nothing but the waitlist offer — so the step walked straight
     past it, and the student went from Academic Details to Preferred Campuses
     having never been told there was nothing for them. Every card the form has
     something to show now gets seen (Angad, 24 Aug 2026). */
  var sectionVisited = {};
  function stepNeedsAttention(groups, index, def) {
    if (!SECTION_BOX_IDS[def.id] || !sectionBoxes[def.id]) return false;
    // Nothing to show at all: not a step, and it cannot be opened anyway —
    // an empty card is display:none.
    if (!groupHasVisibleField(groups[index])) return false;
    if (!sectionVisited[def.id]) return true;
    return !groupComplete(groups[index]);
  }
  /* Answers already in place before the visitor has done anything were given
     by someone who has seen the card — a restored draft, a pre-fill link — so
     the step must not march them back through it. Only sections that have
     actually been started count, or a fresh form would treat Programs as seen
     merely because nothing in it is required yet.

     Re-seeded every pass until the first real interaction rather than once: a
     draft restores asynchronously, and a single seeding on the first pass ran
     before the values landed, which put the visitor back at the top of a form
     they were halfway down. Adding a visit is idempotent, so repeating it
     costs nothing. */
  var stepInteracted = false;
  /* Separate from stepInteracted, and the difference matters. Seeding asks
     "has the visitor started answering?", which only a typed or chosen value
     settles. The settling bypass below asks "has the visitor done anything
     deliberate yet?", and a press on a card header is exactly that — sharing
     one flag meant a restored draft never left the settling window, so every
     pass reset the open card and a click on any other header opened it for a
     frame and lost it again (Angad, 24 Aug 2026). */
  var stepUserActed = false;
  function seedStepVisits(groups) {
    if (stepInteracted) return;
    SECTION_DEFS.forEach(function (def, index) {
      if (!SECTION_BOX_IDS[def.id]) return;
      if (groupStarted(groups[index]) && boxedSectionComplete(groups, index)) sectionVisited[def.id] = true;
    });
  }
  function refreshSectionUnlocks(groups) {
    var reached = true;
    SECTION_DEFS.forEach(function (def, index) {
      if (!SECTION_BOX_IDS[def.id]) return;
      if (reached) sectionUnlocked[def.id] = true;
      if (stepNeedsAttention(groups, index, def)) reached = false;
    });
  }
  // Anything that hands over the whole form — a submit attempt, a pre-fill
  // link, staff mode — has to take the locks off with it. Nobody can fix an
  // error inside a card the form refuses to open.
  function unlockAllSectionSteps() {
    SECTION_DEFS.forEach(function (def) {
      if (!SECTION_BOX_IDS[def.id]) return;
      sectionUnlocked[def.id] = true;
      // Handing the whole form over says every card has been seen. Without
      // this the step would insist on walking a pre-filled visitor back
      // through cards their record already answered.
      sectionVisited[def.id] = true;
    });
  }
  function nextStepSectionId(groups) {
    for (var i = 0; i < SECTION_DEFS.length; i++) {
      if (stepNeedsAttention(groups, i, SECTION_DEFS[i])) return SECTION_DEFS[i].id;
    }
    return null;
  }
  /* Where the visitor's attention is, which is not the same as where the caret
     is. Focus alone was too narrow: the gap between two subject tiles, a
     tile's outer strip, the card's own padding — none of it is focusable, so a
     click plainly aimed inside the card left focus on the body, and the card
     folded and handed over under a click meant to pick another subject
     (Angad, 24 Aug 2026). A pointer-down is read wherever it lands, including
     outside the form, so clicking away still releases the card. */
  var attentionSectionId = null;
  var attentionAt = 0;
  function noteAttention(target) {
    // A press on a card the form has not opened yet is not a move. Its header
    // does nothing by design, so it must not set the rest of the step going
    // either: pressing a PENDING header while a finished card was open folded
    // that card and opened the next one, which from the visitor's seat is a
    // press on one section opening a different one (Angad, 24 Aug 2026).
    var id = sectionIdForNode(target);
    if (id && SECTION_BOX_IDS[id] && !sectionUnlocked[id]) return;
    attentionSectionId = id;
    attentionAt = Date.now();
  }
  function pressWasOnPendingCard(target) {
    var id = sectionIdForNode(target);
    return !!(id && SECTION_BOX_IDS[id] && !sectionUnlocked[id]);
  }
  /* The card a pointer is held down on right now, when that card is one a
     click can open. Between pointerdown and click the eval pass still runs —
     the press has blurred the old card, so focusout schedules one — and that
     pass used to hand the form over to its own next step. Folding one card
     and opening another mid-press shifts the page under the pointer, the
     release lands somewhere the visitor never aimed, and the click event
     never reaches the header they pressed: a press on Preferred Campuses
     opened Final Details (Akshay, 31 Aug 2026). While this is set, the
     hand-over waits for the click's own handler to say where the visitor
     is going. */
  var pressedSectionId = null;
  // Focus leaving for nowhere in particular. Two very different things look
  // identical from here — a press on the card's own dead space, which focuses
  // nothing, and tabbing or blurring away — so they are told apart by whether
  // a press landed a moment ago. A click's focusout follows its own
  // pointerdown within a frame or two; nothing else does.
  var ATTENTION_CLICK_MS = 250;
  function releaseAttentionOnBlur() {
    if (Date.now() - attentionAt < ATTENTION_CLICK_MS) return;
    attentionSectionId = null;
  }
  function focusInsideBox(id) {
    var box = sectionBoxes[id];
    var active = document.activeElement;
    if (!box || !active || active === document.body) return false;
    return box.el.contains(active);
  }
  /* Which card is open. A hand-picked card (the pencil) sets this directly and
     then falls under the same two brakes as one the form opened itself, so
     there is no second rule for manual choices to drift out of step with:

       - an unfinished card holds. This is the "cannot be collapsed" rule seen
         from the other side — the form will not move on from a question that
         has no answer yet, whichever card that question is in;
       - a finished card holds while focus is still inside it, then hands over
         to the earliest card still missing something. Nothing left to miss
         means nothing is open, which is the right resting state for a form
         that is ready to send. */
  // A pre-fill link is the one case where the form itself knows better than
  // "first unanswered card": the record is already complete, so nothing would
  // be open, and the link exists to add subjects. The pin holds that card
  // open until the visitor moves somewhere else themselves.
  var stepPinnedId = null;
  // When the open card last changed. A card that arrives already complete —
  // the waitlist one, or a section whose only field turned out not to apply —
  // would otherwise be handed over from in the same breath it opened, and
  // never actually be seen. It holds until the visitor does something.
  var activeOpenedAt = 0;
  /* What the visitor just pressed, and where it was on screen when they
     pressed it. Folding one card and opening another moves everything between
     them, and the header they aimed at can travel hundreds of pixels — so the
     page is held still against that header instead of being sent chasing after
     the card. Scrolling the page to the opened card was worse than the problem
     it fixed: a smooth scroll is still running when the next press comes, so
     the page slides while the visitor aims, and a header above the open card
     moves out from under the pointer before the click lands (Angad, 24 Aug
     2026). Nothing here reasons about where a card ought to end up. The thing
     that was clicked stays exactly where it was clicked. */
  var stepPressAnchor = null;
  function setActiveSection(id) {
    if (activeSectionId === id) return;
    activeSectionId = id;
    activeOpenedAt = Date.now();
  }
  function refreshActiveSection(groups) {
    if (stepPinnedId) {
      if (sectionBoxes[stepPinnedId]) {
        setActiveSection(stepPinnedId);
        return;
      }
      stepPinnedId = null;
    }
    var next = nextStepSectionId(groups);
    if (!activeSectionId || !sectionBoxes[activeSectionId]) {
      setActiveSection(next);
      return;
    }
    // Before the visitor does anything the form is still settling — a draft
    // arriving, HubSpot inserting a dependent group — and the open card is
    // whatever the answers say it should be. Holding a choice made during that
    // window is how a reload ended up back at the top of a half-filled form.
    if (!stepUserActed) {
      setActiveSection(next);
      return;
    }
    var index = sectionIndexById(activeSectionId);
    if (index !== -1 && !boxedSectionComplete(groups, index)) return;
    if (focusInsideBox(activeSectionId)) return;
    if (attentionSectionId === activeSectionId) return;
    if (attentionAt <= activeOpenedAt) return;
    // A press in flight toward another card, or one that just landed there:
    // the click's own handler is about to open it. Handing over to the
    // form's next step here folds cards under a pointer that is still mid
    // gesture — the page shifts, the click misses, and the visitor watches
    // a section they never pressed open instead (Akshay, 31 Aug 2026).
    if (pressedSectionId && pressedSectionId !== activeSectionId) return;
    if (attentionSectionId && SECTION_BOX_IDS[attentionSectionId] && Date.now() - attentionAt < ATTENTION_CLICK_MS) return;
    setActiveSection(next);
  }
  // Read off the card attributes the last pass wrote, so the Enter handler
  // does not recompute the groups on every keystroke.
  function stepFormReady() {
    for (var i = 0; i < SECTION_DEFS.length; i++) {
      var def = SECTION_DEFS[i];
      if (!SECTION_BOX_IDS[def.id]) continue;
      var box = sectionBoxes[def.id];
      // A card HubSpot has not rendered yet is not evidence of anything, and
      // the safe reading of "not sure" is "not ready": Enter blurs instead of
      // submitting, which costs a keystroke rather than a bad submission.
      if (!box) return false;
      if (box.el.classList.contains("contour-section-box--empty")) continue;
      if (box.el.getAttribute("data-contour-complete") !== "1") return false;
    }
    return true;
  }
  // The summary slot carries one of two things: a row of answers, or a single
  // state word. They are set differently — the word small and hard against the
  // far edge of the band — so the attribute that tells them apart is written
  // here with the text rather than alongside it. Preferred Campuses lost its
  // PENDING tag to exactly that drift: the branch for a card with no fields
  // yet wrote the word and not the mark (Angad, 24 Aug 2026).
  function setStepSummary(box, text) {
    if (box.summary.textContent !== text) box.summary.textContent = text;
    var word = text === STEP_PENDING_LABEL ? "1" : null;
    if ((box.el.getAttribute("data-contour-pending") || null) === word) return;
    if (word) box.el.setAttribute("data-contour-pending", word); else box.el.removeAttribute("data-contour-pending");
  }
  // Accurate here in a way it would not be on the submit button: a locked
  // header really does nothing at all when pressed.
  function setStepHeaderDisabled(box, disabled) {
    var flag = disabled ? "true" : null;
    if ((box.header.getAttribute("aria-disabled") || null) === flag) return;
    if (flag) box.header.setAttribute("aria-disabled", flag); else box.header.removeAttribute("aria-disabled");
  }
  function applyStepSectionStates(groups) {
    var heightChanged = false;
    seedStepVisits(groups);
    refreshSectionUnlocks(groups);
    refreshActiveSection(groups);
    /* Being open is what "seen" means, so it is recorded here and the locks
       are worked out again over it. Marking the visit at the end of the pass
       instead left the cards below waiting a whole event for their turn: a
       card that arrives already complete — the waitlist one — unlocked nothing
       until some unrelated click ran another pass, so Preferred Campuses and
       Final Details sat there saying PENDING with nothing standing in their
       way (Angad, 24 Aug 2026). */
    if (activeSectionId) sectionVisited[activeSectionId] = true;
    refreshSectionUnlocks(groups);
    refreshStepReport();
    SECTION_DEFS.forEach(function (def, index) {
      var box = sectionBoxes[def.id];
      if (!box) return;
      var nodes = groups[index];
      var locked = !sectionUnlocked[def.id];
      var empty = !groupHasVisibleField(nodes);
      // A locked card is a header and nothing else, so it can stand before
      // HubSpot has anything visible inside it — Preferred Campuses holds no
      // visible option until a program with campuses is picked, and hiding it
      // until then would undercount the form by a card, which is the one
      // thing the stepper exists to get right. If its turn comes and it still
      // has nothing to ask, it hides itself as it always did.
      box.el.classList.toggle("contour-section-box--empty", empty && !locked);
      box.el.classList.toggle(STEP_LOCKED_CLASS, locked);
      // Ahead of the empty branch: a locked card with no fields yet is still
      // shown, and a grey bar with no name on it is not a step.
      var title = sectionTitle(def) || "";
      if (box.title.textContent !== title) box.title.textContent = title;
      if (empty) {
        setStepSummary(box, STEP_PENDING_LABEL);
        box.el.classList.toggle(STEP_FLAGGED_CLASS, false);
        box.header.classList.toggle("contour-section-box__header--togglable", false);
        if (setSectionBoxCollapsed(def.id, true)) heightChanged = true;
        if (box.header.tabIndex !== -1) box.header.tabIndex = -1;
        setStepHeaderDisabled(box, true);
        return;
      }
      // Every text and attribute write here is guarded by a changed-check:
      // this runs from a MutationObserver over the same subtree, and an
      // identical rewrite still counts as a mutation.
      var complete = groupComplete(nodes);
      var completeAttr = complete ? "1" : "0";
      if (box.el.getAttribute("data-contour-complete") !== completeAttr) box.el.setAttribute("data-contour-complete", completeAttr);
      // The mark comes off the moment the card is put right, without waiting
      // for another submit attempt to tell it so.
      if (complete) delete sectionFlagged[def.id];
      var open = !locked && def.id === activeSectionId;
      // Two ways a card earns the band. A submit attempt naming fields inside
      // it, which is the report's doing; or — at any time, submit or no — the
      // card folding away with a message already on screen inside it. The
      // second is knowledge the form has anyway, and without it a rejected
      // answer folded behind the same quiet ring as a card nobody had reached,
      // so a known problem left the screen unmarked (Angad, 24 Aug 2026). The
      // open card is left alone: its message is right there under the field,
      // and reddening the band someone is working under says nothing new.
      var flagged = !!sectionFlagged[def.id] || !open && !locked && groupHasVisibleError(nodes);
      box.el.classList.toggle(STEP_FLAGGED_CLASS, flagged);
      // A locked card has nothing to show and the open one will not fold
      // while it is unanswered, so the pointer only changes over a card that
      // will actually respond to the click.
      box.header.classList.toggle("contour-section-box__header--togglable", !locked && (!open || complete));
      // A pending card has no answers to summarise, so the slot carries its
      // state instead — a bare title on a bare band read as broken rather
      // than as waiting (Angad, 23 Aug).
      var summaryText = locked ? STEP_PENDING_LABEL : sectionBoxSummary(def);
      // An unlocked card folded before it is finished is still pending; its
      // partial answers show if it has any, the label if it has none.
      if (!locked && !complete && !summaryText) summaryText = STEP_PENDING_LABEL;
      setStepSummary(box, summaryText);
      if (setSectionBoxCollapsed(def.id, !open)) heightChanged = true;
      // setSectionBoxCollapsed puts every folded header in the tab order as
      // the way back into its card. A locked one is not a way into anything.
      if (locked && box.header.tabIndex !== -1) box.header.tabIndex = -1;
      setStepHeaderDisabled(box, locked);
    });
    return heightChanged;
  }
  function scrollStepIntoView(id) {
    var box = sectionBoxes[id];
    if (!box) return;
    // force: the multi-select guard exists to stop the page moving on the
    // first tick of a list. By the time a step hands over, that list is
    // answered and folded — the card being opened is the thing to look at.
    // The box, not its header: scroll-margin for the sticky nav lives on the
    // box, and a scrolled bare header ends up sitting flush under the nav.
    scrollSectionIntoView({
      header: box.el,
      nodes: [box.el]
    }, true);
  }
  /* A card opened by a press scrolls to the top of the view, always — the
     off-screen-only nudge above is for answers landing while someone works,
     where an unasked-for scroll steals the page. A press is asked-for: the
     visitor chose that card, and leaving it wherever on the screen they
     happened to catch its header buries a tall card's questions below the
     fold (Akshay, 31 Aug 2026). The box, not the header, for the same
     scroll-margin reason as scrollStepIntoView. */
  var pressScrollUntil = 0;
  function scrollPressedSectionIntoView(id) {
    var box = sectionBoxes[id];
    if (!box || !box.el.getBoundingClientRect) return;
    // The pin holding the pressed header still has done its job by now;
    // this is the visitor's own move, so the pin stands down.
    noteIntentionalScroll();
    var smooth = !prefersReducedMotion();
    // While the glide runs, a new press freezes the page (see pointerdown).
    pressScrollUntil = smooth ? Date.now() + 700 : 0;
    box.el.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "start"
    });
  }
  function updateSectionBoxStates(groups) {
    if (!sectionBoxesEnabled()) return;
    if (stepModeEnabled()) {
      var openBefore = activeSectionId;
      var pressed = stepPressAnchor;
      stepPressAnchor = null;
      // No press to anchor on: hold the open card's header instead. The
      // generic anchor guess lands on the card that is about to fold, and an
      // anchor that folds is a hand-over where the whole page lurches up by
      // the folded card's height.
      var autoAnchor = null;
      if (!pressed && openBefore && sectionBoxes[openBefore] && sectionBoxes[openBefore].header.getBoundingClientRect) {
        autoAnchor = {
          el: sectionBoxes[openBefore].header,
          top: sectionBoxes[openBefore].header.getBoundingClientRect().top
        };
      }
      withScrollAnchor(function () {
        return applyStepSectionStates(groups);
      }, pressed || autoAnchor);
      // Not after a press: that scroll is for a hand-over the form decided on
      // — a press-opened card runs its own glide from toggleSectionBox, since
      // the toggle changes activeSectionId before this pass ever starts and
      // openBefore can never tell a press-open apart from no change at all.
      // Deferred past the fold: fired straight away it computes its endpoint
      // against a layout the collapse is still moving, and lands wherever
      // the page was mid-animation rather than at the new section.
      if (!pressed && activeSectionId && activeSectionId !== openBefore) {
        var stepScrollTo = activeSectionId;
        setTimeout(function () {
          if (activeSectionId === stepScrollTo) scrollStepIntoView(stepScrollTo);
        }, COLLAPSE_ANIM_MS + 60);
      }
      updateSubmitReveal(groups);
      return;
    }
    var startedFlags = SECTION_DEFS.map(function (def, index) {
      return revealedSections[def.id] && groupStarted(groups[index]);
    });
    withScrollAnchor(function () {
      return applySectionBoxStates(groups, startedFlags);
    });
    updateSubmitReveal(groups);
  }
  function applySectionBoxStates(groups, startedFlags) {
    var heightChanged = false;
    SECTION_DEFS.forEach(function (def, index) {
      var box = sectionBoxes[def.id];
      if (!box) return;
      var nodes = groups[index];
      var empty = !groupHasVisibleField(nodes);
      // Own class rather than setNodeSectionHidden: that helper's bookkeeping
      // belongs to the reveal system, and an empty card is a styling matter.
      box.el.classList.toggle("contour-section-box--empty", empty);
      if (empty) return;
      // Text and attribute writes are all guarded by a changed-check: this
      // runs from a MutationObserver over the same subtree, and identical
      // rewrites still count as mutations — the eval would chase its own
      // tail every tick.
      var title = sectionTitle(def) || "";
      if (box.title.textContent !== title) box.title.textContent = title;
      var complete = groupComplete(nodes);
      var completeAttr = complete ? "1" : "0";
      if (box.el.getAttribute("data-contour-complete") !== completeAttr) box.el.setAttribute("data-contour-complete", completeAttr);
      box.header.classList.toggle("contour-section-box__header--togglable", complete);
      if (!complete) {
        delete sectionBoxManualCollapsed[def.id];
        if (setSectionBoxCollapsed(def.id, false)) heightChanged = true;
        return;
      }
      var summaryText = sectionBoxSummary(def);
      if (box.summary.textContent !== summaryText) box.summary.textContent = summaryText;
      var laterStarted = startedFlags.some(function (started, j) {
        return started && j > index;
      });
      var collapsed;
      if (sectionBoxManualCollapsed[def.id]) collapsed = true;
      else if (sectionBoxManualOpen[def.id]) collapsed = false;
      else if (def.id === "finish")
        // Nothing comes after Finishing Up, so "moved on" can't be the cue —
        // it folds the moment its last answer lands (Amrit, 22 Aug), leaving
        // the submit button on its own.
        collapsed = true;
      // The working-here guard needs both signals: last interaction alone
      // would pin a section open after an auto-selected program marks the
      // next one started (the person has already typed on, focus elsewhere),
      // and focus alone misses clicks that land on body. Together they hold
      // a card open only while someone is genuinely still in it.
      else collapsed = laterStarted && !(lastInteractedSectionId === def.id && box.el.contains(document.activeElement));
      if (setSectionBoxCollapsed(def.id, collapsed)) heightChanged = true;
    });
    return heightChanged;
  }
  // The submit button is the last step of the cascade: it stays off the page
  // until every boxed section reads complete — the consent tick is what
  // finally brings it in. Reveal-once, like sections: un-ticking consent
  // afterwards never yanks the button back out.
  var submitRevealed = false;
  function allBoxedSectionsComplete(groups) {
    return SECTION_DEFS.every(function (def, index) {
      if (!SECTION_BOX_IDS[def.id]) return true;
      if (!groupHasVisibleField(groups[index])) return true;
      return groupComplete(groups[index]);
    });
  }
  function updateSubmitReveal(groups) {
    var node = formRoot.querySelector(".hs_submit") || formRoot.querySelector(".hs-submit");
    if (!node) return;
    if (stepModeEnabled()) {
      // The button is on the page from the start — the whole point of showing
      // every card is that the end of the form is visible, and a CTA that
      // appears out of nowhere puts it back out of sight. It wears a muted
      // style until the form is ready, and stays clickable while it does:
      // runSubmitGate takes the locks off and names every missing field as a
      // jump link, which is worth far more than a dead button (Amrit, 23 Aug).
      node.classList.remove("contour-submit-pending");
      var button = node.querySelector(".hs-button");
      if (!button) return;
      // Muted, but deliberately not aria-disabled: the click does something
      // useful — it takes the locks off and names every missing field as a
      // jump link. Announcing "disabled" would tell a screen reader not to
      // press the one control that would explain what is left.
      button.classList.toggle("contour-submit--waiting", !allBoxedSectionsComplete(groups));
      return;
    }
    if (!featureEnabled("progressiveSections") || !sectionBoxesEnabled() || isInternalMode()) {
      node.classList.remove("contour-submit-pending");
      return;
    }
    if (!submitRevealed && allBoxedSectionsComplete(groups)) submitRevealed = true;
    if (!submitRevealed) {
      // Re-applied every pass: a HubSpot re-render rebuilds this node bare.
      node.classList.add("contour-submit-pending");
      return;
    }
    if (!node.classList.contains("contour-submit-pending")) return;
    node.classList.remove("contour-submit-pending");
    playReveal(node);
  }
  function playFormEntrance() {
    if (!formRoot || prefersReducedMotion()) return;
    formRoot.classList.add("contour-form-enter");
    setTimeout(function () {
      formRoot.classList.remove("contour-form-enter");
    }, 900);
  }
  /* =========================================================
     ACCESSIBILITY — invalid fields announce themselves
     -----------------------------------------------------------
     Every error list on the form carries role="alert", so the message is read
     out when it appears, but nothing tied the message to the field. A screen
     reader landing on the box afterwards had no way to know it was rejected
     or why.
     ========================================================= */
  var ariaErrorSeq = 0;
  var ARIA_OWNED_ATTR = "data-contour-describes";
  function syncFieldErrorAria() {
    if (!formRoot) return;
    Array.prototype.forEach.call(formRoot.querySelectorAll("." + FIELD_WRAPPER_CLASS), function (wrap) {
      var shown = null;
      Array.prototype.forEach.call(wrap.querySelectorAll(".hs-error-msgs"), function (list) {
        if (!shown && list.style.display !== "none") shown = list;
      });
      if (shown && !shown.id) shown.id = "contour-error-" + ++ariaErrorSeq;
      Array.prototype.forEach.call(wrap.querySelectorAll("input[name], select[name], textarea[name], input[type='tel']"), function (control) {
        if (control.type === "hidden") return;
        var owned = control.getAttribute(ARIA_OWNED_ATTR);
        if (shown) {
          control.setAttribute("aria-invalid", "true");
          if (owned !== shown.id) {
            control.setAttribute("aria-describedby", shown.id);
            control.setAttribute(ARIA_OWNED_ATTR, shown.id);
          }
          return;
        }
        control.removeAttribute("aria-invalid");
        // Only ever removes the pointer this file put there.
        if (owned) {
          if (control.getAttribute("aria-describedby") === owned) control.removeAttribute("aria-describedby");
          control.removeAttribute(ARIA_OWNED_ATTR);
        }
      });
    });
  }
  // A greyed-out field with no explanation reads as broken. Program Interest
  // already says what it is waiting for; Year Level and Current School said
  // nothing at all.
  function setDisabledHint(fieldEl, text) {
    var wrap = fieldEl ? fieldWrapper(fieldEl) : null;
    if (!wrap) return;
    var hint = wrap.querySelector(".contour-disabled-hint");
    if (!text) {
      if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
      return;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "hs-field-desc contour-disabled-hint";
      wrap.appendChild(hint);
    }
    if (hint.textContent !== text) hint.textContent = text;
  }
  function isFieldWrapVisible(fieldWrap) {
    return isElementVisible(fieldWrap);
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
      reportFieldError(fieldWrap, focusTargetIn(fieldWrap));
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
    registerSubmitValidator({
      isValid: isValid,
      showError: showError,
      anchor: function () {
        return fieldWrap;
      }
    });
    return {
      isValid: isValid,
      showError: showError,
      clearError: clearError
    };
  }
  // A prefill visit may submit with no new subjects at all (Faraz, 31 Aug
  // 2026): the held ticks satisfy the required check and the student gets
  // their campus, school and phone updates through. The additional-subject
  // gate that briefly lived here was removed on that call.
  // A program backed by a held subject cannot be deselected: the trial or
  // enrolment it stands for keeps existing whatever this form says, and a
  // dropped card would overwrite program_interest into disagreeing with the
  // record (Amrit, 31 Aug 2026). The card snaps back and a note under the
  // cards says why; removals stay an ops action via the email reply.
  //
  // Only a still-eligible program snaps back. evaluateProgramInterestOptions
  // unchecks programs the location/year/intake pair rules out, and re-ticking
  // those would fight it forever, so an eligibility uncheck is let stand.
  function enforceHeldProgramLock() {
    var options = qAll(FIELD_SELECTORS.programInterest);
    if (options.length === 0) return;
    var fieldWrap = fieldWrapper(options[0]);
    var note = null;
    var noteTimer = null;
    function heldStatusFor(programValue) {
      if (prefetchedTrialSubjectCodes.length === 0 && prefetchedEnrolledSubjectCodes.length === 0) return null;
      var status = null;
      qAll(FIELD_SELECTORS.interestedSubjects).forEach(function (opt) {
        var classification = getClassification(opt);
        if (classification.program !== programValue || !classification.code) return;
        if (prefetchedEnrolledSubjectCodes.indexOf(classification.code) !== -1) status = "enrolled in";
        else if (!status && prefetchedTrialSubjectCodes.indexOf(classification.code) !== -1) status = "trialing";
      });
      return status;
    }
    function showNote(programValue, status) {
      if (!fieldWrap) return;
      if (!note) {
        note = document.createElement("div");
        note.className = "contour-program-held-note";
        note.setAttribute("role", "status");
        note.style.cssText = "margin: 8px 4px 0; font-size: 13px; font-weight: 600; color: #0C3166;";
        fieldWrap.appendChild(note);
      }
      var name = PROGRAM_DISPLAY_NAMES[programValue] || programValue;
      note.textContent = "You are already " + status + " a " + name + " subject, so this program stays selected.";
      note.style.removeProperty("display");
      if (noteTimer) clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        note.style.display = "none";
      }, 6000);
    }
    options.forEach(function (opt) {
      opt.addEventListener("change", function () {
        if (opt.checked) return;
        var status = heldStatusFor(opt.value);
        if (!status) return;
        var location = getValue(FIELD_SELECTORS.location);
        var yearLevel = getValue(FIELD_SELECTORS.yearLevel);
        var intakeYear = getValue(FIELD_SELECTORS.intakeYear);
        if (!location || !yearLevel || !intakeYear || !isProgramEligibleFromSubjects(opt.value, location, yearLevel, intakeYear)) return;
        var programValue = opt.value;
        // HubSpot's own handler for this same click settles after this
        // listener and would flip the tick straight back off, so the re-tick
        // waits until the event has fully run its course.
        setTimeout(function () {
          var fresh = qAll(FIELD_SELECTORS.programInterest).filter(function (o) {
            return o.value === programValue;
          })[0] || opt;
          if (!fresh.checked) setCheckboxChecked(fresh, true);
        }, 0);
        showNote(programValue, status);
      });
    });
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
      reportFieldError(fieldWrap, focusTargetIn(fieldWrap));
    }
    function clearError() {
      errorList.style.display = "none";
    }
    qAll(FIELD_SELECTORS.interestedSubjects).concat(qAll(FIELD_SELECTORS.programInterest)).forEach(function (opt) {
      opt.addEventListener("change", function () {
        if (isValid()) clearError();
      });
    });
    registerSubmitValidator({
      isValid: isValid,
      showError: showError,
      anchor: function () {
        return fieldWrap;
      }
    });
  }
  /* =========================================================
     CONTACT FIELD FORMAT VALIDATION
     -----------------------------------------------------------
     The form collects up to four contact points: the guardian's email and
     phone (always on the page, relabelled "Your ..." on the student flow)
     and the student's email and phone, which only exist inside the Contact
     Type dependent group. HubSpot's own validation only checks that a
     required field is non-empty, so whether what was typed is shaped like an
     address or a number is checked here. The four name fields (guardian and
     student, first and last) are held to the same standard: no digits, and
     not whitespace passed off as an answer.

     student_phone_number is deliberately not in the list below:
     enforceStudentPhoneValidation() already checks it against the custom
     widget's dial code, and a second validator would stack a second error
     message under the same field.
     ========================================================= */
  var EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  // Anything a real number can be written with. Digit count is bounded by the
  // same constants as the student phone widget, so the two phone fields agree
  // on what counts as a number.
  var PHONE_ALLOWED_CHARS = /^[\d\s+().-]+$/;
  // Names may not carry digits, and a value of nothing but whitespace reads as
  // filled to HubSpot's required check, so both are rejected here. A truly
  // empty box stays HubSpot's required error to report.
  /* Anything that is not a letter, a space, or the punctuation real names
     carry: O'Brien, Anne-Marie, D'Souza, St. John. Accented and non-Latin
     letters are letters — \u00C0 up covers the Latin supplement and beyond, so
     José and Nguyễn are names and "a@g.com" pasted into a name box is not
     (Amrit, 25 Aug 2026). Digits were the only thing caught before. */
  var NAME_DIGIT_PATTERN = /[^A-Za-z\u00C0-\u024F\u0370-\uFFFF '.\u2019-]/;
  var NAME_MESSAGE = "Please use letters only \u2014 no numbers or symbols.";
  var CONTACT_FORMAT_FIELDS = [
    {
      selector: FIELD_SELECTORS.firstName,
      kind: "name",
      message: NAME_MESSAGE,
      errorClass: "contour-firstname-error"
    },
    {
      selector: FIELD_SELECTORS.lastName,
      kind: "name",
      message: NAME_MESSAGE,
      errorClass: "contour-lastname-error"
    },
    {
      selector: FIELD_SELECTORS.studentFirstName,
      kind: "name",
      message: NAME_MESSAGE,
      errorClass: "contour-student-firstname-error"
    },
    {
      selector: FIELD_SELECTORS.studentLastName,
      kind: "name",
      message: NAME_MESSAGE,
      errorClass: "contour-student-lastname-error"
    },
    {
      selector: FIELD_SELECTORS.emailTemp,
      kind: "email",
      message: "Please enter a valid email address.",
      errorClass: "contour-email-temp-error"
    },
    {
      selector: FIELD_SELECTORS.studentEmail,
      kind: "email",
      message: "Please enter a valid email address.",
      errorClass: "contour-student-email-error"
    },
    {
      selector: FIELD_SELECTORS.guardianPhone,
      kind: "phone",
      message: "Please enter a valid phone number.",
      errorClass: "contour-phone-error"
    }
  ];
  var CONTACT_FORMAT_BOUND_ATTR = "data-contour-format-check";
  var CONTACT_FORMAT_TOUCHED_ATTR = "data-contour-format-touched";
  var contactFormatSubmitGates = {};
  // HubSpot's intl-phone widget — used by the guardian "phone" field, the only
  // one carrying useCountryCodeSelect — renders three siblings: a country
  // <select>, the visible <input type="tel"> the user types into, and a hidden
  // input that carries the field name. Matching on [name] therefore lands on an
  // element that never receives focus, so blur never fires. Resolve the visible
  // sibling instead; the dial code lives on the select, so what is typed in the
  // box is the national number on its own.
  function typableInput(input) {
    if (!input) return input;
    // The visible box is ours now, so anything that wants to blur, mark or
    // report on this field has to be pointed at that rather than at the
    // widget's own, which is off the screen.
    var group = input.closest(".hs-fieldtype-intl-phone, .contour-intl-phone");
    var proxy = group && group.querySelector("." + PHONE_PROXY_CLASS);
    if (proxy) return proxy;
    if (input.type !== "hidden") return input;
    return (group && group.querySelector('input[type="tel"]')) || input;
  }
  function contourErrorList(input, errorClass) {
    var wrapper = fieldWrapper(input) || input.parentElement;
    return wrapper ? wrapper.querySelector("." + errorClass) : null;
  }
  // Rendered in HubSpot's own error markup so it sits where a native message
  // would, and inherits the form's error styling untouched.
  function ensureContourError(input, errorClass, message) {
    var existing = contourErrorList(input, errorClass);
    if (existing) return existing;
    var wrapper = fieldWrapper(input) || input.parentElement;
    if (!wrapper) return null;
    var errorList = document.createElement("ul");
    errorList.className = "no-list hs-error-msgs inputs-list " + errorClass;
    errorList.setAttribute("role", "alert");
    errorList.style.display = "none";
    var errorItem = document.createElement("li");
    var errorLabel = document.createElement("label");
    errorLabel.className = "hs-error-msg hs-main-font-element";
    errorLabel.textContent = message;
    errorItem.appendChild(errorLabel);
    errorList.appendChild(errorItem);
    wrapper.appendChild(errorList);
    return errorList;
  }
  function showContourError(input, errorClass) {
    input.classList.add("invalid", "error");
    var list = contourErrorList(input, errorClass);
    if (list) list.style.display = "";
  }
  function clearContourError(input, errorClass) {
    var list = contourErrorList(input, errorClass);
    if (list) list.style.display = "none";
    // Student Email carries two checks (format, and not the guardian's), and
    // HubSpot adds its own, so the red state only comes off the box once none
    // of them is showing.
    var wrapper = fieldWrapper(input) || input.parentElement;
    var stillShowing = wrapper && Array.prototype.some.call(wrapper.querySelectorAll(".hs-error-msgs"), function (el) {
      return el.style.display !== "none";
    });
    if (!stillShowing) input.classList.remove("invalid", "error");
  }
  // What was actually typed, with the country code taken off. HubSpot's widget
  // seeds the box with the dial code as soon as a country is picked, so counting
  // every digit reads a freshly opened "+91" as a two-digit phone number. The
  // longest matching code wins, so a shorter one that is a prefix of the real
  // one is never mistaken for it.
  function phoneNationalDigits(value) {
    var digits = value.replace(/\D/g, "");
    if (value.charAt(0) !== "+") return digits;
    var dial = "";
    for (var i = 0; i < PHONE_DIAL_CODES.length; i++) {
      var code = PHONE_DIAL_CODES[i][0];
      if (code.length > dial.length && digits.indexOf(code) === 0) dial = code;
    }
    return digits.slice(dial.length);
  }
  /* The generic pattern accepts anything shaped like an address, so
     "angad@gamil.asdai.com" sails through it (Angad, 25 Aug 2026). Two layers
     answer that, and which layer a rule belongs in matters more than the rules
     themselves.

     Blocking is structure only — things that cannot be an address whoever owns
     the domain. No domain lookups: half the students sign up on a school
     address (edu.vic.edu.au, catholic.edu.au, a one-school domain nobody has
     heard of), and any list of "real" domains turns those away. A network
     check is worse still, since it fails whoever is behind a captive portal or
     a slow DNS.

     The typo layer never blocks. It only recognises a handful of consumer
     domains and only within one edit of them, which is far enough to catch
     gamil/gmial/hotmial and nowhere near far enough to reach a school domain —
     and it offers the correction rather than refusing the address, so being
     wrong about it costs a glance. */
  var EMAIL_TYPO_DOMAINS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.au", "icloud.com", "bigpond.com", "live.com", "me.com", "optusnet.com.au"];
  // Real domains that happen to sit one edit from one of the above. mail.com
  // is a live mail host and one insertion from gmail.com, so without this it
  // would be told it meant something else every time.
  var EMAIL_TYPO_EXEMPT = ["mail.com", "email.com", "gmx.com", "aol.com", "live.com.au", "yahoo.co.uk", "me.com.au"];
  function emailStructureIsValid(value) {
    if (!EMAIL_PATTERN.test(value)) return false;
    var at = value.lastIndexOf("@");
    if (at < 1) return false;
    var domain = value.slice(at + 1).toLowerCase();
    if (domain.indexOf("..") !== -1) return false;
    var labels = domain.split(".");
    // A domain with no dot cannot be reached from outside its own network, and
    // nobody signing up here has one.
    if (labels.length < 2) return false;
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (label === "") return false;
      if (label.charAt(0) === "-" || label.charAt(label.length - 1) === "-") return false;
    }
    // The last label is the public suffix: letters only, at least two of them.
    return /^[a-z]{2,}$/.test(labels[labels.length - 1]);
  }
  /* One edit away, counting a swap of two neighbours as one. Plain edit
     distance calls a swap two changes, which would miss the whole family this
     is for — gamil for gmail, gmial, hotmial, yahho are all neighbours in the
     wrong order, and they are the typos people actually make. */
  function withinOneEdit(a, b) {
    if (a === b) return false;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la === lb) {
      var diff = [];
      for (var i = 0; i < la; i++) {
        if (a.charAt(i) !== b.charAt(i)) {
          diff.push(i);
          if (diff.length > 2) return false;
        }
      }
      if (diff.length === 1) return true;
      // Two differences are only forgiven when they are the same two letters
      // the other way round, and adjacent.
      if (diff.length !== 2 || diff[1] !== diff[0] + 1) return false;
      return a.charAt(diff[0]) === b.charAt(diff[1]) && a.charAt(diff[1]) === b.charAt(diff[0]);
    }
    // One longer than the other: the extra character has to be the only thing
    // between them.
    var longer = la > lb ? a : b;
    var shorter = la > lb ? b : a;
    for (var j = 0; j < shorter.length; j++) {
      if (longer.charAt(j) === shorter.charAt(j)) continue;
      return longer.slice(j + 1) === shorter.slice(j);
    }
    return true;
  }
  /* The other half of the same idea, for the slip one edit cannot reach:
     gmail.asdkas.com, gmail.subdomain.com. Nobody's mailbox is at gmail
     under someone else's domain, so when a known provider's name turns up as
     the first label of a domain that is not theirs, the address they meant is
     the provider's own (Amrit, 25 Aug 2026).

     Only the first label, and only these providers. "mail.myschool.edu.au" is
     ordinary and untouched, because "mail" is not one of these names; and a
     domain that genuinely is the provider's — yahoo.com.au — is on the known
     list already and never reaches here. */
  function emailProviderMisplaced(domain) {
    var first = domain.split(".")[0];
    if (!first) return null;
    for (var i = 0; i < EMAIL_TYPO_DOMAINS.length; i++) {
      var known = EMAIL_TYPO_DOMAINS[i];
      if (known === domain) return null;
      if (known.split(".")[0] === first) return known;
    }
    return null;
  }
  function emailDomainSuggestion(value) {
    var at = value.lastIndexOf("@");
    if (at < 1) return null;
    var domain = value.slice(at + 1).toLowerCase();
    if (EMAIL_TYPO_EXEMPT.indexOf(domain) !== -1) return null;
    if (EMAIL_TYPO_DOMAINS.indexOf(domain) !== -1) return null;
    for (var i = 0; i < EMAIL_TYPO_DOMAINS.length; i++) {
      if (withinOneEdit(domain, EMAIL_TYPO_DOMAINS[i])) return value.slice(0, at + 1) + EMAIL_TYPO_DOMAINS[i];
    }
    var misplaced = emailProviderMisplaced(domain);
    if (misplaced) return value.slice(0, at + 1) + misplaced;
    return null;
  }
  function contactFormatIsValid(config, input) {
    var raw = input.value || "";
    var value = raw.trim();
    // Whitespace-only satisfies HubSpot's required check, so a name of nothing
    // but spaces has to be caught here; only a truly empty box is left to it.
    if (config.kind === "name") {
      if (value === "") return raw === "";
      return !NAME_DIGIT_PATTERN.test(value);
    }
    // Blank is HubSpot's own required error to report, not ours.
    if (value === "") return true;
    if (config.kind === "email") return emailStructureIsValid(value);
    if (!PHONE_ALLOWED_CHARS.test(value)) return false;
    var national = phoneNationalDigits(value);
    // Dial code and nothing else. HubSpot's own required error owns that state
    // — ours would stack a second line under it saying the same thing twice.
    if (national === "") return true;
    return national.length >= STUDENT_PHONE_MIN_DIGITS && national.length <= STUDENT_PHONE_MAX_DIGITS;
  }
  // HubSpot runs its own validation on the guardian phone box — required, its
  // own character rule, and an in-range check — and renders each in the same
  // .hs-error-msgs markup ours uses. Two red lines saying much the same thing
  // is worse than either alone, so when HubSpot has already spoken its message
  // wins and ours stays hidden. The student phone field never hits this: its
  // control is rebuilt here with the dial code seeded, so HubSpot has nothing
  // to say about it and studentPhoneState() is the only voice.
  function nativeErrorShowing(input) {
    var wrapper = fieldWrapper(input) || input.parentElement;
    if (!wrapper) return false;
    return Array.prototype.some.call(wrapper.querySelectorAll(".hs-error-msgs"), function (el) {
      return el.style.display !== "none" && el.className.indexOf("contour-") === -1 && el.textContent.trim() !== "";
    });
  }
  /* The typo note. Not an error: the address is structurally fine and may well
     be right, so it offers the correction and gets out of the way rather than
     refusing to let the form go. Shown on the way out of the box, taken back
     the moment the address changes or is put right. */
  var EMAIL_SUGGEST_CLASS = "contour-email-suggest";
  function emailSuggestionNode(input) {
    var wrap = fieldWrapper(input) || input.parentElement;
    return wrap ? wrap.querySelector("." + EMAIL_SUGGEST_CLASS) : null;
  }
  function clearEmailSuggestion(input) {
    var node = emailSuggestionNode(input);
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }
  function refreshEmailSuggestion(input, allowShow) {
    if (!input) return;
    var suggestion = allowShow ? emailDomainSuggestion((input.value || "").trim()) : null;
    if (!suggestion) {
      clearEmailSuggestion(input);
      return;
    }
    var node = emailSuggestionNode(input);
    if (!node) {
      var wrap = fieldWrapper(input) || input.parentElement;
      if (!wrap) return;
      node = document.createElement("div");
      node.className = "hs-field-desc " + EMAIL_SUGGEST_CLASS;
      wrap.appendChild(node);
    }
    if (node.getAttribute("data-contour-suggestion") === suggestion) return;
    node.setAttribute("data-contour-suggestion", suggestion);
    node.textContent = "Did you mean ";
    var button = document.createElement("button");
    button.type = "button";
    button.className = EMAIL_SUGGEST_CLASS + "__fix";
    button.textContent = suggestion;
    button.addEventListener("click", function () {
      input.value = suggestion;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      clearEmailSuggestion(input);
      try {
        input.focus();
      } catch (err) { }
    });
    node.appendChild(button);
    node.appendChild(document.createTextNode("?"));
  }
  // allowShow is false until the person has left the field at least once, so a
  // box they have not reached yet is never marked wrong.
  function refreshContactFormatError(config, input, allowShow) {
    if (config.kind === "email") refreshEmailSuggestion(input, allowShow);
    if (contactFormatIsValid(config, input) || nativeErrorShowing(input)) {
      clearContourError(input, config.errorClass);
      return;
    }
    if (allowShow) showContourError(input, config.errorClass);
  }
  function contactFormatTouched(input) {
    return input.getAttribute(CONTACT_FORMAT_TOUCHED_ATTR) === "1";
  }
  // Called from the form observer, so ours appears the moment HubSpot withdraws
  // its own message and disappears again the moment HubSpot posts one.
  function refreshAllContactFormatErrors() {
    CONTACT_FORMAT_FIELDS.forEach(function (config) {
      var input = typableInput(q(config.selector));
      if (input) refreshContactFormatError(config, input, contactFormatTouched(input));
    });
  }
  function enforceContactFormatField(config) {
    var input = typableInput(q(config.selector));
    if (!input) return;
    // Runs on every mutation, so skip an input that already carries the check.
    // A re-render replaces the node, dropping the flag, which re-binds it.
    if (input.getAttribute(CONTACT_FORMAT_BOUND_ATTR) === "1") return;
    input.setAttribute(CONTACT_FORMAT_BOUND_ATTR, "1");
    ensureContourError(input, config.errorClass, config.message);
    input.addEventListener("blur", function () {
      input.setAttribute(CONTACT_FORMAT_TOUCHED_ATTR, "1");
      refreshContactFormatError(config, input, true);
      syncFieldErrorAria();
    });
    input.addEventListener("input", function () {
      // Typing only ever takes the message away; it comes back on the way out.
      refreshContactFormatError(config, input, false);
    });
    if (formRoot && !contactFormatSubmitGates[config.errorClass]) {
      contactFormatSubmitGates[config.errorClass] = true;
      // Registered once for the lifetime of the form: formRoot survives the
      // field re-renders, so the check re-resolves the input each time it runs
      // rather than closing over a node that may since have been replaced.
      registerSubmitValidator({
        isValid: function () {
          var current = typableInput(q(config.selector));
          return !current || contactFormatIsValid(config, current);
        },
        showError: function () {
          var current = typableInput(q(config.selector));
          if (!current) return;
          current.setAttribute(CONTACT_FORMAT_TOUCHED_ATTR, "1");
          refreshContactFormatError(config, current, true);
          reportFieldError(fieldWrapper(current) || current, current);
        },
        anchor: function () {
          var current = typableInput(q(config.selector));
          return current ? fieldWrapper(current) || current : null;
        }
      });
    }
  }
  function enforceAllContactFormatValidation() {
    CONTACT_FORMAT_FIELDS.forEach(enforceContactFormatField);
  }
  function watchContactFields() {
    if (!formRoot) return;
    // student_email sits inside the Contact Type dependent group, so it isn't
    // in the DOM at init, and HubSpot rebuilds any of these fields when its own
    // validation fires — the same behaviour watchStudentPhoneField() handles.
    // Both binders are idempotent, so the nodes they add themselves just no-op
    // on the next observer callback.
    var observer = new MutationObserver(function () {
      enforceAllContactFormatValidation();
      enforceGuardianStudentEmailValidation();
      // Prefilled email locks land here too: student_email joins the DOM only
      // after the Guardian radio is set, and HubSpot re-renders swap in fresh
      // unlocked nodes. The binder no-ops on anything already locked.
      enforcePrefilledFieldLock();
      // enforceDuplicateEmailValidation(); // parked — see DUPLICATE EMAIL GUARD
      refreshAllContactFormatErrors();
      // The student fields join the DOM only after the Guardian radio is set,
      // so their card header, row classes and shortened labels can only be
      // painted from here. Idempotent — repeat passes make no DOM writes, so
      // this observer never feeds itself.
      updatePersonGroups();
    });
    observer.observe(formRoot, {
      childList: true,
      subtree: true
    });
  }
  /* =========================================================
     GUARDIAN EMAIL vs STUDENT EMAIL
     -----------------------------------------------------------
     On the Guardian flow one submission records two people, and HubSpot
     creates a contact for each. The same address on both collapses them onto
     a single record, taking the guardian's details with it, so the pair has
     to differ. Only checked while the student fields are on the page.
     ========================================================= */
  var EMAIL_PAIR_ERROR_CLASS = "contour-student-email-same-error";
  var EMAIL_PAIR_MESSAGE = "The student email must be different from the guardian email.";
  var EMAIL_PAIR_BOUND_ATTR = "data-contour-email-pair-check";
  var emailPairSubmitGateBound = false;
  var emailPairContactTypeBound = false;
  function emailPairInputs() {
    var guardian = q(FIELD_SELECTORS.emailTemp);
    var student = q(FIELD_SELECTORS.studentEmail);
    if (!guardian || !student) return null;
    var wrap = fieldWrapper(student);
    if (wrap && !isFieldWrapVisible(wrap)) return null;
    return { guardian: guardian, student: student };
  }
  function emailPairIsValid() {
    if (!isGuardianContactType()) return true;
    var pair = emailPairInputs();
    if (!pair) return true;
    var guardian = (pair.guardian.value || "").trim().toLowerCase();
    var student = (pair.student.value || "").trim().toLowerCase();
    // A half-typed address is not a clash yet; the required check covers blanks.
    if (guardian === "" || student === "") return true;
    return guardian !== student;
  }
  function updateEmailPairError(showWhenInvalid) {
    var pair = emailPairInputs();
    if (!pair) return;
    ensureContourError(pair.student, EMAIL_PAIR_ERROR_CLASS, EMAIL_PAIR_MESSAGE);
    if (emailPairIsValid()) {
      clearContourError(pair.student, EMAIL_PAIR_ERROR_CLASS);
      return;
    }
    if (showWhenInvalid) showContourError(pair.student, EMAIL_PAIR_ERROR_CLASS);
  }
  function enforceGuardianStudentEmailValidation() {
    if (!emailPairContactTypeBound) {
      emailPairContactTypeBound = true;
      // Switching to the student flow takes the student fields off the page,
      // so a clash raised under Guardian must not be left showing behind them.
      onContactTypeChange(function () {
        updateEmailPairError(false);
      });
    }
    var pair = emailPairInputs();
    if (!pair) return;
    ensureContourError(pair.student, EMAIL_PAIR_ERROR_CLASS, EMAIL_PAIR_MESSAGE);
    // Either box can be the one that creates the clash, so both are watched,
    // and the message always renders under Student Email — the field the
    // person filling the form is meant to change.
    [pair.guardian, pair.student].forEach(function (input) {
      if (input.getAttribute(EMAIL_PAIR_BOUND_ATTR) === "1") return;
      input.setAttribute(EMAIL_PAIR_BOUND_ATTR, "1");
      input.addEventListener("blur", function () {
        updateEmailPairError(true);
      });
      input.addEventListener("input", function () {
        updateEmailPairError(false);
      });
    });
    if (formRoot && !emailPairSubmitGateBound) {
      emailPairSubmitGateBound = true;
      registerSubmitValidator({
        isValid: emailPairIsValid,
        showError: function () {
          updateEmailPairError(true);
          var current = emailPairInputs();
          if (current) reportFieldError(fieldWrapper(current.student) || current.student, current.student);
        },
        anchor: function () {
          var current = emailPairInputs();
          return current ? fieldWrapper(current.student) : null;
        }
      });
    }
  }
  /* =========================================================
     DUPLICATE EMAIL GUARD — PARKED (Amrit, 20 Aug 2026)
     -----------------------------------------------------------
     Kept in full and commented out rather than deleted. The team has put the
     frontend blocking on hold: too many edge cases resolve wrong in a check
     that can only say "already registered", so deduplication moves to the
     backend, and this comes back as part of a friendlier enhancement —
     when the address is found, offer to email the person their pre-fill
     link (built from the HubSpot record ID the match returned) so they can
     add subjects through the landing page instead of being turned away
     (Akshay, Slack). Until then the form does no HubSpot cross-checking of
     email fields at all; the format validation above stays as it is.

     What the parked version does: checks every box holding the address of a
     person the submission would create — email_2 and student_email on the
     Student flow, student_email only on the Guardian flow, since a guardian
     registering a sibling is entitled to come back — against the contact
     `email` property alone, via the prefetch function's /exists route.
     Verdicts are cached per address, network failures fail open, a submit
     that beats the first lookup is held and resolved, and ?student_id= is
     the one exemption. Reinstating it means uncommenting this block, its
     two enforceDuplicateEmailValidation() calls (the form observer and
     init()), and the duplicateEmailCheck feature flag.
     ========================================================= */
  // var DUPLICATE_EMAIL_ERROR_CLASS = "contour-duplicate-email-error";
  // var DUPLICATE_EMAIL_BOUND_ATTR = "data-contour-duplicate-check";
  // // guardianFlow: whether the box still holds a checkable address once the
  // // Guardian flow is chosen. Only email_2 changes hands — it is the student's
  // // own address on the Student flow and the guardian's on the Guardian one.
  // var DUPLICATE_EMAIL_SLOTS = [{
  // key: "own",
  // selector: FIELD_SELECTORS.emailTemp,
  // guardianFlow: false,
  // message: "This email is already registered with us. Please use the personalised sign-up link we sent you, or contact our team."
  // }, {
  // key: "student",
  // selector: FIELD_SELECTORS.studentEmail,
  // guardianFlow: true,
  // message: "This student email is already registered with us. Please use the personalised sign-up link we sent you, or contact our team."
  // }];
  // var duplicateEmailResults = {};
  // var duplicateEmailPending = {};
  // var duplicateEmailGatesBound = {};
  // var duplicateEmailPendingGateBound = false;
  // var duplicateEmailContactTypeBound = false;
  // function duplicateEmailCheckEnabled() {
  // if (!featureEnabled("duplicateEmailCheck") || !PREFETCH_ENDPOINT) return false;
  // return getUrlParam(STUDENT_ID_PARAM).trim() === "";
  // }
  // // The box this slot names, but only while it is in play: on the page, on
  // // screen, and holding an address this flow is meant to check.
  // function duplicateEmailSlotInput(slot) {
  // if (!duplicateEmailCheckEnabled()) return null;
  // if (isGuardianContactType() && !slot.guardianFlow) return null;
  // var input = q(slot.selector);
  // if (!input) return null;
  // // student_email lives in the Contact Type dependent group: HubSpot leaves
  // // it on the page for a moment after the flow switches away from it.
  // var wrap = fieldWrapper(input);
  // if (wrap && !isFieldWrapVisible(wrap)) return null;
  // return input;
  // }
  // function duplicateEmailSlotsInPlay() {
  // var entries = [];
  // DUPLICATE_EMAIL_SLOTS.forEach(function (slot) {
  // var input = duplicateEmailSlotInput(slot);
  // if (input) entries.push({ slot: slot, input: input });
  // });
  // return entries;
  // }
  // function duplicateEmailValue(input) {
  // return ((input && input.value) || "").trim().toLowerCase();
  // }
  // // Worth a lookup: a complete address the endpoint will accept. Both shapes
  // // are applied because the endpoint rejects anything its own EMAIL_SHAPE
  // // fails, and a 400 is a wasted round trip.
  // function duplicateEmailCheckable(value) {
  // return value !== "" && value.length <= 254 && EMAIL_PATTERN.test(value) && EMAIL_SHAPE.test(value);
  // }
  // // true (registered), false (clear), or null for "not looked up yet".
  // function duplicateEmailVerdict(value) {
  // return Object.prototype.hasOwnProperty.call(duplicateEmailResults, value) ? duplicateEmailResults[value] : null;
  // }
  // function lookupDuplicateEmail(value) {
  // if (Object.prototype.hasOwnProperty.call(duplicateEmailResults, value)) {
  // return Promise.resolve(duplicateEmailResults[value]);
  // }
  // if (duplicateEmailPending[value]) return duplicateEmailPending[value];
  // var request = fetch(PREFETCH_ENDPOINT + "/exists?email=" + encodeURIComponent(value)).then(function (res) {
  // if (!res.ok) throw new Error("HTTP " + res.status);
  // return res.json();
  // }).then(function (data) {
  // duplicateEmailResults[value] = !!(data && data.exists);
  // return duplicateEmailResults[value];
  // }).catch(function (err) {
  // // Fail open: a signup must never be blocked by our own outage.
  // console.warn("Contour Form 1 logic: duplicate email check failed:", err);
  // duplicateEmailResults[value] = false;
  // return false;
  // }).then(function (exists) {
  // delete duplicateEmailPending[value];
  // return exists;
  // });
  // duplicateEmailPending[value] = request;
  // return request;
  // }
  // // An unknown verdict passes here; duplicateEmailPendingGate() resolves it.
  // function duplicateEmailSlotIsValid(slot) {
  // var input = duplicateEmailSlotInput(slot);
  // if (!input) return true;
  // var value = duplicateEmailValue(input);
  // if (!duplicateEmailCheckable(value)) return true;
  // return duplicateEmailVerdict(value) !== true;
  // }
  // function updateDuplicateEmailError(slot) {
  // var input = q(slot.selector);
  // if (!input) return;
  // ensureContourError(input, DUPLICATE_EMAIL_ERROR_CLASS, slot.message);
  // if (duplicateEmailSlotIsValid(slot)) {
  // clearContourError(input, DUPLICATE_EMAIL_ERROR_CLASS);
  // return;
  // }
  // showContourError(input, DUPLICATE_EMAIL_ERROR_CLASS);
  // }
  // // Switching flow moves which box counts as whose, so a message raised
  // // against an address that is no longer being checked must not be left
  // // behind under the new label — and one that is still standing has to stay.
  // function refreshDuplicateEmailErrors() {
  // DUPLICATE_EMAIL_SLOTS.forEach(updateDuplicateEmailError);
  // }
  // function checkDuplicateEmailOnBlur(slot) {
  // var input = duplicateEmailSlotInput(slot);
  // if (!input) return;
  // var value = duplicateEmailValue(input);
  // if (!duplicateEmailCheckable(value)) {
  // clearContourError(input, DUPLICATE_EMAIL_ERROR_CLASS);
  // return;
  // }
  // lookupDuplicateEmail(value).then(function () {
  // // Typed on since the lookup left: whatever is in the box now owns the
  // // verdict, and its own blur will ask for it.
  // if (duplicateEmailValue(input) !== value) return;
  // updateDuplicateEmailError(slot);
  // syncFieldErrorAria();
  // });
  // }
  // // A submit can arrive before an address has ever been looked up — autofill
  // // then Enter never blurs the field. The registered validators are
  // // synchronous, so unknown verdicts are resolved here instead: block this
  // // round quietly, and once the answers land either raise the messages or
  // // send the form on its way. Bound after runSubmitGate, so a round already
  // // blocked by another field never reaches this and never spends a lookup;
  // // the cached verdicts then take the re-submission straight through.
  // function duplicateEmailPendingGate(e) {
  // if (!duplicateEmailCheckEnabled()) return;
  // var waiting = [];
  // duplicateEmailSlotsInPlay().forEach(function (entry) {
  // var value = duplicateEmailValue(entry.input);
  // if (!duplicateEmailCheckable(value)) return;
  // if (duplicateEmailVerdict(value) !== null) return;
  // waiting.push(value);
  // });
  // if (waiting.length === 0) return;
  // e.preventDefault();
  // e.stopImmediatePropagation();
  // Promise.all(waiting.map(lookupDuplicateEmail)).then(function () {
  // var flagged = [];
  // DUPLICATE_EMAIL_SLOTS.forEach(function (slot) {
  // updateDuplicateEmailError(slot);
  // if (duplicateEmailSlotIsValid(slot)) return;
  // var input = duplicateEmailSlotInput(slot);
  // if (input) flagged.push({ wrap: fieldWrapper(input) || input, input: input });
  // });
  // if (flagged.length === 0) {
  // // Clean, and now cached: the same click, finished.
  // if (typeof formRoot.requestSubmit === "function") {
  // formRoot.requestSubmit();
  // } else {
  // var button = submitButtonEl();
  // if (button) button.click();
  // }
  // return;
  // }
  // markSubmitBusy(false);
  // // The verdicts can land a second or more after the click, by which time
  // // the caret may have moved on. Always scroll to the reason the submit
  // // did nothing, but only take focus if nothing else holds it.
  // var active = document.activeElement;
  // var caretIsFree = !active || active === document.body || active.type === "submit" || active.tagName === "BUTTON";
  // reportFieldError(flagged[0].wrap, caretIsFree ? flagged[0].input : null);
  // showFormErrorSummary(flagged.map(function (item) {
  // return item.wrap;
  // }));
  // syncFieldErrorAria();
  // });
  // }
  // function enforceDuplicateEmailValidation() {
  // if (!duplicateEmailCheckEnabled()) return;
  // if (!duplicateEmailContactTypeBound) {
  // duplicateEmailContactTypeBound = true;
  // onContactTypeChange(refreshDuplicateEmailErrors);
  // }
  // DUPLICATE_EMAIL_SLOTS.forEach(function (slot) {
  // // Bound whether or not the slot is in play right now: which of them is
  // // is decided when an event fires, not here. student_email is not even in
  // // the DOM until the Guardian flow is chosen, and HubSpot rebuilds either
  // // box when its own validation fires, so this runs from the form observer
  // // and skips an input that already carries the check.
  // var input = q(slot.selector);
  // if (!input) return;
  // if (input.getAttribute(DUPLICATE_EMAIL_BOUND_ATTR) !== "1") {
  // input.setAttribute(DUPLICATE_EMAIL_BOUND_ATTR, "1");
  // input.addEventListener("blur", function () {
  // checkDuplicateEmailOnBlur(slot);
  // });
  // input.addEventListener("input", function () {
  // // Typing only ever takes the message away; it comes back on the way out.
  // clearContourError(input, DUPLICATE_EMAIL_ERROR_CLASS);
  // });
  // }
  // if (formRoot && !duplicateEmailGatesBound[slot.key]) {
  // duplicateEmailGatesBound[slot.key] = true;
  // // One validator per box, so a summary that names both can name both.
  // registerSubmitValidator({
  // isValid: function () {
  // return duplicateEmailSlotIsValid(slot);
  // },
  // showError: function () {
  // var current = duplicateEmailSlotInput(slot);
  // if (!current) return;
  // updateDuplicateEmailError(slot);
  // reportFieldError(fieldWrapper(current) || current, current);
  // },
  // anchor: function () {
  // var current = duplicateEmailSlotInput(slot);
  // return current ? fieldWrapper(current) || current : null;
  // }
  // });
  // }
  // });
  // if (formRoot && !duplicateEmailPendingGateBound) {
  // duplicateEmailPendingGateBound = true;
  // formRoot.addEventListener("submit", duplicateEmailPendingGate, true);
  // }
  // }
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
    style.textContent = ".hs-form .hs_student_phone_number, .hs-form .hs-dependent-field > .hs_student_phone_number { flex: 0 0 calc(50% - 0.375rem) !important; box-sizing: border-box; margin-bottom: 0 !important; min-width: 0 !important; }" + ".hs-form .contour-intl-phone { display: flex; align-items: stretch; gap: 0.5rem; width: 100%; box-sizing: border-box; }" + '.hs-form select.contour-intl-phone__country:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex: 0 0 auto !important; width: auto !important; min-width: 90px; max-width: 130px; }' + '.hs-form input.contour-intl-phone__number:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { flex: 1 1 auto !important; width: auto !important; min-width: 0; }' + "@media screen and (max-width: 767px) { .hs-form .hs_student_phone_number, .hs-form .hs-dependent-field > .hs_student_phone_number { flex: 0 0 100% !important; } }" + '@media screen and (max-width: 480px) { .hs-form select.contour-intl-phone__country:not([type="checkbox"]):not([type="radio"]):not([type="file"]) { min-width: 76px; } }';
    document.head.appendChild(style);
  }
  var STUDENT_PHONE_DEFAULT_ISO = "au";
  var STUDENT_PHONE_MIN_DIGITS = 7;
  var STUDENT_PHONE_MAX_DIGITS = 20;
  // HubSpot's native intl-phone widget (the guardian/Your Phone field) geo-
  // detects the visitor's country and seeds its box with the dial code
  // ("+91" in India) before this code ever runs. The student widget mirrors
  // that answer instead of always opening on Australia, so the two phone
  // fields greet the visitor the same way (Amrit, 21 Aug 2026). The dial
  // code is read off the seeded value rather than HubSpot's select, whose
  // option format is theirs to change.
  function detectedPhoneIso() {
    var nativeInput = formRoot ? formRoot.querySelector('.hs-fieldtype-intl-phone input[type="tel"]') : null;
    var value = nativeInput ? (nativeInput.value || "").trim() : "";
    var parts = value.charAt(0) === "+" ? splitE164(value) : null;
    return parts ? parts.iso : STUDENT_PHONE_DEFAULT_ISO;
  }
  // The native widget labels countries as "India (भारत)" — English name plus
  // the native-script one — while the student widget shows just "India". The
  // parenthetical goes only when it holds non-ASCII text: "Congo (DRC)" is a
  // disambiguation, not a translation, and must stay. Idempotent — once
  // stripped there is no parenthetical left to match, so the MutationObserver
  // that re-runs this can never feed itself.
  function normalizeNativePhoneCountryNames() {
    if (!formRoot) return;
    qAll(".hs-fieldtype-intl-phone select option").forEach(function (option) {
      var match = option.textContent.match(/^(.*\S)\s*\(([^)]*)\)\s*$/);
      if (!match || !/[^ -]/.test(match[2])) return;
      option.textContent = match[1];
    });
  }
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
    selectStudentPhoneCountry(select, existingParts ? existingParts.iso : detectedPhoneIso());
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
    registerSubmitValidator({
      isValid: studentPhoneIsValid,
      showError: function () {
        updateStudentPhoneError(true);
        var input = q(FIELD_SELECTORS.studentPhone);
        reportFieldError(fieldWrapper(input) || input, input);
      },
      anchor: function () {
        var input = q(FIELD_SELECTORS.studentPhone);
        return input ? fieldWrapper(input) || input : null;
      }
    });
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
    // Staff hit both of these blank on every internal signup. They used to
    // need a dedicated listener to surface together; the single submit gate
    // now shows every failing check at once, so registering them is enough.
    INTERNAL_ONLY_FIELDS.forEach(function (config) {
      enforceFieldRequiredValidation(config.key, config.errorText, config.errorClass, isInternalMode, internalOnlyFieldSatisfied(config));
    });
  }
  // Grey helper note under the intake year dropdown clarifying when the
  // 2027 program actually starts (Amitav's request).
  var INTAKE_YEAR_NOTE_TEXT = "Some of our 2027 programs begin as early as November 2026 with a two-week free trial.";
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
    injectFormWidthStyles();
    injectSubjectTileStyles();
    injectDisabledFieldStyles();
    injectErrorRollupStyles();
    injectMotionStyles();
    watchErrorRollup();
    enhanceSchoolSearch();
    watchSchoolFieldRerender();
    injectRegionStyles();
    enhanceRegionField();
    watchRegionField();
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
    updateGuardianFieldLabels();
    onContactTypeChange(updateGuardianFieldLabels);
    enforceAllContactFormatValidation();
    injectStudentPhoneStyles();
    enhanceStudentPhoneField();
    watchStudentPhoneField();
    enforceStudentPhoneValidation();
    enforceGuardianStudentEmailValidation();
    // enforceDuplicateEmailValidation(); // parked — see DUPLICATE EMAIL GUARD
    watchContactFields();
    enforceFieldRequiredValidation("programInterest", "Please select a program.", "contour-program-interest-error", anyProgramInterestOptionEligible);
    enforceFieldRequiredValidation("campus", "Please select a campus.", "contour-campus-error", isFieldWrapVisible);
    enforceFieldRequiredValidation("interestedSubjects", "Please select at least one subject.", "contour-subjects-error", isFieldWrapVisible);
    enforceHeldProgramLock();
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
    renderUcatIntakeNote();
    initDraftCache();
    initPrefetchFromUrl();
  }
  return {
    init: init
  };
}();
