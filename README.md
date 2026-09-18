# Contour Form 1 — AY2026/27 Signup Form Logic

Custom JS + CSS for the Contour free-trial signup form (HubSpot form embedded in Webflow).
This repo is the source of truth for the form logic. Webflow owns page design and CSS;
it loads the JS from here via jsDelivr.

Staging page: https://contour-staging.webflow.io/free-trial-hubspot

## Structure

```
js/form1.js                    Form logic — the staging copy, served straight off main
js/prod/form1.js               What production serves; written only by the promote workflow
css/form1.css                  Reference copy of the custom CSS (live copy lives in Webflow page header)
webflow/embed.html             Staging Code Embed — js/form1.js, tracks main
webflow/production-embed.html  Production Code Embed — js/prod/form1.js, moves on a release
data/schools-v1.json           School + university list the form's search reads, served off Pages
data/build-schools-json.py     Builds that file from the source CSV
data/source/...csv             Source of truth for the list (ACARA schools + CRICOS universities)
data/school-code-overrides.json  Contour school codes the CSV doesn't carry
```

Internal docs and the HubSpot properties spreadsheet are kept local only
(gitignored) — this repo is public because free static hosting requires it.

## Deploying to staging

Push to `main`. That's it — GitHub Pages rebuilds automatically (~30-60s)
and the staging page serves the new version (browser cache max 10 min):

```
https://contour-tech.github.io/contour-education-signup-form-hubspot/js/form1.js
```

Production is a different file on the same site and does not move:

```
https://contour-tech.github.io/contour-education-signup-form-hubspot/js/prod/form1.js
```

Why not jsDelivr `@main`, or a `production` branch: jsDelivr caches the
branch→commit resolution for up to 12 hours and the purge API does not clear
that layer — pushes silently don't appear. Pages serves exactly one branch, so
a second branch gets no URL of its own. Hence two paths rather than two
branches. Pinned jsDelivr tag URLs are safe (immutable) and stay available as
a rollback.

## The school and university list

The school search reads one JSON file from Pages:

```
https://contour-tech.github.io/contour-education-signup-form-hubspot/data/schools-v1.json
```

It holds ACARA schools and CRICOS universities together, told apart by `type`
(`"University"` vs `Primary`/`Secondary`/`Combined`/`Special`). The form shows
universities to a student whose year level is Graduated and schools to
everyone else. Schools are narrowed to the student's own state; universities
are not, since a student can be enrolled interstate.

To refresh the list, replace the CSV in `data/source/` and rebuild:

```
python3 data/build-schools-json.py
```

Commit both the CSV and the regenerated JSON. Staging picks it up on push;
production picks it up as soon as Pages rebuilds, since both builds of
`form1.js` read the same URL. The filename is versioned for that reason —
a change to the file's *shape* ships as `schools-v2.json` alongside the old
one, so the production build keeps reading the file it was written against
until it is promoted.

`data/school-code-overrides.json` carries Contour school codes the source CSV
is missing, plus any entry a CSV refresh drops that a code still points at.
The build merges it in by `acara_id`; without it, a refresh would silently
unassign a campus.

It was previously a .txt uploaded to Webflow, which minted a new CDN URL on
every edit and so needed a code change to refresh (Luke, 10 Sep 2026).

## The student email check

As the **student's** email box is left, the form asks HubSpot whether that
address already belongs to someone. Only the student's box is checked — on the
Student flow that is `email_2`, on the Guardian flow `student_email`. A
guardian's own address is never looked up, because a parent signing up a second
child is meant to reuse it.

`functions/prefetch` classifies the address server-side and returns one of
three verdicts, and nothing else about the record:

| verdict | when | what the form does |
|---|---|---|
| `clear` | no match, or a match this form does not act on (untyped, `temp *`, Tutor, School/Uni Representative, Supplier) | nothing |
| `student` | `contact_type` is Student | offers to email them the link that continues that signup; `canSendLink` says whether `add_subjects_url` is actually on the record |
| `guardian` | `contact_type` is Parent or Guardian | points at the field the address belongs in |

Both non-clear verdicts hold the submit. The two ways out are "that's me, send
me the link" and "not me, use a different address", and neither of them submits
this form. A lookup that fails or times out yields `unknown`, which passes —
our own outage must never cost a signup. Arriving on a `?student_id=` link
switches the whole check off, since that link is the answer it would offer.

