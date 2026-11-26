const OPENCC_URL = 'https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/umd/cn2t.js';

const ZH = {
  'The fill-in-the-blank party game for terrible friends. Up to 50 players, no sign-up.': '损友专属的填空派对卡牌游戏。最多50人同玩，无需注册。',
  'You were hosting room': '你之前在主持房间',
  'Resume hosting': '继续主持',
  'Forget it': '不用了',
  'Your name': '你的名字',
  'e.g. Captain Chaos': '例如：混乱队长',
  'Pick your face': '选择头像',
  'Pick your colour': '选择颜色',
  '🎲 Create a room': '🎲 创建房间',
  'Join': '加入',
  'CODE': '房间码',
  '📲 Install the app': '📲 安装应用',
  'Credits & privacy': '鸣谢与隐私',
  'Language': '语言',
  'Room code': '房间码',
  '🔗 Copy invite link': '🔗 复制邀请链接',
  '📤 Share': '📤 分享',
  'Connecting…': '连接中…',
  'in the club': '人在俱乐部',
  '(max 50 + spectators)': '（最多50人＋观众）',
  'House rules': '房间规则',
  'Sound on/off': '声音开关',
  'Leave': '离开',
  'Hall of Shame': '名场面',
  'Scores': '比分',
  'Host controls': '房主控制',
  'Say something': '说点什么',
  'Cancel': '取消',
  'OK': '确定',
  'Close': '关闭',
  'Type your name first.': '请先输入名字。',
  'Opening the room…': '正在开房…',
  'Room is open. Share the code!': '房间已开好，快分享房间码！',
  'Network trouble. Retrying…': '网络有点问题，正在重试…',
  'Could not reach the game servers. Check your connection.': '连不上游戏服务器，请检查网络。',
  'Joining room {code}…': '正在加入房间 {code}…',
  'You are in! 🎉': '你进来啦！🎉',
  'The room is full, so you are watching as a spectator.': '房间已满，你将以观众身份观看。',
  'The host removed you from the room.': '房主把你移出了房间。',
  'Flip every card before you pick.': '先把所有卡翻开再选。',
  'Flip every card first.': '先把所有卡翻开。',
  'Connection hiccup, reconnecting…': '网络波动，正在重连…',
  'Room {code} was not found. Check the code.': '找不到房间 {code}，请检查房间码。',
  'Could not connect. Check your connection.': '连接失败，请检查网络。',
  'You are the judge this round 👑': '这一轮你是裁判 👑',
  '{who} joined the club': '{who} 加入了俱乐部',
  '{who} joined as a spectator': '{who} 以观众身份加入',
  'Your card won! +1 🏆': '你的卡赢了！+1 🏆',
  'You are spectating this game.': '你正在观战。',
  'Connected. Waiting for the host to start.': '已连接，等待房主开始。',
  'No limit': '不限时',
  '{n} s': '{n} 秒',
  '1 min': '1 分钟',
  '1.5 min': '1.5 分钟',
  '2 min': '2 分钟',
  '3 min': '3 分钟',
  'Points to win': '获胜分数',
  'Endless': '无限',
  'Cards in hand': '手牌数量',
  'Answer timer': '答题计时',
  'Judge timer': '裁判计时',
  'Off': '关闭',
  'Blank cards': '空白卡',
  'None': '无',
  'Rando the Bot': '随机机器人',
  'Playing': '参与中',
  'Swap hand for 1 point': '花1分换整手牌',
  'Allowed': '允许',
  'Random card is played when time runs out': '时间到会自动出一张随机卡',
  'Random winner when time runs out': '时间到会随机选出赢家',
  'Write your own answer': '自己写答案',
  'Plays a random card every round': '每轮随机出一张卡',
  'Only the host can change the rules. Waiting for the host to start…': '只有房主能改规则。等待房主开始…',
  '{n} card pack': '{n} 个卡包',
  '{n} card packs': '{n} 个卡包',
  '+{n} more': '还有 {n} 个',
  '🃏 Choose card packs': '🃏 选择卡包',
  '🚀 Start the game': '🚀 开始游戏',
  '🤖 Add a bot player': '🤖 添加机器人',
  'You need at least 3 players (Rando the Bot counts). ': '至少需要3名玩家（随机机器人也算）。',
  'Players can also join after the game starts.': '游戏开始后也可以随时加入。',
  'Shuffling…': '洗牌中…',
  'Card packs': '卡包',
  'Loading every pack…': '正在加载全部卡包…',
  'Search {n} packs…': '搜索 {n} 个卡包…',
  'Starter only': '仅入门包',
  'Base set': '基础包',
  'Chinese': '中文',
  'Anime': '动漫',
  'All official': '全部官方',
  'Everything (English)': '全部英文',
  'The classic packs could not be downloaded right now. The club originals are still available.': '经典卡包暂时无法下载，俱乐部原创卡包仍可使用。',
  'Use these packs': '使用这些卡包',
  'Clear': '清空',
  'Select all': '全选',
  'No packs match that search.': '没有符合的卡包。',
  'Card packs updated.': '卡包已更新。',
  '{n} pack on': '已选 {n} 个',
  '{n} packs on': '已选 {n} 个',
  '{n} prompt': '{n} 张题目卡',
  '{n} prompts': '{n} 张题目卡',
  '{n} answer': '{n} 张答案卡',
  '{n} answers': '{n} 张答案卡',
  'Mixing English and Chinese packs in one game makes the cards hard to read.': '同一局混用中英文卡包，读起来会很乱哦。',
  'Club originals': '俱乐部原创',
  '中文原创': '中文原创',
  'Anime, manga & manhwa': '动漫・漫画・韩漫',
  'Base sets': '基础套装',
  'Official expansions': '官方扩展',
  'Official themed packs': '官方主题包',
  'Promos, holidays & events': '活动与节日包',
  'Community packs': '社区卡包',
  'Waiting for more players…': '等待更多玩家…',
  'Waiting for at least 3 players.': '至少需要3名玩家。',
  'The judge left, so this round was skipped.': '裁判离开了，本轮跳过。',
  'Nobody played a card, so this round was skipped.': '没人出牌，本轮跳过。',
  'The prompt deck ran out.': '题目卡用完了。',
  'The judge ran out of time, so a random card won.': '裁判超时，随机选出了赢家。',
  'Players are choosing answers. {judge} is judging.': '玩家正在选答案，{judge} 是裁判。',
  '{judge} is judging.': '{judge} 是裁判。',
  'You are the judge 👑 Wait for the answers to come in.': '你是裁判 👑 等大家交卡。',
  'Locked in ✓ Waiting for everyone else…': '已出牌 ✓ 等其他人…',
  'Pick <b>{n}</b> cards in order. {judge} is judging.': '按顺序选 <b>{n}</b> 张卡。{judge} 是裁判。',
  'Pick your funniest card. {judge} is judging.': '选出你最好笑的卡。{judge} 是裁判。',
  'Tap the wiggling card to flip it 👇': '点晃动的卡把它翻开 👇',
  'Tap your favourite, then crown it 👑': '点选你最爱的，然后给它加冕 👑',
  '{judge} is reading the answers…': '{judge} 正在看答案…',
  '{who} wins the round!': '{who} 赢下这一轮！',
  '🏆 {who} wins the game!': '🏆 {who} 赢得整场游戏！',
  'Game over': '游戏结束',
  'Round {n}': '第 {n} 轮',
  '{n} playing': '{n} 人在玩',
  'you': '你',
  'spectating': '观战中',
  'away': '离开了',
  '👑 judging': '👑 裁判中',
  '✓ played': '✓ 已出牌',
  'thinking…': '思考中…',
  '🤖 Add a bot': '🤖 添加机器人',
  'Back to lobby': '回到大厅',
  '🔁 Play again': '🔁 再来一局',
  'Waiting for the host to start a new game…': '等待房主开新局…',
  'Drag a card here<br>or tap one in your hand': '把卡拖到这里<br>或点一下手牌',
  '✓ Locked in': '✓ 已出牌',
  'tap to remove': '点击移除',
  'Flip them all': '全部翻开',
  '👑 Crown this one': '👑 就选这张',
  'Next round ⏭': '下一轮 ⏭',
  '(left)': '（已离开）',
  'someone who left': '已离开的玩家',
  'round {n}': '第 {n} 轮',
  'Blank card: write anything': '空白卡：想写什么写什么',
  '✅ Play these': '✅ 出这些',
  '✅ Play this card': '✅ 出这张',
  'Undo': '撤销',
  'Choose {n} more card (order matters)': '再选 {n} 张（注意顺序）',
  'Choose {n} more cards (order matters)': '再选 {n} 张（注意顺序）',
  'Drag a card up to the prompt, or tap one': '把卡拖到题目上，或点一下',
  '♻️ New hand (−1 point)': '♻️ 换手牌（−1分）',
  'You are judging this round. Your hand takes a break.': '这一轮你当裁判，手牌先休息。',
  'Answer locked in. Send some reactions while you wait 😏': '已出牌。等的时候发点表情吧 😏',
  'Something terrible…': '写点损的…',
  'Say something to the table': '对大家说点什么',
  'Type a message…': '输入消息…',
  '🏆 Hall of Shame': '🏆 名场面',
  'No winning cards yet. Give it a round.': '还没有获胜卡，先玩一轮吧。',
  'Next round': '下一轮',
  'Skip the countdown': '跳过倒计时',
  'Invite link': '邀请链接',
  'Copy it for friends': '复制给朋友',
  'Add a bot': '添加机器人',
  'Plays random cards': '随机出牌',
  'Add Rando': '加入随机机器人',
  'Remove Rando': '移除随机机器人',
  'A bot that never judges': '从不当裁判的机器人',
  'End game': '结束游戏',
  'Back to the lobby': '回到大厅',
  'Players': '玩家',
  '· away': '· 离开了',
  'Remove': '移除',
  'Nobody else yet. Share the invite link!': '还没有其他人，快分享邀请链接！',
  'End this game?': '结束这局游戏？',
  'Scores reset and everyone goes back to the lobby.': '分数会清零，所有人回到大厅。',
  'Invite link copied!': '邀请链接已复制！',
  'Remove player?': '移除玩家？',
  'Remove <b>{name}</b> from the room? They will not be able to rejoin this room.': '把 <b>{name}</b> 移出房间？对方将无法再加入这个房间。',
  'Room codes are 5 letters or numbers.': '房间码是5位字母或数字。',
  'Join my game! Room {code}': '来玩！房间码 {code}',
  'Swap your hand?': '换掉整手牌？',
  'You lose 1 point and get a whole new hand.': '扣1分，换一整手新牌。',
  'Swap it': '换！',
  'You are the host. If you leave, the room closes for everyone.': '你是房主，你离开房间就会关闭。',
  'You can rejoin with the same code later.': '之后可以用同一个房间码回来。',
  'Leave the room?': '离开房间？',
  'Could not download the card packs. Starting with the club originals instead.': '卡包下载失败，改用俱乐部原创卡包开始。',
  'Not enough answer cards for {n} players: these packs have {have}, you need at least {need}. Add more card packs.': '{n} 名玩家的答案卡不够：这些卡包只有 {have} 张，至少需要 {need} 张。请多选几个卡包。',
  'The card packs changed since this room was saved, so the game went back to the lobby.': '卡包内容有变动，游戏已回到大厅。',
  'Mean Meme Card Club is installed. Open it from your home screen or app list.': '已安装！可以从主屏幕或应用列表打开。',
  'PICK {n}': '选 {n} 张',
  'Card text for the classic packs is loaded from the open <a href="https://github.com/crhallberg/json-against-humanity" target="_blank" rel="noopener">JSON Against Humanity</a> dataset and is licensed <a href="https://creativecommons.org/licenses/by-nc-sa/2.0/" target="_blank" rel="noopener">CC BY-NC-SA 2.0</a>. This site is not affiliated with or endorsed by Cards Against Humanity LLC. This site records your IP address, your player name and how many times you visit, for usage statistics.':
    '经典英文卡包的卡面来自开放数据集 <a href="https://github.com/crhallberg/json-against-humanity" target="_blank" rel="noopener">JSON Against Humanity</a>，采用 <a href="https://creativecommons.org/licenses/by-nc-sa/2.0/" target="_blank" rel="noopener">CC BY-NC-SA 2.0</a> 许可。本站与 Cards Against Humanity LLC 无关，也未获其认可。本站会记录你的 IP 地址、玩家名字和访问次数，用于统计。',
};

