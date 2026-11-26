# 🏙️ Landlords

An animated online property-trading board game for **2–32 players**. It runs entirely in the browser on GitHub Pages, so there are no accounts, installs or servers.

**▶ Play: https://clpow.github.io/landlords/**

## How to play with friends

1. Open the game, type your name, pick a token and press **Create a room**.
2. Share the 5-letter room code or the invite link (**Copy invite link**).
3. Friends open the link, press **Join**, and appear in the lobby.
4. Optionally add bots, then choose starting cash and turn timer, and press **Start game**.

The host's browser runs the game, so **the host must keep their tab open** until the game ends. Players who drop out can reload and press Join to rejoin the same seat.

## Game modes

| Mode | Ends when | Winner |
|---|---|---|
| 👑 Classic | one landlord is left | last one standing |
| ⏱️ Time Attack | the clock runs out (5–60 min) | two winners: most cash and highest property value |
| 🏙️ Property Fight | every property on the board is owned | highest property value |
| 🔁 Rounds | the set number of rounds is played (5–30) | two winners: most cash and highest property value |

Property value counts each city, airport and utility at its price (half if mortgaged), plus houses and hotels. In every mode, a player who outlasts everyone else wins outright.

## Expansion packs

Before starting, the host can switch on any mix of packs. They work with every mode.

| Pack | Inspired by | What it adds |
|---|---|---|
| ⚡ Turbo Die | the Mega Edition speed die | A third die: +1 to +3 steps, 🚌 Bus (move by one die or the total), 🎩 Tycoon (then jump to the nearest unowned property). Triples let you warp to any space |
| 🏙️ Skyscrapers & Terminals | the Mega Edition skyscrapers and depots | A skyscraper on top of a hotel once the whole set has hotels (1.5× hotel rent). Airport terminals double that airport’s rent |
| 📈 Market Shocks | Ultimate Banking events | Breaking news every round: regional booms and crashes, recessions, bull markets, stimulus, property tax, tourist season, blackouts |
| 🌳 Zoning | the City Edition hazards and bonuses | Once per turn: a 🌳 park on your own city (+50% rent) or a 🏭 factory on a rival’s city (−50% rent, blocks building) |
| 🃏 Cheats | the Cheaters Edition | Secretly skim $150 from the bank or swipe $75 from a rival. Anyone can 🚨 accuse within 12 s: right earns $100, wrong costs $50. Cheats are never sent to other players’ devices |
| 🏠 House Rules | the most popular official house rules | Double START, jail lockdown (no rent while jailed), starter deeds, free build order, no auctions |

The packs are original designs inspired by mechanics from those editions; no names or art from them are used.

## Features

- A 64-space world board with 44 cities in 12 regional colour sets, 4 airports, 2 utilities, Fortune and Treasury cards, and a growing Jackpot.
- 3D tumbling dice, hopping tokens with squash-and-stretch, a camera that follows the action, flying coins, flipping cards, flags dropping onto bought cities, houses popping up, jail bars slamming down, confetti and fireworks.
- Auctions with live bidding and a countdown ring. Trading with drag-and-drop properties, cash sliders and counter-offers.
- Building and mortgaging, automatic liquidation when you can't pay, and bankruptcy.
- A tabletop view: the board tilts like a real table, the dice are thrown across the felt, and the tokens stand up and hop. The board is alive with planes flying between airports, owned cities twinkling in their owner’s color, drifting clouds and animated icons.
- Adaptive background music generated in the browser: lounge in the lobby, an upbeat theme in play, tension in auctions and final moments, and a victory theme. It ducks under sound effects. Separate Music and Sound sliders and a Full/Reduced motion switch are under 🔊; music starts muted on phones.
- Emoji reactions, chat bubbles over tokens, sound effects made with WebAudio, and a turn timer so 30-player games keep moving.
- Pan by dragging, zoom with the scroll wheel or a pinch, and press Space to roll or end your turn.

## Tech

Plain HTML, CSS and ES modules with no build step. Game messages are relayed through a public MQTT broker over secure WebSockets ([mqtt.js](https://github.com/mqttjs/MQTT.js), HiveMQ with EMQX and Mosquitto as fallbacks), so it works across phones, VPNs and strict networks. The host browser is authoritative: clients send actions, and the host validates them and broadcasts the state. [GSAP](https://gsap.com) drives the animation and [canvas-confetti](https://github.com/catdad/canvas-confetti) the celebrations.

```
js/board.js   board, cities and cards
js/rules.js   pure game engine (state + actions)
js/bot.js     bot players
js/net.js     MQTT relay transport (host and client)
js/ui.js      rendering and animation
js/fx.js      particles, coins, banners, sounds
js/main.js    wiring
```

Before each deploy, run `npm run stamp` so browsers fetch the new files instead of cached ones.

Run locally with `npm run serve` and open http://localhost:8080. Add `?bots=24` to the URL before creating a room to fill it with bots. Run `npm run sim` to stress-test the rules engine with bot-only games.

The relay is a free public broker, so room traffic is not private. Do not put anything secret in chat.

## Relay

Game traffic goes through a small Cloudflare Worker in `relay/` (one Durable Object per room, with WebSocket hibernation), at `landlords-relay.landlords.workers.dev`. The public MQTT brokers stay as automatic fallbacks for networks that block it. To deploy the relay, run `cd relay && npx wrangler deploy`.
