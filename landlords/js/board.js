export const BOARD_SIZE = 64;
export const START = 0;
export const JAIL = 16;
export const PARKING = 32;
export const GOTO_JAIL = 48;
export const PASS_START = 200;
export const JAIL_FINE = 50;

export const GROUPS = [
  { name: 'Africa', color: '#a0673f', cities: ['Lagos', 'Nairobi', 'Cairo'] },
  { name: 'South America', color: '#5bc0eb', cities: ['Lima', 'Bogotá', 'Santiago', 'Buenos Aires'] },
  { name: 'South Asia', color: '#e056a0', cities: ['Kathmandu', 'Dhaka', 'Mumbai', 'Delhi'] },
  { name: 'Southeast Asia', color: '#f79824', cities: ['Manila', 'Jakarta', 'Bangkok'] },
  { name: 'Middle East', color: '#e63946', cities: ['Istanbul', 'Doha', 'Abu Dhabi', 'Dubai'] },
  { name: 'Central Europe', color: '#f4d03f', cities: ['Warsaw', 'Prague', 'Budapest', 'Vienna'] },
  { name: 'Oceania', color: '#2ec4b6', cities: ['Auckland', 'Melbourne', 'Sydney'] },
  { name: 'Southern Europe', color: '#43a047', cities: ['Lisbon', 'Madrid', 'Barcelona', 'Rome'] },
  { name: 'Northern Europe', color: '#3a86ff', cities: ['Amsterdam', 'Berlin', 'Stockholm', 'Copenhagen'] },
  { name: 'East Asia', color: '#8338ec', cities: ['Seoul', 'Hong Kong', 'Tokyo'] },
  { name: 'North America', color: '#ff006e', cities: ['Toronto', 'Los Angeles', 'San Francisco', 'New York'] },
  { name: 'Global Elite', color: '#22304a', cities: ['Singapore', 'Zurich', 'Paris', 'London'] },
];

const RENT_MULT = [1, 4, 12, 30, 38, 46];
const CITY_SLOTS = [[1, 3, 4], [5, 7, 9, 10], [11, 13, 14, 15]];
const SPECIAL_SLOTS = [2, 6, 12];
const SIDE_SPECIALS = [
  ['treasury', 'tax', 'fortune'],
  ['utility', 'treasury', 'fortune'],
  ['fortune', 'treasury', 'utility'],
  ['treasury', 'fortune', 'tax'],
];
const AIRPORT_NAMES = ['North Gate Airport', 'East Wind Airport', 'South Cross Airport', 'West Bay Airport'];
const UTILITIES = [{ name: 'Solar Grid', icon: '☀️' }, { name: 'Aqua Works', icon: '💧' }];
const TAXES = [{ name: 'Income Tax', amount: 200, icon: '🧾' }, { name: 'Luxury Tax', amount: 120, icon: '💎' }];
const CORNERS = [
  { type: 'start', name: 'START', icon: '🏁' },
  { type: 'jail', name: 'JAIL', icon: '🔒' },
  { type: 'parking', name: 'JACKPOT', icon: '🎰' },
  { type: 'gotojail', name: 'GO TO JAIL', icon: '🚓' },
];

const round10 = (n) => Math.round(n / 10) * 10;

function build() {
  const spaces = [];
  let util = 0;
  let tax = 0;
  for (let side = 0; side < 4; side++) {
    spaces.push({ ...CORNERS[side] });
    for (let pos = 1; pos < 16; pos++) {
      if (pos === 8) {
        spaces.push({ type: 'airport', name: AIRPORT_NAMES[side], icon: '✈️', price: 200 });
        continue;
      }
      const si = SPECIAL_SLOTS.indexOf(pos);
      if (si >= 0) {
        const kind = SIDE_SPECIALS[side][si];
        if (kind === 'utility') spaces.push({ type: 'utility', price: 150, ...UTILITIES[util++] });
        else if (kind === 'tax') spaces.push({ type: 'tax', ...TAXES[tax++] });
        else if (kind === 'fortune') spaces.push({ type: 'fortune', name: 'Fortune', icon: '❓' });
        else spaces.push({ type: 'treasury', name: 'Treasury', icon: '💰' });
        continue;
      }
      const gi = CITY_SLOTS.findIndex((slots) => slots.includes(pos));
      const group = side * 3 + gi;
      const k = CITY_SLOTS[gi].indexOf(pos);
      const n = CITY_SLOTS[gi].length;
      const price = round10(60 + group * 30 + (k === n - 1 ? 20 : 0));
      const base = Math.max(2, Math.round((price * price) / 3500 + 1));
      spaces.push({
        type: 'city',
        name: GROUPS[group].cities[k],
        group,
        price,
        rent: [...RENT_MULT.map((m) => base * m), Math.round(base * RENT_MULT[5] * 1.5)],
        houseCost: 50 * (side + 1),
      });
    }
  }
  return spaces.map((s, i) => ({ ...s, i }));
}

