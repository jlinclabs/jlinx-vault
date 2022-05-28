# Jlinx Vault

A recoverable data Vault.

## Usage

```js
const Vault = require('jlinx-vault')

const key = Vault.generateKey()
// make sure to save this somewhere

const vault = new Vault({
  path: '~/.my-vault',
  key: key,
})

(async () => {

  await vault.open()

  await vault.set('name', 'example')
  (await vault.get('name')).toString() === 'example'

  await vault.set('name', 'example', 'utf-8')

})()

```
