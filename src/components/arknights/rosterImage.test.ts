import { describe, expect, it, vi } from 'vitest'
import type { Character } from '../../pkg/cpp-arknights'
import type { ArknightsCharacterStatus } from '../../pkg/cpp-arknights/types'
import { SceneNode, walkScene } from '../rosterImage/scene'
import m2 from './assets/m2.png'
import potential3 from './assets/potential3.png'
import {
  ARKNIGHTS_STATUS_HEIGHT,
  ARKNIGHTS_STATUS_WIDTH,
  STATUS_SHADOW,
  createArknightsRosterPainter,
} from './rosterImage'

// 只测画法本身，不碰 React
vi.mock('../../Cpp', () => ({}))

function character(modules: string[] = ['X', 'Y'], skills = 3): Character {
  return {
    key: 'char_002_amiya',
    rarity: 4,
    avatar: 'avatar.png',
    uniEquips: modules.map((t) => ({
      equipId: `equip-${t}`,
      equip: {
        icon: `icon-${t}.png`,
        raw: { unlockEvolvePhase: 'PHASE_2', typeName2: t, equipShiningColor: 'blue' },
      },
    })),
    skills: Array.from({ length: skills }, (_, i) => ({
      skillId: `skill-${i + 1}`,
      skill: { icon: `skill-${i + 1}.png` },
    })),
  } as unknown as Character
}

function status(extra: Partial<ArknightsCharacterStatus> = {}): ArknightsCharacterStatus {
  return { elite: 2, level: 60, skillLevel: 7, skillMaster: {}, modLevel: {}, ...extra }
}

const painter = createArknightsRosterPainter({ showPotential: true })

function all(nodes: SceneNode[]): SceneNode[] {
  const result: SceneNode[] = []
  walkScene(nodes, (n) => result.push(n))
  return result
}

type Group = Extract<SceneNode, { kind: 'group' }>

/** 直接画出 blob 为 src 的图的那一组 */
function groupWith(nodes: SceneNode[], src: string): Group | undefined {
  return all(nodes).find(
    (n): n is Group =>
      n.kind === 'group' && n.children.some((c) => c.kind === 'image' && 'blob' in c.image && c.image.blob === src),
  )
}

const texts = (nodes: SceneNode[]) => all(nodes).flatMap((n) => (n.kind === 'text' ? [n.text] : []))

