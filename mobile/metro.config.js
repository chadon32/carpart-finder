const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
// Only the dependency-free API contracts are shared with the website. Keep
// React/module resolution rooted in mobile rather than watching the whole repo.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')]

module.exports = config
