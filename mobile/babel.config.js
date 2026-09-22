module.exports = function (api) {
  const isTest = api.env('test')
  return {
    presets: ['babel-preset-expo'],
    // Jest runs CommonJS. Transform import() only there so tests can mock
    // lazily loaded native modules without changing Metro's production code.
    plugins: isTest ? ['@babel/plugin-transform-dynamic-import'] : [],
  }
}
