# Contour Form 1 — AY2026/27 Signup Form Logic

Custom JS + CSS for the Contour free-trial signup form (HubSpot form embedded in Webflow).
This repo is the source of truth for the form logic. Webflow owns page design and CSS;
it loads the JS from here via jsDelivr.

Staging page: https://contour-staging.webflow.io/free-trial-hubspot

## Structure

```
js/form1.js                    Form logic (loaded by Webflow via GitHub Pages)
css/form1.css                  Reference copy of the custom CSS (live copy lives in Webflow page header)
webflow/embed.html             Staging Code Embed — GitHub Pages URL, tracks main
webflow/production-embed.html  Production Code Embed — pinned jsDelivr tag URL
```

Internal docs and the HubSpot properties spreadsheet are kept local only
(gitignored) — this repo is public because free static hosting requires it.

## Deploying

Push to `main`. That's it — GitHub Pages rebuilds automatically (~30-60s)
and the URL used by Webflow serves the new version (browser cache max 10 min):

```
https://contour-tech.github.io/contour-education-signup-form-hubspot/js/form1.js
```

Why not jsDelivr `@main`: jsDelivr caches the branch→commit resolution for up
to 12 hours and the purge API does not clear that layer — pushes silently
don't appear. Pinned jsDelivr tag URLs are safe (immutable).

## Production releases

Push a version tag:

```
git tag v1.0.0 && git push origin v1.0.0
```

The `release-jsdelivr` workflow then verifies jsDelivr serves the tag
byte-identical and creates a GitHub Release containing the pinned production
URL (`https://cdn.jsdelivr.net/gh/contour-tech/contour-education-signup-form-hubspot@v1.0.0/js/form1.js`).

Bump the version in the src line of `webflow/production-embed.html` and paste
that file into the Code Embed on the production page; keep the GitHub Pages
URL (`webflow/embed.html`) for staging. Until the production page's embed is
swapped, both pages load the Pages URL and every push to main is live.

Publish to Webflow **staging only** unless the web team is looped in.

## Notes

- `js/form1.js` is ahead of the currently deployed Webflow inline version: it adds
  mandatory school-field validation (`schoolFieldSatisfied`, `contour-school-error`).
  Verify on staging on first deploy.
- The Cal.com "book a consultation" widget script on the Webflow page is a separate
  embed — unrelated to this repo.
