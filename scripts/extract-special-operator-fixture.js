#!/usr/bin/env node
// Cuts src/pkg/cpp-arknights/__fixtures__/special-operators.json out of the four regions' published
// arknights-kengxxiao-<lang>.json; see that directory's README.md.
import fs from 'fs'

const LANGS = ['zh_CN', 'en_US', 'ja_JP', 'ko_KR']
const OUTPUT = 'src/pkg/cpp-arknights/__fixtures__/special-operators.json'

const inputs = process.argv.slice(2)
if (inputs.length !== LANGS.length) {
  console.error(`usage: node scripts/extract-special-operator-fixture.js ${LANGS.map((l) => `<${l}.json>`).join(' ')}`)
  process.exit(1)
}

const fixture = { version: {} }
LANGS.forEach((lang, i) => {
  const { version, data } = JSON.parse(fs.readFileSync(inputs[i], 'utf-8'))
  if (!data.exSpecialOperators) throw new Error(`${inputs[i]} has no exSpecialOperators; it needs schema 8`)
  fixture.version[lang] = version.id
  fixture[lang] = data.exSpecialOperators
})

fs.writeFileSync(OUTPUT, JSON.stringify(fixture))
console.log(
  'wrote %s: %s',
  OUTPUT,
  LANGS.map((l) => `${l} ${Object.keys(fixture[l].operatorDetailData).length}`).join(', '),
)
