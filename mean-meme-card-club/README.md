# Mean Meme Card Club

A free online fill-in-the-blank party card game for up to 50 players plus spectators. Runs in the browser, installs as an app, and needs no sign-up.

**Play:** https://clpow.github.io/mean-meme-card-club/

## How to play

1. Someone creates a room and shares the 5-letter code, the invite link, or the QR code.
2. The host picks card packs and house rules, then starts the game.
3. Each round one player is the judge and reads a prompt card. Everyone else drags (or taps) the answer card(s) from their hand that best fill the blank.
4. The judge flips the anonymous answers one by one, highlights favourites for the whole table to see, and crowns a winner.
5. First to the target score wins. The best combos go into the Hall of Shame.

Players can send emoji reactions and chat bubbles. Players who reconnect keep their seat and score.

## Languages

The interface is available in English, 简体中文 and 繁體中文 (switch on the home page or with the 🌐 button in a game). Each player picks their own language, so one room can mix them. A host who plays in Chinese gets the Chinese packs by default.

## House rules

- Points to win (or endless), cards in hand, answer and judge timers
- Blank cards: players write their own answer
- Rando the Bot plays a random card every round
- Swap your whole hand for 1 point

## Card packs

The host can mix any packs:

- **Club Starter Deck:** original cards that ship with the game and work offline.
- **中文原创 (Chinese originals, 18 packs, 493 prompts, 1,415 answers):** 国剧上头包, 网络热梗包, 二次元动漫包, 过年亲戚包, 打工人职场包, 校园青春包, 恋爱相亲包, 吃货日常包, 游戏电竞包, 追星饭圈包, 短视频直播包, 网购剁手包, 减肥健身包, 萌宠铲屎官包, 出游旅行包, 四大名著包, 武侠修仙包 and 深夜emo包.
- **Anime, manga & manhwa:** Anime & Manga Hits (Japan), Manhwa Mania (Korea) and Manhua & Donghua (China), original jokes about today's most popular series. Text only, no character artwork.
- **Classic packs:** the base set, every official expansion, themed packs, promo and holiday packs, and community packs (205 packs, about 22,000 answers). They are downloaded at runtime from the open [JSON Against Humanity](https://github.com/crhallberg/json-against-humanity) dataset. That card text was written by Cards Against Humanity LLC and released under [CC BY-NC-SA 2.0](https://creativecommons.org/licenses/by-nc-sa/2.0/). This project is non-commercial and is not affiliated with or endorsed by Cards Against Humanity LLC.

## Tech

- Static site with no build step, hosted on GitHub Pages. The host's browser runs the game rules (`js/rules.js`, pure and simulation-tested).
- Real-time traffic goes through a Cloudflare Worker relay (`relay/`, one Durable Object per room). Public MQTT brokers are the fallback.
- Installable PWA with offline shell caching and a screen wake lock during games.
- The same Worker records visitor stats: player names, IP addresses, games played, rooms hosted and joined, and location. Bots and headless browsers are ignored. The owner views them at `stats.html` with an admin key.

## Development

```sh
npm run serve           # http://localhost:8080
npm run sim -- cah.json # bot-only games (optionally against a local copy of the dataset)
npm run stamp           # version-stamp assets before every commit
cd relay && npx wrangler@4 deploy
```

URL flags: `?bots=N` adds bot players to a new room, `?relay=URL` overrides the relay, `?nosw` skips the service worker, `?nohit` skips visit tracking.
