/*
 * CONTOUR STAFF GATE
 *
 * Sign-in in front of the internal signup form. It runs BEFORE
 * hbspt.forms.create, so a person who is not Contour staff never receives the
 * form markup at all. A gate that renders the form and then hides it is one
 * devtools toggle away from being no gate.
 *
 *   ContourStaffGate.require("#contour-form1", function () {
 *     hbspt.forms.create({ ... });
 *   });
 *
 * ONE PAGE, TWO AUDIENCES. The same embed serves the public form and the
 * internal one; ?type=internal is what separates them, exactly as it already
 * decides whether the two staff-only questions appear. Without it this stands
 * aside entirely — no panel, nothing hidden, no network call — and the callback
 * runs immediately, so a visitor's page behaves precisely as it did before the
 * gate existed. That is why there is no separate internal page.
 *
 * What it cannot do is stop someone posting straight to HubSpot's public
 * submit endpoint. That is true of every HubSpot form. Attribution here is
 * trustworthy in normal use, not tamper-proof against a determined insider.
 *
 * Nor is the staff name list a secret it protects: the HubSpot form-definition
 * endpoint serves every one of those names unauthenticated. What a stranger is
 * kept away from is a working internal form, not the names in it.
 *
 * ES5 on purpose, matching js/form1.js: both are hand-written in this style
 * and minified together by scripts/build-prod.sh.
 */
