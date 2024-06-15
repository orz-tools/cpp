#!/usr/bin/env node
import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const json = await (async () => {
  const page = await (
    await fetch(
      `https://www.taptap.cn/webapiv2/game-guide/v1/landing?${new URLSearchParams({
        'X-UA': new URLSearchParams({
          V: '1',
          PN: 'WebApp',
          LANG: 'zh_CN',
          VN_CODE: '102',
          LOC: 'CN',
          PLT: 'PC',
          DS: 'Android',
          OS: 'Linux',
          OSV: 'x86_64',
          DT: 'PC',
        }),
        app_id: 221062,
      })}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
        },
      },
    )
  ).json()
  return page
})()

const cn = await (
  await fetch(
    'https://raw.githubusercontent.com/SaionjiReisaki/cpp-data/master/files/reverse1999-yuanyan3060-zh_CN.json',
  )
).json()
const cnChars = cn.data.exCharacters

const chars = json.data.list
  .find((x) => x?.index?.name === '角色信息')
  .index.list.map((x) => x.list.map((y) => y))
  .flat()

const items = json.data.list
  .find((x) => x?.index?.name === '素材道具')
  .index.list.find((x) => x.name === '角色培养素材').list

const now = new Date().toISOString()
const nameMap = new Map()
chars.forEach((x) => {
  const n = x.name
  let official = cnChars.find((y) => y.name === n)
  if (official) {
    return nameMap.set(n, official.name)
  }
  official = cnChars.find((y) => y.name.replaceAll('.', '') === n.trim().replaceAll('.', ''))
  if (official) {
    return nameMap.set(n, official.name)
  }
  throw new Error(`Missing character ${n}`)
})

await writeFile(
  join(__dirname, '..', 'src', 'components', 're1999', 'taptap.json'),
  JSON.stringify(
    {
      updatedAt: now,
      chars: Object.fromEntries(chars.map((x) => [nameMap.get(x.name), x.web_url])),
      items: Object.fromEntries(items.map((x) => [x.name, x.web_url])),
    },
    null,
    2,
  ),
)

await writeFile(
  join(__dirname, '..', 'src', 'pkg', 'cpp-re1999', 'taptap.json'),
  JSON.stringify(
    {
      updatedAt: now,
      chars: Object.fromEntries(chars.map((x) => [nameMap.get(x.name), x.image.original_url])),
      items: Object.fromEntries(items.map((x) => [x.name, x.image.original_url])),
    },
    null,
    2,
  ),
)
