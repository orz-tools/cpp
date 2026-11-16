import { Alert, IconName, Intent, TextArea } from '@blueprintjs/core'
import { memo, ReactNode, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { gt } from '../pkg/gt'

export interface MessageBoxOptions {
  icon?: IconName
  intent?: Intent
}

interface Box extends MessageBoxOptions {
  id: number
  message: ReactNode
  cancelable: boolean
  /** Set for a prompt: the text field's initial value. */
  defaultValue?: string
  resolve(confirmed: boolean, value: string): void
}

let boxes: Box[] = []
let nextId = 0
let root: ReactDOM.Root | undefined

// A root of its own rather than a component in the app: Cpp's region switch and main's profile check run outside any
// React tree, and the latter before the app is mounted at all.
function render() {
  if (!root) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  }
  root.render(
    <>
      {boxes.map((box) => (
        <MessageBoxView key={box.id} box={box} />
      ))}
    </>,
  )
}

function open(box: Omit<Box, 'id' | 'resolve'>) {
  return new Promise<{ confirmed: boolean; value: string }>((resolve) => {
    boxes = [...boxes, { ...box, id: nextId++, resolve: (confirmed, value) => resolve({ confirmed, value }) }]
    render()
  })
}

function remove(id: number) {
  boxes = boxes.filter((x) => x.id !== id)
  render()
}

export async function showAlert(message: ReactNode, options?: MessageBoxOptions): Promise<void> {
  await open({ ...options, message, cancelable: false })
}

export async function showConfirm(message: ReactNode, options?: MessageBoxOptions): Promise<boolean> {
  return (await open({ ...options, message, cancelable: true })).confirmed
}

/** Resolves to undefined when cancelled. */
export async function showPrompt(message: string, defaultValue = ''): Promise<string | undefined> {
  const { confirmed, value } = await open({ message, cancelable: true, defaultValue })
  return confirmed ? value : undefined
}

const MessageBoxView = memo(({ box }: { box: Box }) => {
  const [isOpen, setIsOpen] = useState(true)
  const [value, setValue] = useState(box.defaultValue ?? '')
  return (
    <Alert
      isOpen={isOpen}
      icon={box.icon}
      intent={box.intent ?? 'primary'}
      confirmButtonText={gt.gettext('确定')}
      cancelButtonText={box.cancelable ? gt.gettext('取消') : undefined}
      canEscapeKeyCancel
      onClose={(confirmed) => {
        setIsOpen(false)
        box.resolve(confirmed, value)
      }}
      onClosed={() => remove(box.id)}
    >
      {/* App.css widens alerts to 80vw, too long a line for a message */}
      <div style={{ whiteSpace: 'pre-line', maxWidth: '30em' }}>{box.message}</div>
      {box.defaultValue != null ? (
        <TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          fill
          rows={6}
          spellCheck={false}
          style={{ marginTop: '10px', fontFamily: 'monospace' }}
        />
      ) : null}
    </Alert>
  )
})
