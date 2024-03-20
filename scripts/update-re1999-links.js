import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const res = await fetch('https://reverse1999.gamekee.com/v1/wiki/entry', { headers: { 'Game-Alias': 'reverse1999' } })
const body = await res.json()
const chars = body?.data.entry_list.find((x) => x.name === '角色').child.find((x) => x.name === '实装角色').child

const result = chars.map((x) => {
  return {
    name: x.name,
    alias: x.name_alias ? x.name_alias.split(',') : [],
    url: `https://reverse1999.gamekee.com/${encodeURIComponent(x.content_id)}.html`,
  }
})

const cn = await (
  await fetch(
    'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master/files/reverse1999-yuanyan3060-zh_CN.json',
  )
).json()
const en = await (
  await fetch(
    'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master/files/reverse1999-enigmaticnebula-en.json',
  )
).json()

const cnChars = cn.data.exCharacters
const enChars = en.data.exCharacters

const englishNames = Object.fromEntries(
  cnChars
    .map((cnChar) => {
      const enChar = enChars.find((x) => x.id === cnChar.id)
      if (!enChar) return null
      if (cnChar.isOnline !== '1') return null
      if (enChar.isOnline !== '1') return null
      if (cnChar.nameEng === enChar.name) return null
      return [cnChar.nameEng, enChar.name]
    })
    .filter((x) => !!x),
)

const links = {
  updatedAt: new Date().toISOString(),
  gamekee: result,
  englishNames: englishNames,
}
const path = join(__dirname, '..', 'src', 'components', 're1999', 'links.json')
await writeFile(path, JSON.stringify(links, null, 2))
