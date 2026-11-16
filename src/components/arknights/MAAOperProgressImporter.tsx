import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { Draft } from 'immer'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { mergeMaaOperProgressPlans, parseMaaOperProgressPlans } from '../../pkg/cpp-arknights/maaOperProgress'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import { ImportContext, useStartImportSession } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const MAAOperProgressImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    onClose()
    startImportSession(() => {
      const plans = parseMaaOperProgressPlans(input)
      const uda = ga.getUserDataAdapter()
      const characters = uda.getAllCharacterIds().map((x) => ga.getCharacter(x))
      const empty = uda.getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, invalid, inferred } = mergeMaaOperProgressPlans(characters, draft, empty, plans)
        const sep = gt.pgettext('list separator', '、')
        if (inferred.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员在 cpp 中尚未持有，已按计划所需的最低状态设为持有，请自行核对：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', inferred.map((x) => ga.getCharacter(x).name).join(sep)),
          )
        }
        if (invalid.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员的目标超出了可培养的上限（精英化次数或技能），已跳过：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', invalid.join(sep)),
          )
        }
        if (unknown.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '认不出这些干员，已跳过：%s。cpp 只认识简体中文名、西文代号和当前区服语言的名字；如果是新干员，可能游戏数据尚未更新。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', unknown.join(sep)),
          )
        }
      }
    })
  })

  const handleInput = useEvent<React.ClipboardEventHandler<HTMLInputElement>>((e) => {
    e.preventDefault()
    const data = e.clipboardData.getData('Text')
    if (data) {
      handleData(data)
    } else {
      alert(gt.gettext('粘贴的东西好像不太对，请重试。'))
    }
  })

  return (
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入 MAA「干员培养」计划')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>
            {gt.pgettext(
              'arknights maa step',
              '复制 MAA「干员培养」计划的 JSON，例如 arkntools「精英材料计算」中「导出培养方案至 MAA」的结果',
            )}
          </MyCard>
          <MyCard step={2}>
            <InputGroup
              onPaste={handleInput}
              value={''}
              placeholder={gt.gettext('请在此粘贴...')}
              autoFocus
              style={{ width: '100%' }}
              onChange={noop}
            />
          </MyCard>
        </CardList>
      </DialogBody>
    </Dialog>
  )
})
