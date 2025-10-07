const base = require('@microsoft/teams.config/tsdown.config');

/**
 * @type {import('tsdown').Options}
 */
module.exports = {
  ...base,
  minify: true,
  unbundle: true,
  entry: ['src/**/*.ts'],
  copy: [{ from: 'templates', to: 'dist/templates' }],
};