`functions/send-link` is what the "Email me my link" button calls. It takes an
address, resolves the contact itself, and sets one boolean so a HubSpot
workflow sends the "continue your signup" email — which builds its button from
that contact's own `add_subjects_url`. The browser never sends or receives a
record id, and the flag is only ever set, so a second click cannot queue a
second email.

The boolean is `send_prefill_link` (Send Pre-fill Link, single checkbox). It
has no default in the function: writing a guessed property name onto a live
contact either sends nothing or sends the wrong mail to a real family, and
neither failure is visible from the function, so an unconfigured deploy returns
503 rather than writing.

```
gcloud functions deploy contour-form1-send-link --gen2 \
  --region=australia-southeast1 --project=hubspot-signup-form \
  --runtime=nodejs22 --entry-point=sendLink --trigger-http \
  --allow-unauthenticated --source=functions/send-link \
  --set-secrets=HUBSPOT_TOKEN=projects/1034904971230/secrets/contour-form1-hubspot-write-token:latest \
  --set-env-vars=SEND_TRIGGER_PROPERTY=send_prefill_link \
  --memory=256Mi --timeout=30s --max-instances=20
```

The write-scoped token is required: this is the only endpoint the form has that
writes to HubSpot. `functions/prefetch` stays on the read-only token.

`DRY_RUN=true` runs everything except the write — the address is resolved, the
record is checked, the caller gets the answer the form would get. Use it to
exercise the button without mailing anyone.

Redeploy prefetch alongside it, so `/exists` starts reporting `canSendLink`:

```
gcloud functions deploy contour-form1-prefetch --gen2 \
  --region=australia-southeast1 --project=hubspot-signup-form \
  --runtime=nodejs22 --entry-point=prefetch --trigger-http \
  --allow-unauthenticated --source=functions/prefetch \
  --set-secrets=HUBSPOT_TOKEN=projects/1034904971230/secrets/contour-form1-hubspot-token:latest \
  --memory=256Mi --timeout=60s --max-instances=100
```

### Testing before you deploy

Run both functions here and open `test/local-test.html?api=local`:

```
cd functions/prefetch  && HUBSPOT_TOKEN=$(gcloud secrets versions access latest \
  --secret=contour-form1-hubspot-token --project hubspot-signup-form) \
  PORT=8081 npx functions-framework --target=prefetch

cd functions/send-link && HUBSPOT_TOKEN=$(gcloud secrets versions access latest \
  --secret=contour-form1-hubspot-write-token --project hubspot-signup-form) \
  DRY_RUN=true SEND_TRIGGER_PROPERTY=send_prefill_link \
  PORT=8082 npx functions-framework --target=sendLink
```

Without `?api=local` the page talks to the deployed functions, as the live form
does. Either way it loads the **live** HubSpot form, so blur the email box to
test this check and don't submit unless you mean to create a real contact.

Turn the form's half off with `window.ContourForm1Config = { studentEmailRecognition: false }`
on the page; with it off the form behaves exactly as it did before.

## Production releases

Verify on staging, then push a version tag:

```
git tag v1.1.2 && git push origin v1.1.2
```

Two workflows run:

- `release-jsdelivr` verifies jsDelivr serves the tag byte-identical and
  creates a GitHub Release holding the immutable tag URL.
- `promote-to-production` copies that tag's `js/form1.js` to `js/prod/form1.js`
  on main, then waits until Pages serves it.

Nothing to paste into Webflow — the production embed's URL is stable, so a
release changes what it serves. **To roll back**, run `promote-to-production`
by hand (Actions → Run workflow) with the previous tag.

The embeds are pasted once each: `webflow/embed.html` on the staging page,
`webflow/production-embed.html` on the production page. Until the production
page's embed is swapped, it still loads `js/form1.js` and every push to main
is live there.

Publish to Webflow **staging only** unless the web team is looped in.

## Notes

- `js/form1.js` is ahead of the currently deployed Webflow inline version: it adds
  mandatory school-field validation (`schoolFieldSatisfied`, `contour-school-error`).
  Verify on staging on first deploy.
- The Cal.com "book a consultation" widget script on the Webflow page is a separate
  embed — unrelated to this repo.
