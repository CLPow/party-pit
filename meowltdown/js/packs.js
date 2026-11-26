export const CARDS = {
  meltdown: { name: 'Meltdown', icon: '☢️', tone: 'bomb', text: 'Draw this and you are out, unless you play a Coolant.' },
  coolant: { name: 'Coolant', icon: '🧊', tone: 'cool', text: 'Saves you from a Meltdown. Then slide the Meltdown back into the reactor anywhere you like, in secret.' },
  hiss: { name: 'Hiss!', icon: '🙀', tone: 'hiss', text: 'Cancel any action. Play it at any time, even on another Hiss!' },
  nap: { name: 'Catnap', icon: '💤', tone: 'calm', text: 'End your turn without drawing.' },
  overload: { name: 'Overload', icon: '⚡', tone: 'zap', text: 'End your turn without drawing. The next player takes 2 turns, plus any turns you still had left.' },
  peek: { name: 'Geiger Peek', icon: '📟', tone: 'scan', text: 'Look at the top 3 cards of the reactor in secret.' },
  scramble: { name: 'Scramble', icon: '🌀', tone: 'calm', text: 'Shuffle the reactor.' },
  bribe: { name: 'Bribe', icon: '🐟', tone: 'gold', text: 'Pick a player. They must give you a card of their choice.' },
  cat1: { name: 'Dr. Whiskers', icon: '🥼', tone: 'cat', cat: true, text: 'Lab cat. Play 2 matching to steal a random card, 3 matching to ask for any card.' },
  cat2: { name: 'Rad-Kit', icon: '🟢', tone: 'cat', cat: true, text: 'Lab cat. Play 2 matching to steal a random card, 3 matching to ask for any card.' },
  cat3: { name: 'Fluffton', icon: '☁️', tone: 'cat', cat: true, text: 'Lab cat. Play 2 matching to steal a random card, 3 matching to ask for any card.' },
  cat4: { name: 'Sir Purrcival', icon: '🎩', tone: 'cat', cat: true, text: 'Lab cat. Play 2 matching to steal a random card, 3 matching to ask for any card.' },
  cat5: { name: 'Biscuit', icon: '🍪', tone: 'cat', cat: true, text: 'Lab cat. Play 2 matching to steal a random card, 3 matching to ask for any card.' },
  reverse: { name: 'Reverse Polarity', icon: '🔄', tone: 'chaos', pack: 'chaos', text: 'Flip the turn order and end your turn without drawing.' },
  bottom: { name: 'Bottom Feeder', icon: '🎣', tone: 'chaos', pack: 'chaos', text: 'End your turn by drawing from the bottom of the reactor.' },
  recal: { name: 'Recalibrate', icon: '🎛️', tone: 'chaos', pack: 'chaos', text: 'Look at the top 3 cards and put them back in any order.' },
  target: { name: 'Targeted Overload', icon: '🎯', tone: 'chaos', pack: 'chaos', text: 'End your turn without drawing. Pick any player: they take 2 turns, plus any turns you still had left.' },
  critical: { name: 'Critical Mass', icon: '🟣', tone: 'crit', pack: 'mega', text: 'First draw: it flips face up and goes back where you choose. Second draw: no Coolant can save you.' },
  contain: { name: 'Containment', icon: '🛢️', tone: 'mega', pack: 'mega', text: 'End your turn by burying the top card anywhere in the reactor without looking at it.' },
};

export const COMBO = {
  pair: { name: 'Pair', text: 'Steal a random card from a player.' },
  triple: { name: 'Triple', text: 'Name a card. If the player has it, they must hand it over.' },
  five: { name: 'Five of a kind… of five kinds', text: 'Take any card from the discard pile.' },
};

export const BASE = { hiss: 5, nap: 4, overload: 4, peek: 5, scramble: 4, bribe: 4, cat1: 4, cat2: 4, cat3: 4, cat4: 4, cat5: 4 };

export const PACKS = [
  { id: 'chaos', name: 'Chaos Pack', icon: '🌀', cards: { reverse: 4, bottom: 4, recal: 4, target: 3 }, desc: 'Reverse Polarity, Bottom Feeder, Recalibrate and Targeted Overload. Turn order gets weird.' },
  { id: 'mega', name: 'Mega Bomb Pack', icon: '💥', cards: { contain: 4 }, desc: 'One Meltdown becomes a Critical Mass that no Coolant can stop, plus Containment to bury the danger.' },
  { id: 'party', name: 'Party Scaling', icon: '🎉', cards: {}, desc: 'Grows the reactor for big rooms: extra deck copies and more Coolant. Above 15 players it adds a turn timer and caps the Hiss! window at 2.5 seconds. Needed for more than 5 players.' },
];

export const HOUSE = [
  { id: 'timer', name: 'Turn timer', desc: 'Draw automatically when your turn clock runs out.' },
  { id: 'streak', name: 'Streaking', desc: 'Drew a Meltdown while holding Coolant? You may keep it in your hand. It goes off the moment you lose your last Coolant.' },
  { id: 'sudden', name: 'Sudden Death', desc: 'After the time limit, every turn becomes 2 draws in a row. Overload adds 2 more on top.' },
  { id: 'double', name: 'Double Coolant', desc: 'Everyone starts with 2 Coolants.' },
  { id: 'nohiss', name: 'No Hiss!', desc: 'Remove every Hiss! card. Nothing can be cancelled.' },
];

export const PLAYABLE = new Set(['hiss', 'nap', 'overload', 'peek', 'scramble', 'bribe', 'reverse', 'bottom', 'recal', 'target', 'contain']);
export const TARGETED = new Set(['bribe', 'target']);
