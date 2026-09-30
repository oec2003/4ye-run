import { randomBytes } from 'node:crypto'
import { access, chmod, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const toolDir = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(toolDir, '../worker/.dev.vars')

let exists = false
try {
  await access(outputPath, constants.F_OK)
  exists = true
} catch {
  const token = randomBytes(32).toString('hex')
  await writeFile(outputPath, `PUBLISH_TOKEN=${token}\n`, { mode: 0o600, flag: 'wx' })
}

await chmod(outputPath, 0o600)
console.log(JSON.stringify({
  created: !exists,
  output: outputPath,
  note: 'Token value is intentionally not printed and this file is ignored by Git.'
}, null, 2))
