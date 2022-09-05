const fs = require('fs/promises')
const tmp = require('tmp-promise')
const test = require('brittle')
const Vault = require('../../')

Object.assign(exports, {
  test,
  createVault
})

const newTmpDir = async (t) => {
  const { path } = await tmp.dir()
  t.teardown(() => {
    fs.rm(path, { recursive: true })
  })
  return path
}

async function createVault (t) {
  const key = Vault.generateKey()
  const path = await newTmpDir(t)
  const vault = new Vault({ path, key })
  await vault.ready()
  return vault
}

// module.exports.test = function (name, fn, _tape = tape) {
//   return _tape(name, run)
//   async function run (t) {
//     const cleanup = []

//     await fn(t, create)

//     await Promise.all(
//       cleanup.map(fn => fn())
//     )
//   }
// }
// exports.test.only = (name, fn) => exports.test(name, fn, tape.only)
// exports.test.skip = (name, fn) => exports.test(name, fn, tape.skip)
