(function () {
  "use strict";

  const KEY = "chuchu-save-v2";
  const SOUND_KEY = "chuchu-sound";
  const app = document.getElementById("app");
  const I = window.PSI18n;
  const D = window.PSData;
  let game = null;
  let soundOn = false;
  let audioCtx = null;
  let titleNote = "";
  let adBusy = false;
  let adNote = "";

  try {
    soundOn = localStorage.getItem(SOUND_KEY) === "1";
  } catch (err) {
    soundOn = false;
  }

  function t(key, vars) {
    return D.ui(key, vars);
  }

  function fmt(msg) {
    return I.format(msg);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function yen(n) {
    const v = Math.round(n);
    const sign = v < 0 ? "-" : "";
    const body = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + "¥" + body;
  }

  function priceOf(ask, mult) {
    return Math.max(1, Math.round(ask * mult));
  }

  function itemName(it) {
    return D.itemName(it.templateId, it.flipped);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function persist() {
    if (!game) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(game.serialize()));
    } catch (err) {
      /* private mode */
    }
  }

  function wipe() {
    try {
      localStorage.removeItem(KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function dailySeed() {
    const d = new Date();
    const s = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function blip(freq, dur) {
    if (!soundOn) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.stop(ctx.currentTime + dur);
    } catch (err) {
      /* audio blocked */
    }
  }

  function btn(act, label, attrs, opt) {
    opt = opt || {};
    const cls = opt.danger ? "danger" : opt.primary ? "primary" : opt.ghost ? "ghost" : "";
    return (
      '<button type="button" class="' +
      cls +
      '" data-act="' +
      act +
      '" ' +
      (attrs || "") +
      (opt.disabled ? " disabled" : "") +
      ">" +
      esc(label) +
      "</button>"
    );
  }

  function hasSave() {
    const snap = load();
    return !!(snap && snap.version === 2 && snap.state);
  }

  function langSwitcher() {
    const langs = I.available();
    const cur = I.getLang();
    return (
      '<div class="lang" role="group" aria-label="' +
      esc(t("lang")) +
      '">' +
      langs
        .map(function (L) {
          return btn("lang", L.short, 'data-lang="' + L.id + '"', {
            primary: L.id === cur,
            ghost: L.id !== cur
          });
        })
        .join("") +
      "</div>"
    );
  }

  function render() {
    if (!game) {
      renderTitle();
      return;
    }
    const s = game.state;
    if (s.phase === "ending") {
      app.innerHTML = '<div class="page ending-page">' + header() + ending() + "</div>";
      return;
    }
    const wide = s.phase === "counter" || s.phase === "result" ? " counter" : " wide";
    app.innerHTML =
      '<div class="page">' + header() + '<div class="layout' + wide + '">' + main() + side() + "</div>" + logList() + "</div>";
    if (window.ProvenanceMore) window.ProvenanceMore.paint();
  }

  function renderTitle() {
    const save = hasSave();
    app.innerHTML =
      '<div class="title-screen">' +
      langSwitcher() +
      '<p class="eyebrow">' +
      esc(t("eyebrow")) +
      "</p>" +
      '<p class="en">' +
      esc(t("brandEn")) +
      "</p>" +
      "<h1>" +
      esc(t("title")) +
      "</h1>" +
      '<p class="tag">' +
      esc(t("tag")) +
      "</p>" +
      (titleNote ? '<p class="flash">' + esc(titleNote) + "</p>" : "") +
      '<ul class="rules">' +
      "<li>" +
      esc(t("rule1")) +
      "</li>" +
      "<li>" +
      esc(t("rule2")) +
      "</li>" +
      "<li>" +
      esc(t("rule3")) +
      "</li>" +
      "<li>" +
      esc(t("rule4")) +
      "</li>" +
      "</ul>" +
      '<div class="actions">' +
      btn("start", t("startNew"), 'data-kind="new"', { primary: true }) +
      btn("start", t("startDaily"), 'data-kind="daily"') +
      (save ? btn("start", t("startContinue"), 'data-kind="continue"') : "") +
      (save ? btn("wipe", t("wipe"), "", { ghost: true }) : "") +
      btn("share", t("share"), "", { ghost: true }) +
      "</div>" +
      '<nav class="more" data-play-more="provenance-unknown" aria-label="' +
      esc(t("alsoPlay")) +
      '"></nav>' +
      '<p class="fine">' +
      esc(t("fineTitle")) +
      "</p>" +
      "</div>";
    if (window.ProvenanceMore) window.ProvenanceMore.paint();
  }

  function header() {
    const s = game.state;
    const heatCls = s.heat >= 70 ? "hot" : s.heat >= 40 ? "warm" : "cool";
    return (
      '<header class="top">' +
      '<div class="brand"><span class="en tiny">' +
      esc(t("brandShort")) +
      "</span><strong>" +
      esc(t("title")) +
      "</strong><em>" +
      esc(t("dayOf", { day: s.day })) +
      "</em></div>" +
      '<div class="meters">' +
      meter(t("heat"), s.heat, heatCls) +
      meter(t("street"), s.street, "street") +
      '<div class="meter-num"><span>' +
      esc(t("syndicate")) +
      "</span><b>" +
      Math.round(s.syndicate) +
      "</b></div>" +
      "</div>" +
      '<div class="cash"><span>' +
      esc(t("cash")) +
      "</span><b>" +
      yen(s.credits) +
      "</b></div>" +
      '<div class="top-tools">' +
      langSwitcher() +
      btn("mute", soundOn ? t("soundOn") : t("soundOff"), "", { ghost: true }) +
      "</div>" +
      "</header>"
    );
  }

  function meter(name, value, cls) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    return (
      '<div class="meter ' +
      cls +
      '" role="meter" aria-label="' +
      esc(name) +
      '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      v +
      '">' +
      "<span>" +
      esc(name) +
      " " +
      v +
      "</span>" +
      '<i><b style="width:' +
      v +
      '%"></b></i>' +
      "</div>"
    );
  }

  function main() {
    const s = game.state;
    if (s.phase === "briefing") return briefing();
    if (s.phase === "counter" || s.phase === "result") return counter();
    if (s.phase === "backroom") return backroom();
    if (s.phase === "night") return night();
    if (s.phase === "crisis") return crisis();
    return "";
  }

  function side() {
    const s = game.state;
    if (s.phase === "backroom") return '<aside class="side">' + upgrades() + "</aside>";
    if (s.phase === "briefing" || s.phase === "night" || s.phase === "crisis") {
      return '<aside class="side">' + stockList(false) + upgrades() + "</aside>";
    }
    return '<aside class="side">' + stockList(true) + "</aside>";
  }

  function briefing() {
    const s = game.state;
    const b = game.bills();
    const owned = D.UPGRADES.filter(function (u) {
      return s.upgrades[u.id];
    }).map(function (u) {
      return D.upgradeText(u.id).name;
    });
    let notes = "";
    if (s.todayNote) notes += "<p>" + esc(fmt(s.todayNote)) + "</p>";
    s.morningSales.forEach(function (line) {
      notes += "<p>" + esc(fmt(line)) + "</p>";
    });
    s.todayRumors.forEach(function (line) {
      notes += "<p>" + esc(fmt(line)) + "</p>";
    });
    if (!notes) notes = '<p class="muted">' + esc(t("noRumor")) + "</p>";
    return (
      '<section class="panel">' +
      "<h2>" +
      esc(t("briefing")) +
      "</h2>" +
      '<p class="lead">' +
      esc(s.day === 1 ? t("briefingDay1") : t("briefingLater")) +
      "</p>" +
      '<div class="notes">' +
      notes +
      "</div>" +
      '<ul class="bills">' +
      "<li>" +
      esc(t("guestsTonight", { n: game.customerCount() })) +
      "</li>" +
      "<li>" +
      esc(t("powerBill", { yen: yen(b.power) })) +
      "</li>" +
      (b.due
        ? "<li>" + esc(t(s.owed ? "stallBillOwed" : "stallBill", { yen: yen(b.fee) })) + "</li>"
        : "<li>" + esc(t("noStallTonight")) + "</li>") +
      (owned.length ? "<li>" + esc(t("installed", { list: owned.join(D.quotes().sep) })) + "</li>" : "") +
      "</ul>" +
      '<div class="actions">' +
      btn("open", t("openShop"), "", { primary: true }) +
      adCoolBtn() +
      adBailBtn() +
      "</div>" +
      adStatus() +
      flash() +
      "</section>"
    );
  }

  function customerLine(c) {
    if (c.mood === "counter") return D.archLine(c.archId, "counter", 0);
    return D.archLine(c.archId, "enter", c.enterIndex || 0);
  }

  function secretsHtml(item) {
    const lines = [];
    for (let i = 0; i < item.shownSecrets; i++) {
      lines.push("<li>" + esc(D.tell(item.faceOrigin, item.secretIndices[i])) + "</li>");
    }
    return lines.length ? '<ul class="secrets">' + lines.join("") + "</ul>" : "";
  }

  function counter() {
    const s = game.state;
    const c = s.customer;
    if (!c) return '<section class="panel"><p>' + esc(t("counterEmpty")) + "</p></section>";
    const item = c.item;
    const max = game.inspectMax(c);
    const arch = D.archText(c.archId);
    const ads = window.ProvenanceAds;
    const canBonusLook =
      ads &&
      ads.configured("look") &&
      !c.bonusLook &&
      c.mood === "open" &&
      s.phase === "counter" &&
      c.inspects >= (s.upgrades.lamp ? 3 : 2);
    let actions = "";
    if (s.phase === "result") {
      const nextLabel = s.queue && s.queue.length ? t("nextCustomer") : t("toBackroom");
      actions =
        '<div class="result ' +
        esc(s.result.tone) +
        '"><h3>' +
        esc(fmt(s.result.title)) +
        "</h3><p>" +
        esc(fmt(s.result.body)) +
        "</p></div>" +
        '<div class="actions">' +
        btn("ack", nextLabel, "", { primary: true }) +
        "</div>";
    } else if (c.mood === "counter") {
      actions =
        '<div class="result warn"><h3>' +
        esc(t("counterOfferTitle")) +
        "</h3><p>" +
        esc(customerLine(c)) +
        '</p><p class="askline">' +
        yen(c.counter) +
        "</p></div>" +
        '<div class="actions">' +
        btn("accept", t("acceptCounter", { yen: yen(c.counter) }), "", {
          primary: true,
          disabled: s.credits < c.counter || s.inventory.length >= game.cap()
        }) +
        btn("refuse", t("refuseCounter")) +
        "</div>";
    } else {
      const low = priceOf(c.ask, 0.65);
      const mid = priceOf(c.ask, 0.85);
      const full = priceOf(c.ask, 1);
      const fullShelf = s.inventory.length >= game.cap();
      actions =
        '<div class="actions">' +
        btn("inspect", t("inspect", { n: c.inspects, max: max }), "", { disabled: c.inspects >= max }) +
        btn("offer", t("lowball", { yen: yen(low) }), 'data-mult="0.65"', { disabled: fullShelf || s.credits < low }) +
        btn("offer", t("midball", { yen: yen(mid) }), 'data-mult="0.85"', { disabled: fullShelf || s.credits < mid }) +
        btn("offer", t("fullball", { yen: yen(full) }), 'data-mult="1"', {
          primary: true,
          disabled: fullShelf || s.credits < full
        }) +
        btn("pass", t("pass"), "", { ghost: true }) +
        btn("snitch", t("snitch"), "", { danger: true }) +
        (canBonusLook
          ? btn("ad-look", t("adLook"), "", { disabled: adBusy })
          : "") +
        "</div>" +
        '<p class="fine">' +
        esc(t("counterTip")) +
        "</p>" +
        adStatus();
    }
    return (
      '<section class="who">' +
      '<div class="bust" style="--c:' +
      esc(c.color) +
      '">' +
      esc(c.mark) +
      "</div>" +
      "<div><div class=\"who-name\">" +
      esc(arch.name) +
      '</div><div class="who-role">' +
      esc(arch.role) +
      "</div></div>" +
      '<p class="look">' +
      esc(arch.look) +
      "</p>" +
      '<p class="say">' +
      esc(D.quotes().q) +
      esc(customerLine(c)) +
      esc(D.quotes().q2) +
      "</p>" +
      '<p class="fine queue-note">' +
      esc(t("queueLeft", { n: (s.queue && s.queue.length) || 0 })) +
      "</p>" +
      "</section>" +
      '<section class="panel ticket-wrap">' +
      '<article class="ticket">' +
      '<div class="ticket-top"><span>NO. ' +
      c.ticket +
      "</span><span>" +
      esc(D.catName(item.cat)) +
      "</span></div>" +
      "<h2>" +
      esc(itemName(item)) +
      (item.knownCorp ? ' <em class="brand">' + esc(t("stamped")) + "</em>" : "") +
      "</h2>" +
      '<div class="stamp">' +
      esc(D.conditionName(item.conditionId)) +
      "</div>" +
      "<p>" +
      esc(D.itemBlurb(item.templateId)) +
      "</p>" +
      '<p class="vague">' +
      esc(D.vague(item.vagueIndex)) +
      "</p>" +
      secretsHtml(item) +
      (item.flipped ? '<p class="reveal">' + esc(D.gemText(item.templateId)) + "</p>" : "") +
      (item.gutOrigin ? '<p class="gut">' + esc(D.gut(item.gutOrigin)) + "</p>" : "") +
      (item.estimate
        ? '<p class="est">' + esc(t("estimate", { lo: yen(item.estimate[0]), hi: yen(item.estimate[1]) })) + "</p>"
        : "") +
      '<div class="ask"><span>' +
      esc(t("ask")) +
      "</span><strong>" +
      yen(c.ask) +
      "</strong></div>" +
      "</article>" +
      actions +
      flash() +
      "</section>"
    );
  }

  function backroom() {
    return (
      '<section class="panel">' +
      "<h2>" +
      esc(t("backroom")) +
      "</h2>" +
      '<p class="lead">' +
      esc(t("backroomLead")) +
      "</p>" +
      flash() +
      stockBoards() +
      '<div class="actions">' +
      btn("close", t("closeShop"), "", { primary: true }) +
      "</div>" +
      '<p class="fine">' +
      esc(t("backroomTip")) +
      "</p>" +
      "</section>"
    );
  }

  function stockBoards() {
    const s = game.state;
    return (
      "<h3>" +
      esc(t("shelf", { n: s.inventory.length, cap: game.cap() })) +
      "</h3>" +
      cards(s.inventory, true) +
      "<h3>" +
      esc(t("window", { n: s.window.length })) +
      "</h3>" +
      (s.window.length ? cards(s.window, false) : '<p class="muted">' + esc(t("windowEmpty")) + "</p>")
    );
  }

  function cards(list, onShelf) {
    if (!list.length) return '<p class="muted">' + esc(t("shelfEmpty")) + "</p>";
    return list
      .map(function (it) {
        const sells =
          (onShelf
            ? sellBtn(it, "window", t("channelWindow"))
            : btn("recall", t("recall"), 'data-uid="' + it.uid + '"', { ghost: true })) +
          sellBtn(it, "alley", t("channelAlley")) +
          sellBtn(it, "fixer", t("channelFixer")) +
          sellBtn(it, "corp", t("channelCorp")) +
          btn("discard", t("discard"), 'data-uid="' + it.uid + '"', { danger: true });
        return (
          '<article class="stock">' +
          "<header><b>" +
          esc(itemName(it)) +
          "</b><span>" +
          esc(D.catName(it.cat)) +
          " · " +
          esc(D.conditionName(it.conditionId)) +
          (it.knownCorp ? " · " + esc(t("stamped")) : "") +
          "</span></header>" +
          "<p>" +
          esc(t("paid", { yen: yen(it.paid || 0) })) +
          "</p>" +
          (it.flipped ? "<p>" + esc(D.gemText(it.templateId)) + "</p>" : "") +
          (it.gutOrigin ? '<p class="muted">' + esc(D.gut(it.gutOrigin)) + "</p>" : "") +
          '<div class="sells">' +
          sells +
          "</div>" +
          "</article>"
        );
      })
      .join("");
  }

  function sellBtn(it, channel, label) {
    const check = game.canSell(it.uid, channel);
    return btn("sell", label, 'data-uid="' + it.uid + '" data-channel="' + channel + '"', { disabled: !check.ok });
  }

  function stockList(allowDiscard) {
    const s = game.state;
    const items = s.inventory
      .map(function (it) {
        return (
          "<li><span>" +
          esc(itemName(it)) +
          "</span><em>" +
          yen(it.paid || 0) +
          "</em>" +
          (allowDiscard ? btn("discard", t("discardShort"), 'data-uid="' + it.uid + '"', { ghost: true }) : "") +
          "</li>"
        );
      })
      .join("");
    const win = s.window
      .map(function (it) {
        return (
          "<li><span>" +
          esc(t("windowItem", { name: itemName(it) })) +
          "</span><em>" +
          yen(it.paid || 0) +
          "</em></li>"
        );
      })
      .join("");
    return (
      '<section class="panel slim">' +
      "<h3>" +
      esc(t("shelfShort", { n: s.inventory.length, cap: game.cap() })) +
      "</h3>" +
      (items || win ? '<ul class="mini">' + items + win + "</ul>" : '<p class="muted">' + esc(t("empty")) + "</p>") +
      "</section>"
    );
  }

  function upgrades() {
    const s = game.state;
    if (s.phase !== "briefing" && s.phase !== "backroom") return "";
    const buttons = D.UPGRADES.filter(function (u) {
      return !s.upgrades[u.id];
    })
      .map(function (u) {
        const text = D.upgradeText(u.id);
        return (
          '<div class="up"><div><b>' +
          esc(text.name) +
          " " +
          yen(u.cost) +
          "</b><p>" +
          esc(text.desc) +
          "</p></div>" +
          btn("upgrade", t("install"), 'data-id="' + u.id + '"', { disabled: s.credits < u.cost }) +
          "</div>"
        );
      })
      .join("");
    if (!buttons) return "";
    return '<section class="panel slim"><h3>' + esc(t("tools")) + "</h3>" + buttons + "</section>";
  }

  function night() {
    const s = game.state;
    const n = s.night;
    const opts = game
      .nightOptions()
      .map(function (o) {
        const label = D.msg(o.labelKey, o.yen != null ? { yen: yen(o.yen) } : {});
        return btn("night", label, 'data-id="' + o.id + '"', {
          primary: !!o.primary,
          danger: !!o.danger
        });
      })
      .join("");
    return (
      '<section class="panel">' +
      "<h2>" +
      esc(t("night")) +
      "</h2>" +
      "<p>" +
      esc(D.eventText(n.eventId)) +
      "</p>" +
      '<ul class="bills">' +
      "<li>" +
      esc(t("powerBill", { yen: yen(n.power) })) +
      "</li>" +
      (n.fee ? "<li>" + esc(t("stallBill", { yen: yen(n.fee) })) + "</li>" : "<li>" + esc(t("noStallTonight")) + "</li>") +
      "<li>" +
      esc(t("onHand", { yen: yen(s.credits) })) +
      "</li>" +
      "</ul>" +
      (s.heat >= 55 ? '<p class="warnline">' + esc(t("nightWarn")) + "</p>" : "") +
      '<div class="actions">' +
      opts +
      adCoolBtn() +
      adBailBtn() +
      "</div>" +
      adStatus() +
      flash() +
      "</section>"
    );
  }

  function crisis() {
    const s = game.state;
    const c = s.crisis;
    const haveGoods = s.inventory.length + s.window.length > 0;
    return (
      '<section class="panel">' +
      "<h2>" +
      esc(t("crisis")) +
      "</h2>" +
      '<p class="lead">' +
      esc(D.msg(c.textKey)) +
      "</p>" +
      '<div class="actions">' +
      btn("crisis", t("bribe", { yen: yen(c.bribe) }), 'data-id="bribe"', {
        primary: true,
        disabled: s.credits < c.bribe
      }) +
      btn("crisis", t("dump"), 'data-id="dump"', { disabled: !haveGoods }) +
      btn("crisis", t("bluff", { pct: Math.round(c.bluff * 100) }), 'data-id="bluff"') +
      adBailBtn() +
      "</div>" +
      adStatus() +
      flash() +
      "</section>"
    );
  }

  function ending() {
    const e = game.state.ending;
    const rows = e.books
      .map(function (it) {
        return (
          "<tr><td>" +
          esc(D.itemName(it.templateId, it.flipped)) +
          "</td><td>" +
          esc(D.originLabel(it.origin)) +
          "</td><td>" +
          yen(it.paid) +
          "</td><td>" +
          yen(it.value) +
          "</td></tr>"
        );
      })
      .join("");
    return (
      '<section class="panel ending">' +
      '<p class="eyebrow">' +
      esc(e.win ? t("endingWin") : t("endingLose")) +
      "</p>" +
      "<h2>" +
      esc(D.msg(e.titleKey)) +
      "</h2>" +
      '<p class="lead">' +
      esc(D.msg(e.bodyKey)) +
      "</p>" +
      '<ul class="bills">' +
      "<li>" +
      esc(t("netWorth", { yen: yen(e.net) })) +
      "</li>" +
      "<li>" +
      esc(t("cash")) +
      " " +
      yen(e.credits) +
      "</li>" +
      "<li>" +
      esc(
        t("endMeters", {
          heat: Math.round(e.heat),
          street: Math.round(e.street),
          syndicate: Math.round(e.syndicate)
        })
      ) +
      "</li>" +
      "<li>" +
      esc(
        t("endStats", {
          bought: e.stats.bought,
          passed: e.stats.passed,
          right: e.stats.snitchRight,
          wrong: e.stats.snitchWrong
        })
      ) +
      "</li>" +
      "<li>" +
      esc(t("endMoney", { revenue: yen(e.stats.revenue), spent: yen(e.stats.spent) })) +
      "</li>" +
      "</ul>" +
      (rows
        ? '<div class="books"><table><thead><tr><th>' +
          esc(t("colItem")) +
          "</th><th>" +
          esc(t("colOrigin")) +
          "</th><th>" +
          esc(t("colPaid")) +
          "</th><th>" +
          esc(t("colValue")) +
          "</th></tr></thead><tbody>" +
          rows +
          "</tbody></table></div>"
        : '<p class="muted">' + esc(t("booksEmpty")) + "</p>") +
      '<p class="fine">' +
      esc(t("seed", { seed: e.seed })) +
      "</p>" +
      '<div class="actions">' +
      btn("start", t("again"), 'data-kind="new"', { primary: true }) +
      btn("share", t("share")) +
      btn("menu", t("menu"), "", { ghost: true }) +
      "</div>" +
      '<nav class="more" data-play-more="provenance-unknown" aria-label="' +
      esc(t("alsoPlay")) +
      '"></nav>' +
      "</section>"
    );
  }

  function adCoolBtn() {
    const ads = window.ProvenanceAds;
    const s = game.state;
    if (!ads || !ads.configured("cool") || s.dayAds.cool) return "";
    return btn("ad-cool", t("adCool"), "", { disabled: adBusy });
  }

  function adBailBtn() {
    const ads = window.ProvenanceAds;
    const s = game.state;
    if (!ads || !ads.configured("bailout") || s.dayAds.bailout) return "";
    const label = t("adBail") + " · " + t("bailAmount", { yen: yen(D.BALANCE.adBailout) });
    return btn("ad-bail", label, "", { disabled: adBusy });
  }

  function adStatus() {
    return adNote ? '<p class="flash" role="status">' + esc(adNote) + "</p>" : "";
  }

  function flash() {
    const text = game.state.flash ? fmt(game.state.flash) : "";
    return text ? '<p class="flash" role="status">' + esc(text) + "</p>" : "";
  }

  function logList() {
    const lines = game.state.log;
    if (!lines.length) return "";
    return (
      '<ol class="log">' +
      lines
        .map(function (line) {
          return "<li>" + esc(fmt(line)) + "</li>";
        })
        .join("") +
      "</ol>"
    );
  }

  function start(kind) {
    titleNote = "";
    adNote = "";
    const boot = function () {
      try {
        if (kind === "continue") {
          const snap = load();
          if (!snap) return;
          game = PS.createGame({ snapshot: snap });
        } else if (kind === "daily") {
          game = PS.createGame({ seed: dailySeed() });
        } else {
          game = PS.createGame({ seed: (Math.random() * 4294967296) >>> 0 });
        }
        persist();
        blip(440, 0.08);
        if (window.ProvenanceAds) window.ProvenanceAds.prepare();
        render();
      } catch (err) {
        game = null;
        titleNote = t("badSave");
        renderTitle();
      }
    };
    if (game && game.state.phase === "ending") maybeInterstitial(boot);
    else boot();
  }

  function act(name, el) {
    if (name === "lang") {
      I.setLang(el.dataset.lang);
      titleNote = "";
      render();
      return;
    }
    if (name === "start") {
      start(el.dataset.kind || "new");
      return;
    }
    if (name === "wipe") {
      wipe();
      titleNote = t("wipeDone");
      renderTitle();
      return;
    }
    if (name === "menu") {
      game = null;
      renderTitle();
      return;
    }
    if (name === "mute") {
      soundOn = !soundOn;
      try {
        localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0");
      } catch (err) {
        /* ignore */
      }
      if (soundOn) blip(520, 0.06);
      render();
      return;
    }
    if (name === "share") {
      const url = window.ProvenanceTg ? window.ProvenanceTg.deepLink() : location.href;
      const text = t("shareText", { url: url });
      if (window.ProvenanceTg) window.ProvenanceTg.share(text);
      else {
        try {
          navigator.clipboard.writeText(text);
          titleNote = t("share");
        } catch (err) {}
      }
      if (window.ProvenanceTg) window.ProvenanceTg.haptic("success");
      return;
    }
    if (name === "ad-look" || name === "ad-cool" || name === "ad-bail") {
      watchAd(name);
      return;
    }
    if (!game) return;
    let result = null;
    if (name === "open") result = game.openShop();
    else if (name === "inspect") result = game.inspect();
    else if (name === "offer") result = game.offer(Number(el.dataset.mult));
    else if (name === "accept") result = game.acceptCounter();
    else if (name === "refuse") result = game.refuseCounter();
    else if (name === "pass") result = game.pass();
    else if (name === "snitch") result = game.snitch();
    else if (name === "ack") result = game.ack();
    else if (name === "discard") result = game.discard(el.dataset.uid);
    else if (name === "sell") result = game.sell(el.dataset.uid, el.dataset.channel);
    else if (name === "recall") result = game.recall(el.dataset.uid);
    else if (name === "close") result = game.closeShop();
    else if (name === "night") result = game.nightChoice(el.dataset.id);
    else if (name === "crisis") result = game.crisisChoice(el.dataset.id);
    else if (name === "upgrade") result = game.buyUpgrade(el.dataset.id);
    if (result && result.ok) {
      if (name === "inspect") blip(660, 0.04);
      else if (name === "snitch") blip(180, 0.12);
      else if (name === "offer" || name === "accept") blip(520, 0.06);
      else blip(360, 0.05);
      if (window.ProvenanceTg) window.ProvenanceTg.haptic(name === "snitch" ? "warn" : "light");
    } else if (result && result.error) {
      blip(140, 0.08);
      if (window.ProvenanceTg) window.ProvenanceTg.haptic("error");
    }
    persist();
    render();
  }

  function watchAd(kind) {
    const ads = window.ProvenanceAds;
    if (!ads) {
      adNote = t("adEmpty");
      render();
      return;
    }
    if (adBusy || ads.busy()) {
      adNote = t("adBusy");
      render();
      return;
    }
    const placement = kind === "ad-look" ? "look" : kind === "ad-cool" ? "cool" : "bailout";
    if (!ads.configured(placement)) {
      adNote = t("adEmpty");
      render();
      return;
    }
    adBusy = true;
    adNote = t("adPlaying");
    render();
    ads.rewarded(placement).then(function (result) {
      adBusy = false;
      if (!result || !result.ok) {
        adNote = result && result.reason === "skip" ? t("adSkip") : result && result.reason === "unconfigured" ? t("adEmpty") : t("adFail");
        if (window.ProvenanceTg) window.ProvenanceTg.haptic("error");
        render();
        return;
      }
      adNote = "";
      let grant = null;
      if (placement === "look") grant = game.grantBonusLook();
      else if (placement === "cool") grant = game.grantCool();
      else grant = game.grantBailout();
      if (grant && grant.ok) {
        blip(620, 0.08);
        if (window.ProvenanceTg) window.ProvenanceTg.haptic("success");
      } else if (grant && grant.error) adNote = grant.error;
      persist();
      render();
    });
  }

  function maybeInterstitial(done) {
    const ads = window.ProvenanceAds;
    if (!ads || !ads.configured("interstitial")) {
      done();
      return;
    }
    const timed = new Promise(function (resolve) {
      setTimeout(resolve, 2500);
    });
    Promise.race([ads.interstitial().catch(function () {}), timed]).then(done, done);
  }

  app.addEventListener("click", function (e) {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    e.preventDefault();
    act(el.dataset.act, el);
  });

  document.addEventListener("keydown", function (e) {
    if (!game) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const s = game.state;
    const key = e.key;
    if (key === "Enter") {
      if (s.phase === "result") act("ack", {});
      else if (s.phase === "briefing") act("open", {});
      else return;
      e.preventDefault();
      return;
    }
    if (s.phase !== "counter" || !s.customer || s.customer.mood !== "open") return;
    const map = { "1": "inspect", "2": "offer", "3": "offer", "4": "offer", "5": "pass", "6": "snitch" };
    if (!map[key]) return;
    e.preventDefault();
    if (map[key] === "offer") {
      const mult = key === "2" ? "0.65" : key === "3" ? "0.85" : "1";
      act("offer", { dataset: { mult: mult } });
    } else act(map[key], { dataset: {} });
  });

  I.init();
  if (window.ProvenanceTg) window.ProvenanceTg.ready();
  if (window.ProvenanceAds) window.ProvenanceAds.prepare();
  renderTitle();
})();

