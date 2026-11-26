import { configureNet } from '../../shared/net.js';

configureNet({ game: 'landlords', prefix: 'landlords/v2/', cid: 'll' });

export * from '../../shared/net.js';
