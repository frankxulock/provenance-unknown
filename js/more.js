/* 已上線的小遊戲互相引流。 */
(function () {
  "use strict";

  var GAMES = [
    {
      id: "provenance-unknown",
      href: "https://frankxulock.github.io/provenance-unknown/",
      mark: "🧾",
      name: {
        "zh-CN": "出处不详",
        "zh-TW": "出處不詳",
        en: "Provenance",
        ja: "出所不明"
      }
    },
    {
      id: "water-sort",
      href: "https://frankxulock.github.io/water-sort/",
      mark: "💧",
      name: {
        "zh-CN": "倒水排序",
        "zh-TW": "倒水排序",
        en: "Water Sort",
        ja: "水ソート"
      }
    },
    {
      id: "cinderwell",
      href: "https://frankxulock.github.io/cinderwell/",
      mark: "🏮",
      name: {
        "zh-CN": "烬井",
        "zh-TW": "燼井",
        en: "Cinderwell",
        ja: "燼井"
      }
    },
    {
      id: "whack",
      href: "https://frankxulock.github.io/game-whack-mole/",
      mark: "🔨",
      name: {
        "zh-CN": "打地鼠",
        "zh-TW": "打地鼠",
        en: "Whack-a-Mole",
        ja: "モグラたたき"
      }
    }
  ];

  var LABEL = {
    "zh-CN": "也来玩",
    "zh-TW": "也來玩",
    en: "Also play",
    ja: "ほかのゲーム"
  };

  function code() {
    var raw = "";
    try {
      if (window.PSI18n && window.PSI18n.getLang) raw = window.PSI18n.getLang();
    } catch (e) {}
    if (!raw) raw = document.documentElement.lang || navigator.language || "en";
    raw = String(raw).toLowerCase();
    if (raw.indexOf("zh") === 0) return /tw|hk|mo|hant/.test(raw) ? "zh-TW" : "zh-CN";
    if (raw.indexOf("ja") === 0) return "ja";
    return "en";
  }

  function paint() {
    var nodes = document.querySelectorAll("[data-play-more]");
    if (!nodes.length) return;
    var selfId = nodes[0].getAttribute("data-play-more") || "";
    var lang = code();
    var label = LABEL[lang] || LABEL.en;
    var html = '<span class="more-label">' + label + "</span>";
    for (var g = 0; g < GAMES.length; g++) {
      var game = GAMES[g];
      if (game.id === selfId) continue;
      var name = game.name[lang] || game.name.en;
      var href = game.href + "?from=" + encodeURIComponent(selfId);
      html += '<a class="more-link" href="' + href + '">' + game.mark + " " + name + "</a>";
    }
    for (var i = 0; i < nodes.length; i++) nodes[i].innerHTML = html;
  }

  document.addEventListener("click", function (e) {
    var node = e.target;
    while (node && node !== document) {
      if (node.classList && node.classList.contains("more-link")) break;
      node = node.parentNode;
    }
    if (!node || node === document) return;
    e.preventDefault();
    var href = node.getAttribute("href");
    if (!href) return;
    if (window.ProvenanceTg && window.ProvenanceTg.openLink) window.ProvenanceTg.openLink(href);
    else window.open(href, "_blank");
  });

  window.ProvenanceMore = { paint: paint };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
})();
