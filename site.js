(function () {
  var header = document.querySelector(".site-header");
  var root = document.documentElement;

  var ENTER_Y = 28;
  var EXIT_Y = 8;
  var headerScrolled = window.scrollY > ENTER_Y;

  function applyHeaderState(nextState) {
    if (!header) {
      return;
    }
    headerScrolled = nextState;
    header.classList.toggle("is-scrolled", headerScrolled);
  }

  function updateHeaderFromScroll() {
    if (!header) {
      return;
    }
    var y = window.scrollY;
    if (!headerScrolled && y > ENTER_Y) {
      applyHeaderState(true);
    } else if (headerScrolled && y <= EXIT_Y) {
      applyHeaderState(false);
    }
  }

  var heroStage = document.querySelector(".hero-stage");
  var heroSticky = document.querySelector(".hero-sticky");
  var heroSlot = document.querySelector(".hero-slot");
  var heroFrame = document.querySelector(".hero-frame");
  var heroCopy = document.querySelector(".hero-copy");
  var hasHero = Boolean(heroStage && heroSticky && heroSlot && heroFrame && heroCopy);
  var motionMedia = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  var metrics = {
    scale0: 1,
    tx0: 0,
    ty0: 0,
    travel: 1,
    headerHeight: 68
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function measureHero() {
    if (!hasHero || (motionMedia && motionMedia.matches)) {
      root.classList.remove("hero-scroll-ready");
      if (heroFrame) {
        heroFrame.style.transform = "";
      }
      if (heroCopy) {
        heroCopy.style.opacity = "";
        heroCopy.style.transform = "";
        heroCopy.style.pointerEvents = "";
      }
      return;
    }

    root.classList.add("hero-scroll-ready");

    var stickyRect = heroSticky.getBoundingClientRect();
    var slotRect = heroSlot.getBoundingClientRect();
    var frameWidth = heroFrame.offsetWidth;
    var headerHeight = header ? header.offsetHeight : 68;

    metrics.headerHeight = headerHeight;
    metrics.scale0 = frameWidth > 0 ? slotRect.width / frameWidth : 1;
    metrics.tx0 = (slotRect.left - stickyRect.left + slotRect.width / 2) - (stickyRect.width / 2);
    metrics.ty0 = (slotRect.top - stickyRect.top + slotRect.height / 2) - (stickyRect.height / 2);
    metrics.travel = Math.max(1, heroStage.offsetHeight - heroSticky.offsetHeight);
  }

  function renderHero() {
    if (!hasHero || !root.classList.contains("hero-scroll-ready")) {
      return;
    }

    var stageTop = heroStage.getBoundingClientRect().top;
    var raw = clamp((metrics.headerHeight - stageTop) / metrics.travel, 0, 1);
    var p = clamp(raw / 0.85, 0, 1);
    var e = p * p * (3 - 2 * p);

    var scale = metrics.scale0 + (1 - metrics.scale0) * e;
    var tx = metrics.tx0 * (1 - e);
    var ty = metrics.ty0 * (1 - e);

    heroFrame.style.transform =
      "translate3d(" + tx.toFixed(2) + "px, " + ty.toFixed(2) + "px, 0) scale(" + scale.toFixed(4) + ")";

    var copyFade = clamp(p / 0.42, 0, 1);
    heroCopy.style.opacity = String(1 - copyFade);
    heroCopy.style.transform = "translate3d(" + (-28 * copyFade).toFixed(2) + "px, 0, 0)";
    heroCopy.style.pointerEvents = copyFade > 0.9 ? "none" : "";
  }

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".doc-toc a[href^=\"#\"]"));
  var tocPairs = [];
  tocLinks.forEach(function (link) {
    var id = decodeURIComponent(link.getAttribute("href").slice(1));
    var heading = document.getElementById(id);
    if (heading) {
      tocPairs.push({ link: link, heading: heading });
    }
  });

  var lockedTocPair = null;

  function setTocActive(activePair) {
    tocPairs.forEach(function (pair) {
      pair.link.classList.toggle("is-active", pair === activePair);
    });
  }

  function updateTocActive() {
    if (tocPairs.length === 0) {
      return;
    }
    if (lockedTocPair) {
      setTocActive(lockedTocPair);
      return;
    }
    var docEl = document.documentElement;
    var atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= docEl.scrollHeight - 4;
    if (atBottom) {
      setTocActive(tocPairs[tocPairs.length - 1]);
      return;
    }
    var offset = (header ? header.offsetHeight : 68) + 32;
    var active = tocPairs[0];
    for (var i = 0; i < tocPairs.length; i++) {
      if (tocPairs[i].heading.getBoundingClientRect().top <= offset) {
        active = tocPairs[i];
      } else {
        break;
      }
    }
    setTocActive(active);
  }

  function clearTocLock() {
    if (lockedTocPair) {
      lockedTocPair = null;
      updateTocActive();
    }
  }

  var ticking = false;

  function onFrame() {
    ticking = false;
    updateHeaderFromScroll();
    renderHero();
    updateTocActive();
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onFrame);
    }
  }

  function syncLayout() {
    measureHero();
    renderHero();
    updateTocActive();
  }

  applyHeaderState(headerScrolled);
  syncLayout();

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("wheel", clearTocLock, { passive: true });
  window.addEventListener("touchstart", clearTocLock, { passive: true });
  window.addEventListener("keydown", function (event) {
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "PageUp" ||
      event.key === "PageDown" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === " "
    ) {
      clearTocLock();
    }
  });
  window.addEventListener("resize", syncLayout, { passive: true });
  window.addEventListener("load", syncLayout);
  window.addEventListener("pageshow", function () {
    applyHeaderState(window.scrollY > ENTER_Y);
    syncLayout();
  });

  tocPairs.forEach(function (pair) {
    pair.link.addEventListener("click", function () {
      lockedTocPair = pair;
      setTocActive(pair);
    });
  });

  if (motionMedia && typeof motionMedia.addEventListener === "function") {
    motionMedia.addEventListener("change", syncLayout);
  }

  if (hasHero && typeof window.ResizeObserver === "function") {
    var observer = new window.ResizeObserver(syncLayout);
    observer.observe(heroSticky);
  }

  function copyText(text, onDone) {
    function fallbackCopy() {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        onDone();
      } finally {
        document.body.removeChild(area);
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).then(onDone, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  var copyButtons = document.querySelectorAll("[data-copy-target]");
  copyButtons.forEach(function (button) {
    var resetTimer = null;
    var defaultLabel = button.getAttribute("aria-label") || "Copy";
    button.addEventListener("click", function () {
      var targetId = button.getAttribute("data-copy-target");
      var target = targetId ? document.getElementById(targetId) : null;
      if (!target) {
        return;
      }

      copyText(target.textContent || "", function () {
        button.classList.add("is-copied");
        button.setAttribute("aria-label", "Copied");
        if (resetTimer) {
          window.clearTimeout(resetTimer);
        }
        resetTimer = window.setTimeout(function () {
          button.classList.remove("is-copied");
          button.setAttribute("aria-label", defaultLabel);
        }, 1600);
      });
    });
  });

  var splitWraps = document.querySelectorAll(".copy-split-wrap");
  splitWraps.forEach(function (wrap) {
    var mainBtn = wrap.querySelector(".copy-split-main");
    var mainLabel = wrap.querySelector(".copy-split-label");
    var toggleBtn = wrap.querySelector(".copy-split-toggle");
    var items = wrap.querySelectorAll(".copy-menu-item[data-copy-format]");
    var resetTimer = null;

    function setOpen(nextOpen) {
      wrap.classList.toggle("is-open", nextOpen);
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      }
    }

    function flashCopied() {
      if (!mainBtn) {
        return;
      }
      mainBtn.classList.add("is-copied");
      if (mainLabel) {
        mainLabel.textContent = "Copied";
      }
      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }
      resetTimer = window.setTimeout(function () {
        mainBtn.classList.remove("is-copied");
        if (mainLabel) {
          mainLabel.textContent = "Copy page";
        }
      }, 1600);
    }

    function getPageContent(format) {
      var bodyEl = document.querySelector(".doc-body");
      var titleEl = document.querySelector(".doc-title");
      var sourceEl = document.getElementById("doc-markdown-source");

      if (format === "markdown" && sourceEl) {
        return (sourceEl.textContent || "").replace(/<\\\/script/gi, "</script");
      }
      if (format === "html" && bodyEl) {
        return bodyEl.innerHTML.trim();
      }
      var titleText = titleEl ? (titleEl.textContent || "").trim() : "";
      var bodyText = bodyEl ? (bodyEl.innerText || bodyEl.textContent || "").trim() : "";
      return titleText && bodyText ? titleText + "\n\n" + bodyText : bodyText || titleText;
    }

    if (mainBtn) {
      mainBtn.addEventListener("click", function () {
        copyText(getPageContent("markdown"), flashCopied);
      });
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        setOpen(!wrap.classList.contains("is-open"));
      });
    }

    items.forEach(function (item) {
      item.addEventListener("click", function () {
        var fmt = item.getAttribute("data-copy-format") || "markdown";
        setOpen(false);
        copyText(getPageContent(fmt), flashCopied);
      });
    });

    document.addEventListener("click", function (event) {
      if (wrap.classList.contains("is-open") && !wrap.contains(event.target)) {
        setOpen(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && wrap.classList.contains("is-open")) {
        setOpen(false);
        if (toggleBtn) {
          toggleBtn.focus();
        }
      }
    });
  });
})();
