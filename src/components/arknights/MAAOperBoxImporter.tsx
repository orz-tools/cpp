import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { Draft } from 'immer'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useGameAdapter } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import { mergeMAAOperBox, parseMAAOperBox } from '../../pkg/cpp-arknights/maa'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import { ImportContext, useStartImportSession } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const MAAOperBoxImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const ga = useGameAdapter<Arknights>() as ArknightsAdapter
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    onClose()
    startImportSession(() => {
      const opers = parseMAAOperBox(input)
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, hasDetails } = mergeMAAOperBox(ga, draft.current, empty, opers)
        if (!hasDetails) {
          ctx.addWarning(
            gt.gettext(
              'MAA 截图识别的结果只有精英化、等级和潜能，不含技能等级、专精和模组；这些保持导入前的值，请自行核对。',
            ),
          )
        }
        if (unknown.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '尚不支持这些干员，已跳过：%s。可能游戏数据尚未更新，请静候数据更新。游戏数据通常需要 2~24 小时解析。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', unknown.join(gt.pgettext('list separator', '、'))),
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
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入「MAA 干员识别」数据')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights maa step', '打开 MAA「小工具」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights maa step', '选择「干员识别」功能')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights maa step', '点击「开始识别」按钮')}</MyCard>
          <MyCard step={4}>{gt.pgettext('arknights maa step', '等待识别完成')}</MyCard>
          <MyCard step={5}>{gt.pgettext('arknights maa step', '「导出到」选择「剪切板」，点击「导出」按钮')}</MyCard>
          <MyCard step={6}>
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
