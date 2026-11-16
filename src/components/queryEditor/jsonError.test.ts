import { describe, expect, it } from 'vitest'
import { locateJsonError } from './jsonError'

describe('locateJsonError', () => {
  const text = '{\n  "a": 1\n  "b": 2\n}'

  it('reads Firefox line and column', () => {
    expect(
      locateJsonError(
        text,
        'JSON.parse: expected , or } after property value in object at line 3 column 3 of the JSON data',
      ),
    ).toEqual({ line: 3, column: 3 })
  })

  it('converts a Chrome offset to line and column', () => {
    let message = ''
    try {
      JSON.parse(text)
    } catch (e) {
      message = (e as Error).message
    }
    // node 与 Chrome 同为 V8；新版消息里已带行列，旧版只有 position
    expect(locateJsonError(text, message)).toEqual({ line: 3, column: 3 })
    expect(locateJsonError(text, "Expected ',' or '}' after property value in JSON at position 13")).toEqual({
      line: 3,
      column: 3,
    })
  })

  it('gives up on other messages', () => {
    expect(locateJsonError(text, 'Unexpected end of JSON input')).toBeUndefined()
  })
})
