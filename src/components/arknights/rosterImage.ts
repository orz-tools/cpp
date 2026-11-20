import { useMemo } from 'react'
import { WithGame } from '../../Cpp'
import type { Character } from '../../pkg/cpp-arknights'
import { Arknights, ArknightsCharacterStatus, PreferenceKeys } from '../../pkg/cpp-arknights/types'
import { gt } from '../../pkg/gt'
import type { RosterImagePainter, RosterToggleValues, SceneImage, SceneNode, SceneShadow } from '../rosterImage/scene'
import charbg1 from './assets/charbg1.png'
import charbg2 from './assets/charbg2.png'
import charbg3 from './assets/charbg3.png'
import charbg4 from './assets/charbg4.png'
import charbg5 from './assets/charbg5.png'
import charbg6 from './assets/charbg6.png'
import elite0 from './assets/elite0-small.png'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'
import m1 from './assets/m1.png'
import m2 from './assets/m2.png'
import m3 from './assets/m3.png'
import potential1 from './assets/potential1.png'
import potential2 from './assets/potential2.png'
import potential3 from './assets/potential3.png'
import potential4 from './assets/potential4.png'
import potential5 from './assets/potential5.png'
import potential6 from './assets/potential6.png'
import shiningBlue from './assets/shining_blue.png'
import shiningGreen from './assets/shining_green.png'
import shiningGrey from './assets/shining_grey.png'
import shiningRed from './assets/shining_red.png'
import shiningYellow from './assets/shining_yellow.png'
import { moduleSlots } from './moduleSlots'

const charbgs = [charbg1, charbg2, charbg3, charbg4, charbg5, charbg6]
/** 精英化图标的原图尺寸：画成 20 宽，高按比例 */
const elites = [
  { src: elite0, aspect: 42 / 64 },
  { src: elite1, aspect: 42 / 64 },
  { src: elite2, aspect: 53 / 64 },
]
const masters = [m1, m2, m3]
const M_ASPECT = 22 / 20
const potentials = [potential1, potential2, potential3, potential4, potential5, potential6]
const shinings: Record<string, string> = {
  blue: shiningBlue,
  green: shiningGreen,
  grey: shiningGrey,
  red: shiningRed,
  yellow: shiningYellow,
}

// 尺寸照列表：一项 40×40，间隔 3，左边 1，右边 4；模组两格的位置里放两格或三格
const ICON = 40
const GAP = 3
const PAD_LEFT = 1
const PAD_RIGHT = 4
const MODULE_AREA = ICON * 2 + GAP
const CELL_BACKGROUND = '#313131'
/** 列表里练度格的 box-shadow: #313131 0px 3px 6px（App.css 的 .cpp-char-menu-status::after） */
export const STATUS_SHADOW: SceneShadow = { dx: 0, dy: 3, blur: 6, color: CELL_BACKGROUND }
const LABEL_HEIGHT = 20
const LABEL_PAD = 4
const LABEL_SIZE = 14
/** 等宽字一个字符的宽：画法不量字，按 0.6em 算小方块的宽 */
const MONO_ADVANCE = LABEL_SIZE * 0.6
/** 和当前相同的项，像列表的 Hide */
const SAME_OPACITY = 0.1

export const ARKNIGHTS_STATUS_WIDTH = PAD_LEFT + ICON + GAP + MODULE_AREA + GAP + (ICON + GAP) * 3 - GAP + PAD_RIGHT
export const ARKNIGHTS_STATUS_HEIGHT = 42

const MODULE_LEFT = PAD_LEFT + ICON + GAP
const SKILL_LEFT = MODULE_LEFT + MODULE_AREA + GAP
const ITEM_TOP = (ARKNIGHTS_STATUS_HEIGHT - ICON) / 2

/** 左上角写等级的深灰小方块 */
function label(content: { text: string } | { image: SceneImage; w: number; h: number }): SceneNode[] {
  if ('text' in content) {
    const w = content.text.length * MONO_ADVANCE + LABEL_PAD * 2
    return [
      { kind: 'rect', x: 0, y: 0, w, h: LABEL_HEIGHT, fill: CELL_BACKGROUND },
      { kind: 'text', x: LABEL_PAD, y: 15, text: content.text, size: LABEL_SIZE, mono: true, fill: '#ffffff' },
    ]
  }
  return [
    { kind: 'rect', x: 0, y: 0, w: content.w + LABEL_PAD * 2, h: LABEL_HEIGHT, fill: CELL_BACKGROUND },
    {
      kind: 'image',
      x: LABEL_PAD,
      y: (LABEL_HEIGHT - content.h) / 2 + 1,
      w: content.w,
      h: content.h,
      image: content.image,
    },
  ]
}

function item(x: number, w: number, same: boolean, children: SceneNode[], clip = false): SceneNode {
  return {
    kind: 'group',
    x,
    y: ITEM_TOP,
    w,
    h: ICON,
    ...(same ? { opacity: SAME_OPACITY } : null),
    ...(clip ? { clip: true } : null),
    children,
  }
}

function levelItem(status: ArknightsCharacterStatus, same: boolean): SceneNode {
  const elite = elites[status.elite] ?? elites[0]
  const w = 20
  const h = w * elite.aspect
  // 列表里图标下面留 15 的空，和它一起在 40 高里上下居中
  const top = (ICON - (h + 15)) / 2
  return item(PAD_LEFT, ICON, same, [
    { kind: 'image', x: (ICON - w) / 2, y: top, w, h, image: { asset: elite.src } },
    {
      kind: 'text',
      x: ICON / 2,
      y: ICON - LABEL_HEIGHT + 15,
      text: String(status.level),
      size: LABEL_SIZE,
      mono: true,
      anchor: 'middle',
      fill: '#ffffff',
    },
  ])
}