window.ContourStaffGate = (function () {
  "use strict";

  var DEFAULTS = {
    endpoint: "https://australia-southeast1-hubspot-signup-form.cloudfunctions.net/contour-form1-staff-auth",
    clientId: "",
    // A hint to Google's own dialog so it offers the right account first. It
    // is NOT the domain check — that happens on the verified token, server
    // side, where a browser cannot reach it.
    hostedDomain: "contoureducation.com.au"
  };

  var SESSION_KEY = "contour-staff-session";
  var GIS_SRC = "https://accounts.google.com/gsi/client";
  var PANEL_CLASS = "contour-staff-gate";
  var RIBBON_CLASS = "contour-staff-ribbon";
  var STYLE_ID = "contour-staff-gate-styles";

  // The same parameter form1.js reads to reveal the staff-only questions.
  var INTERNAL_TYPE_PARAM = "type";
  var INTERNAL_TYPE_VALUE = "internal";

  var config = {};
  var host = null;
  var onPass = null;
  var hiddenPeers = [];
  var footerWatcher = null;
  var footerRetryBound = false;
  // Held here as well as in sessionStorage, because sessionStorage throws
  // outright in a private window with site data blocked. Losing the session on
  // reload is a far smaller failure than refusing to sign anyone in.
  var current = null;

  function isInternalMode() {
    var match = new RegExp("[?&]" + INTERNAL_TYPE_PARAM + "=([^&#]*)").exec(window.location.search);
    var value = match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    return value.trim().toLowerCase() === INTERNAL_TYPE_VALUE;
  }

  function settings() {
    var provided = window.ContourStaffGateConfig || {};
    var merged = {};
    for (var key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
        merged[key] = provided[key] === undefined ? DEFAULTS[key] : provided[key];
      }
    }
    return merged;
  }

  function readStored() {
    try {
      var raw = window.sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeStored(session) {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      // In-memory only for this page load. Deliberate: see `current`.
    }
  }

  function clearStored() {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // Nothing to clear if storage is unavailable.
    }
  }

  /*
   * Expiry is judged HERE, at load, and nowhere else. A session that lapses
   * while someone is mid-form is left alone: forcing re-auth would destroy a
   * half-filled form in front of a student, and it would buy nothing, because
   * the submit endpoint is public either way.
   */
  function usable(session) {
    if (!session || session.ok !== true) return false;
    if (typeof session.exp !== "number" || !isFinite(session.exp)) return false;
    if (session.exp <= Math.floor(Date.now() / 1000)) return false;
    // Only the server can mint this, so a hand-written session object fails
    // here. Be clear about what that is worth: it stops someone typing four
    // fields into a console, and it stops nobody who signs in once and copies
    // a real one. The ticket is not verified anywhere — it cannot be, since
    // checking the HMAC needs LINK_KEY and that never reaches a browser.
    if (!/^[0-9a-f]{32}$/.test(String(session.ticket || ""))) return false;
    return typeof session.email === "string" && session.email.length > 0;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      // Sits inline, where the form will be. The page keeps its header, its
      // footer and its own background: the only things that go are the title
      // block and the form, and they come back on success.
      "." + PANEL_CLASS + "{width:100%;max-width:600px;margin:0 auto;padding:52px 32px 44px;",
      "background:#fff;border:1px solid #e3e6ec;border-radius:16px;",
      "box-shadow:0 10px 40px rgba(12,49,102,.08);font-family:inherit;color:#0C3166;text-align:center}",
      "." + PANEL_CLASS + "__title{margin:0 0 16px;font-size:34px;line-height:1.2;font-weight:700;color:#0C3166}",
      // No character cap and slim side padding: the copy reads on two lines
      // here rather than three, which is what the extra width is for.
      /*
       * Two lines, each a complete sentence on its own row — what the form is,
       * then what to do. Letting one paragraph wrap on its own put the break
       * mid-phrase ("on a student's / behalf"), which reads as a mistake.
       *
       * They are block elements rather than a <br>, so on a narrow screen each
       * sentence still wraps within itself instead of overflowing.
       */
      "." + PANEL_CLASS + "__body{margin:0 16px 40px;font-size:16px;line-height:1.7;color:#4a5568}",
      "." + PANEL_CLASS + "__line{display:block;text-wrap:pretty}",
      /*
       * Google renders this button itself, inside its own iframe. `size` tops
       * out at "large" and there is no height option, so the only way to make
       * what is INSIDE it bigger — the avatar, the label, the G mark — is to
       * scale the whole thing. A transform does not affect layout, hence the
       * matching min-height, or the button would overlap what follows.
       */
      "." + PANEL_CLASS + "__button{display:flex;justify-content:center;align-items:center;min-height:56px}",
      "." + PANEL_CLASS + "__button>*{transform:scale(1.15);transform-origin:center center}",
      // Collapses when empty, so a panel with nothing to report has no band of
      // dead space under the button.
      "." + PANEL_CLASS + "__status{margin:18px 0 0;font-size:14.5px;line-height:1.5;color:#b3261e}",
      "." + PANEL_CLASS + "__status:empty{display:none}",
      "." + PANEL_CLASS + "__retry{margin-top:14px;padding:9px 18px;font:inherit;font-size:14px;font-weight:600;",
      "color:#0C3166;background:#fff;border:1.5px solid #0C3166;border-radius:999px;cursor:pointer}",

      // Checking state: the button goes away entirely so there is nothing to
      // click twice, and comes back if it fails.
      "." + PANEL_CLASS + "__spinner{display:flex;align-items:center;justify-content:center;gap:10px;",
      "min-height:56px;font-size:15.5px;color:#4a5568}",
      "." + PANEL_CLASS + "__spinner i{width:18px;height:18px;border:2px solid #d7dce5;",
      "border-top-color:#0C3166;border-radius:50%;display:inline-block;animation:contour-staff-spin .7s linear infinite}",
      "@keyframes contour-staff-spin{to{transform:rotate(360deg)}}",

      // Signed-in ribbon: a flag off the left edge, out of the form's way.
      "." + RIBBON_CLASS + "{position:fixed;left:0;bottom:28px;z-index:2147482000;display:flex;",
      "align-items:center;gap:11px;padding:10px 18px 10px 12px;background:#fff;",
      "border:1px solid #e3e6ec;border-left:0;border-radius:0 12px 12px 0;",
      "box-shadow:0 4px 18px rgba(12,49,102,.12);font-family:inherit;max-width:min(320px,80vw);",
      "transition:transform .22s ease,opacity .22s ease}",
      // Slides back out the way it came rather than blinking off.
      "." + RIBBON_CLASS + "--away{transform:translateX(-110%);opacity:0;pointer-events:none}",
      "." + RIBBON_CLASS + "__avatar{width:34px;height:34px;border-radius:50%;flex:0 0 34px;",
      "object-fit:cover;background:#eef1f6}",
      "." + RIBBON_CLASS + "__initial{width:34px;height:34px;border-radius:50%;flex:0 0 34px;",
      "display:flex;align-items:center;justify-content:center;background:#0C3166;color:#fff;",
      "font-size:14px;font-weight:700}",
      "." + RIBBON_CLASS + "__text{display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-width:0}",
      "." + RIBBON_CLASS + "__name{font-size:13.5px;font-weight:600;color:#0C3166;line-height:1.25;",
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}",
      "." + RIBBON_CLASS + "__out{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12.5px;",
      "color:#4a5568;background:none;border:0;padding:0;text-decoration:underline;cursor:pointer;line-height:1.25}",
      "." + RIBBON_CLASS + "__out:hover{color:#0C3166}",
      "." + RIBBON_CLASS + "__out svg{width:13px;height:13px;flex:0 0 13px}",
      "@media (max-width:600px){." + RIBBON_CLASS + "{bottom:12px;padding:8px 14px 8px 10px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function element(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  /*
   * Hide the form's neighbours, not the page.
   *
   * The title block and the form sit as siblings in one Webflow grid. While
   * the gate is up, everything in that grid except the branch holding the
   * form is hidden, so the panel stands alone where the form will be — and
   * the page keeps its header, its footer and its own background.
   *
   * Derived from the DOM rather than a hardcoded class, so a Webflow class
   * rename does not quietly stop this working. Each element's previous inline
   * display is remembered, so restoring puts back exactly what was there.
   */
  function hidePeers() {
    restorePeers();
    var branch = host;
    while (branch && branch.parentElement && !branch.parentElement.classList.contains("w-layout-grid")) {
      branch = branch.parentElement;
      if (branch === document.body) return;
    }
    if (!branch || !branch.parentElement) return;
    var siblings = branch.parentElement.children;
    for (var i = 0; i < siblings.length; i++) {
      var el = siblings[i];
      if (el === branch || el.contains(host)) continue;
      hiddenPeers.push({ el: el, display: el.style.display });
      el.style.display = "none";
    }
  }

  function restorePeers() {
    for (var i = 0; i < hiddenPeers.length; i++) {
      hiddenPeers[i].el.style.display = hiddenPeers[i].display;
    }
    hiddenPeers = [];
  }

  function renderPanel() {
    injectStyles();
    hidePeers();
    host.innerHTML = "";

    var panel = element("div", PANEL_CLASS);
    panel.appendChild(element("h2", PANEL_CLASS + "__title", "Contour internal sign up form"));
    var body = element("p", PANEL_CLASS + "__body");
    body.appendChild(element("span", PANEL_CLASS + "__line",
      "For team members taking a signup on a student's behalf."));
    body.appendChild(element("span", PANEL_CLASS + "__line",
      "Sign in with your Contour Google account to continue."));
    panel.appendChild(body);

    var button = element("div", PANEL_CLASS + "__button");
    panel.appendChild(button);
    panel.appendChild(element("p", PANEL_CLASS + "__status"));
    host.appendChild(panel);
    return button;
  }

  function panelEl(suffix) {
    return host ? host.querySelector("." + PANEL_CLASS + suffix) : null;
  }

  // While a token is being checked there is nothing useful to click, so the
  // button is taken away rather than left live and ignorable.
  function setBusy(busy, message) {
    var button = panelEl("__button");
    var existing = panelEl("__spinner");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!button) return;
    if (!busy) {
      button.style.display = "";
      return;
    }
    button.style.display = "none";
    var spinner = element("div", PANEL_CLASS + "__spinner");
    spinner.appendChild(element("i"));
    spinner.appendChild(element("span", null, message || "Checking your account…"));
    button.parentNode.insertBefore(spinner, button.nextSibling);
  }

  function status(message, retry) {
    var el = panelEl("__status");
    if (!el) return;
    el.textContent = message || "";
    var existing = panelEl("__retry");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    if (!retry) return;
    var button = element("button", PANEL_CLASS + "__retry", "Try again");
    button.type = "button";
    button.addEventListener("click", function () { start(); });
    el.parentNode.appendChild(button);
  }

  function logoutIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4");
    var arrow = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    arrow.setAttribute("points", "16 17 21 12 16 7");
    var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "21"); line.setAttribute("y1", "12");
    line.setAttribute("x2", "9"); line.setAttribute("y2", "12");
    svg.appendChild(path);
    svg.appendChild(arrow);
    svg.appendChild(line);
    return svg;
  }

  /*
   * A flag off the left edge rather than a strip above the form. Above the
   * form it pushed the whole page down and ate a band of whitespace; down here
   * it stays visible while scrolling and costs the form no room. Campus
   * machines are shared, so whose name is going on the signup should be
   * readable at a glance without hunting for it.
   */
  function renderRibbon(session) {
    injectStyles();
    var existing = document.querySelector("." + RIBBON_CLASS);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

    var ribbon = element("div", RIBBON_CLASS);
    var name = session.name || session.email || "";

    if (session.picture) {
      var avatar = document.createElement("img");
      avatar.className = RIBBON_CLASS + "__avatar";
      avatar.src = session.picture;
      avatar.alt = "";
      avatar.referrerPolicy = "no-referrer";
      // A Google avatar URL can 404 once the photo changes; fall back to the
      // initial rather than leaving a broken image on the page.
      avatar.addEventListener("error", function () {
        if (avatar.parentNode) avatar.parentNode.replaceChild(initialDisc(name), avatar);
      });
      ribbon.appendChild(avatar);
    } else {
      ribbon.appendChild(initialDisc(name));
    }

    var text = element("div", RIBBON_CLASS + "__text");
    text.appendChild(element("span", RIBBON_CLASS + "__name", name));

    var out = element("button", RIBBON_CLASS + "__out");
    out.type = "button";
    out.appendChild(logoutIcon());
    out.appendChild(element("span", null, "Sign out"));
    out.addEventListener("click", function () {
      signOut();
      window.location.reload();
    });
    text.appendChild(out);

    ribbon.appendChild(text);
    document.body.appendChild(ribbon);
    watchFooterOverlap(ribbon);
  }

  /*
   * The footer is dark and full-bleed, and a white flag sitting on top of it
   * looks like a rendering fault rather than a status. So the ribbon retreats
   * off the left edge as soon as any part of the footer is on screen, and
   * comes back when it leaves.
   *
   * IntersectionObserver rather than a scroll handler: no work on frames where
   * nothing crosses the boundary. If either the observer or the footer is
   * missing the ribbon simply stays put, which is the old behaviour.
   */
  function watchFooterOverlap(ribbon) {
    if (footerWatcher) {
      footerWatcher.disconnect();
      footerWatcher = null;
    }
    if (typeof window.IntersectionObserver !== "function") return;
    var footer = document.querySelector("footer, .footer_wrapper, .footer_component");
    if (!footer) {
      /*
       * On a RELOAD with a stored session this runs while the document is
       * still parsing — the embed sits in the middle of the page, so the
       * footer below it does not exist yet and the watcher would silently
       * never attach. That is why the retreat worked right after signing in
       * and was gone after a refresh.
       *
       * Bound once, and the handlers re-enter this function rather than
       * duplicating it.
       */
      if (!footerRetryBound) {
        footerRetryBound = true;
        var retry = function () { watchFooterOverlap(ribbon); };
        document.addEventListener("DOMContentLoaded", retry);
        window.addEventListener("load", retry);
      }
      return;
    }
    // Signed out between the retry being scheduled and the document finishing.
    if (!ribbon.parentNode) return;
    footerWatcher = new window.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) ribbon.classList.add(RIBBON_CLASS + "--away");
        else ribbon.classList.remove(RIBBON_CLASS + "--away");
      }
    });
    footerWatcher.observe(footer);
  }

  function initialDisc(name) {
    var disc = element("div", RIBBON_CLASS + "__initial", (name || "?").trim().charAt(0).toUpperCase());
    return disc;
  }

  function loadGoogle() {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
      var existing = document.querySelector('script[src="' + GIS_SRC + '"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("Google sign-in failed to load.")); });
        return;
      }
      var script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error("Google sign-in failed to load.")); };
      document.head.appendChild(script);
    });
  }

  function exchange(credential) {
    status("", false);
    setBusy(true);
    return window.fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: credential })
    }).then(function (res) {
      return res.json().then(function (body) {
        return { status: res.status, body: body };
      });
    }).then(function (result) {
      if (result.status === 403) {
        setBusy(false);
        status("That's not a Contour account — sign in with your @contoureducation.com.au address.", false);
        return;
      }
      if (result.status !== 200 || !result.body || result.body.ok !== true) {
        setBusy(false);
        status("Couldn't sign you in. Try again.", true);
        return;
      }
      accept(result.body);
    })["catch"](function () {
      setBusy(false);
      status("Couldn't reach the sign-in service. Try again.", true);
    });
  }

  function accept(session) {
    current = session;
    writeStored(session);
    host.innerHTML = "";
    restorePeers();
    renderRibbon(session);
    if (onPass) onPass(session);
  }

  function start() {
    var button = renderPanel();
    return loadGoogle().then(function () {
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        hosted_domain: config.hostedDomain,
        callback: function (response) { return exchange(response.credential); }
      });
      window.google.accounts.id.renderButton(button, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        // The 1.15 scale above turns this into roughly 320px on screen.
        width: 280
      });
    })["catch"](function () {
      setBusy(false);
      status("Couldn't reach the sign-in service. Try again.", true);
    });
  }

  function signOut() {
    current = null;
    clearStored();
  }

  function require(target, callback) {
    config = settings();
    host = typeof target === "string" ? document.querySelector(target) : target;
    onPass = callback;
    if (!host) return;

    // A public visitor. Nothing to gate, nothing to render, no request to
    // make — hand straight back so the form is built exactly as it always was.
    if (!isInternalMode()) {
      if (onPass) onPass(null);
      return;
    }

    var stored = readStored();
    if (usable(stored)) {
      current = stored;
      renderRibbon(stored);
      if (onPass) onPass(stored);
      return;
    }
    clearStored();
    start();
  }

  function session() {
    return current;
  }

  return {
    require: require,
    session: session,
    signOut: signOut
  };
})();
