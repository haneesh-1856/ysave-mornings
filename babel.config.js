module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Bundle Drizzle's generated .sql migration files as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
