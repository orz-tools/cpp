import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

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

const links = {
  updatedAt: new Date().toISOString(),
  gamekee: result,
}
const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components', 're1999', 'links.json')
await writeFile(path, JSON.stringify(links, null, 2))
