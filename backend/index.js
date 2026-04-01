// Hostinger/Node panels often expect a root entry file (index.js).
// Our compiled app entry lives at dist/index.js.

try {
  require('./dist/index.js');
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Failed to start backend. Did you run `npm run build`?', err);
  process.exit(1);
}
