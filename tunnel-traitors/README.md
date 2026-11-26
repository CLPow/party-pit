# Tunnel Traitors

An original online hidden-traitor mining board game for 3 to 32 players. Play it at **https://clpow.github.io/tunnel-traitors/**.

Every round, each miner secretly gets a role. Diggers build a tunnel from the entrance to the hidden gold; traitors hide among them and try to make the cards run out first. Survey a vein and you must tell everyone what you saw, by text or voice. You may lie.

- 3 to 32 players plus spectators, no sign-up. Join with a 5-letter code or QR, also mid-game.
- Expansion packs the host can switch on: Rival Crews, Specialists, Dirty Tricks, Crystal Veins, Hazards, plus house rules.
- Drag-and-drop digging with live previews, a 3D lantern-lit mine, procedural music and sound, and a phone layout for portrait and landscape.
- Installable as an app (PWA).

## How it runs

- Static site on GitHub Pages; no build step. `npm run stamp` version-stamps assets before each commit.
- The host's browser is authoritative (`js/host.js`); the rules engine is pure (`js/rules.js`).
- Traffic goes through the `tunnel-traitors-relay` Cloudflare Worker (`relay/`, one Durable Object per room), with public MQTT brokers as a fallback.
- `npm run sim [games] [all|mixed|none]` plays bot-only games at 3 to 32 players.
- `stats.html` is the usage dashboard (admin key required).

This site records IP addresses, player names and visit counts for usage statistics, as noted on the home page.
