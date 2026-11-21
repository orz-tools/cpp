// This repository's own lint rules, loaded through jsPlugins in .oxlintrc.json.
import fs from 'fs'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { IconNames } = require('@blueprintjs/icons/lib/cjs/iconNames.js')

/** @type {Map<string, { snake: string, pascal: string }>} */
const iconKeys = new Map()
for (const [key, name] of Object.entries(IconNames)) {
  const keys = iconKeys.get(name) ?? { snake: key, pascal: key }
  if (/[a-z]/.test(key)) keys.pascal = key
  else keys.snake = key
  iconKeys.set(name, keys)
}

/**
 * The icons src/icons.ts bundles, by the pixel grid Blueprint draws them on: an entry `[IconNames.X, Paths20.X]`
 * bundles X for 20.
 * @param {string} source
 */
export function readBundledIcons(source) {
  const bundled = { 16: new Set(), 20: new Set() }
  for (const [, key, grid] of source.matchAll(/\[IconNames\.(\w+),\s*Paths(16|20)\.\w+\]/g)) {
    if (IconNames[key]) bundled[grid].add(IconNames[key])
  }
  return bundled
}

const iconProps = new Set(['icon', 'leftIcon', 'rightIcon', 'endIcon'])

// Blueprint picks the 20px paths for an icon drawn at 20px or more, which these props always are.
// NoPlanState (src/components/NoPlan.tsx) hands its icon to a NonIdealState
const largeIconElements = new Set(['NonIdealState', 'Alert', 'Drawer', 'NoPlanState'])

// MessageBox.tsx hands their options' icon to an Alert
const messageBoxCalls = new Set(['showAlert', 'showConfirm'])

function attribute(element, name) {
  return element.attributes.find((x) => x.type === 'JSXAttribute' && x.name.name === name)
}

function iconSize(element) {
  const value = attribute(element, 'size')?.value
  const expr = value?.type === 'JSXExpressionContainer' ? value.expression : value
  if (expr?.type === 'Literal' && typeof expr.value === 'number') return expr.value
  if (expr?.type === 'MemberExpression' && expr.object.name === 'IconSize' && expr.property.name === 'LARGE') return 20
  return 16
}

function isLargeTagInput(element) {
  const large = attribute(element, 'large')
  if (large && (large.value == null || large.value.expression?.value === true)) return true
  return attribute(element, 'size')?.value?.value === 'large'
}

/** The pixel grid Blueprint draws an element's icon prop on */
function gridOfProp(element, prop) {
  const name = element.name.type === 'JSXIdentifier' ? element.name.name : undefined
  if (largeIconElements.has(name)) return prop === 'icon' ? 20 : 16
  if (name === 'Icon') return iconSize(element) >= 20 ? 20 : 16
  if (name === 'TagInput') return prop === 'leftIcon' && isLargeTagInput(element) ? 20 : 16
  return 16
}

/** The icon names an expression can evaluate to, with the node that spells each */
function* iconsIn(node) {
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string' && iconKeys.has(node.value)) yield [node, node.value]
      break
    case 'TemplateLiteral':
      if (node.expressions.length === 0 && iconKeys.has(node.quasis[0].value.cooked))
        yield [node, node.quasis[0].value.cooked]
      break
    case 'MemberExpression':
      if (!node.computed && node.object.type === 'Identifier' && node.object.name === 'IconNames') {
        if (IconNames[node.property.name]) yield [node, IconNames[node.property.name]]
      } else {
        // `({ a: 'tick', b: 'cross' } as const)[key]`
        yield* iconsIn(node.object)
      }
      break
    case 'ConditionalExpression':
      yield* iconsIn(node.consequent)
      yield* iconsIn(node.alternate)
      break
    case 'LogicalExpression':
      yield* iconsIn(node.left)
      yield* iconsIn(node.right)
      break
    case 'ObjectExpression':
      for (const p of node.properties) if (p.type === 'Property') yield* iconsIn(p.value)
      break
    case 'ArrayExpression':
      for (const e of node.elements) if (e) yield* iconsIn(e)
      break
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'ParenthesizedExpression':
      yield* iconsIn(node.expression)
      break
  }
}

function mentionsIconName(type) {
  if (type == null || typeof type !== 'object') return false
  if (type.type === 'TSTypeReference') {
    const name = type.typeName.type === 'TSQualifiedName' ? type.typeName.right.name : type.typeName.name
    if (name === 'IconName') return true
  }
  for (const key in type) {
    if (key === 'parent') continue
    const child = type[key]
    if (Array.isArray(child) ? child.some(mentionsIconName) : child?.type && mentionsIconName(child)) return true
  }
  return false
}

/** @param {() => { 16: Set<string>, 20: Set<string> }} getBundled */
export function bundledIconRule(getBundled) {
  return {
    meta: {
      type: 'problem',
      docs: { description: 'Require every Blueprint icon the app names to be bundled in src/icons.ts' },
    },
    create(context) {
      const bundled = getBundled()
      const checked = new Set()
      function check(node, grid) {
        for (const [spelling, name] of iconsIn(node)) {
          if (checked.has(spelling)) continue
          checked.add(spelling)
          if (bundled[grid].has(name)) continue
          const { snake, pascal } = iconKeys.get(name)
          context.report({
            node: spelling,
            message:
              `Icon '${name}' is drawn at ${grid}px here, but src/icons.ts bundles no ${grid}px paths for it, ` +
              `so it shows blank and toasts "missing icon": add [IconNames.${snake}, Paths${grid}.${pascal}]`,
          })
        }
      }
      return {
        JSXAttribute(node) {
          if (node.name.type !== 'JSXIdentifier' || !iconProps.has(node.name.name) || node.value == null) return
          const value = node.value.type === 'JSXExpressionContainer' ? node.value.expression : node.value
          check(value, gridOfProp(node.parent, node.name.name))
        },
        Property(node) {
          if (node.computed || node.parent.type !== 'ObjectExpression') return
          const key = node.key.type === 'Identifier' ? node.key.name : node.key.value
          if (!iconProps.has(key)) return
          const call = node.parent.parent
          const large =
            call.type === 'CallExpression' && call.arguments[1] === node.parent && messageBoxCalls.has(call.callee.name)
          check(node.value, large ? 20 : 16)
        },
        VariableDeclarator(node) {
          if (node.init && mentionsIconName(node.id.typeAnnotation)) check(node.init, 16)
        },
        TSAsExpression(node) {
          if (mentionsIconName(node.typeAnnotation)) check(node.expression, 16)
        },
        TSSatisfiesExpression(node) {
          if (mentionsIconName(node.typeAnnotation)) check(node.expression, 16)
        },
      }
    },
  }
}

const iconsPath = new URL('../src/icons.ts', import.meta.url)

export default {
  meta: { name: 'cpp' },
  rules: {
    // Read on every file rather than once, so that a long-running editor session sees entries added since it started
    'bundled-icon': bundledIconRule(() => readBundledIcons(fs.readFileSync(iconsPath, 'utf8'))),
  },
}
