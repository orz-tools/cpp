import { en } from 'zod/locales'
import { config, int, maximum, minimum } from 'zod/mini'

// zod/mini 自己不带报错文案，解析失败时只说 Invalid input；导入出错时错误框要能指出是哪一项、错在哪里
config(en())

export * as z from 'zod/mini'

export function intBetween(min: number, max: number) {
  return int().check(minimum(min), maximum(max))
}
