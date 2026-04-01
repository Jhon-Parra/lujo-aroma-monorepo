/**
 * Hostinger Startup Script
 * This file serves as a entry point for Hostinger's Node.js selector.
 * It redirects the execution to the compiled 'dist/index.js' file.
 */

// If you are using CommonJS in your dist/index.js
require('./dist/index.js');

// If you are using ESM in your dist/index.js, you might need to use dynamic import 
// (uncomment if require fails):
// import('./dist/index.js');
