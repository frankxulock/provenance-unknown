(function (root) {
  "use strict";

  const LANG_KEY = "chuchu-lang";
  const packs = Object.create(null);
  let lang = "zh-Hant";

  function register(pack) {
    if (!pack || !pack.meta || !pack.meta.id) throw new Error("bad locale pack");
    packs[pack.meta.id] = pack;
  }

  function available() {
    return Object.keys(packs).map((id) => ({
      id,
      name: packs[id].meta.name,
      short: packs[id].meta.short || packs[id].meta.name
    }));
  }

  function detect() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && packs[saved]) return saved;
    } catch (err) {
      /* ignore */
    }
    const nav = String((typeof navigator !== "undefined" && navigator.language) || "").toLowerCase();
    if (nav.indexOf("ja") === 0 && packs.ja) return "ja";
    if (nav.indexOf("zh") === 0 && packs["zh-Hant"]) return "zh-Hant";
    if (packs.en) return "en";
    return Object.keys(packs)[0] || "zh-Hant";
  }

  function setLang(id) {
    if (!packs[id]) return false;
    lang = id;
    try {
      localStorage.setItem(LANG_KEY, id);
    } catch (err) {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = packs[id].meta.htmlLang || id;
      if (document.title !== undefined) document.title = packs[id].ui.title;
    }
    return true;
  }

  function getLang() {
    return lang;
  }

  function pack() {
    return packs[lang] || packs["zh-Hant"] || packs.en || packs[Object.keys(packs)[0]];
  }

  function dig(obj, path) {
    const parts = String(path).split(".");
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function fill(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (_, key) {
      return vars && vars[key] != null ? String(vars[key]) : "";
    });
  }

  function t(path, vars) {
    const p = pack();
    let val = dig(p, path);
    if (val == null && packs.en) val = dig(packs.en, path);
    if (val == null && packs["zh-Hant"]) val = dig(packs["zh-Hant"], path);
    if (typeof val !== "string") return path;
    return fill(val, vars || {});
  }

  function format(msg) {
    if (msg == null) return "";
    if (typeof msg === "string") return msg;
    if (msg.raw != null) return String(msg.raw);
    if (msg.k) return t(msg.k, msg.v || {});
    return String(msg);
  }

  function init() {
    if (!Object.keys(packs).length) throw new Error("no locales");
    lang = detect();
    setLang(lang);
  }

  root.PSI18n = {
    register,
    available,
    detect,
    setLang,
    getLang,
    pack,
    t,
    format,
    init,
    LANG_KEY
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
