/* Adsgram 激勵／插頁。看完才發獎；跳過、失敗、沒填廣告位都不發。
   廣告位在 index.html 的 PROVENANCE_ADS 裡填。 */
(function (root) {
  "use strict";

  var cfg = root.PROVENANCE_ADS || {};
  var blocks = {
    look: digits(cfg.look || cfg.blockId),
    cool: digits(cfg.cool || cfg.blockId),
    bailout: digits(cfg.bailout || cfg.blockId),
    interstitial: slotId(cfg.interstitial, /^int-\d+$/)
  };
  var debug = !!cfg.debug;
  var controllers = {};
  var busy = false;

  function digits(value) {
    return slotId(value, /^\d+$/);
  }

  function slotId(value, pattern) {
    var text = String(value || "").trim();
    return pattern.test(text) ? text : "";
  }

  function controller(placement) {
    var id = blocks[placement] || "";
    if (!id || !root.Adsgram || typeof root.Adsgram.init !== "function") return null;
    if (!controllers[id]) {
      try {
        controllers[id] = root.Adsgram.init({
          blockId: id,
          debug: debug,
          debugBannerType: String(id).indexOf("int-") === 0 ? "FullscreenMedia" : "RewardedVideo"
        });
      } catch (e) {
        controllers[id] = null;
      }
    }
    return controllers[id] || null;
  }

  function prepare() {
    ["look", "cool", "bailout", "interstitial"].forEach(function (placement) {
      var ad = controller(placement);
      if (ad && typeof ad.load === "function") {
        try {
          ad.load();
        } catch (e) {}
      }
    });
  }

  function show(placement, allowClose) {
    placement = blocks[placement] ? placement : "";
    if (!placement) return Promise.resolve({ ok: false, reason: "unconfigured" });
    if (busy) return Promise.resolve({ ok: false, reason: "busy" });
    var ad = controller(placement);
    if (!ad || typeof ad.show !== "function") return Promise.resolve({ ok: false, reason: "missing" });
    busy = true;
    return ad.show().then(
      function (result) {
        busy = false;
        var finished = !!(result && result.done !== false);
        return { ok: allowClose ? true : finished, reason: finished ? "done" : "close" };
      },
      function (result) {
        busy = false;
        var skipped = result && result.done === false && !result.error;
        return { ok: false, reason: skipped ? "skip" : "error" };
      }
    );
  }

  root.ProvenanceAds = {
    prepare: prepare,
    rewarded: function (placement) {
      return show(placement, false);
    },
    interstitial: function () {
      return show("interstitial", true);
    },
    configured: function (placement) {
      return !!blocks[placement];
    },
    live: function () {
      return !!(blocks.look || blocks.cool || blocks.bailout);
    },
    busy: function () {
      return busy;
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
