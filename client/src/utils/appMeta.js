import pkg from '../../package.json';

const releaseDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
export const APP_VERSION = `v${pkg.version || '0.0.0'} (${releaseDate})`;
