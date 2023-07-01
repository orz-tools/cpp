import { Alignment, Button, Classes, Menu, MenuItem, Navbar, NumericInput } from '@blueprintjs/core'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import useEvent from 'react-use-event-hook'
import { useAtoms, useGameAdapter, useStore } from '../Cpp'
import { useComponents } from '../hooks/useComponents'
import { IGame, IItem } from '../pkg/cpp-basic'
import { CachedImg } from './Icons'
import { Popover2 } from '@blueprintjs/popover2'
import { ItemImportButton } from './arknights/ItemList'
import { SyncButton } from './ItemList'

const formatter = (q: number) => q.toFixed(0)
const parser = (q: string) => Math.floor(parseFloat(q) || 0)
export function ItemQuantityEditor<G extends IGame>({
  item,
  style,
  itemQuantities,
  setItemQuantity,
  focus,
}: {
  item: IItem
  style?: React.CSSProperties
  itemQuantities: Record<string, number>
  setItemQuantity?: (itemId: string, value: number) => any
  focus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const spanRef = useRef<HTMLSpanElement>(null)
  const ga = useGameAdapter<G>()
  const quantity = itemQuantities[item.key] || 0
  const [input, setInput] = useState(formatter(quantity))
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (spanRef.current) {
      setWidth(spanRef.current.clientWidth + 20 || 0)
    }
  }, [input])
  useEffect(() => setInput(formatter(quantity)), [quantity])
  useEffect(() => {
    if (ref.current && focus) {
      ref.current.focus()
      ref.current.select()
    }
  }, [focus])

  if (Object.prototype.hasOwnProperty.call(ga.getExpItems(), item.key)) {
    return <NumericInput value={input} style={style} disabled={true} />
  }
  return (
    <>
      <span ref={spanRef} style={{ opacity: 0, position: 'fixed', left: -100000, top: -100000 }}>
        {input}
      </span>
      <NumericInput
        buttonPosition="none"
        inputRef={ref}
        readOnly={!setItemQuantity}
        value={input}
        style={{ ...(style || {}), width: Math.max(width, 30) }}
        min={0}
        onValueChange={(_, valueAsString) => setInput(valueAsString)}
        onBlur={() => {
          if (input === formatter(quantity)) return
          if (setItemQuantity) {
            setItemQuantity(item.key, parser(input))
          }
        }}
        onButtonClick={(_, valueAsString) => {
          if (setItemQuantity) {
            setItemQuantity(item.key, parser(valueAsString))
          }
        }}
      />
    </>
  )
}

