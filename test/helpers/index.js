const { withDir } = require('tmp-promise')

module.exports.withDir = function (handler) {
  return withDir(handler, { unsafeCleanup: true })
}
