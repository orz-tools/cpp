import { Button, ButtonGroup, Icon, Navbar } from '@blueprintjs/core'
import { memo } from 'react'
import { DeployableProfession, Profession, ProfessionNames } from '../../pkg/cpp-arknights'
import { BASE_ROOMS, baseRoomName } from '../../pkg/cpp-arknights/baseSkills'
import { gt } from '../../pkg/gt'
import { useQuickFilter } from '../CharacterList'
import { ProfessionIcon } from './Icons'
import elite0 from './assets/elite0-small.png'
import elite1 from './assets/elite1-small.png'
import elite2 from './assets/elite2-small.png'

export const QuickFilterBuilder = memo(({ join }: { join?: string }) => {
  // 展开基建技能时职业和精英化让位给十个房间
  if (join === 'building') {
    return (
      <>
        <ButtonGroup>
          {BASE_ROOMS.map((roomType) => (
            <RoomFilter key={roomType} roomType={roomType} />
          ))}
        </ButtonGroup>
        <Navbar.Divider />
        <RarityFilters />
      </>
    )
  }
  return (
    <>
      <ButtonGroup>
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
      <RarityFilters />
      <Navbar.Divider />
      <ButtonGroup>
        <EliteFilter elite={2} />
        <EliteFilter elite={1} />
        <EliteFilter elite={0} />
      </ButtonGroup>
    </>
  )
})

const RarityFilters = memo(() => {
  return (
    // 星号按数字的基线对齐、和数字一样高，居中对齐会显得比数字低
    <ButtonGroup style={{ alignItems: 'baseline' }}>
      <Icon
        icon="star"
        size={12}
        title={gt.pgettext('arknights quick filter', '稀有度')}
        style={{ color: 'var(--bp-typography-color-muted)', paddingLeft: 7, paddingRight: 3 }}
      />
      <RarityFilter rarity={6} />
      <RarityFilter rarity={5} />
      <RarityFilter rarity={4} />
      <RarityFilter rarity={3} />
      <RarityFilter rarity={2} />
      <RarityFilter rarity={1} />
    </ButtonGroup>
  )
})

const RoomFilter = memo(({ roomType }: { roomType: string }) => {
  const { active, toggle } = useQuickFilter('building.room', roomType)
  const { short, full } = baseRoomName(roomType)
  return (
    <Button variant="minimal" active={active} aria-pressed={active} title={full} aria-label={full} onClick={toggle}>
      {short}
    </Button>
  )
})

const ProfessionFilter = memo(({ profession }: { profession: Profession }) => {
  // XXX: use professions for AMIYA
  const { active, toggle } = useQuickFilter('professions', profession)
  const name = String(ProfessionNames[profession as DeployableProfession])
  return (
    <Button
      variant="minimal"
      active={active}
      aria-pressed={active}
      title={name}
      aria-label={name}
      onClick={toggle}
      style={{ minWidth: 32 }}
      icon={<ProfessionIcon profession={profession} style={{ transform: 'scale(1.5)' }} />}
    />
  )
})

const RarityFilter = memo(({ rarity }: { rarity: number }) => {
  const { active, toggle } = useQuickFilter('rarity', rarity)
  const name = gt.pgettext('arknights quick filter', '%d 星').replaceAll('%d', String(rarity))
  return (
    <Button variant="minimal" active={active} aria-pressed={active} title={name} aria-label={name} onClick={toggle}>
      {rarity}
    </Button>
  )
})

const EliteFilter = memo(({ elite }: { elite: number }) => {
  const { active, toggle } = useQuickFilter('elite', elite)
  const img = [elite0, elite1, elite2][elite]
  const name = gt.pgettext('arknights quick filter', '精英 %d').replaceAll('%d', String(elite))
  return (
    <Button
      variant="minimal"
      active={active}
      aria-pressed={active}
      title={name}
      aria-label={name}
      onClick={toggle}
      icon={<img className="cpp-qf-elite" src={img} width={'20'} style={{ transform: 'scale(1.2)' }} />}
    />
  )
})
