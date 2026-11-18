import { Checkbox } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { memo, useRef } from 'react'
import { useAtoms, useCpp, useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter, Character } from '../../pkg/cpp-arknights'
import { DefaultSkin, defaultSkins } from '../../pkg/cpp-arknights/skins'
import { ICharacter } from '../../pkg/cpp-basic'
import { gt, lpstr } from '../../pkg/gt'
import { useFocusFrame } from '../focusFrame'
import { DossierSection } from '../types'
import {
  SkinMarks,
  SkinPicture,
  acquiredText,
  channelName,
  channelTone,
  formLabel,
  priceText,
  untilText,
} from './SkinImages'
import { SkinState, setSkinOwned, useSkinModel } from './skinsModel'

const eliteNames = [
  () => gt.pgettext('skins', '精英零'),
  () => gt.pgettext('skins', '精英一'),
  () => gt.pgettext('skins', '精英二'),
]
const eliteNotes = [
  () => gt.pgettext('skins', '默认'),
  () => gt.pgettext('skins', '精英一解锁'),
  () => gt.pgettext('skins', '精英二解锁'),
]

const DefaultCard = memo(({ skin, character }: { skin: DefaultSkin; character: Character }) => {
  const elite = skin.elite ?? (skin.id.endsWith('#2') ? 2 : 0)
  const name = eliteNames[elite]?.() ?? ''
  // 阿米娅另外几个形态的默认立绘：副标题是形态的职业名
  const note = skin.tmplId ? formLabel(skin.tmplId, character) : (eliteNotes[elite]?.() ?? '')
  return (
    <div className="cpp-skins-dcard">
      <span className="cpp-skins-dcard-pic">
        <SkinPicture id={skin.id} kind="portrait" name={name} />
      </span>
      <span className="cpp-skins-dcard-name">{name}</span>
      <span className="cpp-skins-dcard-sub">{note}</span>
    </div>
  )
})

const SkinDossierCard = memo(({ state, character }: { state: SkinState; character: Character }) => {
  const cpp = useCpp<Arknights>()
  const { skin } = state
  const w = state.owned ? undefined : state.available[0]
  // 从侧栏点了这一件：滚过来、框出来
  const ref = useRef<HTMLDivElement>(null)
  const focused = useFocusFrame('skin:' + skin.id, ref)
  return (
    <div ref={ref} className={'cpp-skins-dcard' + (focused ? ' is-focused' : '')}>
      <span className="cpp-skins-dcard-pic">
        <SkinPicture id={skin.id} kind="portrait" name={skin.name} />
        <SkinMarks state={state} marking={false} />
      </span>
      <span className="cpp-skins-dcard-name" title={skin.name}>
        {skin.name}
      </span>
      <span className="cpp-skins-dcard-sub" title={skin.groupName}>
        {[formLabel(skin.tmplId, character), skin.groupName].filter(Boolean).join(' · ')}
      </span>
      <Checkbox
        className="cpp-skins-dcard-own"
        checked={state.owned}
        label={gt.pgettext('skins', '已有')}
        onChange={() => setSkinOwned(cpp, [skin.id], !state.owned)}
      />
      {state.owned ? (
        state.acquiredAt ? (
          <span className="cpp-skins-dcard-state cpp-skins-muted">{acquiredText(state.acquiredAt)}</span>
        ) : null
      ) : w ? (
        <span className={`cpp-skins-dcard-state cpp-skins-tone-${channelTone(w.channel)}`}>
          {channelName(w.channel)}
          {priceText(w) ? <br /> : null}
          {priceText(w)}
          <br />
          {untilText(w.end)}
        </span>
      ) : (
        <span className="cpp-skins-dcard-state cpp-skins-muted">{gt.pgettext('skins', '暂时拿不到')}</span>
      )}
    </div>
  )
})

const SkinsSectionBody = memo(({ character }: { character: ICharacter }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const c = character as Character
  const model = useSkinModel()
  const current = useAtomValue(useAtoms<Arknights>().currentCharacter(c.key))

  const skins = (model.catalog.byChar.get(c.key) ?? []).map((s) => model.states.get(s.id)!)
  const defaults = defaultSkins(ga.getDataManager().raw.exSkin, c.key)
  const owned = skins.filter((s) => s.owned).length
  const absent = ga.getUserDataAdapter().isAbsentCharacter(c, current)

  return (
    <div className="cpp-skins-dossier">
      {absent && owned > 0 ? (
        <div className="cpp-skins-dossier-note">
          {gt
            .ngettext(
              '你有这名干员的 %d 件时装，但还没有这名干员。',
              '你有这名干员的 %d 件时装，但还没有这名干员。',
              owned,
            )
            .replaceAll('%d', String(owned))}
        </div>
      ) : null}
      <div className="cpp-skins-dcards">
        {defaults.map((d) => (
          <DefaultCard key={d.id} skin={d} character={c} />
        ))}
        {skins.map((s) => (
          <SkinDossierCard key={s.skin.id} state={s} character={c} />
        ))}
      </div>
      <div className="cpp-skins-muted cpp-skins-dossier-count">
        {gt
          .ngettext('已有 %1/%2 件时装', '已有 %1/%2 件时装', skins.length)
          .replace('%1', String(owned))
          .replace('%2', String(skins.length))}
      </div>
    </div>
  )
})

export const skinsSection: DossierSection = {
  id: 'skins',
  title: lpstr(() => gt.pgettext('dossier section', '时装')),
  Body: SkinsSectionBody,
  isAvailable: (ga, character) => {
    const aga = ga as ArknightsAdapter
    return aga.hasSkins() && aga.getSkinCatalog().byChar.has(character.key)
  },
}
