import { execSync } from 'node:child_process'
import fs from 'node:fs'

const packagePath = 'package.json'
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
const pluginVersion = String(packageJson.version || '')
const distTag = pluginVersion.includes('-') ? 'next' : 'latest'
const distTagsOutput = execSync('npm view @talex-touch/utils dist-tags --json', {
  encoding: 'utf8',
})
const distTags = JSON.parse(distTagsOutput)
const utilsVersion = distTags[distTag] || distTags.latest

if (!utilsVersion) {
  throw new Error(`Unable to resolve @talex-touch/utils dist-tag "${distTag}" from npm`)
}

packageJson.dependencies ??= {}
packageJson.dependencies['@talex-touch/utils'] = utilsVersion

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

console.log(`Prepared CI dependency: @talex-touch/utils@${utilsVersion} (${distTag})`)
