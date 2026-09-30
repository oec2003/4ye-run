import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = resolve(process.argv[2] || `${projectDir}/exports/content-backup.json`)
await mkdir(dirname(destination), { recursive: true })
await copyFile(resolve(projectDir, 'server/data/legacy-content.json'), destination)
console.log(`已导出本地内容快照：${destination}`)
