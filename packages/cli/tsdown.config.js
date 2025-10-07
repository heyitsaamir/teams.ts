const base = require('@microsoft/teams.config/tsdown.config');

/**
 * @type {import('tsdown').Options}
 */
module.exports = {
  ...base,
  minify: true,
  bundle: true,
  entry: ['src/index.ts'],
};
