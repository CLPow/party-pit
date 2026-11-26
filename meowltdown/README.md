# Meow-ltdown

An online party card game for 2–40 players. Lab cats take turns drawing from a reactor deck. Draw a **Meltdown** without a **Coolant** and you're out. The last cat standing wins.

**Play:** https://clpow.github.io/meowltdown/

## Features
- Host a room and share a join code or QR. Players can join mid-game, and you can fill empty seats with bots.
- Expansion packs: Chaos Pack, Mega Bomb Pack, Party Scaling (up to 40 players) and House Rules.
- Push-to-talk and live voice call in the room.
- Adaptive graphics quality on phones and desktops, plus a reduced-motion mode.
- Installable as an app (PWA).

## Run locally
```
npm run stamp
npx http-server -c-1 -p 8091 .
```
Open http://localhost:8091/?bots=5 to play against bots.

Run the engine simulation: `node tests/sim.js 30 mixed`

## Relay
`relay/` is a Cloudflare Worker that relays room traffic and records anonymous stats (`stats.html`). Public MQTT brokers are the fallback.
