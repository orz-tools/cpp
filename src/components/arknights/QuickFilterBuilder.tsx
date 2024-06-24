import { Button, ButtonGroup, Navbar, Tag } from '@blueprintjs/core'
import { memo } from 'react'
import { Profession } from '../../pkg/cpp-arknights'
import { gt } from '../../pkg/gt'
import { useQuickFilter } from '../CharacterList'
import { ProfessionIcon } from './Icons'
import elite0 from './assets/elite0-small.png'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'

export const QuickFilterBuilder = memo(() => {
  return (
    <>
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('arknights quick filter', '职业')}
        </Tag>
        <ProfessionFilter profession={Profession.PIONEER} />
        <ProfessionFilter profession={Profession.WARRIOR} />
        <ProfessionFilter profession={Profession.TANK} />
        <ProfessionFilter profession={Profession.SNIPER} />
        <ProfessionFilter profession={Profession.CASTER} />
        <ProfessionFilter profession={Profession.MEDIC} />
        <ProfessionFilter profession={Profession.SUPPORT} />
        <ProfessionFilter profession={Profession.SPECIAL} />
      </ButtonGroup>
      <Navbar.Divider />
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('arknights quick filter', '稀有度')}
        </Tag>
        <RarityFilter rarity={6} />
        <RarityFilter rarity={5} />
        <RarityFilter rarity={4} />
        <RarityFilter rarity={3} />
        <RarityFilter rarity={2} />
        <RarityFilter rarity={1} />
      </ButtonGroup>
      <Navbar.Divider />
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('arknights quick filter', '精英化')}
        </Tag>
        <EliteFilter elite={2} />
        <EliteFilter elite={1} />
        <EliteFilter elite={0} />
      </ButtonGroup>
    </>
  )
})

const ProfessionFilter = memo(({ profession }: { profession: Profession }) => {
  // XXX: use professions for AMIYA
  const { active, toggle } = useQuickFilter('professions', profession)
  return (
    <Button
      minimal
      active={active}
      onClick={toggle}
      style={{ minWidth: 32 }}
      icon={<ProfessionIcon profession={profession} style={{ transform: 'scale(1.5)' }} />}
    />
  )
})

const RarityFilter = memo(({ rarity }: { rarity: number }) => {
  const { active, toggle } = useQuickFilter('rarity', rarity)
  return (
    <Button minimal active={active} onClick={toggle}>
      {rarity}
    </Button>
  )
})

const EliteFilter = memo(({ elite }: { elite: number }) => {
  const { active, toggle } = useQuickFilter('elite', elite)
  const img = [elite0, elite1, elite2][elite]
  return (
    <Button
      minimal
      active={active}
      onClick={toggle}
      icon={
        <img
          src={img}
          width={'20'}
          style={{
            filter: 'invert(1)',
            transform: 'scale(1.2)',
          }}
        />
      }
    />
  )
})