describe('createArknightsRosterPainter', () => {
  it('is as wide as the list draws a status cell', () => {
    expect(ARKNIGHTS_STATUS_WIDTH).toBe(260)
    expect(ARKNIGHTS_STATUS_HEIGHT).toBe(42)
    expect(painter.statusWidth).toBe(260)
  })

  it('gives the status box the shadow of the list, under the current and the goal alike', () => {
    expect(STATUS_SHADOW).toEqual({ dx: 0, dy: 3, blur: 6, color: '#313131' })
    for (const nodes of [
      painter.status(status(), character()),
      painter.status(status({ elite: 2, level: 90 }), character(), status()),
    ]) {
      expect(nodes[0]).toMatchObject({ kind: 'rect', w: 260, h: 42, fill: '#313131', shadow: STATUS_SHADOW })
      // 等级的小方块不带
      expect(all(nodes).filter((n) => n.kind === 'rect' && n.shadow)).toHaveLength(1)
    }
  })

  it('draws the mastery icon for a mastered skill and the level for the others', () => {
    const nodes = painter.status(status({ skillMaster: { 'skill-2': 2 } }), character())
    const mastered = groupWith(nodes, 'skill-2.png')!
    expect(mastered.children.some((c) => c.kind === 'image' && 'asset' in c.image && c.image.asset === m2)).toBe(true)
    expect(mastered.children.some((c) => c.kind === 'text')).toBe(false)
    const plain = groupWith(nodes, 'skill-1.png')!
    expect(plain.children.some((c) => c.kind === 'text' && c.text === '7')).toBe(true)
  })

  it('writes the elite level', () => {
    expect(texts(painter.status(status(), character()))).toContain('60')
  })

  it('greys out a module at level 0 and halves its icon', () => {
    const nodes = painter.status(status({ modLevel: { 'equip-X': 0, 'equip-Y': 2 } }), character())
    const off = groupWith(nodes, 'icon-X.png')!
    const images = off.children.filter((c) => c.kind === 'image')
    expect(images.every((c) => c.kind === 'image' && c.image.grayscale)).toBe(true)
    expect(images.find((c) => c.kind === 'image' && 'blob' in c.image)).toMatchObject({ opacity: 0.5 })
    expect(images.find((c) => c.kind === 'image' && 'asset' in c.image)).toMatchObject({ fit: 'cover' })

    const on = groupWith(nodes, 'icon-Y.png')!
    expect(on.children.some((c) => c.kind === 'image' && c.image.grayscale)).toBe(false)
    expect(on.children.some((c) => c.kind === 'text' && c.text === '2')).toBe(true)
  })

  it('fades only what matches the current status', () => {
    const current = status({ modLevel: { 'equip-X': 1, 'equip-Y': 0 }, skillMaster: { 'skill-1': 3 } })
    const goal = status({ modLevel: { 'equip-X': 3, 'equip-Y': 0 }, skillMaster: { 'skill-1': 3, 'skill-2': 3 } })
    const nodes = painter.status(goal, character(), current)
    expect(groupWith(nodes, 'icon-X.png')!.opacity).toBeUndefined()
    expect(groupWith(nodes, 'icon-Y.png')!.opacity).toBe(0.1)
    expect(groupWith(nodes, 'skill-1.png')!.opacity).toBe(0.1)
    expect(groupWith(nodes, 'skill-2.png')!.opacity).toBeUndefined()
    const level = nodes.find((n) => n.kind === 'group' && n.children.some((c) => c.kind === 'text' && c.text === '60'))
    expect(level).toMatchObject({ opacity: 0.1 })

    const unfaded = painter.status(goal, character())
    expect(all(unfaded).some((n) => n.kind === 'group' && n.opacity != null)).toBe(false)
  })

  it('draws three narrow clipped slots for three modules', () => {
    const nodes = painter.status(status(), character(['X', 'Y', 'D']))
    const slots = ['X', 'Y', 'D'].map((t) => groupWith(nodes, `icon-${t}.png`)!)
    for (const slot of slots) {
      expect(slot.w).toBeCloseTo((40 * 2 + 3 - 6) / 3)
      expect(slot.clip).toBe(true)
    }
    expect(slots[1].x - slots[0].x).toBeCloseTo(slots[0].w + 3)
    expect(slots[2].x + slots[2].w).toBeCloseTo(slots[0].x + 83)
  })

  it('keeps two full slots for X and Y', () => {
    const nodes = painter.status(status(), character(['X', 'Y']))
    expect(groupWith(nodes, 'icon-X.png')!.w).toBe(40)
    expect(groupWith(nodes, 'icon-Y.png')!.w).toBe(40)
  })

  it('leaves a missing skill empty', () => {
    const nodes = painter.status(status(), character([], 2))
    expect(groupWith(nodes, 'skill-2.png')).toBeDefined()
    expect(all(nodes).filter((n) => n.kind === 'image' && 'blob' in n.image)).toHaveLength(2)
  })

  it('draws the potential badge only when shown and owned', () => {
    const badge = (nodes: SceneNode[]) =>
      nodes.find((n) => n.kind === 'image' && 'asset' in n.image && n.image.asset === potential3)
    const st = status({ potentialRank: 2 })
    expect(badge(painter.avatar(character(), st, false))).toMatchObject({ glow: true, w: 18, h: 18 })
    expect(badge(painter.avatar(character(), st, true))).toBeUndefined()
    expect(badge(createArknightsRosterPainter({ showPotential: false }).avatar(character(), st, false))).toBeUndefined()
  })

  it('draws the avatar over the rarity background', () => {
    const nodes = painter.avatar(character(), status(), false)
    expect(nodes[0]).toMatchObject({ kind: 'group', opacity: 0.5 })
    expect(nodes[1]).toMatchObject({ kind: 'image', image: { blob: 'avatar.png' }, w: 40, h: 40 })
  })
})
