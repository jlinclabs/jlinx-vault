const fs = require('fs/promises')
const tmp = require('tmp-promise')
const tape = require('tape')
const Vault = require('../../')

module.exports.test = function (name, fn, _tape = tape) {
  return _tape(name, run)
  async function run (t) {
    const cleanup = []
    const newTmpDir = async () => {
      const { path } = await tmp.dir()
      cleanup.push(async () => {
        await fs.rm(path, { recursive: true })
      })
      return path
    }

    async function create () {
      const key = Vault.generateKey()
      const path = await newTmpDir()
      const vault = new Vault({ path, key })
      await vault.ready()
      return vault
    }

    await fn(t, create)

    await Promise.all(
      cleanup.map(fn => fn())
    )
  }
}
exports.test.only = (name, fn) => exports.test(name, fn, tape.only)
exports.test.skip = (name, fn) => exports.test(name, fn, tape.skip)
