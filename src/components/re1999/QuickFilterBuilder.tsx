import { Button, ButtonGroup, Navbar, Tag } from '@blueprintjs/core'
import { memo } from 'react'
import { gt } from '../../pkg/gt'
import { useQuickFilter } from '../CharacterList'
import dmgtype1 from './assets/dmgtype1.png'
import dmgtype2 from './assets/dmgtype2.png'
import dongxi1 from './assets/dongxi_da_001.png'
import dongxi2 from './assets/dongxi_da_002.png'
import dongxi3 from './assets/dongxi_da_003.png'
import career1 from './assets/sx_icon_1.png'
import career2 from './assets/sx_icon_2.png'
import career3 from './assets/sx_icon_3.png'
import career4 from './assets/sx_icon_4.png'
import career5 from './assets/sx_icon_5.png'
import career6 from './assets/sx_icon_6.png'

const careerIcons = [undefined, career1, career2, career3, career4, career5, career6]
const dmgtypeIcons = [undefined, dmgtype1, dmgtype2]

export const QuickFilterBuilder = memo(() => {
  return (
    <>
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('re1999 quick filter', '灵感')}
        </Tag>
        <CareerFilter career={1} />
        <CareerFilter career={2} />
        <CareerFilter career={3} />
        <CareerFilter career={4} />
        <CareerFilter career={5} />
        <CareerFilter career={6} />
      </ButtonGroup>
      <Navbar.Divider />
      <ButtonGroup>
        <DmgtypeFilter dmgtype={1} />
        <DmgtypeFilter dmgtype={2} />
      </ButtonGroup>
      <Navbar.Divider />
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('re1999 quick filter', '稀有度')}
        </Tag>
        <RarityFilter rarity={6} />
        <RarityFilter rarity={5} />
        <RarityFilter rarity={4} />
        <RarityFilter rarity={3} />
        <RarityFilter rarity={2} />
      </ButtonGroup>
      <Navbar.Divider />
      <ButtonGroup>
        <Tag large minimal style={{ background: 'none' }}>
          {gt.pgettext('re1999 quick filter', '洞悉')}
        </Tag>
        <InsightFilter insight={3} />
        <InsightFilter insight={2} />
        <InsightFilter insight={1} />
        <InsightFilter insight={0} />
      </ButtonGroup>
    </>
  )
})

const CareerFilter = memo(({ career }: { career: number }) => {
  const { active, toggle } = useQuickFilter('career', career)
  return (
    <Button
      minimal
      active={active}
      onClick={toggle}
      style={{ padding: 5 }}
      icon={
        <img
          src={careerIcons[career]}
          width={'15'}
          style={{
            padding: 0,
            transform: 'scale(1.2) translateY(1px)',
          }}
        />
      }
    />
  )
})

const DmgtypeFilter = memo(({ dmgtype }: { dmgtype: number }) => {
  const { active, toggle } = useQuickFilter('dmgtype', dmgtype)
  return (
    <Button
      minimal
      active={active}
      onClick={toggle}
      style={{ padding: 5 }}
      icon={
        <img
          src={dmgtypeIcons[dmgtype]}
          width={'15'}
          style={{
            padding: 0,
            filter: 'invert(1)',
            transform: 'scale(1.2) translateY(1px)',
          }}
        />
      }
    />
  )
})

const RarityFilter = memo(({ rarity }: { rarity: number }) => {
  const { active, toggle } = useQuickFilter('rarity', rarity)
  return (
    <Button minimal active={active} onClick={toggle} style={{ padding: 5 }}>
      {rarity}
    </Button>
  )
})

const InsightFilter = memo(({ insight }: { insight: number }) => {
  const { active, toggle } = useQuickFilter('insight', insight)
  const img = [undefined, dongxi1, dongxi2, dongxi3][insight]
  return (
    <Button
      minimal
      active={active}
      onClick={toggle}
      style={{ padding: 5 }}
      icon={
        img === undefined ? undefined : (
          <img
            src={img}
            width={'15'}
            style={{
              padding: 0,
              filter: 'invert(1)',
              transform: 'scale(1.2)',
            }}
          />
        )
      }
      text={insight === 0 ? '/' : undefined}
    />
  )
})
