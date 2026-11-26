export const PACKS = [
  {
    id: 'turbo', icon: '⚡', name: 'Turbo Die', inspired: 'the Mega Edition speed die',
    desc: 'A third die: +1 to +3 steps, 🚌 Bus (move by one die or the total), 🎩 Tycoon (then jump to the nearest unowned property). Triples: go anywhere.',
  },
  {
    id: 'sky', icon: '🏙️', name: 'Skyscrapers & Terminals', inspired: 'the Mega Edition skyscrapers and depots',
    desc: 'Top a hotel with a skyscraper once the whole set has hotels (1.5× hotel rent). Airport terminals double that airport’s rent.',
  },
  {
    id: 'market', icon: '📈', name: 'Market Shocks', inspired: 'Ultimate Banking events',
    desc: 'Breaking news every round: regional booms and crashes, recessions, bull markets, stimulus, property tax, tourist season, blackouts.',
  },
  {
    id: 'zoning', icon: '🌳', name: 'Zoning', inspired: 'the City Edition hazards and bonuses',
    desc: 'Once per turn: plant a 🌳 park on your city (+50% rent) or drop a 🏭 factory on a rival’s city (−50% rent, blocks building).',
  },
  {
    id: 'cheats', icon: '🃏', name: 'Cheats', inspired: 'the Cheaters Edition',
    desc: 'Once per turn, secretly skim $150 from the bank or swipe $75 from a rival. Anyone can 🚨 accuse within 12 s: right earns $100, wrong costs $50.',
  },
  {
    id: 'house', icon: '🏠', name: 'House Rules', inspired: 'the most popular official house rules',
    desc: 'Switch on the classic table rules your group plays with.',
  },
];

export const HOUSE_RULES = [
  { id: 'doubleStart', name: 'Double START', desc: 'Land exactly on START to collect $400' },
  { id: 'jailNoRent', name: 'Jail lockdown', desc: 'Players in jail collect no rent' },
  { id: 'starterDeeds', name: 'Starter deeds', desc: 'Everyone starts with 2 random cities' },
  { id: 'freeBuild', name: 'Free build', desc: 'Build and sell in any order' },
  { id: 'noAuction', name: 'No auctions', desc: 'Declined properties stay unsold' },
];

export const SPEED_FACES = [1, 2, 3, 'bus', 'tycoon', 'tycoon'];
export const TERMINAL_COST = 100;
export const PARK_COST = 150;
export const FACTORY_COST = 200;
export const UNZONE_COST = 100;
export const SKIM_AMT = 150;
export const SWIPE_AMT = 75;
export const CATCH_REWARD = 100;
export const FALSE_FINE = 50;
export const CHEAT_WINDOW = 12000;

export const MARKET_EVENTS = [
  { kind: 'boom', w: 3, target: 'group', mult: 1.5, rounds: 2 },
  { kind: 'crash', w: 3, target: 'group', mult: 0.5, rounds: 2 },
  { kind: 'recession', w: 1, target: 'all', mult: 0.75, rounds: 1 },
  { kind: 'bull', w: 1, target: 'all', mult: 1.25, rounds: 1 },
  { kind: 'tourism', w: 1, target: 'airport', mult: 2, rounds: 2 },
  { kind: 'blackout', w: 1, target: 'utility', mult: 0, rounds: 1 },
  { kind: 'stimulus', w: 1, instant: true, amt: 100 },
  { kind: 'proptax', w: 1, instant: true, pct: 0.03 },
];

export const packOn = (s, id) => !!(s.settings.packs && s.settings.packs[id]);
export const houseOn = (s, id) => packOn(s, 'house') && !!(s.settings.house && s.settings.house[id]);
export const activePacks = (settings) => PACKS.filter((p) => settings.packs && settings.packs[p.id]);