export const SPACES = build();
export const GROUP_SPACES = GROUPS.map((_, g) => SPACES.filter((s) => s.group === g && s.type === 'city').map((s) => s.i));
export const AIRPORT_SPACES = SPACES.filter((s) => s.type === 'airport').map((s) => s.i);
export const UTILITY_SPACES = SPACES.filter((s) => s.type === 'utility').map((s) => s.i);

const at = (name) => SPACES.find((s) => s.name === name).i;

export const FORTUNE = [
  { text: 'Advance to START. Collect $200.', a: 'goto', to: 0, icon: '🏁' },
  { text: 'Take a first-class flight to London.', a: 'goto', to: at('London'), icon: '🛫' },
  { text: 'Safari time! Travel to Cairo.', a: 'goto', to: at('Cairo'), icon: '🐪' },
  { text: 'Surf trip! Travel to Sydney.', a: 'goto', to: at('Sydney'), icon: '🏄' },
  { text: 'Head to the nearest airport. If owned, pay double rent.', a: 'nearest', kind: 'airport', icon: '✈️' },
  { text: 'Head to the nearest utility. If owned, pay 10× your roll.', a: 'nearest', kind: 'utility', icon: '⚡' },
  { text: 'Wrong turn! Go back 3 spaces.', a: 'back', n: 3, icon: '↩️' },
  { text: 'Busted! Go directly to Jail.', a: 'jail', icon: '🚔' },
  { text: 'Get Out of Jail Free. Keep this card.', a: 'jailcard', icon: '🗝️' },
  { text: 'Your startup got acquired! Collect $150.', a: 'collect', n: 150, icon: '🚀' },
  { text: 'Crypto dividend. Collect $50.', a: 'collect', n: 50, icon: '🪙' },
  { text: 'Speeding fine. Pay $30.', a: 'pay', n: 30, icon: '🚨' },
  { text: 'Renovations: pay $25 per house and $100 per hotel.', a: 'repairs', h: 25, H: 100, icon: '🔧' },
  { text: 'You were elected mayor. Pay every player $10.', a: 'payEach', n: 10, icon: '🎩' },
];

export const TREASURY = [
  { text: 'Advance to START. Collect $200.', a: 'goto', to: 0, icon: '🏁' },
  { text: 'Bank error in your favour. Collect $200.', a: 'collect', n: 200, icon: '🏦' },
  { text: 'Doctor’s fee. Pay $50.', a: 'pay', n: 50, icon: '🩺' },
  { text: 'Get Out of Jail Free. Keep this card.', a: 'jailcard', icon: '🗝️' },
  { text: 'Caught dodging taxes. Go directly to Jail.', a: 'jail', icon: '🚔' },
  { text: 'Tax refund. Collect $20.', a: 'collect', n: 20, icon: '🧾' },
  { text: 'It’s your birthday! Collect $10 from every player.', a: 'each', n: 10, icon: '🎂' },
  { text: 'Travel insurance pays out. Collect $100.', a: 'collect', n: 100, icon: '🧳' },
  { text: 'Hospital fees. Pay $100.', a: 'pay', n: 100, icon: '🏥' },
  { text: 'School fees. Pay $50.', a: 'pay', n: 50, icon: '🎓' },
  { text: 'Consulting fee. Collect $25.', a: 'collect', n: 25, icon: '💼' },
  { text: 'Street repairs: pay $40 per house and $115 per hotel.', a: 'repairs', h: 40, H: 115, icon: '🚧' },
  { text: 'You inherit $100.', a: 'collect', n: 100, icon: '📜' },
];
