(function (root) {
  "use strict";

  const D = root.PSData;
  if (!D) throw new Error("PSData missing");
  const B = D.BALANCE;

  function makeRng(seed) {
    let a = seed >>> 0;
    function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    next.getState = function () {
      return a >>> 0;
    };
    next.setState = function (s) {
      a = s >>> 0;
    };
    return next;
  }

  function createGame(opts) {
    opts = opts || {};
    if (opts.snapshot) {
      if (opts.snapshot.version !== 2 || !opts.snapshot.state) throw new Error("bad save");
      const state = JSON.parse(JSON.stringify(opts.snapshot.state));
      if (!Array.isArray(state.inventory) || !state.phase) throw new Error("bad save");
      if (!state.dayAds) state.dayAds = { cool: false, bailout: false };
      const rng = makeRng(state.seed || 1);
      if (state.rngState != null) rng.setState(state.rngState);
      return bind(state, rng);
    }
    let seed = opts.seed;
    if (seed == null || Number.isNaN(Number(seed))) seed = (Math.random() * 4294967296) >>> 0;
    seed = seed >>> 0 || 1;
    return bind(fresh(seed), makeRng(seed));
  }

  function fresh(seed) {
    return {
      seed,
      rngState: seed,
      day: 1,
      credits: B.startCredits,
      heat: B.startHeat,
      street: B.startStreet,
      syndicate: B.startSyndicate,
      inventory: [],
      window: [],
      upgrades: { lamp: false, storage: false, jammer: false, sign: false },
      phase: "boot",
      queue: null,
      customer: null,
      result: null,
      night: null,
      crisis: null,
      ending: null,
      flash: null,
      log: [],
      pendingLearn: [],
      todayRumors: [],
      morningSales: [],
      todayNote: null,
      flags: { blackout: false, rain: false },
      shortToday: false,
      owed: false,
      refusedOnce: false,
      confirmRefuse: false,
      dayHeat: 0,
      dayAds: { cool: false, bailout: false },
      lastArch: "",
      nextId: 1,
      ticket: 1040,
      stats: {
        bought: 0,
        passed: 0,
        snitched: 0,
        snitchRight: 0,
        snitchWrong: 0,
        revenue: 0,
        spent: 0,
        discarded: 0
      }
    };
  }

  function bind(state, rng) {
    function clamp(n, a, b) {
      return Math.max(a, Math.min(b, n));
    }

    function yen(n) {
      const v = Math.round(n);
      const sign = v < 0 ? "-" : "";
      const body = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return sign + "¥" + body;
    }

    function randInt(a, b) {
      return a + Math.floor(rng() * (b - a + 1));
    }

    function weighted(list, weightFn) {
      let total = 0;
      const weights = list.map(function (item) {
        const w = Math.max(0, weightFn(item));
        total += w;
        return w;
      });
      if (total <= 0) return list[0];
      let r = rng() * total;
      for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
      }
      return list[list.length - 1];
    }

    function pickN(arr, n) {
      const copy = arr.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy.slice(0, n);
    }

    function nid(prefix) {
      const id = prefix + state.nextId;
      state.nextId += 1;
      return id;
    }

    function M(key, vars) {
      return { k: "msg." + key, v: vars || {} };
    }

    function log(key, vars) {
      state.log.unshift(M(key, vars));
      if (state.log.length > 12) state.log.length = 12;
    }

    function fail(key, vars) {
      state.flash = M(key, vars);
      return { ok: false, error: D.msg(key, vars) };
    }

    function clearFlash() {
      state.flash = null;
    }

    function fmt(msg) {
      return root.PSI18n.format(msg);
    }

    function heatWord(n) {
      if (n >= 12) return D.msg("heatHeavy");
      if (n >= 5) return D.msg("heatMed");
      if (n > 0) return D.msg("heatLight");
      if (n < 0) return D.msg("heatDown");
      return D.msg("heatNone");
    }

    function label(origin) {
      return D.originLabel(origin);
    }

    function nameOf(item) {
      return D.itemName(item.templateId, item.flipped);
    }

    function clueOf(item) {
      if (item.hasGem && !item.flipped) return null;
      if (item.flipped) return D.gemText(item.templateId);
      if (item.shownSecrets > 0) {
        const idx = item.secretIndices[item.shownSecrets - 1];
        return D.tell(item.faceOrigin, idx);
      }
      return null;
    }

    function teachShort(item) {
      if (item.hasGem && !item.flipped) return D.msg("teachNoFlip", { origin: label(item.realOrigin) });
      const clue = clueOf(item);
      if (!clue) return D.msg("teachNoClue", { origin: label(item.realOrigin) });
      return D.msg("teachClue", { origin: label(item.realOrigin), clue: clue });
    }

    function cap() {
      return state.upgrades.storage ? B.slotsStorage : B.slots;
    }

    function customerCount() {
      let n = 4;
      if (state.upgrades.sign) n += 1;
      if (state.shortToday) n -= 1;
      return clamp(n, 3, 6);
    }

    function billsFor(day) {
      const due = day % 4 === 0;
      return {
        power: B.powerBase + day * B.powerPerDay,
        fee: due ? Math.round((B.feeBase + day * B.feePerDay) * (state.owed ? 1.5 : 1)) : 0,
        due: due
      };
    }

    function gainHeat(n) {
      const applied = n > 0 && state.upgrades.jammer ? Math.round(n * B.jammer) : Math.round(n);
      state.heat = clamp(state.heat + applied, 0, 100);
      if (applied > 0) state.dayHeat += applied;
      return applied;
    }

    function addHeatRaw(n) {
      state.heat = clamp(state.heat + Math.round(n), 0, 100);
    }

    function locate(uid) {
      const keys = ["inventory", "window"];
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        const i = state[key].findIndex(function (it) {
          return it.uid === uid;
        });
        if (i >= 0) return { key: key, i: i, item: state[key][i] };
      }
      return null;
    }

    function forget(uid) {
      state.pendingLearn = state.pendingLearn.filter(function (p) {
        return p.uid !== uid;
      });
    }

    function archWeight(a) {
      let w = a.weight;
      if (a.id === "survey") w *= 1 + state.heat / 45;
      if (a.id === "scar") w *= 0.25 + state.syndicate / 35 + state.day / 24;
      if (a.id === "granny" || a.id === "student" || a.id === "tourist") w *= 0.55 + state.street / 80;
      return w;
    }

    function byId(id) {
      for (let i = 0; i < D.ARCH.length; i++) {
        if (D.ARCH[i].id === id) return D.ARCH[i];
      }
      return D.ARCH[0];
    }

    function pickOrigin(arch) {
      return weighted(["legit", "stolen", "hot", "planted"], function (o) {
        let w = arch.origin[o] || 0;
        if (o === "planted" && state.heat > 45) w *= 1.7;
        if (o === "legit" && state.street > 35) w *= 1.35;
        if (o === "legit" && state.flags.rain) w *= 1.45;
        if (o === "hot" && state.day > 7) w *= 1.25;
        return w;
      });
    }

    function makeItem(arch, origin) {
      let pool = D.ITEMS.filter(function (it) {
        return arch.cats.indexOf(it.cat) >= 0 && (it.origins[origin] || 0) > 0;
      });
      if (!pool.length) {
        pool = D.ITEMS.filter(function (it) {
          return (it.origins[origin] || 0) > 0;
        });
      }
      if (!pool.length) pool = D.ITEMS.slice();
      const tmpl = weighted(pool, function (it) {
        return it.origins[origin] || 1;
      });
      const cond = weighted(D.CONDITIONS, function (c) {
        return c.weight;
      });
      const scale = B.valueScale + (state.day - 1) * B.valueScaleDay;
      let faceValue = Math.round(randInt(tmpl.min, tmpl.max) * cond.mult * scale);
      faceValue = Math.max(20, faceValue);
      let realOrigin = origin;
      let realValue = faceValue;
      let realHeat = tmpl.heat[origin] != null ? tmpl.heat[origin] : 8;
      let realCorp = !!tmpl.corp;
      let hasGem = false;
      if (tmpl.gem && origin === "legit" && rng() < tmpl.gem.chance) {
        hasGem = true;
        realOrigin = tmpl.gem.origin;
        realValue = Math.max(20, Math.round(tmpl.gem.value * cond.mult * scale));
        realHeat = tmpl.gem.heat;
        realCorp = !!tmpl.gem.corp;
      }
      const tellCount = ((D.pack().tell && D.pack().tell[origin]) || [0, 1, 2]).length;
      const indices = [];
      for (let i = 0; i < tellCount; i++) indices.push(i);
      const secretIndices = pickN(indices, Math.min(2, indices.length));
      const vagueCount = (D.pack().vague || [0]).length;
      return {
        uid: nid("i"),
        templateId: tmpl.id,
        cat: tmpl.cat,
        conditionId: cond.id,
        vagueIndex: randInt(0, Math.max(0, vagueCount - 1)),
        secretIndices: secretIndices,
        shownSecrets: 0,
        gutOrigin: null,
        estimate: null,
        flipped: false,
        hasGem: hasGem,
        knownCorp: !!tmpl.corp,
        realCorp: realCorp,
        faceOrigin: origin,
        faceValue: faceValue,
        realOrigin: realOrigin,
        realValue: realValue,
        realHeat: realHeat
      };
    }

    function makeCustomer(tutorial) {
      let arch;
      if (tutorial) {
        arch = rng() < 0.55 ? byId("granny") : byId("mosquito");
      } else {
        arch = weighted(D.ARCH, archWeight);
        if (arch.id === state.lastArch) {
          const again = weighted(D.ARCH, function (a) {
            return a.id === state.lastArch ? 0 : archWeight(a);
          });
          if (again) arch = again;
        }
      }
      state.lastArch = arch.id;
      let origin = pickOrigin(arch);
      if (tutorial && origin === "planted") origin = "legit";
      const item = makeItem(arch, origin);
      const basis = arch.knows ? item.realValue : item.faceValue;
      let ask = basis * arch.ask * (0.94 + rng() * 0.12);
      ask = Math.max(20, Math.round(ask));
      const floor = Math.min(ask, Math.max(15, Math.round(ask * arch.floor)));
      let insult = Math.round(floor * 0.74);
      if (insult >= floor) insult = Math.max(1, floor - 1);
      state.ticket += 1;
      const enterCount = (((D.archText(arch.id).lines || {}).enter) || [""]).length;
      return {
        uid: nid("c"),
        ticket: state.ticket,
        archId: arch.id,
        mark: arch.mark,
        color: arch.color,
        enterIndex: randInt(0, Math.max(0, enterCount - 1)),
        streetOnDeal: arch.streetOnDeal || 0,
        ask: ask,
        floor: floor,
        insult: insult,
        mood: "open",
        counter: null,
        inspects: 0,
        bonusLook: false,
        item: item
      };
    }

    function inspectMax(c) {
      const base = state.upgrades.lamp ? B.inspectLamp : B.inspectBase;
      return base + (c && c.bonusLook ? 1 : 0);
    }

    function tightness() {
      const n = state.customer ? state.customer.inspects : 0;
      if (n >= 3) return 0.05;
      if (n >= 2) return 0.09;
      if (n >= 1) return 0.22;
      return null;
    }

    function rollEstimate(item) {
      const t = tightness();
      if (t == null) {
        item.estimate = null;
        return;
      }
      const v = item.faceValue;
      item.estimate = [Math.max(10, Math.round(v * (1 - t))), Math.round(v * (1 + t))];
    }

    function rollGut(item) {
      const n = state.customer.inspects;
      const acc = n >= 3 ? 0.93 : n >= 2 ? 0.8 : 0.6;
      let o = item.faceOrigin;
      if (rng() > acc) {
        const others = ["legit", "stolen", "hot", "planted"].filter(function (x) {
          return x !== o;
        });
        o = others[Math.floor(rng() * others.length)];
      }
      item.gutOrigin = o;
    }

    function flip(item) {
      item.flipped = true;
      item.faceOrigin = item.realOrigin;
      item.faceValue = item.realValue;
      if (item.realCorp) item.knownCorp = true;
    }

    function setResult(titleKey, bodyKey, bodyVars, tone) {
      state.result = {
        title: M(titleKey),
        body: M(bodyKey, bodyVars),
        tone: tone
      };
      state.phase = "result";
    }

    function stockFrom(item, paid) {
      return {
        uid: item.uid,
        templateId: item.templateId,
        cat: item.cat,
        conditionId: item.conditionId,
        vagueIndex: item.vagueIndex,
        secretIndices: item.secretIndices.slice(),
        shownSecrets: item.shownSecrets,
        gutOrigin: item.gutOrigin,
        flipped: item.flipped,
        hasGem: item.hasGem,
        knownCorp: item.knownCorp,
        realCorp: item.realCorp,
        faceOrigin: item.faceOrigin,
        realOrigin: item.realOrigin,
        realValue: item.realValue,
        realHeat: item.realHeat,
        paid: paid
      };
    }

    function completeBuy(price) {
      const c = state.customer;
      const item = c.item;
      if (state.credits < price) return fail("noCash");
      if (state.inventory.length >= cap()) return fail("shelfFull");
      state.credits -= price;
      state.stats.spent += price;
      state.stats.bought += 1;
      const dh = gainHeat(item.realHeat);
      const ratio = price / item.realValue;
      if (item.realOrigin === "legit") {
        if (ratio >= 0.85) state.street += 3;
        else if (ratio < 0.62) state.street -= 4;
        else state.street += 1;
        if (state.upgrades.sign && ratio >= 0.85) state.street += 1;
      } else if (item.realOrigin === "stolen" || item.realOrigin === "hot") {
        state.syndicate += 2;
      }
      if (c.streetOnDeal && item.realOrigin === "legit") state.street += c.streetOnDeal;
      state.street = clamp(state.street, 0, 100);
      state.syndicate = clamp(state.syndicate, 0, 100);
      const stock = stockFrom(item, price);
      state.inventory.push(stock);
      state.pendingLearn.push({ uid: stock.uid, day: state.day + 1 });
      log("bought", { name: nameOf(stock), yen: yen(price) });
      setResult(
        "boughtTitle",
        "boughtBody",
        {
          line: D.archLine(c.archId, "deal", 0),
          heat: heatWord(dh)
        },
        dh >= 12 ? "bad" : "good"
      );
      return { ok: true };
    }

    function nextCustomer() {
      if (!state.queue || !state.queue.length) {
        state.phase = "backroom";
        state.customer = null;
        state.result = null;
        return { ok: true };
      }
      state.customer = state.queue.shift();
      state.phase = "counter";
      state.result = null;
      return { ok: true };
    }

    function resolveWindow() {
      const kept = [];
      for (let i = 0; i < state.window.length; i++) {
        const item = state.window[i];
        const chance = B.windowChance[item.realOrigin] != null ? B.windowChance[item.realOrigin] : 0.3;
        if (rng() < chance) {
          const pay = Math.round(item.realValue * (B.windowPay[item.realOrigin] != null ? B.windowPay[item.realOrigin] : 0.8));
          state.credits += pay;
          state.stats.revenue += pay;
          const h = B.windowHeat[item.realOrigin] || 0;
          if (h) addHeatRaw(h);
          forget(item.uid);
          const line = M("windowSold", {
            name: nameOf(item),
            yen: yen(pay),
            teach: teachShort(item)
          });
          state.log.unshift(line);
          if (state.log.length > 12) state.log.length = 12;
          state.morningSales.push(line);
        } else {
          kept.push(item);
        }
      }
      state.window = kept;
    }

    function beginDay() {
      state.morningSales = [];
      resolveWindow();
      const due = state.pendingLearn.filter(function (p) {
        return p.day <= state.day;
      });
      state.pendingLearn = state.pendingLearn.filter(function (p) {
        return p.day > state.day;
      });
      const notes = [];
      for (let i = 0; i < due.length; i++) {
        const found = locate(due[i].uid);
        if (!found) continue;
        const item = found.item;
        if (item.hasGem && !item.flipped) {
          notes.push(M("rumorNoFlip", { name: nameOf(item), origin: label(item.realOrigin) }));
        } else {
          const clue = clueOf(item);
          notes.push(
            clue
              ? M("rumorClue", { name: nameOf(item), origin: label(item.realOrigin), clue: clue })
              : M("rumorNoLook", { name: nameOf(item), origin: label(item.realOrigin) })
          );
        }
      }
      state.todayRumors = notes;
      state.dayHeat = 0;
      state.dayAds = { cool: false, bailout: false };
      state.customer = null;
      state.result = null;
      state.flash = null;
      state.confirmRefuse = false;
      state.todayNote = null;
      state.shortToday = false;
      if (state.flags.blackout) {
        state.shortToday = true;
        state.flags.blackout = false;
        state.todayNote = M("blackoutNote");
      }
      state.queue = null;
      state.phase = "briefing";
    }

    function quote(item, channel) {
      const o = item.realOrigin;
      const v = item.realValue;
      if (channel === "alley") {
        if (o === "planted") return { ok: false, heat: B.plantedAskHeat, line: D.buyerLine("alley", "planted") };
        return {
          ok: true,
          pay: Math.round(v * B.alley[o]),
          heat: B.alleyHeat[o] || 0,
          syndicate: o === "stolen" ? 1 : 0,
          line: D.buyerLine("alley", o)
        };
      }
      if (channel === "fixer") {
        const trust = Math.min(1.18, B.fixerBase + state.street / B.fixerStreet + (state.syndicate > 28 ? 0.05 : 0));
        return {
          ok: true,
          pay: Math.round(v * trust * B.fixerOrigin[o]),
          heat: B.fixerHeat[o] || 0,
          syndicate: o === "planted" ? -6 : o === "hot" ? 3 : o === "stolen" ? 2 : 0,
          line: D.buyerLine("fixer", o)
        };
      }
      if (channel === "corp") {
        if (!item.realCorp) return { ok: false, heat: 0, line: D.msg("corpOnly") };
        return {
          ok: true,
          pay: Math.round(v * B.corp[o]),
          heat: B.corpHeat[o] || 0,
          syndicate: 0,
          line: D.buyerLine("corp", o)
        };
      }
      return { ok: false, heat: 0, line: D.msg("noChannel") };
    }

    function snapshotBooks() {
      return state.inventory.concat(state.window).map(function (it) {
        return {
          templateId: it.templateId,
          flipped: it.flipped,
          origin: it.realOrigin,
          paid: it.paid || 0,
          value: it.realValue
        };
      });
    }

    function netWorth() {
      return (
        state.credits +
        snapshotBooks().reduce(function (sum, it) {
          return sum + Math.round(it.value * 0.7);
        }, 0)
      );
    }

    function endingPayload(win, titleKey, bodyKey) {
      return {
        win: win,
        titleKey: titleKey,
        bodyKey: bodyKey,
        net: netWorth(),
        credits: state.credits,
        heat: state.heat,
        street: state.street,
        syndicate: state.syndicate,
        day: state.day,
        seed: state.seed,
        stats: {
          bought: state.stats.bought,
          passed: state.stats.passed,
          snitched: state.stats.snitched,
          snitchRight: state.stats.snitchRight,
          snitchWrong: state.stats.snitchWrong,
          revenue: state.stats.revenue,
          spent: state.stats.spent,
          discarded: state.stats.discarded
        },
        books: snapshotBooks()
      };
    }

    function lose(titleKey, bodyKey) {
      state.phase = "ending";
      state.ending = endingPayload(false, titleKey, bodyKey);
      state.customer = null;
      log(titleKey);
      return { ok: true, ending: true };
    }

    function win() {
      const net = netWorth();
      let titleKey = "endLitTitle";
      let bodyKey = "endLitBody";
      if (net >= 8000 && state.heat < 52 && state.street >= 24) {
        titleKey = "endSignTitle";
        bodyKey = "endSignBody";
      } else if (net >= 5200 && state.heat < 62) {
        titleKey = "endStandTitle";
        bodyKey = "endStandBody";
      } else if (state.heat >= 62) {
        titleKey = "endLitTitle";
        bodyKey = "endLitHeatBody";
      } else if (net < 3600) {
        titleKey = "endThinTitle";
        bodyKey = "endThinBody";
      }
      state.phase = "ending";
      state.ending = endingPayload(true, titleKey, bodyKey);
      log(titleKey);
      return { ok: true, ending: true };
    }

    function advance() {
      if (state.credits < 0) return lose("loseCashTitle", "loseCashBody");
      if (state.day >= B.days) return win();
      state.day += 1;
      beginDay();
      return { ok: true };
    }

    function shouldRaid() {
      if (state.heat >= 100) return true;
      const gate = state.day <= 2 ? 66 : 48;
      if (state.heat < gate) return false;
      return rng() < (state.heat - gate) / 110;
    }

    function finishNight() {
      const decay = state.dayHeat >= 12 ? 4 : 10;
      addHeatRaw(-decay);
      if (shouldRaid()) {
        state.phase = "crisis";
        state.crisis = {
          bribe: 260 + Math.round(state.heat * 7),
          bluff: clamp(0.2 + state.street / 190 - state.heat / 280, 0.08, 0.72),
          textKey: state.heat >= 85 ? "crisisHard" : "crisisSoft"
        };
        log("someoneCame");
        return { ok: true };
      }
      return advance();
    }

    function openShop() {
      clearFlash();
      if (state.phase !== "briefing") return fail("notBriefing");
      const n = customerCount();
      state.queue = [];
      for (let i = 0; i < n; i++) state.queue.push(makeCustomer(state.day === 1 && i === 0));
      state.flags.rain = false;
      return nextCustomer();
    }

    function inspect() {
      clearFlash();
      if (state.phase !== "counter") return fail("noCustomer");
      const c = state.customer;
      const max = inspectMax(c);
      if (c.inspects >= max) return fail("noMoreInspect");
      c.inspects += 1;
      const item = c.item;
      if (item.shownSecrets < item.secretIndices.length) item.shownSecrets += 1;
      if (item.hasGem && !item.flipped && c.inspects >= 2) flip(item);
      rollGut(item);
      rollEstimate(item);
      return { ok: true };
    }

    function offer(mult) {
      clearFlash();
      if (state.phase !== "counter") return fail("noCustomer");
      const c = state.customer;
      if (c.mood !== "open") return fail("handleCounter");
      if (mult < 0.5 || mult > 1.05) return fail("badPrice");
      const price = Math.max(1, Math.round(c.ask * mult));
      if (state.credits < price) return fail("noCash");
      if (state.inventory.length >= cap()) return fail("shelfFull");
      if (price >= c.floor) return completeBuy(price);
      if (price <= c.insult) {
        state.street = clamp(state.street - 3, 0, 100);
        if (c.archId === "scar") state.syndicate = clamp(state.syndicate - 4, 0, 100);
        state.stats.passed += 1;
        log("insulted", { name: D.archText(c.archId).name });
        state.result = {
          title: M("leftTitle"),
          body: { k: "", raw: D.archLine(c.archId, "insult", 0) },
          tone: "bad"
        };
        state.phase = "result";
        return { ok: true };
      }
      c.mood = "counter";
      c.counter = Math.max(c.floor, Math.round((c.floor + c.ask) / 2));
      return { ok: true };
    }

    function acceptCounter() {
      clearFlash();
      if (state.phase !== "counter" || !state.customer || state.customer.mood !== "counter") {
        return fail("noCounter");
      }
      return completeBuy(state.customer.counter);
    }

    function refuseCounter() {
      clearFlash();
      if (state.phase !== "counter" || !state.customer || state.customer.mood !== "counter") {
        return fail("noCounter");
      }
      const c = state.customer;
      state.stats.passed += 1;
      log("walked", { name: D.archText(c.archId).name });
      state.result = {
        title: M("noDealTitle"),
        body: { k: "", raw: D.archLine(c.archId, "walk", 0) },
        tone: "warn"
      };
      state.phase = "result";
      return { ok: true };
    }

    function pass() {
      clearFlash();
      if (state.phase !== "counter") return fail("noCustomer");
      const c = state.customer;
      if (c.archId === "granny") state.street = clamp(state.street - 1, 0, 100);
      state.stats.passed += 1;
      log("passed", { name: D.archText(c.archId).name });
      state.result = {
        title: M("passedTitle"),
        body: { k: "", raw: D.archLine(c.archId, "walk", 0) },
        tone: "warn"
      };
      state.phase = "result";
      return { ok: true };
    }

    function snitch() {
      clearFlash();
      if (state.phase !== "counter") return fail("noCustomer");
      const c = state.customer;
      const o = c.item.realOrigin;
      const eff = B.snitch[o];
      state.credits += eff.cash;
      gainHeat(eff.heat);
      state.street = clamp(state.street + eff.street, 0, 100);
      state.syndicate = clamp(state.syndicate + (eff.syndicate || 0), 0, 100);
      state.stats.snitched += 1;
      const right = o === "planted" || o === "hot";
      if (right) state.stats.snitchRight += 1;
      else state.stats.snitchWrong += 1;
      const bodyKey =
        o === "planted" ? "snitchPlanted" : o === "hot" ? "snitchHot" : o === "stolen" ? "snitchStolen" : "snitchLegit";
      log("snitchLog", { name: D.archText(c.archId).name, origin: label(o) });
      setResult(right ? "snitchRightTitle" : "snitchWrongTitle", "snitchBody", { body: D.msg(bodyKey), origin: label(o) }, right ? "warn" : "bad");
      return { ok: true };
    }

    function ack() {
      clearFlash();
      if (state.phase !== "result") return fail("noAck");
      state.result = null;
      state.customer = null;
      return nextCustomer();
    }

    function discard(uid) {
      clearFlash();
      if (state.phase !== "counter" && state.phase !== "backroom") return fail("cantDiscard");
      const loc = locate(uid);
      if (!loc) return fail("notFound");
      const item = loc.item;
      state[loc.key].splice(loc.i, 1);
      forget(uid);
      state.stats.discarded += 1;
      let dh = 0;
      if (item.realOrigin === "hot") dh = gainHeat(-5);
      else if (item.realOrigin === "planted") dh = gainHeat(-8);
      const msg = M("discarded", {
        name: nameOf(item),
        teach: teachShort(item),
        heat: dh ? heatWord(dh) : ""
      });
      state.flash = msg;
      state.log.unshift(msg);
      if (state.log.length > 12) state.log.length = 12;
      return { ok: true };
    }

    function canSell(uid, channel) {
      const loc = locate(uid);
      if (!loc) return { ok: false, reason: "notFound" };
      if (state.phase !== "backroom") return { ok: false, reason: "cantSellNow" };
      if (channel === "window") {
        if (loc.key === "window") return { ok: false, reason: "alreadyWindow" };
        if (state.window.length >= B.windowSlots) return { ok: false, reason: "windowFull" };
      }
      if (channel === "corp" && !loc.item.knownCorp) return { ok: false, reason: "noStamp" };
      return { ok: true };
    }

    function sell(uid, channel) {
      clearFlash();
      if (state.phase !== "backroom") return fail("finishCustomers");
      const loc = locate(uid);
      if (!loc) return fail("itemMissing");
      const item = loc.item;
      if (channel === "window") {
        if (loc.key === "window") return fail("alreadyWindow");
        if (state.window.length >= B.windowSlots) return fail("windowFull");
        state.inventory.splice(loc.i, 1);
        state.window.push(item);
        state.flash = M("toWindow", { name: nameOf(item) });
        log("windowLog", { name: nameOf(item) });
        return { ok: true };
      }
      if (channel === "corp" && !item.realCorp) return fail("corpReject");
      const q = quote(item, channel);
      if (!q.ok) {
        if (q.heat) gainHeat(q.heat);
        state.flash = { k: "", raw: q.line };
        state.log.unshift(state.flash);
        if (state.log.length > 12) state.log.length = 12;
        return { ok: false, error: q.line };
      }
      state[loc.key].splice(loc.i, 1);
      forget(item.uid);
      state.credits += q.pay;
      state.stats.revenue += q.pay;
      const dh = q.heat ? gainHeat(q.heat) : 0;
      if (q.syndicate) state.syndicate = clamp(state.syndicate + q.syndicate, 0, 100);
      const msg = M("sold", {
        line: q.line,
        yen: yen(q.pay),
        heat: heatWord(dh),
        teach: teachShort(item)
      });
      state.flash = msg;
      state.log.unshift(msg);
      if (state.log.length > 12) state.log.length = 12;
      return { ok: true };
    }

    function recall(uid) {
      clearFlash();
      if (state.phase !== "backroom" && state.phase !== "counter") return fail("cantRecall");
      const loc = locate(uid);
      if (!loc || loc.key !== "window") return fail("notInWindow");
      if (state.inventory.length >= cap()) return fail("shelfFull");
      state.window.splice(loc.i, 1);
      state.inventory.push(loc.item);
      state.flash = M("recalled", { name: nameOf(loc.item) });
      return { ok: true };
    }

    function closeShop() {
      clearFlash();
      if (state.phase !== "backroom") return fail("customersRemain");
      const event = weighted(D.EVENTS, function (e) {
        return e.weight;
      });
      if (event.heat) addHeatRaw(event.heat);
      if (event.street) state.street = clamp(state.street + event.street, 0, 100);
      if (event.cash) state.credits += event.cash;
      if (event.rain) state.flags.rain = true;
      const bills = billsFor(state.day);
      state.night = { power: bills.power, fee: bills.fee, eventId: event.id };
      state.phase = "night";
      state.confirmRefuse = false;
      state.log.unshift({ k: "", raw: D.eventText(event.id) });
      if (state.log.length > 12) state.log.length = 12;
      return { ok: true };
    }

    function nightOptions() {
      const n = state.night;
      const opts = [];
      const total = n.power + n.fee;
      if (state.credits >= total) {
        opts.push({
          id: "pay",
          labelKey: n.fee ? "payAll" : "payPower",
          yen: n.fee ? total : n.power,
          primary: true
        });
      }
      if (n.fee && state.credits >= n.fee && state.credits < total) {
        opts.push({ id: "fee-only", labelKey: "payFeeOnly", yen: n.fee, primary: true });
      }
      if (n.fee && !state.owed && state.credits < total) opts.push({ id: "owe", labelKey: "oweFee" });
      if (n.fee && state.credits < total) {
        opts.push({
          id: "refuse",
          labelKey: state.confirmRefuse ? "refuseConfirm" : state.refusedOnce ? "refuseFatal" : "refuseFee",
          danger: true
        });
      }
      if (!n.fee && state.credits < n.power) opts.push({ id: "dark", labelKey: "goDark", primary: true });
      return opts;
    }

    function nightChoice(id) {
      clearFlash();
      if (state.phase !== "night") return fail("notNight");
      const n = state.night;
      if (id !== "refuse") state.confirmRefuse = false;
      if (id === "pay") {
        const total = n.power + n.fee;
        if (state.credits < total) return fail("noCash");
        state.credits -= total;
        state.stats.spent += total;
        if (n.fee) state.owed = false;
        log("nightPaid", { yen: yen(total) });
        return finishNight();
      }
      if (id === "fee-only") {
        if (!n.fee || state.credits < n.fee) return fail("feeShort");
        state.credits -= n.fee;
        state.stats.spent += n.fee;
        state.owed = false;
        state.flags.blackout = true;
        addHeatRaw(4);
        log("feePaidDark");
        return finishNight();
      }
      if (id === "owe") {
        if (!n.fee || state.owed) return fail("cantOwe");
        if (state.credits >= n.power) {
          state.credits -= n.power;
          state.stats.spent += n.power;
        } else {
          state.flags.blackout = true;
          addHeatRaw(4);
        }
        state.owed = true;
        state.street = clamp(state.street - 4, 0, 100);
        log("feeOwed");
        return finishNight();
      }
      if (id === "refuse") {
        if (!n.fee) return fail("noFeeTonight");
        if (!state.confirmRefuse) {
          state.confirmRefuse = true;
          state.flash = M("refuseAgain");
          return { ok: true };
        }
        state.confirmRefuse = false;
        if (state.refusedOnce) return lose("loseStallTitle", "loseStallBody");
        state.refusedOnce = true;
        if (state.inventory.length) {
          const i = Math.floor(rng() * state.inventory.length);
          const gone = state.inventory.splice(i, 1)[0];
          forget(gone.uid);
          log("seized", { name: nameOf(gone) });
        }
        addHeatRaw(6);
        state.street = clamp(state.street - 8, 0, 100);
        if (state.credits >= n.power) {
          state.credits -= n.power;
          state.stats.spent += n.power;
        } else state.flags.blackout = true;
        log("refusedFee");
        return finishNight();
      }
      if (id === "dark") {
        if (n.fee) return fail("stillFee");
        if (state.credits >= n.power) return fail("canPayPower");
        state.flags.blackout = true;
        addHeatRaw(4);
        log("wentDark");
        return finishNight();
      }
      return fail("noPath");
    }

    function crisisChoice(id) {
      clearFlash();
      if (state.phase !== "crisis") return fail("noKnock");
      if (id === "bribe") {
        const cost = state.crisis.bribe;
        if (state.credits < cost) return fail("noCash");
        state.credits -= cost;
        state.stats.spent += cost;
        state.heat = clamp(state.heat - 28, 0, 100);
        state.street = clamp(state.street - 2, 0, 100);
        log("bribed", { yen: yen(cost) });
        return advance();
      }
      if (id === "dump") {
        const pool = state.inventory.concat(state.window).sort(function (a, b) {
          return b.realHeat - a.realHeat;
        });
        const n = Math.min(2, pool.length);
        if (!n) return fail("nothingDump");
        const picked = pool.slice(0, n);
        for (let i = 0; i < picked.length; i++) {
          const loc = locate(picked[i].uid);
          if (!loc) continue;
          state[loc.key].splice(loc.i, 1);
          forget(picked[i].uid);
          state.stats.discarded += 1;
        }
        state.heat = clamp(state.heat - (n === 2 ? 30 : 16), 0, 100);
        const sep = D.quotes().sep;
        const list = picked
          .map(function (it) {
            return D.msg("dumpItem", { name: nameOf(it), origin: label(it.realOrigin) });
          })
          .join(sep);
        log("dumped", { list: list });
        return advance();
      }
      if (id === "bluff") {
        const ok = rng() < state.crisis.bluff;
        if (ok) {
          state.heat = clamp(state.heat - 12, 0, 100);
          state.street = clamp(state.street + 2, 0, 100);
          log("bluffOk");
          return advance();
        }
        if (state.heat >= 74) return lose("loseBluffTitle", "loseBluffBody");
        state.credits -= 460;
        state.heat = clamp(state.heat - 6, 0, 100);
        state.street = clamp(state.street - 6, 0, 100);
        log("bluffPay", { yen: yen(460) });
        return advance();
      }
      return fail("noPath");
    }

    function buyUpgrade(id) {
      clearFlash();
      if (state.phase !== "briefing" && state.phase !== "backroom") return fail("cantUpgrade");
      let up = null;
      for (let i = 0; i < D.UPGRADES.length; i++) {
        if (D.UPGRADES[i].id === id) up = D.UPGRADES[i];
      }
      if (!up) return fail("noUpgrade");
      if (state.upgrades[id]) return fail("haveUpgrade");
      if (state.credits < up.cost) return fail("noCash");
      state.credits -= up.cost;
      state.stats.spent += up.cost;
      state.upgrades[id] = true;
      const name = D.upgradeText(id).name;
      state.flash = M("upgraded", { name: name });
      log("upgraded", { name: name });
      return { ok: true };
    }

    function grantBonusLook() {
      clearFlash();
      if (state.phase !== "counter" || !state.customer) return fail("noCustomer");
      const c = state.customer;
      if (c.bonusLook) return fail("adLookUsed");
      if (c.inspects < (state.upgrades.lamp ? B.inspectLamp : B.inspectBase)) return fail("adLookEarly");
      c.bonusLook = true;
      state.flash = M("adLookOk");
      log("adLookOk");
      return { ok: true };
    }

    function grantCool() {
      clearFlash();
      if (state.phase !== "briefing" && state.phase !== "backroom" && state.phase !== "night") {
        return fail("adCoolPhase");
      }
      if (state.dayAds.cool) return fail("adCoolUsed");
      state.dayAds.cool = true;
      addHeatRaw(-B.adCool);
      state.flash = M("adCoolOk", { n: B.adCool });
      log("adCoolOk", { n: B.adCool });
      return { ok: true };
    }

    function grantBailout() {
      clearFlash();
      if (state.phase !== "night" && state.phase !== "crisis" && state.phase !== "briefing") {
        return fail("adBailPhase");
      }
      if (state.dayAds.bailout) return fail("adBailUsed");
      state.dayAds.bailout = true;
      state.credits += B.adBailout;
      state.flash = M("adBailOk", { yen: yen(B.adBailout) });
      log("adBailOk", { yen: yen(B.adBailout) });
      return { ok: true };
    }

    function serialize() {
      state.rngState = rng.getState();
      return { version: 2, state: JSON.parse(JSON.stringify(state)) };
    }

    if (state.phase === "boot") beginDay();

    return {
      get state() {
        return state;
      },
      cap: cap,
      bills: function () {
        return billsFor(state.day);
      },
      customerCount: customerCount,
      inspectMax: inspectMax,
      canSell: canSell,
      openShop: openShop,
      inspect: inspect,
      offer: offer,
      acceptCounter: acceptCounter,
      refuseCounter: refuseCounter,
      pass: pass,
      snitch: snitch,
      ack: ack,
      discard: discard,
      sell: sell,
      recall: recall,
      closeShop: closeShop,
      nightOptions: nightOptions,
      nightChoice: nightChoice,
      crisisChoice: crisisChoice,
      buyUpgrade: buyUpgrade,
      grantBonusLook: grantBonusLook,
      grantCool: grantCool,
      grantBailout: grantBailout,
      serialize: serialize,
      yen: yen,
      fmt: fmt
    };
  }

  root.PS = { createGame: createGame };
})(typeof globalThis !== "undefined" ? globalThis : this);
