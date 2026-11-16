import { describe, expect, it } from 'vitest'
import { ExtraCharacterQuery, Querier, QueryParam, RootCharacterQuery, listQueryFields, resolveField } from './queries'
import { QBoolean, QNumber, QString } from './queryTypes'

function createRoot() {
  const root = new RootCharacterQuery<any, any>()
  root.addField('rarity', '稀有度', QNumber, ({ character }) => character.rarity).addAlias('star')
  root.addField('name', '代号', QString, ({ character }) => character.name)
  root.addStatusField('elite', '精英化', QNumber, ({ status }) => status.elite)
  root
    .createSubQuery(
      'skill',
      '技能',
      () => [[0]],
      (i) => `${i}`,
    )
    .tap((sq) => {
      sq.addField('name', '技能名', QString, () => 'x')
      sq.addStatusField('mastery', '专精等级', QNumber, () => 0)
    })
  return root
}

class Extra extends ExtraCharacterQuery<any, any> {
  public constructor() {
    super()
    this.addStatusField('own', '持有', QBoolean, () => true)
  }
}

function querier(param: QueryParam) {
  const q = new Querier(createRoot(), param)
  q.addQuery(new Extra())
  return q
}

describe('listQueryFields', () => {
  it('dedupes aliases and groups fields', () => {
    const entries = listQueryFields(querier({}))
    expect(entries.map((x) => [x.id, x.group])).toEqual([
      ['goal', 'character'],
      ['rarity', 'character'],
      ['name', 'character'],
      ['current.elite', 'current'],
      ['current.own', 'current'],
      ['goal.elite', 'goal'],
      ['goal.own', 'goal'],
    ])
  })

  it('adds the joined sub query fields with their prefix', () => {
    const entries = listQueryFields(querier({ join: 'skill' }))
    const sub = entries.filter((x) => x.group === 'sub')
    expect(sub.map((x) => x.id)).toEqual(['skill.name', 'skill.current.mastery', 'skill.goal.mastery'])
    expect(String(sub[0].subName)).toBe('技能')
    expect(entries.find((x) => x.id === 'name')?.group).toBe('character')
  })

  it('resolves aliases to the canonical entry', () => {
    const q = querier({ join: 'skill' })
    const entries = listQueryFields(q)
    expect(resolveField(entries, q, 'star')?.id).toBe('rarity')
    expect(resolveField(entries, q, 'elite')?.id).toBe('current.elite')
    expect(resolveField(entries, q, 'skill.mastery')?.id).toBe('skill.current.mastery')
    expect(resolveField(entries, q, 'nope')).toBeUndefined()
  })
})

describe('Querier.validate', () => {
  it('accepts a valid query', () => {
    expect(() =>
      querier({
        join: 'skill',
        select: ['skill.mastery'],
        where: {
          _: '&&',
          operand: [
            { _: 'field', field: 'star', op: '>=', operand: 5 },
            { _: '!', operand: { _: 'field', field: 'own', op: '==', operand: true } },
          ],
        },
        order: [['skill.mastery', 'DESC']],
      }).validate(),
    ).not.toThrow()
  })

  it('reports an unknown field in where', () => {
    expect(() => querier({ where: { _: 'field', field: 'skill.mastery', op: '<', operand: 3 } }).validate()).toThrow(
      'skill.mastery',
    )
  })

  it('reports an unknown operator', () => {
    expect(() => querier({ where: { _: 'field', field: 'rarity', op: 'contains', operand: 3 } }).validate()).toThrow(
      'contains',
    )
  })

  it('reports an operand of the wrong type', () => {
    expect(() => querier({ where: { _: 'field', field: 'rarity', op: '==', operand: '6' } }).validate()).toThrow(
      'rarity',
    )
  })

  it('reports an unknown field in order and select', () => {
    expect(() => querier({ order: [['potential', 'ASC']] }).validate()).toThrow('potential')
    expect(() => querier({ select: ['potential'] }).validate()).toThrow('potential')
  })

  it('reports a missing join', () => {
    expect(() => querier({ join: 'module' })).toThrow('module')
  })
})
