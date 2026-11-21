import fs from 'fs'
import { RuleTester } from 'oxlint/plugins-dev'
import { describe, expect, it } from 'vitest'
import { bundledIconRule, readBundledIcons } from './oxlint-plugin.js'

RuleTester.describe = describe
RuleTester.it = it

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: 'tsx' } } })

const rule = bundledIconRule(() => ({
  16: new Set(['search', 'flag', 'tick', 'chevron-down']),
  20: new Set(['flag']),
}))

const missing = (name, grid) => ({ message: new RegExp(`^Icon '${name}' is drawn at ${grid}px here`) })

tester.run('bundled-icon', rule, {
  valid: [
    '<Button icon="search" />',
    '<NonIdealState icon="flag" />',
    '<NonIdealState icon={<Spinner />} />',
    '<NoPlanState icon="flag" />',
    '<Icon icon="search" size={12} />',
    '<Icon icon="flag" size={20} />',
    '<TagInput leftIcon="search" />',
    // Not a Blueprint icon name, so not an icon prop of Blueprint's
    '<Foo icon="not-an-icon" />',
    'toaster.show({ icon: "tick" })',
    'showAlert(message, { icon: "flag" })',
    // Nothing says these are icons
    'const words = { a: "cog" }',
    'const kind = "cog"',
  ],
  invalid: [
    {
      code: '<NonIdealState icon="search" />',
      errors: [
        {
          message:
            `Icon 'search' is drawn at 20px here, but src/icons.ts bundles no 20px paths for it, ` +
            `so it shows blank and toasts "missing icon": add [IconNames.SEARCH, Paths20.Search]`,
        },
      ],
    },
    { code: '<Button icon="cog" />', errors: [missing('cog', 16)] },
    {
      code: '<Button endIcon="caret-down" rightIcon="cog" />',
      errors: [missing('caret-down', 16), missing('cog', 16)],
    },
    { code: '<InputGroup leftIcon={"cog"} />', errors: [missing('cog', 16)] },
    { code: '<Button icon={IconNames.COG} />', errors: [missing('cog', 16)] },
    { code: '<Button icon={open ? "chevron-down" : "chevron-right"} />', errors: [missing('chevron-right', 16)] },
    { code: '<Alert icon="search" />', errors: [missing('search', 20)] },
    { code: '<Drawer icon="search" />', errors: [missing('search', 20)] },
    // NoPlan.tsx draws it in a NonIdealState
    { code: '<NoPlanState icon="search" />', errors: [missing('search', 20)] },
    { code: '<Icon icon="search" size={40} />', errors: [missing('search', 20)] },
    { code: '<Icon icon="search" size={IconSize.LARGE} />', errors: [missing('search', 20)] },
    { code: '<TagInput large leftIcon="search" />', errors: [missing('search', 20)] },
    { code: '<TagInput size="large" leftIcon="search" />', errors: [missing('search', 20)] },
    { code: 'toaster.show({ icon: "cog" })', errors: [missing('cog', 16)] },
    { code: 'const panel = { id: "x", icon: "cog" }', errors: [missing('cog', 16)] },
    // MessageBox.tsx draws these in an Alert
    { code: 'showConfirm(message, { icon: "search", intent: "danger" })', errors: [missing('search', 20)] },
    { code: 'const icons: Record<Kind, IconName> = { a: "tick", b: "cog" }', errors: [missing('cog', 16)] },
    {
      code: 'const icons = { a: "tick", b: "cog", c: <span /> } satisfies Record<Kind, IconName | MaybeElement>',
      errors: [missing('cog', 16)],
    },
    {
      code: 'const icon: IconName | null = hide ? ({ a: "cog" } as const)[k] : null',
      errors: [missing('cog', 16)],
    },
    // Reported once, at the size of the prop it lands in
    { code: '<NonIdealState icon={"search" as IconName} />', errors: [missing('search', 20)] },
  ],
})

describe('readBundledIcons', () => {
  it('reads the entries by the paths they take', () => {
    const bundled = readBundledIcons(`
      [IconSize.STANDARD, new Map([[IconNames.ADD, Paths16.Add], [IconNames.TH_DERIVED, Paths16.ThDerived]])],
      [IconSize.LARGE, new Map([[IconNames.ERROR, Paths20.Error]])],
    `)
    expect(bundled).toEqual({ 16: new Set(['add', 'th-derived']), 20: new Set(['error']) })
  })

  it('reads every entry of src/icons.ts', () => {
    const source = fs.readFileSync(new URL('../src/icons.ts', import.meta.url), 'utf8')
    const bundled = readBundledIcons(source)
    expect(bundled[16].size).toBe(source.match(/Paths16\./g).length)
    expect(bundled[20].size).toBe(source.match(/Paths20\./g).length)
  })
})
