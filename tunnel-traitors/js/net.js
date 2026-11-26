import { configureNet } from '../../shared/net.js';

configureNet({ game: 'tunnel-traitors', prefix: 'tt/v1/', cid: 'tt' });

export * from '../../shared/net.js';
