#!/usr/bin/env node
// Cuts src/pkg/cpp-arknights/__fixtures__/module-missions.zh_CN.json out of a published
// arknights-kengxxiao-zh_CN.json; see that directory's README.md.
import fs from 'fs'

const STAGES = [
  'main_03-08',
  'main_04-02',
  'main_04-03',
  'main_04-06',
  'sub_02-03',
  'main_02-04',
  'main_07-06',
  'main_03-04',
  'main_11-02',
  'main_02-10',
]

const [input, output = 'src/pkg/cpp-arknights/__fixtures__/module-missions.zh_CN.json'] = process.argv.slice(2)
if (!input) {
  console.error('usage: node scripts/extract-module-mission-fixture.js <arknights-kengxxiao-zh_CN.json> [output]')
  process.exit(1)
}

const { version, data } = JSON.parse(fs.readFileSync(input, 'utf-8'))
const { missionList, equipDict } = data.exUniEquips

const equipIds = new Set(
  Object.values(missionList)
    .filter((m) => STAGES.includes(m.jumpStageId))
    .map((m) => m.uniEquipId),
)

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]))
const character = (c) => pick(c, ['name', 'profession', 'rarity', 'position'])

const missions = {}
const equips = {}
const characters = {}
const patchChars = {}
const enemies = {}
const skills = {}
for (const equipId of [...equipIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
  const e = equipDict[equipId]
  equips[equipId] = pick(e, ['uniEquipId', 'charId', 'tmplId', 'typeName1', 'typeName2', 'uniEquipName', 'missionList'])
  characters[e.charId] = character(data.exCharacters[e.charId])
  if (e.tmplId) patchChars[e.tmplId] = character(data.exPatchCharacters.patchChars[e.tmplId])
  for (const id of e.missionList) {
    const m = missionList[id]
    missions[id] = m
    for (const p of m.paramList.flatMap((x) => x.split(/[;,]/))) {
      if (p.startsWith('enemy_')) enemies[p] = data.exEnemies.enemyData[p]
      if (p.startsWith('sk')) skills[p] = { levels: [{ name: data.exSkills[p].levels[0].name }] }
    }
  }
}

const stages = Object.fromEntries(STAGES.map((id) => [id, pick(data.exStage.stages[id], ['code', 'name', 'apCost'])]))

fs.writeFileSync(
  output,
  JSON.stringify({
    version: version.id,
    exUniEquips: { equipDict: equips, missionList: missions },
    exCharacters: characters,
    exPatchCharacters: { patchChars },
    exSkills: skills,
    exEnemies: { enemyData: enemies },
    exStage: { stages },
  }),
)
console.log('wrote %s: %d modules, %d missions', output, Object.keys(equips).length, Object.keys(missions).length)
