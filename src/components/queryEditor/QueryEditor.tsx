import { Alert, Button, Icon, Menu, MenuItem, Popover, SegmentedControl } from '@blueprintjs/core'
import deepEqual from 'deep-equal'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { memo, useEffect, useMemo, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { Cpp, useAtoms, useCpp } from '../../Cpp'
import { QueryParam } from '../../pkg/cpp-basic'
import { normalizeQuery } from '../../pkg/cpp-basic/queryEditorModel'
import { SavedQuery, UserData } from '../../pkg/cpp-core/UserData'
import { gt } from '../../pkg/gt'
import {
  ListModeAbsent,
  ListModeAll,
  ListModeFav,
  ListModeWithGoal,
  PredefinedGameQueryPrefix,
  SavedQueryPrefix,
  compileQuery,
  createListQuerier,
  isCustomQuery,
  stringifyQuery,
} from '../characterQuery'
import { JsonEditor, describeJsonError } from './JsonEditor'
import { NameDialog } from './NameDialog'
import { VisualEditor, cleanQuery } from './VisualEditor'
import { createFieldCatalog } from './catalog'
import * as saved from './savedQueries'
import './style.css'

/** 面板里的查询未通过校验时为 true，列表据此调暗 */
export const queryEditorStaleAtom = atom(false)

/** 面板挂载时登记的关闭流程，导航栏的 ✏ 与面板的 ✕ 共用 */
const queryEditorCloseAtom = atom<{ close: () => void } | null>(null)

export function useQueryEditorToggle() {
  const cpp = useCpp()
  const [param, setParam] = useAtom(cpp.queryParamAtom)
  const closer = useAtomValue(queryEditorCloseAtom)
  const open = isCustomQuery(param.query)
  return {
    open,
    toggle: useEvent(() => {
      if (open) {
        closer?.close()
        return
      }
      setParam((x) => ({ ...x, query: stringifyQuery(forEditing(compileQuery(x.query, cpp), cpp)), source: x.query }))
    }),
  }
}

/** 与默认排序相同的 order 省略掉，编辑器里显示为“按默认排序” */
function forEditing(q: QueryParam, cpp: Cpp<any>): QueryParam {
  const r = { ...q }
  if (deepEqual(r.order, cpp.gameAdapter.getDefaultCharacterQueryOrder(), { strict: true })) delete r.order
  return cleanQuery(r)
}

function comparable(q: QueryParam, cpp: Cpp<any>): QueryParam {
  return normalizeQuery({ ...q, order: q.order?.length ? q.order : cpp.gameAdapter.getDefaultCharacterQueryOrder() })
}

function validateQuery(cpp: Cpp<any>, q: QueryParam): string | undefined {
  try {
    createListQuerier(cpp, q).validate()
    return undefined
  } catch (e) {
    return (e as Error).message
  }
}

type SourceInfo =
  | { kind: 'fav'; ref: string; name: string; query: QueryParam; customized: boolean }
  | { kind: 'saved'; ref: string; name: string; query: QueryParam; saved: SavedQuery }
  | { kind: 'view'; ref: string; name: string; query: QueryParam }
  | { kind: 'none' }

export function predefinedViewName(ref: string): string | undefined {
  switch (ref) {
    case ListModeFav:
      return gt.pgettext('predefined view name', '想看的')
    case ListModeAll:
      return gt.pgettext('predefined view name', '全部')
    case ListModeWithGoal:
      return gt.pgettext('predefined view name', '计划')
    case ListModeAbsent:
      return gt.pgettext('predefined view name', '缺席')
  }
  return undefined
}

function describeSource(cpp: Cpp<any>, ref: string | undefined, data: UserData<any>): SourceInfo {
  if (!ref) return { kind: 'none' }
  try {
    if (ref === ListModeFav) {
      return {
        kind: 'fav',
        ref,
        name: predefinedViewName(ref)!,
        query: compileQuery(ref, cpp),
        customized: data.favQuery != null,
      }
    }
    if (ref.startsWith(SavedQueryPrefix)) {
      const s = data.savedQueries.find((x) => x.id === ref.slice(SavedQueryPrefix.length))
      if (!s) return { kind: 'none' }
      return { kind: 'saved', ref, name: s.name, query: compileQuery(ref, cpp), saved: s }
    }
    const view = predefinedViewName(ref)
    if (view) return { kind: 'view', ref, name: view, query: compileQuery(ref, cpp) }
    if (ref.startsWith(PredefinedGameQueryPrefix)) {
      const pgq = cpp.gameAdapter.getPredefinedQueries()[ref.slice(PredefinedGameQueryPrefix.length)]
      if (pgq) return { kind: 'view', ref, name: String(pgq.name), query: pgq.query }
    }
  } catch {
    // 来源失效时当作没有来源
  }
  return { kind: 'none' }
}

interface Confirmation {
  message: string
  confirmText: string
  action: () => void
}

export const QueryEditor = memo(() => {
  const param = useAtomValue(useCpp().queryParamAtom)
  return isCustomQuery(param.query) ? <QueryEditorPanel /> : null
})

const QueryEditorPanel = memo(() => {
  const cpp = useCpp()
  const atoms = useAtoms()
  const data = useAtomValue(atoms.dataAtom)
  const [param, setParam] = useAtom(cpp.queryParamAtom)
  const setStale = useSetAtom(queryEditorStaleAtom)
  const setCloser = useSetAtom(queryEditorCloseAtom)

  const committed = useMemo((): { query?: QueryParam; error?: string } => {
    try {
      return { query: JSON.parse(param.query) }
    } catch (e) {
      return { error: describeJsonError(param.query, e) }
    }
  }, [param.query])

  const [draft, setDraft] = useState<QueryParam>(() => committed.query ?? {})
  const [error, setError] = useState<string | undefined>(() =>
    committed.query ? validateQuery(cpp, committed.query) : committed.error,
  )
  const [mode, setMode] = useState<'visual' | 'json'>(() => (error ? 'json' : 'visual'))
  // 递增以重建 JSON 文本框，让它从当前草稿重新生成文本
  const [jsonKey, setJsonKey] = useState(0)

  const resetDraft = useEvent((q: QueryParam) => {
    setDraft(q)
    setError(validateQuery(cpp, q))
    setJsonKey((k) => k + 1)
  })

  // 外部改了 query（撤销、切换来源）时，草稿跟着换
  useEffect(() => {
    if (committed.query && !deepEqual(committed.query, draft)) resetDraft(committed.query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed])

  useEffect(() => setStale(error != null), [error, setStale])
  useEffect(() => () => setStale(false), [setStale])

  const apply = useEvent((next: QueryParam) => {
    setDraft(next)
    const problem = validateQuery(cpp, next)
    setError(problem)
    if (!problem) setParam((x) => ({ ...x, query: stringifyQuery(next) }))
  })

  const onParseError = useEvent((message: string) => setError(message))

  const catalog = useMemo(() => {
    try {
      return createFieldCatalog(cpp, draft.join ?? undefined)
    } catch {
      return createFieldCatalog(cpp, undefined)
    }
  }, [cpp, draft.join])

  const source = useMemo(() => describeSource(cpp, param.source, data), [cpp, param.source, data])
  const dirty = source.kind === 'none' || !deepEqual(comparable(draft, cpp), comparable(source.query, cpp))
  const writable = source.kind === 'saved' || source.kind === 'fav'

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [lastConfirmation, setLastConfirmation] = useState<Confirmation | null>(null)
  const ask = (c: Confirmation) => {
    setConfirmation(c)
    setLastConfirmation(c)
  }

  const goTo = (query: string) => setParam((x) => ({ ...x, query, source: undefined }))

  const requestClose = useEvent(() => {
    if (source.kind === 'none') {
      ask({
        message: gt.pgettext('query editor', '放弃这个自定义查询，回到「全部」？'),
        confirmText: gt.pgettext('query editor', '放弃'),
        action: () => goTo(ListModeAll),
      })
    } else if (dirty) {
      ask({
        message: gt.pgettext('query editor', '放弃对「%s」的修改？').replace('%s', source.name),
        confirmText: gt.pgettext('query editor', '放弃修改'),
        action: () => goTo(source.ref),
      })
    } else {
      goTo(source.ref)
    }
  })

  useEffect(() => {
    setCloser({ close: requestClose })
    return () => setCloser(null)
  }, [requestClose, setCloser])

  const save = () => {
    if (error) return
    if (source.kind === 'saved') saved.overwrite(cpp, source.saved.id, draft)
    else if (source.kind === 'fav') saved.setFavQuery(cpp, draft)
    else return
    goTo(source.ref)
  }

  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const saveAs = (name: string) => {
    if (error) return
    const id = saved.saveAs(cpp, name, draft)
    setSaveAsOpen(false)
    goTo(SavedQueryPrefix + id)
  }

  const [more, setMore] = useState<'closed' | 'menu' | 'rename'>('closed')
  const moreItems: React.ReactNode[] = []
  if (source.kind === 'saved') {
    moreItems.push(
      <MenuItem
        key="rename"
        icon="edit"
        text={gt.pgettext('query editor', '重命名…')}
        shouldDismissPopover={false}
        onClick={() => setMore('rename')}
      />,
      <MenuItem
        key="delete"
        icon="trash"
        intent="danger"
        text={gt.pgettext('query editor', '删除…')}
        onClick={() =>
          ask({
            message: gt.pgettext('query editor', '删除过滤器「%s」？').replace('%s', source.name),
            confirmText: gt.pgettext('query editor', '删除'),
            action: () => {
              saved.remove(cpp, source.saved.id)
              goTo(ListModeAll)
            },
          })
        }
      />,
    )
  }
  if (source.kind === 'fav' && source.customized) {
    moreItems.push(
      <MenuItem
        key="restore"
        icon="reset"
        text={gt.pgettext('query editor', '恢复默认…')}
        onClick={() =>
          ask({
            message: gt.pgettext('query editor', '把「想看的」恢复为默认条件？自定义的版本会被删除。'),
            confirmText: gt.pgettext('query editor', '恢复默认'),
            action: () => {
              saved.setFavQuery(cpp, undefined)
              goTo(ListModeFav)
            },
          })
        }
      />,
    )
  }
  if (writable && dirty) {
    moreItems.push(
      <MenuItem
        key="discard"
        icon="undo"
        text={gt.pgettext('query editor', '放弃更改…')}
        onClick={() =>
          ask({
            message: gt.pgettext('query editor', '放弃对「%s」的修改？').replace('%s', source.name),
            confirmText: gt.pgettext('query editor', '放弃修改'),
            action: () => {
              const q = forEditing(source.query, cpp)
              resetDraft(q)
              setParam((x) => ({ ...x, query: stringifyQuery(q) }))
            },
          })
        }
      />,
    )
  }

  let title: string
  let status: React.ReactNode = null
  if (source.kind === 'saved' || source.kind === 'fav') {
    title = source.name
    if (dirty) status = <span className="cpp-qe-dirty">{gt.pgettext('query editor', '已修改')}</span>
    else if (source.kind === 'fav') {
      status = (
        <span className="cpp-qe-muted">
          {source.customized ? gt.pgettext('query editor', '已自定义') : gt.pgettext('query editor', '默认')}
        </span>
      )
    }
  } else {
    title = gt.pgettext('query editor', '自定义查询')
    status = (
      <span className="cpp-qe-muted">
        {source.kind === 'view'
          ? gt.pgettext('query editor', '基于「%s」· 未保存').replace('%s', source.name)
          : gt.pgettext('query editor', '未保存')}
      </span>
    )
  }

  const visualBlocked = mode === 'json' && error != null

  return (
    <section className="cpp-qe" aria-label={title}>
      <header className="cpp-qe-head">
        <div className="cpp-qe-title">
          <strong title={title}>{title}</strong>
          {status}
        </div>
        <span title={visualBlocked ? gt.pgettext('query editor', '先修好 JSON 再切换') : undefined}>
          <SegmentedControl
            aria-label={gt.pgettext('query editor', '编辑方式')}
            value={mode}
            onValueChange={(v) => {
              if (v === 'json') setJsonKey((k) => k + 1)
              setMode(v as 'visual' | 'json')
            }}
            options={[
              { label: gt.pgettext('query editor', '可视化'), value: 'visual', disabled: visualBlocked },
              { label: 'JSON', value: 'json' },
            ]}
          />
        </span>
        {writable && dirty ? (
          <Button intent="primary" disabled={error != null} onClick={save}>
            {gt.pgettext('query editor', '保存')}
          </Button>
        ) : null}
        <Popover
          isOpen={saveAsOpen}
          onInteraction={(next) => setSaveAsOpen(next && error == null)}
          placement="bottom-end"
          content={
            <NameDialog
              initialName={source.kind === 'saved' ? source.name : ''}
              onSave={saveAs}
              onCancel={() => setSaveAsOpen(false)}
            />
          }
        >
          <Button intent={writable ? 'none' : 'primary'} disabled={error != null}>
            {gt.pgettext('query editor', '另存为…')}
          </Button>
        </Popover>
        {moreItems.length > 0 ? (
          <Popover
            isOpen={more !== 'closed'}
            onInteraction={(next) => setMore(next ? (more === 'closed' ? 'menu' : more) : 'closed')}
            placement="bottom-end"
            minimal={more === 'menu'}
            content={
              more === 'rename' && source.kind === 'saved' ? (
                <NameDialog
                  initialName={source.name}
                  onSave={(name) => {
                    saved.rename(cpp, source.saved.id, name)
                    setMore('closed')
                  }}
                  onCancel={() => setMore('closed')}
                />
              ) : (
                <Menu>{moreItems}</Menu>
              )
            }
          >
            <Button
              variant="minimal"
              icon="more"
              title={gt.pgettext('query editor', '更多操作')}
              aria-label={gt.pgettext('query editor', '更多操作')}
            />
          </Popover>
        ) : null}
        <Button
          variant="minimal"
          icon="cross"
          title={gt.pgettext('query editor', '关闭')}
          aria-label={gt.pgettext('query editor', '关闭')}
          onClick={requestClose}
        />
      </header>

      {mode === 'visual' ? (
        <VisualEditor draft={draft} catalog={catalog} onApply={apply} />
      ) : (
        <div className="cpp-qe-json-body">
          <JsonEditor
            key={jsonKey}
            initialText={committed.query || jsonKey > 0 ? JSON.stringify(draft, null, 2) : param.query}
            invalid={error != null}
            onApply={apply}
            onParseError={onParseError}
          />
          {error ? (
            <div className="cpp-qe-row-message" role="alert">
              <Icon icon="error" size={12} />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      )}
      {error ? (
        <div className="cpp-qe-footnote">
          {mode === 'json'
            ? gt.pgettext('query editor', '列表仍显示上一次的有效结果。切回「可视化」前需要先修好。')
            : gt.pgettext('query editor', '有无效条件，列表仍显示上一次的有效结果。')}
        </div>
      ) : null}

      <Alert
        isOpen={confirmation != null}
        intent="danger"
        icon="warning-sign"
        cancelButtonText={gt.pgettext('query editor', '取消')}
        confirmButtonText={lastConfirmation?.confirmText}
        canEscapeKeyCancel={true}
        canOutsideClickCancel={true}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          confirmation?.action()
          setConfirmation(null)
        }}
      >
        <p>{lastConfirmation?.message}</p>
      </Alert>
    </section>
  )
})
