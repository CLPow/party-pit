# Party Pit

Online party games for big groups, in one site: **https://clpow.github.io/party-pit/**

| Game | Players | Path |
|---|---|---|
| Landlords | 2–32 | `/landlords/` |
| Mean Meme Card Club | 3–50 | `/mean-meme-card-club/` |
| Tunnel Traitors | 3–32 | `/tunnel-traitors/` |
| Meow-ltdown | 2–40 | `/meowltdown/` |

Static site with no build step. Every game runs host-authoritative in the host's browser; traffic goes through one Cloudflare Worker (`relay/`, a Durable Object per room, keyed by game and room code) with public MQTT brokers as a fallback.

## Layout

- `index.html`, `hub.js`, `hub.css`: the hub page
- `shared/`: networking, install/PWA and logo code used by every game
- `stats.html`, `stats.js`: one admin dashboard, filterable by game
- `relay/`: the `party-pit-relay` Worker (`cd relay && npx wrangler@4 deploy`)
- `tools/`: version stamp, icon renderer, logo preview

## Adding a game

1. Put it in its own folder with `index.html`, `js/main.js`, `sw.js` and `icons/`.
2. Make `js/net.js` call `configureNet({ game, prefix, cid })` from `../../shared/net.js`.
3. Add the folder name to `GAMES` in `tools/stamp.js`, `relay/src/index.js`, `stats.js` and `hub.js`.

## Commands

```
npm run stamp   # before every commit: cache-busts scripts in every game
npm run sim     # bot-only simulations for all four games
npm run serve   # local server on :8080
```

Local relay: `cd relay && npx wrangler@4 dev --var ADMIN_KEY:test`, then open a game with `?relay=http://localhost:8787&nohit&nosw`.
