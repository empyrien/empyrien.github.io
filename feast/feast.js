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

  var DEFAULTS = { theme: "", contrast: "normal", face: "serif", lead: "normal", scale: 1 };
  var prefs = Object.assign({}, DEFAULTS, load(PREFS_KEY, {}));

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

  function assignedTo(el) {
    var name = assignments[readingKey(el)];
    return name && readers.indexOf(name) >= 0 ? name : "";
  }

  function persistReaders() {
    save(READERS_KEY, readers);
    save(ASSIGN_KEY, assignments);
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

  renderRoster();
  renderSelects();

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

  /* Show the note in the margin, level with the word — never over the text. */
  var openNote = null;

  function closeNote() {
    if (!openNote) return;
    openNote.button.setAttribute("aria-expanded", "false");
    openNote.note.hidden = true;
    openNote = null;
  }

  function showNote(btn) {
    var card = btn.closest(".reading");
    var gutter = card && card.querySelector(".reading-gutter");
    if (!gutter) return;

    if (openNote && openNote.button === btn) { closeNote(); return; }
    closeNote();

    var note = gutter.querySelector(".pron-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "pron-note";
      note.setAttribute("role", "status");
      gutter.appendChild(note);
    }
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
    note.hidden = false;

    /* On wide screens the note floats to the height of the word it explains. */
    if (window.matchMedia("(min-width: 60rem)").matches) {
      var top = btn.getBoundingClientRect().top - gutter.getBoundingClientRect().top;
      var maxTop = Math.max(0, gutter.offsetHeight - note.offsetHeight);
      note.style.top = Math.max(0, Math.min(top, maxTop)) + "px";
    } else {
      note.style.top = "";
    }

    btn.setAttribute("aria-expanded", "true");
    openNote = { button: btn, note: note };
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".pron");
    if (btn && !btn.closest(".stage")) { showNote(btn); return; }
    if (!e.target.closest || !e.target.closest(".pron-note")) closeNote();
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

  /* Generated in the browser rather than streamed, so there is no audio file
     to load and nothing to license. Off until asked for. */
  var audio = null;

  function startAudio(level) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    var ctx = new Ctx();

    var master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    var warm = ctx.createBiquadFilter();
    warm.type = "lowpass";
    warm.frequency.value = 760;
    warm.Q.value = 0.4;
    warm.connect(master);

    var reverbish = ctx.createDelay(1.2);
    reverbish.delayTime.value = 0.42;
    var feedback = ctx.createGain();
    feedback.gain.value = 0.34;
    reverbish.connect(feedback);
    feedback.connect(reverbish);
    reverbish.connect(master);

    /* A slow drone: root, fifth, octave — a still, open chord. */
    var voices = [110, 164.81, 220].map(function (freq, i) {
      var osc = ctx.createOscillator();
      osc.type = i === 2 ? "triangle" : "sine";
      osc.frequency.value = freq;

      var drift = ctx.createOscillator();
      drift.type = "sine";
      drift.frequency.value = 0.03 + i * 0.017;
      var driftAmt = ctx.createGain();
      driftAmt.gain.value = 3.5;
      drift.connect(driftAmt);
      driftAmt.connect(osc.detune);

      var g = ctx.createGain();
      g.gain.value = [0.5, 0.3, 0.16][i];
      osc.connect(g);
      g.connect(warm);

      osc.start();
      drift.start();
      return osc;
    });

    /* Occasional soft bells from a pentatonic scale. */
    var PENT = [440, 523.25, 587.33, 659.25, 783.99];
    var bellTimer = null;
    function bell() {
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = PENT[Math.floor(Math.random() * PENT.length)];
      var g = ctx.createGain();
      var now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.16, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 5);
      osc.connect(g);
      g.connect(reverbish);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 5.2);
      bellTimer = setTimeout(bell, 9000 + Math.random() * 12000);
    }
    bellTimer = setTimeout(bell, 4000);

    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), ctx.currentTime + 4);

    return {
      ctx: ctx,
      master: master,
      setLevel: function (v) {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.3);
      },
      stop: function () {
        clearTimeout(bellTimer);
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
        setTimeout(function () {
          voices.forEach(function (o) { try { o.stop(); } catch (e) {} });
          ctx.close();
        }, 2000);
      }
    };
  }

  var audioBtn = document.getElementById("audio-toggle");
  var audioVol = document.getElementById("audio-volume");

  function level() {
    return audioVol ? (Number(audioVol.value) / 100) * 0.13 : 0.06;
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