type UniEquipEntry = Character['uniEquips'][number]

function moduleItem(x: number, w: number, ue: UniEquipEntry, level: number, same: boolean): SceneNode {
  const off = level === 0
  const shining = shinings[ue.equip.raw.equipShiningColor]
  const icon = 30
  return item(
    x,
    w,
    same,
    [
      ...(shining
        ? [
            {
              kind: 'image',
              x: 0,
              y: 0,
              w,
              h: ICON,
              fit: 'cover',
              image: { asset: shining, ...(off ? { grayscale: true } : null) },
            } satisfies SceneNode,
          ]
        : []),
      {
        kind: 'image',
        x: (w - icon) / 2,
        y: (ICON - icon) / 2,
        w: icon,
        h: icon,
        image: { blob: ue.equip.icon, ...(off ? { grayscale: true } : null) },
        ...(off ? { opacity: 0.5 } : null),
      },
      ...label({ text: String(level) }),
    ],
    true,
  )
}

type SkillEntry = Character['skills'][number]

function skillItem(x: number, skill: SkillEntry, status: ArknightsCharacterStatus, same: boolean): SceneNode {
  const master = status.skillMaster[skill.skillId] || 0
  const children: SceneNode[] = []
  if (skill.skill) children.push({ kind: 'image', x: 0, y: 0, w: ICON, h: ICON, image: { blob: skill.skill.icon } })
  if (status.skillLevel) {
    if (master > 0) {
      const h = 12
      children.push(...label({ image: { asset: masters[master - 1] }, w: h * M_ASPECT, h }))
    } else {
      children.push(...label({ text: String(status.skillLevel) }))
    }
  }
  return item(x, ICON, same, children)
}

export function createArknightsRosterPainter({ showPotential }: { showPotential: boolean }): RosterImagePainter {
  return {
    statusWidth: ARKNIGHTS_STATUS_WIDTH,
    statusHeight: ARKNIGHTS_STATUS_HEIGHT,

    avatar(character: Character, status: ArknightsCharacterStatus, absent: boolean): SceneNode[] {
      const nodes: SceneNode[] = [
        // 列表里黑底和稀有度底图一起 50% 透明，叠在行的底色上
        {
          kind: 'group',
          x: 0,
          y: 0,
          w: ICON,
          h: ICON,
          opacity: 0.5,
          children: [
            { kind: 'rect', x: 0, y: 0, w: ICON, h: ICON, fill: '#000000' },
            {
              kind: 'image',
              x: 0,
              y: 0,
              w: ICON,
              h: ICON,
              image: { asset: charbgs[character.rarity] ?? charbgs[0] },
            },
          ],
        },
        { kind: 'image', x: 0, y: 0, w: ICON, h: ICON, image: { blob: character.avatar } },
      ]
      if (showPotential && !absent) {
        const size = 18
        nodes.push({
          kind: 'image',
          x: ICON - size + 2,
          y: ICON - size + 2,
          w: size,
          h: size,
          image: { asset: potentials[status.potentialRank || 0] ?? potentials[0] },
          glow: true,
        })
      }
      return nodes
    },

    status(status: ArknightsCharacterStatus, character: Character, current?: ArknightsCharacterStatus): SceneNode[] {
      const nodes: SceneNode[] = [
        {
          kind: 'rect',
          x: 0,
          y: 0,
          w: ARKNIGHTS_STATUS_WIDTH,
          h: ARKNIGHTS_STATUS_HEIGHT,
          fill: CELL_BACKGROUND,
          shadow: STATUS_SHADOW,
        },
      ]
      nodes.push(levelItem(status, current ? status.elite === current.elite && status.level === current.level : false))

      const slots = moduleSlots(character)
      const slotWidth = (MODULE_AREA - (slots.length - 1) * GAP) / slots.length
      slots.forEach((ue, i) => {
        if (!ue) return
        const level = status.modLevel[ue.equipId] || 0
        const same = current ? level === (current.modLevel[ue.equipId] || 0) : false
        nodes.push(moduleItem(MODULE_LEFT + i * (slotWidth + GAP), slotWidth, ue, level, same))
      })

      character.skills.slice(0, 3).forEach((skill, i) => {
        const same = current
          ? status.skillLevel === current.skillLevel &&
            (status.skillMaster[skill.skillId] || 0) === (current.skillMaster[skill.skillId] || 0)
          : false
        nodes.push(skillItem(SKILL_LEFT + i * (ICON + GAP), skill, status, same))
      })
      return nodes
    },
  }
}

export const POTENTIAL_TOGGLE = 'potential'

/** 练度图的对话框里改过就按改的，没改过跟着列表的「显示潜能」；改了也不动列表的 */
export function rosterShowsPotential(toggles: RosterToggleValues, listShowsPotential: boolean): boolean {
  return toggles[POTENTIAL_TOGGLE] ?? listShowsPotential
}

export function useRosterImagePainter(toggles: RosterToggleValues): RosterImagePainter {
  const listShowsPotential = WithGame<Arknights>().useGamePreferenceAtomValue(PreferenceKeys.ShowPotential)
  const showPotential = rosterShowsPotential(toggles, listShowsPotential)
  return useMemo(
    () => ({
      ...createArknightsRosterPainter({ showPotential }),
      toggles: [{ key: POTENTIAL_TOGGLE, label: gt.pgettext('arknights option', '显示潜能'), value: showPotential }],
    }),
    [showPotential],
  )
}
