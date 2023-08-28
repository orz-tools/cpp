import { atom, createStore, useAtomValue } from 'jotai'
import { PropsWithChildren, createContext, memo, useContext, useState } from 'react'
import useEvent from 'react-use-event-hook'

type ChamberState = { C: React.ComponentType<{ onClose?: (...args: any) => any }>; props: any }

class ChamberValue {
  public store = createStore()
  public chambersAtom = atom(new Map<string, ChamberState>())

  public add = <G,>(
    C: React.ComponentType<G & { onClose?: (...args: any) => any }>,
    props: Partial<G> = {},
    name?: string,
  ) => {
    const key = name || Math.random().toString()
    this.store.set(this.chambersAtom, (x) => {
      const result = new Map(x)
      result.set(key, { C: C as any, props })
      return result
    })
  }
}

function createChamber() {
  return new ChamberValue()
}

const ChamberContext = createContext<ChamberValue | null>(null)

function useChamberContext() {
  const ctx = useContext(ChamberContext)
  if (!ctx) throw new Error('Chamber not found')
  return ctx
}

export function useChamber() {
  const cc = useChamberContext()
  return { add: cc.add }
}

export const Chamber = memo((props: PropsWithChildren) => {
  const [chamber] = useState(createChamber())
  return <ChamberContext.Provider value={chamber}>{props.children}</ChamberContext.Provider>
})

export const ChamberPortal = memo(() => {
  const ctx = useChamberContext()
  const chambers = useAtomValue(ctx.chambersAtom, { store: ctx.store })

  return (
    <>
      {[...chambers.entries()].map(([key, value]) => (
        <ChamberView key={key} name={key} state={value} />
      ))}
    </>
  )
})

const ChamberView = memo(({ name, state }: { name: string; state: ChamberState }) => {
  const ctx = useChamberContext()
  const close = useEvent(() => {
    ctx.store.set(ctx.chambersAtom, (x) => {
      const result = new Map(x)
      result.delete(name)
      return result
    })
  })
  return <state.C {...state.props} onClose={close} />
})