let current = 'en';
let converter = null;
let loading = null;
const convCache = new Map();
const listeners = new Set();

function detect() {
  try {
    const saved = localStorage.getItem('mmcc-lang');
    if (saved === 'en' || saved === 'zhs' || saved === 'zht') return saved;
  } catch { /* storage unavailable */ }
  const l = (navigator.language || '').toLowerCase();
  if (/^zh-(tw|hk|mo|hant)/.test(l)) return 'zht';
  if (l.startsWith('zh')) return 'zhs';
  return 'en';
}

function loadConverter() {
  if (converter) return Promise.resolve(converter);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = OPENCC_URL;
      s.onload = () => {
        try { converter = window.OpenCC.Converter({ from: 'cn', to: 'tw' }); resolve(converter); } catch (e) { reject(e); }
      };
      s.onerror = () => { loading = null; reject(new Error('opencc')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export const lang = () => current;
export const isZh = () => current !== 'en';
export const onLang = (fn) => listeners.add(fn);

export async function setLang(l) {
  if (l === 'zht') {
    try { await loadConverter(); } catch { l = 'zhs'; }
  }
  current = l;
  try { localStorage.setItem('mmcc-lang', l); } catch { /* storage unavailable */ }
  document.documentElement.lang = l === 'en' ? 'en' : l === 'zht' ? 'zh-Hant' : 'zh-Hans';
  applyStatic();
  listeners.forEach((fn) => fn(l));
}

function conv(s) {
  if (current !== 'zht' || !converter || !s) return s;
  let out = convCache.get(s);
  if (out === undefined) {
    out = converter(s);
    if (convCache.size > 5000) convCache.clear();
    convCache.set(s, out);
  }
  return out;
}

export function t(key, vars) {
  let s = current === 'en' ? key : ZH[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return conv(s);
}

export function tn(n, one, many, vars = {}) {
  return t(n === 1 ? one : many, { n: n.toLocaleString(), ...vars });
}

export const tc = (text) => conv(text);

export function applyStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    if (!el.dataset.src) el.dataset.src = el.innerHTML.trim();
    el.innerHTML = t(el.dataset.src);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    if (!el.dataset.srcPh) el.dataset.srcPh = el.getAttribute('placeholder') || '';
    el.setAttribute('placeholder', t(el.dataset.srcPh));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    if (!el.dataset.srcTitle) el.dataset.srcTitle = el.getAttribute('title') || '';
    el.setAttribute('title', t(el.dataset.srcTitle));
  });
  root.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === current));
}

export const initialLang = detect;
