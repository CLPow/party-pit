import { configureNet } from '../../shared/net.js';

configureNet({ game: 'double-talk', prefix: 'dt/v1/', cid: 'dt' });

export * from '../../shared/net.js';