export function ItemSimulatedView({
  page,
  itemQuantities,
  setItemQuantity,
  showAll,
}: {
  page: string
  itemQuantities: Record<string, number>
  setItemQuantity?: (itemId: string, value: number) => any
  showAll?: boolean
}) {
  const { itemSimulatedViewConfig } = useComponents()
  const ga = useGameAdapter()
  const items = useMemo(() => ga.getInventoryItems(page), [ga, page])
  const config = itemSimulatedViewConfig || { limit: 3, horizontal: true, viewMaxSize: 500 }
  const [focus, setFocus] = useState(undefined as string | undefined)
  const createNewItem = useEvent((itemId: string) => {
    if (!setItemQuantity) return
    setItemQuantity(itemId, 1)
    setFocus(itemId)
  })

  const availableItems = useMemo(() => items.filter((x) => itemQuantities[x.key] > 0), [items, itemQuantities])
  const count = (showAll ? items : availableItems).length
  let i = -1
  let gap: IItem[] = []
  return (
    <div
      onDragStart={(e) => e.preventDefault()}
      className={['cpp-isv', config.horizontal ? 'cpp-isv-horizontal' : 'cpp-isv-vertical'].join(' ')}
      style={{
        overflowX: config.horizontal ? 'scroll' : 'hidden',
        overflowY: config.horizontal ? 'hidden' : 'scroll',
        [config.horizontal ? 'height' : 'width']: `${config.viewMaxSize}px`,
        [config.horizontal
          ? 'gridTemplateRows'
          : 'gridTemplateColumns']: `repeat(${config.limit}, minmax(32px, 1fr) 10fr) minmax(32px, 1fr)`,
        [config.horizontal ? 'gridTemplateColumns' : 'gridTemplateRows']: `repeat(${Math.ceil(
          count / config.limit,
        )}, minmax(32px, 1fr) 10fr) minmax(32px, 1fr) minmax(min-content, 100%)`,
      }}
    >
      {items.map((item) => {
        if (!showAll && !(itemQuantities[item.key] > 0)) {
          gap.push(item)
          return
        }
        i++
        const x = i % config.limit
        const y = Math.floor(i / config.limit)
        const gappy = gap
        gap = []
        return [
          gappy.length > 0 && x === 0 && y > 0 ? (
            <Gap
              createNewItem={createNewItem}
              items={gappy}
              key={`gap-${config.limit}-${y - 1}`}
              style={{
                [config.horizontal ? 'gridRowStart' : 'gridColumnStart']: config.limit * 2 + 2 - 1,
                [config.horizontal ? 'gridRowEnd' : 'gridColumnEnd']: config.limit * 2 + 3 - 1,
                [config.horizontal ? 'gridColumnStart' : 'gridRowStart']: (y - 1) * 2 + 2,
                [config.horizontal ? 'gridColumnEnd' : 'gridRowEnd']: (y - 1) * 2 + 3,
              }}
            />
          ) : null,
          gappy.length > 0 ? (
            <Gap
              createNewItem={createNewItem}
              items={gappy}
              key={`gap-${x}-${y}`}
              style={{
                [config.horizontal ? 'gridRowStart' : 'gridColumnStart']: x * 2 + 2 - 1,
                [config.horizontal ? 'gridRowEnd' : 'gridColumnEnd']: x * 2 + 3 - 1,
                [config.horizontal ? 'gridColumnStart' : 'gridRowStart']: y * 2 + 2,
                [config.horizontal ? 'gridColumnEnd' : 'gridRowEnd']: y * 2 + 3,
              }}
            />
          ) : null,
          <div
            className="cpp-isv-item"
            key={item.key}
            style={{
              [config.horizontal ? 'gridRowStart' : 'gridColumnStart']: x * 2 + 2,
              [config.horizontal ? 'gridRowEnd' : 'gridColumnEnd']: x * 2 + 3,
              [config.horizontal ? 'gridColumnStart' : 'gridRowStart']: y * 2 + 2,
              [config.horizontal ? 'gridColumnEnd' : 'gridRowEnd']: y * 2 + 3,
            }}
          >
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
            <div style={{ width: '100%', height: '100%' }}>
              <ItemView
                key={item.key}
                item={item}
                itemQuantities={itemQuantities}
                setItemQuantity={setItemQuantity}
                focus={item.key === focus}
              />
            </div>
          </div>,
        ]
      })}
      {(function () {
        const gappy = gap
        if (gap.length <= 0) return null
        i++
        let x = i % config.limit
        let y = Math.floor(i / config.limit)
        if (y > 0 && x === 0) {
          x = config.limit
          y--
        }
        return (
          <Gap
            createNewItem={createNewItem}
            items={gappy}
            key={`gap-${x}-${y}`}
            style={{
              [config.horizontal ? 'gridRowStart' : 'gridColumnStart']: x * 2 + 2 - 1,
              [config.horizontal ? 'gridRowEnd' : 'gridColumnEnd']: x * 2 + 3 - 1,
              [config.horizontal ? 'gridColumnStart' : 'gridRowStart']: y * 2 + 2,
              [config.horizontal ? 'gridColumnEnd' : 'gridRowEnd']: y * 2 + 3,
            }}
          />
        )
      })()}
    </div>
  )
}

function Gap({
  items,
  style,
  createNewItem,
}: {
  items: IItem[]
  style?: React.CSSProperties
  createNewItem: (itemId: string) => any
}) {
  return (
    <div className="cpp-isv-gap" style={style}>
      <Popover2
        position="bottom-left"
        usePortal={true}
        content={
          <Menu style={{ overflow: 'auto', maxHeight: '20em' }}>
            {items.map((x) => (
              <MenuItem
                key={x.key}
                icon={<CachedImg src={x.icon} width={'20'} height={'20'} alt={x.key} title={x.key} />}
                text={x.name}
                onClick={() => createNewItem(x.key)}
              />
            ))}
          </Menu>
        }
      >
        <Button minimal tabIndex={-1} icon={'add'} />
      </Popover2>
    </div>
  )
}

function ItemView({
  itemQuantities,
  setItemQuantity,
  item,
  focus,
}: {
  itemQuantities: Record<string, number>
  setItemQuantity?: (itemId: string, value: number) => any
  item: IItem
  focus?: boolean
}) {
  return (
    <div className="cpp-isviv">
      <CachedImg
        src={item.icon}
        width={'100%'}
        height={'100%'}
        alt={item.key}
        title={item.name}
        className="cpp-item-icon"
      />
      <div className="cpp-isviv-label-wrapper">
        <ItemQuantityEditor
          item={item}
          itemQuantities={itemQuantities}
          setItemQuantity={setItemQuantity}
          focus={focus}
        />
      </div>
    </div>
  )
}

export function InventorySyncer() {
  const store = useStore()
  const atoms = useAtoms()
  const itemQuantities = useAtomValue(atoms.itemQuantities)
  const setItemQuantity = useEvent((itemId: string, value: number) => {
    store.set(atoms.itemQuantity(itemId), value)
  })
  const [showAll, setShowAll] = useState(false)
  const ga = useGameAdapter()
  const pages = ga.getInventoryPages()
  const page = Object.keys(pages)[0]
  const title = pages[page]
  return (
    <section className={Classes.ELEVATION_1}>
      <Navbar>
        <Navbar.Group align={Alignment.LEFT}>{title}</Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button minimal active={!showAll} icon="eye-off" onClick={() => setShowAll(!showAll)} title={'显示全部'} />
        </Navbar.Group>
      </Navbar>
      <ItemSimulatedView
        itemQuantities={itemQuantities}
        setItemQuantity={setItemQuantity}
        page={page}
        showAll={showAll}
      />
    </section>
  )
}
