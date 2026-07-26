/* ============================================================
   Empyrien — Bahá'í Feast programs
   Shared behaviour: display preferences, reader assignment,
   pronunciation margin notes, slideshow, ambient tones.
   Plain ES2019. No build step, no dependencies.
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var PREFS_KEY = "empyrien.feast.prefs";
  var programId = document.body.getAttribute("data-program") || "";

  /* ---------------------------------------------------------- storage */

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private browsing, quota — preferences simply won't persist */
    }
  }

  /* ---------------------------------------------------------- preferences */

  /* Light by default rather than following the device: these pages are read
     aloud in lit rooms and shown on televisions, where light reads better. A
     reader who switches to dark keeps it. */
  var DEFAULTS = { theme: "light", contrast: "normal", face: "serif", lead: "normal", scale: 1 };
  var prefs = Object.assign({}, DEFAULTS, load(PREFS_KEY, {}));

  /* Earlier visits stored an empty theme meaning "follow the device"; treat
     anything unrecognised as the default so everyone lands on the same page. */
  if (prefs.theme !== "light" && prefs.theme !== "dark") prefs.theme = DEFAULTS.theme;

  var SCALES = [0.9, 1, 1.15, 1.35, 1.6, 1.9, 2.25];

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyPrefs() {
    root.setAttribute("data-theme", prefs.theme || systemTheme());
    root.setAttribute("data-contrast", prefs.contrast);
    root.setAttribute("data-face", prefs.face);
    root.setAttribute("data-lead", prefs.lead);
    root.style.setProperty("--scale", String(prefs.scale));
    syncControls();
    /* Bigger type means fewer words per screen, so the paging is redone. */
    if (typeof rebuildStage === "function") rebuildStage();
  }

  function setPref(key, value) {
    prefs[key] = value;
    save(PREFS_KEY, prefs);
    applyPrefs();
  }

  /* Follow the OS until the reader picks a side explicitly. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onScheme = function () { if (!prefs.theme) applyPrefs(); };
    if (mq.addEventListener) mq.addEventListener("change", onScheme);
    else if (mq.addListener) mq.addListener(onScheme);
  }

  function syncControls() {
    var effective = prefs.theme || systemTheme();

    var themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      /* The pill shows the mode you are in; its label says what a tap does. */
      var isDark = effective === "dark";
      themeBtn.setAttribute("aria-pressed", String(isDark));
      themeBtn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      var g = themeBtn.querySelector(".glyph");
      var t = themeBtn.querySelector(".text");
      if (g) g.textContent = isDark ? "◐" : "◑";
      if (t) t.textContent = isDark ? "Dark" : "Light";
    }

    document.querySelectorAll("[data-pref]").forEach(function (btn) {
      var key = btn.getAttribute("data-pref");
      btn.setAttribute("aria-pressed", String(prefs[key] === btn.getAttribute("data-value")));
    });

    var readout = document.getElementById("size-readout");
    if (readout) readout.textContent = Math.round(prefs.scale * 100) + "%";

    var dec = document.getElementById("size-down");
    var inc = document.getElementById("size-up");
    if (dec) dec.disabled = prefs.scale <= SCALES[0];
    if (inc) inc.disabled = prefs.scale >= SCALES[SCALES.length - 1];
  }

  function stepSize(dir) {
    var i = SCALES.indexOf(prefs.scale);
    if (i < 0) {
      i = 1;
      for (var k = 0; k < SCALES.length; k++) if (SCALES[k] <= prefs.scale) i = k;
    }
    var next = Math.min(SCALES.length - 1, Math.max(0, i + dir));
    setPref("scale", SCALES[next]);
  }

  applyPrefs();

  /* ---------------------------------------------------------- toolbar */

  function on(id, event, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(event, fn);
    return el;
  }

  on("theme-toggle", "click", function () {
    setPref("theme", (prefs.theme || systemTheme()) === "dark" ? "light" : "dark");
  });
  on("size-up", "click", function () { stepSize(1); });
  on("size-down", "click", function () { stepSize(-1); });

  document.querySelectorAll("[data-pref]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPref(btn.getAttribute("data-pref"), btn.getAttribute("data-value"));
    });
  });

  on("prefs-reset", "click", function () {
    prefs = Object.assign({}, DEFAULTS);
    save(PREFS_KEY, prefs);
    applyPrefs();
    toast("Display settings reset");
  });

  /* Disclosure panels in the toolbar (accessibility, readers). */
  document.querySelectorAll("[data-panel-toggle]").forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("data-panel-toggle"));
    if (!panel) return;
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
      if (!open) {
        var first = panel.querySelector("input, button, select");
        if (first) first.focus();
      }
    });
  });

  /* ---------------------------------------------------------- toast */

  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------------------------------------------------------- readings */

  var readings = [].slice.call(document.querySelectorAll(".reading"));
  if (!readings.length) return;

  /* ---------------------------------------------------------- readers */

  var READERS_KEY = "empyrien.feast." + programId + ".readers";
  var ASSIGN_KEY = "empyrien.feast." + programId + ".assign";

  var readers = load(READERS_KEY, []);
  var assignments = load(ASSIGN_KEY, {});

  var rosterEl = document.getElementById("roster");
  var readerInput = document.getElementById("reader-input");

  function readingKey(el) { return el.getAttribute("data-key") || el.id; }

  /* --- sharing ------------------------------------------------------ *
   * Assignments live on the device that made them, so to get them onto
   * everyone else's phone they travel in the link: the roster as names,
   * and one base-36 character per reading naming who has it.           */

  function shareQuery() {
    if (!readers.length) return "";
    var seats = readings.map(function (el) {
      var i = readers.indexOf(assignedTo(el));
      return (i < 0 || i > 35) ? "-" : i.toString(36);
    }).join("");
    return "?f=" + readers.map(encodeURIComponent).join("~") + "&s=" + seats;
  }

  function shareUrl() {
    return location.origin + location.pathname + shareQuery();
  }

  /* Read a shared link, if we arrived by one, before anything is drawn. */
  (function importFromLink() {
    var params = new URLSearchParams(location.search);
    var folk = params.get("f");
    if (!folk) return;

    var incoming = folk.split("~").map(function (n) {
      try { return decodeURIComponent(n).trim(); } catch (e) { return n.trim(); }
    }).filter(Boolean);
    if (!incoming.length) return;

    readers = incoming;
    assignments = {};
    var seats = params.get("s") || "";
    readings.forEach(function (el, i) {
      var ch = seats.charAt(i);
      var idx = parseInt(ch, 36);
      if (ch && ch !== "-" && !isNaN(idx) && readers[idx]) {
        assignments[readingKey(el)] = readers[idx];
      }
    });
    save(READERS_KEY, readers);
    save(ASSIGN_KEY, assignments);

    /* Tidy the address bar; the list now lives on this device. */
    if (window.history && history.replaceState) {
      history.replaceState(null, "", location.pathname);
    }
  })();

  function assignedTo(el) {
    var name = assignments[readingKey(el)];
    return name && readers.indexOf(name) >= 0 ? name : "";
  }

  function persistReaders() {
    save(READERS_KEY, readers);
    save(ASSIGN_KEY, assignments);
    refreshShare();
  }

  /* --- the QR code, redrawn as the assignments change ----------------- */

  var qrFrame = document.querySelector(".qr-frame");
  var qrStatic = qrFrame ? qrFrame.innerHTML : "";

  function qrSvg(matrix) {
    var n = matrix.length, b = 4, size = n + 2 * b;
    var finders = [[0, 0], [0, n - 7], [n - 7, 0]];
    function inFinder(r, c) {
      return finders.some(function (f) {
        return r >= f[0] && r < f[0] + 7 && c >= f[1] && c < f[1] + 7;
      });
    }
    var dots = "";
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (matrix[r][c] && !inFinder(r, c)) {
          dots += '<rect x="' + (c + b) + '" y="' + (r + b) + '" width="1" height="1" rx="0.26"/>';
        }
      }
    }
    var eyes = "";
    finders.forEach(function (f) {
      var x = f[1] + b, y = f[0] + b;
      eyes += '<rect class="eo" x="' + (x + 0.5) + '" y="' + (y + 0.5) + '" width="6" height="6" rx="1.9"/>';
      eyes += '<rect class="ei" x="' + (x + 2) + '" y="' + (y + 2) + '" width="3" height="3" rx="1"/>';
    });
    return '<svg class="qr" viewBox="0 0 ' + size + ' ' + size + '" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" ' +
      'aria-label="QR code linking to this programme">' +
      '<rect class="qbg" x="0" y="0" width="' + size + '" height="' + size + '" rx="3"/>' +
      '<g class="qm">' + dots + '</g><g class="qe">' + eyes + '</g></svg>';
  }

  var qrTitle = document.getElementById("qr-title");
  var qrBlurb = document.getElementById("qr-blurb");
  var qrLink = document.getElementById("qr-url");

  function refreshShare() {
    var url = shareUrl();
    var assigned = readings.filter(function (el) { return assignedTo(el); }).length;
    var shared = readers.length > 0;

    if (qrLink) {
      qrLink.href = url;
      qrLink.textContent = url.replace(/^https?:\/\//, "").replace(/\?.*$/, "") +
        (shared ? " + readers" : "");
    }
    if (qrTitle) {
      qrTitle.textContent = shared
        ? "Scan to get the programme and tonight’s readers"
        : "Follow along on your own device";
    }
    if (qrBlurb) {
      qrBlurb.textContent = shared
        ? "This code now carries the reading list. Whoever scans it sees the same " +
          "names beside the same readings — " + assigned + " of " + readings.length +
          " assigned. Re-scan after you change anything."
        : "Scan with a phone camera to open this programme — useful if the text on " +
          "the screen is small, or if you would rather read from your own device.";
    }

    if (!qrFrame) return;
    if (!shared) { qrFrame.innerHTML = qrStatic; return; }

    var matrix = window.FeastQR && window.FeastQR.build(url);
    if (matrix) {
      qrFrame.innerHTML = qrSvg(matrix);
    } else {
      /* Too many names to fit in a code — fall back to the plain link. */
      qrFrame.innerHTML = qrStatic;
      if (qrBlurb) {
        qrBlurb.textContent = "There are too many names to fit in a QR code. " +
          "Use “Copy link” below to send the list instead.";
      }
    }
  }

  function renderRoster() {
    if (!rosterEl) return;
    rosterEl.textContent = "";
    readers.forEach(function (name) {
      var n = readings.filter(function (r) { return assignedTo(r) === name; }).length;
      var chip = document.createElement("span");
      chip.className = "chip";
      var label = document.createElement("span");
      label.textContent = name;
      var count = document.createElement("span");
      count.className = "count";
      count.textContent = n ? n + (n === 1 ? " reading" : " readings") : "unassigned";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.innerHTML = "&times;";
      remove.setAttribute("aria-label", "Remove " + name);
      remove.addEventListener("click", function () {
        readers = readers.filter(function (r) { return r !== name; });
        Object.keys(assignments).forEach(function (k) {
          if (assignments[k] === name) delete assignments[k];
        });
        persistReaders();
        renderRoster();
        renderSelects();
      });
      chip.appendChild(label);
      chip.appendChild(count);
      chip.appendChild(remove);
      rosterEl.appendChild(chip);
    });
  }

  function renderSelects() {
    readings.forEach(function (el) {
      var select = el.querySelector(".assign select");
      if (!select) return;
      var current = assignedTo(el);
      select.textContent = "";
      var none = document.createElement("option");
      none.value = "";
      none.textContent = readers.length ? "— unassigned —" : "— add readers above —";
      select.appendChild(none);
      readers.forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
      select.value = current;
      select.classList.toggle("is-set", !!current);
    });
  }

  function addReader(raw) {
    var name = (raw || "").trim().replace(/\s+/g, " ");
    if (!name) return;
    if (readers.some(function (r) { return r.toLowerCase() === name.toLowerCase(); })) {
      toast(name + " is already on the list");
      return;
    }
    readers.push(name);
    persistReaders();
    renderRoster();
    renderSelects();
  }

  var addForm = document.getElementById("add-reader");
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      /* One name, or several separated by commas. */
      (readerInput.value || "").split(",").forEach(addReader);
      readerInput.value = "";
      readerInput.focus();
    });
  }

  readings.forEach(function (el) {
    var select = el.querySelector(".assign select");
    if (!select) return;
    select.addEventListener("change", function () {
      if (select.value) assignments[readingKey(el)] = select.value;
      else delete assignments[readingKey(el)];
      persistReaders();
      renderRoster();
      select.classList.toggle("is-set", !!select.value);
    });
  });

  on("assign-round", "click", function () {
    if (!readers.length) { toast("Add some readers first"); return; }
    readings.forEach(function (el, i) {
      assignments[readingKey(el)] = readers[i % readers.length];
    });
    persistReaders();
    renderRoster();
    renderSelects();
    toast("Readings shared out in order");
  });

  on("assign-shuffle", "click", function () {
    if (!readers.length) { toast("Add some readers first"); return; }
    /* Shuffle a repeated roster so everyone gets a turn before anyone repeats. */
    var pool = [];
    while (pool.length < readings.length) pool = pool.concat(readers);
    pool = pool.slice(0, readings.length);
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    readings.forEach(function (el, i) { assignments[readingKey(el)] = pool[i]; });
    persistReaders();
    renderRoster();
    renderSelects();
    toast("Readings shuffled");
  });

  on("assign-clear", "click", function () {
    assignments = {};
    persistReaders();
    renderRoster();
    renderSelects();
    toast("Assignments cleared");
  });

  /* Copy or send the link, for anyone not in the room to scan the screen. */
  on("share-link", "click", function () {
    var url = shareUrl();
    var title = document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast(readers.length ? "Link copied, readers included" : "Link copied");
      }, function () {
        window.prompt("Copy this link", url);
      });
      return;
    }
    window.prompt("Copy this link", url);
  });

  renderRoster();
  renderSelects();
  refreshShare();

  /* ---------------------------------------------------------- pronunciation */

  var glossary = window.FEAST_GLOSSARY || {};
  var terms = Object.keys(glossary).sort(function (a, b) { return b.length - a.length; });

  /* A "word" here may contain letters, curly apostrophes and hyphens, so the
     usual \b boundary is no use. Capture the preceding character instead. */
  var BOUND = "[^0-9A-Za-z\\u00C0-\\u024F\\u1E00-\\u1EFF\\u2019'\\-]";
  var termRe = null;
  if (terms.length) {
    var alt = terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    termRe = new RegExp("(^|" + BOUND + ")(" + alt + ")(?=" + BOUND + "|$)", "gi");
  }

  function lookup(word) {
    if (glossary[word]) return glossary[word];
    var lower = word.toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (terms[i].toLowerCase() === lower) return glossary[terms[i]];
    }
    return null;
  }

  function markTerms(container) {
    if (!termRe) return;
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentNode && node.parentNode.closest(".pron")) continue;
      if (termRe.test(node.nodeValue)) nodes.push(node);
      termRe.lastIndex = 0;
    }

    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0;
      var m;
      termRe.lastIndex = 0;
      while ((m = termRe.exec(text)) !== null) {
        var start = m.index + m[1].length;
        var word = m[2];
        var entry = lookup(word);
        if (!entry) continue;
        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pron";
        btn.textContent = word;
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", word + " — how to say it");
        btn.dataset.say = entry.say;
        if (entry.gloss) btn.dataset.gloss = entry.gloss;
        frag.appendChild(btn);
        last = start + word.length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      if (frag.childNodes.length) textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  readings.forEach(function (el) {
    var text = el.querySelector(".reading-text");
    if (text) markTerms(text);
  });

  /* Wide screens get the note in the margin, level with the word. Narrow ones
     have no margin, and putting it under the passage buried it below the fold,
     so there it becomes a bubble pinned to the bottom of the screen: always in
     view, and it neither reflows the text nor covers the line being read. */
  var wideEnough = window.matchMedia("(min-width: 60rem)");
  var openNote = null;
  var bubble = null;

  function makeBubble() {
    if (bubble) return bubble;
    bubble = document.createElement("div");
    bubble.className = "pron-bubble";
    bubble.setAttribute("role", "status");
    bubble.hidden = true;

    var body = document.createElement("div");
    body.className = "pron-note";
    bubble.appendChild(body);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "pron-close";
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Close pronunciation");
    close.addEventListener("click", closeNote);
    bubble.appendChild(close);

    document.body.appendChild(bubble);
    return bubble;
  }

  function fillNote(note, btn) {
    note.textContent = "";
    var word = document.createElement("div");
    word.className = "word";
    word.textContent = btn.textContent;
    var say = document.createElement("div");
    say.className = "say";
    say.textContent = btn.dataset.say;
    note.appendChild(word);
    note.appendChild(say);
    if (btn.dataset.gloss) {
      var gloss = document.createElement("div");
      gloss.className = "gloss";
      gloss.textContent = btn.dataset.gloss;
      note.appendChild(gloss);
    }
  }

  function closeNote() {
    if (!openNote) return;
    openNote.button.setAttribute("aria-expanded", "false");
    openNote.container.hidden = true;
    openNote = null;
  }

  function showNote(btn) {
    if (openNote && openNote.button === btn) { closeNote(); return; }
    closeNote();

    if (!wideEnough.matches) {
      var box = makeBubble();
      fillNote(box.querySelector(".pron-note"), btn);
      box.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      openNote = { button: btn, container: box };
      return;
    }

    var card = btn.closest(".reading");
    var gutter = card && card.querySelector(".reading-gutter");
    if (!gutter) return;

    var note = gutter.querySelector(".pron-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "pron-note";
      note.setAttribute("role", "status");
      gutter.appendChild(note);
    }
    fillNote(note, btn);
    note.hidden = false;

    var top = btn.getBoundingClientRect().top - gutter.getBoundingClientRect().top;
    var maxTop = Math.max(0, gutter.offsetHeight - note.offsetHeight);
    note.style.top = Math.max(0, Math.min(top, maxTop)) + "px";

    btn.setAttribute("aria-expanded", "true");
    openNote = { button: btn, container: note };
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".pron");
    if (btn && !btn.closest(".stage")) { showNote(btn); return; }
    /* Tapping the bubble itself should not dismiss it; its ✕ handles that. */
    if (!e.target.closest || !e.target.closest(".pron-note, .pron-bubble")) closeNote();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && openNote) closeNote();
  });

  window.addEventListener("resize", closeNote);

  /* ---------------------------------------------------------- slideshow */

  var stage = document.getElementById("stage");
  var stageIndex = 0;

  /* One slide per reading, always — the slide changes when the reader changes,
     and nothing else. A long passage earns more of the screen's width rather
     than being broken across screens. */
  var WIDTH_TIERS = [50, 62, 74, 86, 96]; // percent of the viewport
  var COMFORTABLE = 34; // px — stop widening once the text is this big
  var FLOOR = 20;       // px — never shrink past this; let the slide scroll

  /* --- fitting -------------------------------------------------------- */

  /* The stage body is a flex column that always fills its grid row, so its
     scrollHeight never drops below clientHeight and can't show us headroom.
     Add up what is actually in it instead. */
  function contentHeight(body) {
    var total = 0;
    [].forEach.call(body.children, function (child) {
      if (child.hidden) return;
      var cs = getComputedStyle(child);
      total += child.offsetHeight +
        (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    });
    var bs = getComputedStyle(body);
    return total + (parseFloat(bs.paddingTop) || 0) + (parseFloat(bs.paddingBottom) || 0);
  }

  function measureFit(text, body) {
    /* A little slack absorbs sub-pixel rounding and a source line that wraps
       to a second row on a narrower screen. */
    var room = body.clientHeight - 8;
    var lo = 12, hi = 110, best = lo;
    for (var i = 0; i < 10; i++) {
      var mid = (lo + hi) / 2;
      text.style.fontSize = mid + "px";
      if (contentHeight(body) <= room) { best = mid; lo = mid; }
      else { hi = mid; }
    }
    text.style.fontSize = best + "px";
    return best;
  }

  /* Give the passage as much width as it needs to stay comfortably large,
     and no more — a short prayer keeps a narrow, composed column. */
  function fitSlide() {
    var body = stage.querySelector(".stage-body");
    var text = stage.querySelector(".stage-text");
    if (!body || !text) return;

    var chosen = WIDTH_TIERS[0];
    var size = 0;
    for (var i = 0; i < WIDTH_TIERS.length; i++) {
      chosen = WIDTH_TIERS[i];
      text.style.maxWidth = chosen + "vw";
      size = measureFit(text, body);
      if (size >= COMFORTABLE) break;
    }

    /* On a small screen a long passage may still not fit at a legible size.
       Hold the floor and let it scroll rather than shrink into illegibility. */
    var scrolls = size < FLOOR;
    text.style.fontSize = Math.max(size, FLOOR) + "px";
    body.classList.toggle("is-scrolling", scrolls);
    if (scrolls) body.scrollTop = 0;

    /* Centring reads well for a few lines; across a wide screen it makes the
       eye hunt for the start of each line, which is fatal when reading aloud. */
    text.classList.toggle("is-wide", chosen >= 74);
  }

  function renderSlide() {
    var el = readings[stageIndex];
    if (!el) return;

    stage.querySelector(".stage-count").textContent = el.getAttribute("data-label") || "";

    var name = assignedTo(el);
    stage.querySelector(".stage-reader").textContent = name ? "Read by " + name : "";

    var author = (el.querySelector(".reading-author") || {}).textContent || "";
    var src = (el.querySelector(".reading-source") || {}).textContent || "";
    stage.querySelector(".stage-source").textContent =
      (author + (src ? " · " + src : "")).trim();

    var text = stage.querySelector(".stage-text");
    text.textContent = "";
    var body$ = el.querySelector(".reading-text");
    if (body$) {
      var clone = body$.cloneNode(true);
      /* Buttons inside the slide would be tab-traps on a television. */
      [].forEach.call(clone.querySelectorAll(".pron"), function (b) {
        b.parentNode.replaceChild(document.createTextNode(b.textContent), b);
      });
      while (clone.firstChild) text.appendChild(clone.firstChild);
    }

    /* Optional pronunciation rail, for whoever is reading aloud. */
    var rail = stage.querySelector(".stage-pron");
    rail.textContent = "";
    var showRail = stage.querySelector("#stage-pron-toggle").getAttribute("aria-pressed") === "true";
    if (showRail) {
      var onScreen = text.textContent;
      var seen = {};
      [].forEach.call(el.querySelectorAll(".pron"), function (b) {
        var w = b.textContent;
        if (seen[w.toLowerCase()] || onScreen.indexOf(w) < 0) return;
        seen[w.toLowerCase()] = true;
        var span = document.createElement("span");
        var strong = document.createElement("b");
        strong.textContent = w;
        var say = document.createElement("span");
        say.className = "say";
        say.textContent = " " + b.dataset.say;
        span.appendChild(strong);
        span.appendChild(say);
        rail.appendChild(span);
      });
    }
    rail.hidden = !showRail || !rail.childNodes.length;

    stage.querySelectorAll(".stage-dots button").forEach(function (dot, i) {
      dot.setAttribute("aria-current", String(i === stageIndex));
    });

    fitSlide();
  }

  function buildDots() {
    var dots = stage.querySelector(".stage-dots");
    dots.textContent = "";
    readings.forEach(function (el, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", el.getAttribute("data-label") || "Reading " + (i + 1));
      b.addEventListener("click", function () { stageIndex = i; renderSlide(); });
      dots.appendChild(b);
    });
  }

  function goTo(delta) {
    var next = stageIndex + delta;
    if (next < 0 || next >= readings.length) return;
    stageIndex = next;
    renderSlide();
  }

  /* Re-fit after anything that changes how much text fits on a screen. */
  function rebuildStage() {
    if (!stage || stage.hidden) return;
    renderSlide();
  }

  var resizeTimer = null;

  var lastFocus = null;

  function openStage(startAt) {
    if (!stage) return;
    lastFocus = document.activeElement;
    stage.hidden = false;
    document.body.classList.add("presenting");
    stageIndex = typeof startAt === "number" ? startAt : 0;
    buildDots();
    renderSlide();
    stage.querySelector("#stage-next").focus();
    if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
  }

  function closeStage() {
    if (!stage || stage.hidden) return;
    stage.hidden = true;
    document.body.classList.remove("presenting");
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  if (stage) {
    on("present-start", "click", function () { openStage(0); });
    stage.querySelector("#stage-next").addEventListener("click", function () { goTo(1); });
    stage.querySelector("#stage-prev").addEventListener("click", function () { goTo(-1); });
    stage.querySelector("#stage-close").addEventListener("click", closeStage);
    stage.querySelector(".stage-tap.next").addEventListener("click", function () { goTo(1); });
    stage.querySelector(".stage-tap.prev").addEventListener("click", function () { goTo(-1); });

    stage.querySelector("#stage-pron-toggle").addEventListener("click", function () {
      var btn = this;
      btn.setAttribute("aria-pressed", String(btn.getAttribute("aria-pressed") !== "true"));
      renderSlide();
    });

    /* Start the slideshow at a particular reading. */
    readings.forEach(function (el, i) {
      var btn = el.querySelector(".present-here");
      if (btn) btn.addEventListener("click", function () { openStage(i); });
    });

    document.addEventListener("keydown", function (e) {
      if (stage.hidden) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault(); goTo(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault(); goTo(-1);
      } else if (e.key === "Escape") {
        e.preventDefault(); closeStage();
      } else if (e.key === "Home") {
        e.preventDefault(); stageIndex = 0; renderSlide();
      } else if (e.key === "End") {
        e.preventDefault(); stageIndex = readings.length - 1; renderSlide();
      }
    });

    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuildStage, 180);
    });
  }

  /* ---------------------------------------------------------- ambient tones */

  /* Generated in the browser rather than streamed: nothing to download,
     nothing to license, and it never loops back on itself. Off until asked.

     A held D drone with a slow-moving chord above it, in a generated hall.
     Chords cross-fade over about ten seconds, so the harmony changes without
     any moment that draws attention to itself, and a struck bowl sounds every
     half-minute or so, always on a note of the chord already sounding. */
  var audio = null;

  /* Upper voices over a constant D. Every one of these is consonant against
     the drone: Dm, B♭/D, Dm7, Gm/D, D11. */
  var CHORDS = [
    [293.66, 349.23, 440.00], // D  F  A
    [293.66, 349.23, 466.16], // D  F  B♭
    [261.63, 349.23, 440.00], // C  F  A
    [293.66, 392.00, 466.16], // D  G  B♭
    [261.63, 329.63, 392.00]  // C  E  G
  ];

  /* Noise decaying into silence makes a serviceable hall. Smoothing it as it
     goes keeps the tail dark rather than hissy. */
  function makeHall(ctx, seconds, decay) {
    var rate = ctx.sampleRate;
    var length = Math.floor(rate * seconds);
    var buffer = ctx.createBuffer(2, length, rate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buffer.getChannelData(ch);
      var smoothed = 0;
      for (var i = 0; i < length; i++) {
        smoothed += 0.22 * ((Math.random() * 2 - 1) - smoothed);
        data[i] = smoothed * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }

  function startAudio(level) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();
    if (ctx.state === "suspended" && ctx.resume) ctx.resume();

    var master = ctx.createGain();
    master.gain.value = 0.0001;

    /* A gentle ceiling, so this can never spike through a television. */
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 12;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.02;
    limiter.release.value = 0.4;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    /* One very slow swell across everything, like breathing. */
    var breath = ctx.createGain();
    breath.gain.value = 1;
    breath.connect(master);
    var lung = ctx.createOscillator();
    lung.frequency.value = 0.055;
    var lungDepth = ctx.createGain();
    lungDepth.gain.value = 0.15;
    lung.connect(lungDepth);
    lungDepth.connect(breath.gain);
    lung.start();

    var dry = ctx.createGain();
    dry.gain.value = 0.5;
    dry.connect(breath);

    var hall = ctx.createConvolver();
    hall.buffer = makeHall(ctx, 5.5, 2.6);
    var wet = ctx.createGain();
    wet.gain.value = 0.9;
    hall.connect(wet);
    wet.connect(breath);

    var bus = ctx.createGain();
    bus.connect(dry);
    bus.connect(hall);

    /* --- a sustained voice ------------------------------------------- */

    function pad(freq, peak, fade) {
      var out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, ctx.currentTime);
      out.gain.exponentialRampToValueAtTime(peak, ctx.currentTime + fade);

      var tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = Math.min(2400, freq * 5.5);
      tone.Q.value = 0.3;
      tone.connect(out);
      out.connect(bus);

      /* Three slightly separated partials give it body; the detuning is what
         keeps it from sounding like a bare oscillator. */
      var oscs = [];
      [[0, "sine", 1], [-6, "triangle", 0.34], [8, "sine", 0.28]].forEach(function (spec) {
        var osc = ctx.createOscillator();
        osc.type = spec[1];
        osc.frequency.value = freq;
        osc.detune.value = spec[0];
        var g = ctx.createGain();
        g.gain.value = spec[2];
        osc.connect(g);
        g.connect(tone);
        osc.start();
        oscs.push(osc);
      });

      /* A touch of wander, so no two moments are identical. */
      var drift = ctx.createOscillator();
      drift.frequency.value = 0.03 + Math.random() * 0.04;
      var driftDepth = ctx.createGain();
      driftDepth.gain.value = 3;
      drift.connect(driftDepth);
      oscs.forEach(function (o) { driftDepth.connect(o.detune); });
      drift.start();

      return {
        release: function (seconds) {
          var t = ctx.currentTime;
          out.gain.cancelScheduledValues(t);
          out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
          out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
          oscs.forEach(function (o) { try { o.stop(t + seconds + 0.4); } catch (e) {} });
          try { drift.stop(t + seconds + 0.4); } catch (e) {}
        },
        stopNow: function () {
          oscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
          try { drift.stop(); } catch (e) {}
        }
      };
    }

    /* The drone never changes; it is what holds the whole thing still. */
    var drone = [pad(73.42, 0.20, 6), pad(146.83, 0.13, 6)];

    /* --- the chord above it ------------------------------------------- */

    var CROSSFADE = 10;
    var chordIndex = 0;
    var voices = [];
    var chordTimer = null;

    function takeChord(index) {
      var leaving = voices;
      chordIndex = index;
      voices = CHORDS[index].map(function (freq, i) {
        return pad(freq, [0.115, 0.095, 0.075][i], CROSSFADE);
      });
      leaving.forEach(function (v) { v.release(CROSSFADE); });
    }

    function wander() {
      var next = chordIndex;
      while (next === chordIndex) next = Math.floor(Math.random() * CHORDS.length);
      takeChord(next);
      chordTimer = setTimeout(wander, 28000 + Math.random() * 16000);
    }

    takeChord(0);
    chordTimer = setTimeout(wander, 30000);

    /* --- an occasional struck bowl ------------------------------------ */

    /* Inharmonic partials in roughly the ratios a struck bowl gives, the
       higher ones dying away first. */
    var BOWL = [[1, 1, 12], [2.76, 0.36, 7], [5.40, 0.16, 4.5], [8.93, 0.08, 2.6]];
    var bowlTimer = null;

    function bowl() {
      var note = CHORDS[chordIndex][Math.floor(Math.random() * 3)] * 2;
      var t = ctx.currentTime;
      BOWL.forEach(function (p) {
        var osc = ctx.createOscillator();
        osc.frequency.value = note * p[0];
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(p[1] * 0.13, t + 0.3); // sounded, not hit
        g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
        osc.connect(g);
        g.connect(bus);
        osc.start(t);
        osc.stop(t + p[2] + 0.2);
      });
      bowlTimer = setTimeout(bowl, 26000 + Math.random() * 24000);
    }
    bowlTimer = setTimeout(bowl, 12000);

    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), ctx.currentTime + 5);

    return {
      ctx: ctx,
      master: master,
      setLevel: function (v) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.3);
      },
      stop: function () {
        clearTimeout(chordTimer);
        clearTimeout(bowlTimer);
        var t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(0.0001, t, 0.5);
        setTimeout(function () {
          drone.concat(voices).forEach(function (v) { v.stopNow(); });
          try { lung.stop(); } catch (e) {}
          if (ctx.close) ctx.close();
        }, 2600);
      }
    };
  }

  var audioBtn = document.getElementById("audio-toggle");
  var audioVol = document.getElementById("audio-volume");

  function level() {
    return audioVol ? (Number(audioVol.value) / 100) * 0.17 : 0.08;
  }

  if (audioBtn) {
    audioBtn.addEventListener("click", function () {
      if (audio) {
        audio.stop();
        audio = null;
        audioBtn.setAttribute("aria-pressed", "false");
        audioBtn.querySelector(".text").textContent = "Ambience";
        return;
      }
      audio = startAudio(level());
      if (!audio) { toast("This browser can't generate the ambience"); return; }
      audioBtn.setAttribute("aria-pressed", "true");
      audioBtn.querySelector(".text").textContent = "Ambience on";
    });
  }

  if (audioVol) {
    audioVol.addEventListener("input", function () {
      if (audio) audio.setLevel(level());
    });
  }
})();
