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
