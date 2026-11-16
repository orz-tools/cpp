import { CardList, Dialog, DialogBody, InputGroup } from '@blueprintjs/core'
import { Draft } from 'immer'
import { memo } from 'react'
import useEvent from 'react-use-event-hook'
import { useCpp } from '../../Cpp'
import { Arknights, ArknightsAdapter } from '../../pkg/cpp-arknights'
import {
  decodeArkntoolsBackup,
  isArkntoolsStageBlacklistDifferent,
  mergeArkntoolsBackup,
} from '../../pkg/cpp-arknights/arkntools'
import { UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import { ImportContext, useStartImportSession } from '../Importer'
import { MyCard, noop } from './MAAItemImporter'

export const ArkntoolsImporterDialog = memo(({ onClose }: { onClose: () => void }) => {
  const cpp = useCpp<Arknights>()
  const ga = cpp.gameAdapter as ArknightsAdapter
  const startImportSession = useStartImportSession()
  const handleData = useEvent((input: string) => {
    onClose()
    startImportSession(() => {
      const backup = decodeArkntoolsBackup(input)
      const empty = ga.getUserDataAdapter().getFrozenEmptyCharacterStatus()
      return (draft: Draft<UserData<Arknights>>, ctx: ImportContext) => {
        const { unknown, inferred } = mergeArkntoolsBackup(ga, draft, empty, backup, (id) => !!ga.getItem(id))
        if (inferred.length > 0) {
          ctx.addWarning(
            gt
              .gettext(
                '这些干员在 cpp 中尚未持有，已按 arkntools 计划的起点设为持有，等级按计划所需的最低值填写，请自行核对：%s。',
              ) /* I10N: %s: character names */
              .replaceAll('%s', inferred.map((x) => ga.getCharacter(x).name).join(gt.pgettext('list separator', '、'))),
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
        if (backup.planStageBlacklist) {
          const stageCodes = Object.fromEntries(
            Object.values(ga.getStageInfos()).map((x) => [x.id, x.rawCode] as const),
          )
          const forbidden = cpp.store.get(cpp.preferenceAtoms.forbiddenStageIdsAtom)
          // 排除关卡是偏好而不是用户数据，撤销不了，所以不导入，只在与当前设置不同时提示
          if (isArkntoolsStageBlacklistDifferent(backup.planStageBlacklist, forbidden, stageCodes)) {
            ctx.addWarning(
              gt
                .ngettext(
                  '备份中排除了 %d 个关卡，与 cpp 当前的设置不同；排除关卡没有导入，如需一致请在「关卡」菜单中自行设置。',
                  '备份中排除了 %d 个关卡，与 cpp 当前的设置不同；排除关卡没有导入，如需一致请在「关卡」菜单中自行设置。',
                  backup.planStageBlacklist.length,
                ) /* I10N: %d: number */
                .replaceAll('%d', String(backup.planStageBlacklist.length)),
            )
          }
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
    <Dialog isOpen={true} onClose={onClose} title={gt.gettext('导入「arkntools 精英材料计算」备份')} icon="log-in">
      <DialogBody>
        <CardList compact>
          <MyCard step={1}>{gt.pgettext('arknights arkntools step', '打开 arkntools「精英材料计算」')}</MyCard>
          <MyCard step={2}>{gt.pgettext('arknights arkntools step', '点击「导出」按钮，选择「备份」')}</MyCard>
          <MyCard step={3}>{gt.pgettext('arknights arkntools step', '复制文本框中的所有内容')}</MyCard>
          <MyCard step={4}>
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
