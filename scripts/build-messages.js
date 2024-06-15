#!/usr/bin/env node
import fs from 'fs'
import gettextParser from 'gettext-parser'

for (const file of fs.readdirSync('po')) {
  if (!file.endsWith('.po')) continue
  console.log('building messages from %s...', file)
  const input = fs.readFileSync(`po/${file}`)
  const po = gettextParser.po.parse(input)
  delete po.charset
  po.headers = {
    Language: po.headers['Language'],
    'Plural-Forms': po.headers['Plural-Forms'],
  }
  if (po.translations['']) {
    delete po.translations['']['']
  }
  for (const key in po.translations) {
    const value = po.translations[key]
    for (const key2 in value) {
      const value2 = value[key2]
      if (!value2) continue
      delete value2['comments']
      delete value2['msgctxt']
      delete value2['msgid']
    }
  }
  fs.writeFileSync(`po/${file.replace('.po', '.json')}`, JSON.stringify(po, null, 2))
}
