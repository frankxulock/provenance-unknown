/* Telegram Mini App：展開、震動、分享。沒有 WebApp 時仍可在瀏覽器玩。 */
(function (root) {
  "use strict";

  var cfg = root.PROVENANCE_TG || {};

  function webApp() {
    return root.Telegram && root.Telegram.WebApp ? root.Telegram.WebApp : null;
  }

  function ready() {
    var tg = webApp();
    if (!tg) return false;
    try {
      if (typeof tg.ready === "function") tg.ready();
      if (typeof tg.expand === "function") tg.expand();
      if (tg.themeParams && tg.themeParams.bg_color) {
        document.documentElement.style.setProperty("--tg-bg", tg.themeParams.bg_color);
      }
      if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    } catch (e) {}
    return true;
  }

  function haptic(kind) {
    var tg = webApp();
    if (!tg || !tg.HapticFeedback) return;
    try {
      if (kind === "success") tg.HapticFeedback.notificationOccurred("success");
      else if (kind === "error") tg.HapticFeedback.notificationOccurred("error");
      else if (kind === "warn") tg.HapticFeedback.notificationOccurred("warning");
      else tg.HapticFeedback.impactOccurred("light");
    } catch (e) {}
  }

  function publicUrl() {
    var base = String(cfg.publicUrl || "").trim();
    if (base) return base.replace(/\/?$/, "/");
    try {
      return location.href.split("#")[0].split("?")[0];
    } catch (e) {
      return "";
    }
  }

  function deepLink() {
    var bot = String(cfg.bot || "").replace(/^@/, "");
    var app = String(cfg.app || "").trim();
    if (bot && app) return "https://t.me/" + bot + "/" + app;
    return publicUrl();
  }

  function share(text) {
    var url = deepLink() || publicUrl();
    var payload = "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(text || "");
    var tg = webApp();
    if (tg && typeof tg.openTelegramLink === "function") {
      try {
        tg.openTelegramLink(payload);
        return true;
      } catch (e) {}
    }
    try {
      window.open(payload, "_blank");
      return true;
    } catch (e2) {
      return false;
    }
  }

  function openLink(url) {
    var tg = webApp();
    if (tg && typeof tg.openLink === "function") {
      try {
        tg.openLink(url);
        return true;
      } catch (e) {}
    }
    try {
      window.open(url, "_blank");
      return true;
    } catch (e2) {
      return false;
    }
  }

  root.ProvenanceTg = {
    ready: ready,
    haptic: haptic,
    share: share,
    openLink: openLink,
    publicUrl: publicUrl,
    deepLink: deepLink,
    inside: function () {
      return !!webApp();
    },
    cfg: function () {
      return cfg;
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
