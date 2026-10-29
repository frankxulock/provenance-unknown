(function (root) {
  "use strict";

  const BALANCE = {
    days: 12,
    startCredits: 2500,
    startHeat: 5,
    startStreet: 18,
    startSyndicate: 0,
    inspectBase: 2,
    inspectLamp: 3,
    slots: 6,
    slotsStorage: 12,
    windowSlots: 3,
    jammer: 0.72,
    valueScale: 0.86,
    valueScaleDay: 0.03,
    fixerBase: 0.82,
    fixerStreet: 160,
    alley: { legit: 0.9, stolen: 0.94, hot: 0.62 },
    alleyHeat: { legit: 1, stolen: 3, hot: 8 },
    fixerOrigin: { legit: 1.02, stolen: 1.2, hot: 1.16, planted: 0.5 },
    fixerHeat: { legit: 1, stolen: 6, hot: 9, planted: 11 },
    corp: { legit: 1.2, stolen: 1.32, hot: 1.48, planted: 1.7 },
    corpHeat: { legit: 2, stolen: 11, hot: 16, planted: 20 },
    plantedAskHeat: 4,
    windowChance: { legit: 0.52, stolen: 0.38, hot: 0.2, planted: 0.16 },
    windowPay: { legit: 1, stolen: 0.96, hot: 0.72, planted: 0.42 },
    windowHeat: { legit: 0, stolen: 0, hot: 4, planted: 10 },
    powerBase: 64,
    powerPerDay: 7,
    feeBase: 280,
    feePerDay: 18,
    snitch: {
      planted: { cash: 820, heat: -14, street: -5, syndicate: -2 },
      hot: { cash: 360, heat: -10, street: -10, syndicate: -8 },
      stolen: { cash: 120, heat: 4, street: -12, syndicate: -12 },
      legit: { cash: -480, heat: 10, street: -14, syndicate: 0 }
    },
    adBailout: 480,
    adCool: 16
  };

  const CONDITIONS = [
    { id: "worn", mult: 0.74, weight: 2 },
    { id: "used", mult: 0.88, weight: 4 },
    { id: "ok", mult: 1, weight: 4 },
    { id: "mint", mult: 1.1, weight: 2 }
  ];

  const ARCH = [
    { id: "mosquito", mark: "蚊", color: "#1ee0c0", weight: 10, cats: ["data", "gear", "junk", "cloth"], origin: { stolen: 4, hot: 2, legit: 2, planted: 0.4 }, knows: false, floor: 0.62, ask: 0.9 },
    { id: "granny", mark: "陳", color: "#ffb15a", weight: 8, cats: ["relic", "cloth", "junk"], origin: { legit: 6, stolen: 1, hot: 0.2, planted: 0.2 }, knows: false, floor: 0.84, ask: 0.92 },
    { id: "survey", mark: "周", color: "#f2f2f2", weight: 4, cats: ["data", "chrome", "gear"], origin: { planted: 5, legit: 1.2, stolen: 0.5, hot: 0.3 }, knows: true, floor: 0.58, ask: 0.84 },
    { id: "tech", mark: "林", color: "#8eb6ff", weight: 7, cats: ["chrome", "gear", "data"], origin: { legit: 3, stolen: 3, hot: 1.2, planted: 0.4 }, knows: true, floor: 0.86, ask: 1.02 },
    { id: "student", mark: "滿", color: "#d7f28a", weight: 7, cats: ["cloth", "data", "junk", "gear"], origin: { legit: 4, stolen: 2, hot: 0.4, planted: 0.3 }, knows: false, floor: 0.7, ask: 0.96 },
    { id: "scar", mark: "疤", color: "#ff5d73", weight: 5, cats: ["chrome", "data", "gear"], origin: { stolen: 4, hot: 3, legit: 0.6, planted: 0.2 }, knows: true, floor: 0.92, ask: 1.04 },
    { id: "tourist", mark: "客", color: "#ffd0e8", weight: 5, cats: ["cloth", "relic", "junk"], origin: { legit: 5, stolen: 1, hot: 0.2, planted: 0.5 }, knows: false, floor: 0.78, ask: 1.26 },
    { id: "guard", mark: "衛", color: "#9ad7ff", weight: 6, cats: ["gear", "data", "chrome"], origin: { stolen: 3, hot: 2, legit: 2, planted: 0.5 }, knows: true, floor: 0.78, ask: 1 },
    { id: "temple", mark: "慧", color: "#e6c2ff", weight: 5, cats: ["relic", "cloth", "junk"], origin: { legit: 4, stolen: 2, hot: 0.3, planted: 0.3 }, knows: true, floor: 0.76, ask: 0.98 },
    { id: "ex", mark: "岑", color: "#ffcf8a", weight: 3, cats: ["cloth", "relic", "gear", "data"], origin: { legit: 6, stolen: 1, hot: 0.2, planted: 0.2 }, knows: true, floor: 0.8, ask: 0.95, streetOnDeal: 3 }
  ];

  const ITEMS = [
    { id: "eye", cat: "chrome", corp: true, min: 820, max: 1460, origins: { legit: 1, stolen: 4, hot: 3, planted: 2 }, heat: { legit: 1, stolen: 14, hot: 22, planted: 28 } },
    { id: "knee", cat: "chrome", corp: true, min: 540, max: 980, origins: { legit: 2, stolen: 3, hot: 2, planted: 1 }, heat: { legit: 1, stolen: 11, hot: 18, planted: 26 } },
    { id: "bone", cat: "chrome", corp: true, min: 360, max: 740, origins: { legit: 2, stolen: 3, hot: 2, planted: 2 }, heat: { legit: 1, stolen: 10, hot: 17, planted: 25 } },
    { id: "finger", cat: "chrome", corp: false, min: 160, max: 340, origins: { legit: 2, stolen: 4, hot: 1, planted: 1 }, heat: { legit: 0, stolen: 8, hot: 14, planted: 22 } },
    { id: "pass", cat: "data", corp: true, min: 700, max: 1280, origins: { legit: 1, stolen: 4, hot: 3, planted: 2 }, heat: { legit: 1, stolen: 13, hot: 21, planted: 29 } },
    { id: "tape", cat: "data", corp: false, min: 180, max: 520, origins: { legit: 3, stolen: 3, hot: 1, planted: 1 }, heat: { legit: 0, stolen: 9, hot: 15, planted: 23 } },
    { id: "dongle", cat: "data", corp: true, min: 1200, max: 2100, origins: { legit: 1, stolen: 4, hot: 3, planted: 2 }, heat: { legit: 2, stolen: 16, hot: 24, planted: 31 } },
    { id: "calls", cat: "data", corp: false, min: 240, max: 640, origins: { legit: 2, stolen: 4, hot: 2, planted: 1 }, heat: { legit: 0, stolen: 10, hot: 18, planted: 24 } },
    { id: "badge", cat: "data", corp: true, min: 260, max: 620, origins: { legit: 3, stolen: 3, hot: 2, planted: 2 }, heat: { legit: 1, stolen: 9, hot: 16, planted: 24 } },
    { id: "cutter", cat: "gear", corp: false, min: 480, max: 920, origins: { legit: 2, stolen: 3, hot: 2, planted: 1 }, heat: { legit: 1, stolen: 12, hot: 19, planted: 25 } },
    { id: "pen", cat: "gear", corp: false, min: 90, max: 220, origins: { legit: 5, stolen: 1, hot: 0.4, planted: 0.4 }, heat: { legit: 0, stolen: 5, hot: 10, planted: 16 } },
    { id: "roll", cat: "gear", corp: false, min: 200, max: 460, origins: { legit: 4, stolen: 2, hot: 0.6, planted: 0.4 }, heat: { legit: 0, stolen: 7, hot: 12, planted: 18 } },
    { id: "light", cat: "gear", corp: false, min: 30, max: 80, origins: { legit: 4, stolen: 2, hot: 0.3, planted: 0.2 }, heat: { legit: 0, stolen: 3, hot: 8, planted: 12 } },
    { id: "bottle", cat: "gear", corp: true, min: 140, max: 320, origins: { legit: 4, stolen: 2, hot: 0.5, planted: 1 }, heat: { legit: 0, stolen: 6, hot: 11, planted: 18 } },
    { id: "coat", cat: "cloth", corp: false, min: 300, max: 760, origins: { legit: 3, stolen: 3, hot: 1, planted: 1 }, heat: { legit: 0, stolen: 8, hot: 14, planted: 20 } },
    { id: "boots", cat: "cloth", corp: false, min: 70, max: 180, origins: { legit: 3, stolen: 3, hot: 0.5, planted: 0.4 }, heat: { legit: 0, stolen: 6, hot: 11, planted: 16 } },
    { id: "chain", cat: "cloth", corp: false, min: 60, max: 240, origins: { legit: 5, stolen: 2, hot: 0.3, planted: 0.3 }, heat: { legit: 0, stolen: 5, hot: 9, planted: 14 } },
    { id: "record", cat: "relic", corp: false, min: 280, max: 820, origins: { legit: 4, stolen: 2, hot: 0.4, planted: 0.5 }, heat: { legit: 0, stolen: 7, hot: 12, planted: 18 } },
    { id: "incense", cat: "relic", corp: false, min: 140, max: 420, origins: { legit: 4, stolen: 2, hot: 0.4, planted: 0.6 }, heat: { legit: 0, stolen: 6, hot: 11, planted: 17 } },
    { id: "ticket", cat: "relic", corp: false, min: 20, max: 70, origins: { legit: 5, stolen: 1, hot: 0.2, planted: 0.2 }, heat: { legit: 0, stolen: 2, hot: 6, planted: 10 } },
    { id: "box", cat: "junk", corp: false, min: 20, max: 55, origins: { legit: 6, stolen: 1, hot: 0, planted: 0 }, heat: { legit: 0, stolen: 3, hot: 6, planted: 10 }, gem: { chance: 0.2, value: 1560, heat: 15, origin: "stolen", corp: true } },
    { id: "cables", cat: "junk", corp: false, min: 25, max: 70, origins: { legit: 5, stolen: 2, hot: 0.2, planted: 0 }, heat: { legit: 0, stolen: 4, hot: 8, planted: 12 }, gem: { chance: 0.12, value: 980, heat: 12, origin: "stolen", corp: true } },
    { id: "filter", cat: "junk", corp: false, min: 15, max: 40, origins: { legit: 4, stolen: 2, hot: 0.2, planted: 0.2 }, heat: { legit: 0, stolen: 2, hot: 6, planted: 10 } }
  ];

  const UPGRADES = [
    { id: "lamp", cost: 700 },
    { id: "sign", cost: 850 },
    { id: "storage", cost: 1600 },
    { id: "jammer", cost: 2300 }
  ];

  const EVENTS = [
    { id: "quiet", weight: 5 },
    { id: "patrol", weight: 3, heat: 5 },
    { id: "rain", weight: 3, street: 2, rain: true },
    { id: "tip", weight: 2, cash: 140 },
    { id: "gossip", weight: 3, street: 3 },
    { id: "scan", weight: 2, heat: 4 }
  ];

  function pack() {
    return root.PSI18n.pack();
  }

  function t(path, vars) {
    return root.PSI18n.t(path, vars);
  }

  function quotes() {
    const m = pack().meta;
    return { q: m.quoteL || "「", q2: m.quoteR || "」", sep: m.listSep || "、" };
  }

  function originLabel(o) {
    return (pack().origin && pack().origin[o]) || o;
  }

  function catName(id) {
    return (pack().cat && pack().cat[id]) || id;
  }

  function conditionName(id) {
    return (pack().condition && pack().condition[id]) || id;
  }

  function itemText(id) {
    return (pack().item && pack().item[id]) || { name: id, blurb: "" };
  }

  function itemName(id, flipped) {
    const it = itemText(id);
    if (flipped && it.gemName) return it.gemName;
    return it.name || id;
  }

  function itemBlurb(id) {
    return itemText(id).blurb || "";
  }

  function gemText(id) {
    return itemText(id).gemText || "";
  }

  function archText(id) {
    return (pack().arch && pack().arch[id]) || { name: id, role: "", look: "", lines: {} };
  }

  function archLine(id, kind, index) {
    const lines = archText(id).lines || {};
    const arr = lines[kind] || [];
    return arr[index] || arr[0] || "";
  }

  function vague(index) {
    const arr = pack().vague || [];
    return arr[index] || arr[0] || "";
  }

  function tell(origin, index) {
    const arr = (pack().tell && pack().tell[origin]) || [];
    return arr[index] || arr[0] || "";
  }

  function gut(origin) {
    return (pack().gut && pack().gut[origin]) || "";
  }

  function upgradeText(id) {
    return (pack().upgrade && pack().upgrade[id]) || { name: id, desc: "" };
  }

  function eventText(id) {
    return (pack().event && pack().event[id]) || id;
  }

  function buyerLine(channel, origin) {
    const b = pack().buyer || {};
    return (b[channel] && b[channel][origin]) || "";
  }

  function msg(key, vars) {
    const q = quotes();
    const merged = Object.assign({}, q, vars || {});
    return t("msg." + key, merged);
  }

  function ui(key, vars) {
    return t("ui." + key, vars);
  }

  root.PSData = {
    BALANCE,
    CONDITIONS,
    ARCH,
    ITEMS,
    UPGRADES,
    EVENTS,
    pack,
    t,
    quotes,
    originLabel,
    catName,
    conditionName,
    itemName,
    itemBlurb,
    gemText,
    archText,
    archLine,
    vague,
    tell,
    gut,
    upgradeText,
    eventText,
    buyerLine,
    msg,
    ui
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
