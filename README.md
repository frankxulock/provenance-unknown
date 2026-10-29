# 出處不詳 / Provenance Unknown

夜市櫃檯模擬：看貨、出價、撐過十二夜。Telegram Mini App + Adsgram 激勵廣告。

## 本機

開 `index.html`，或：

```bash
python3 -m http.server 8765
```

## Telegram

- Bot：`CakeLinkPlayBot`
- Mini App short name：`provenance`
- 公開頁：https://frankxulock.github.io/provenance-unknown/

BotFather：`/newapp` → 選 Bot → short name `provenance` → Web App URL 填公開頁。

## 廣告（Adsgram）

1. https://partner.adsgram.ai 建立小程式平台
2. 新增 Reward 廣告位，把 Block ID 填進 `index.html` 的 `PROVENANCE_ADS`
3. `look` / `cool` / `bailout` 可共用同一 ID；插頁需 `int-` 開頭
4. 正式上架請保持 `debug: false`

獎勵：

| 廣告位 | 時機 | 效果 |
| --- | --- | --- |
| look | 櫃檯看完一般次數後 | 多看一眼 |
| cool | 開店前／打烊 | 降盯梢（每晚一次） |
| bailout | 打烊／危機／開店前 | 救急金（每晚一次） |
| interstitial | 結算再開 | 可選插頁 |

## 打包進 TG 平台

```bash
rsync -a --delete --exclude sim.js --exclude '.git' \
  provenance-unknown/ telegram-mini-game-platform/games/provenance-unknown/
# 在 builds.json 加一筆後：
telegram-mini-game-platform/scripts/pack-game.sh \
  telegram-mini-game-platform/games/provenance-unknown \
  /tmp/provenance-unknown-1.0.0.zip
```
