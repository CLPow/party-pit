import { configureNet } from '../../shared/net.js';

configureNet({ game: 'deal-rush', prefix: 'dr/v1/', cid: 'dr' });

export * from '../../shared/net.js';
