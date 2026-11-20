/*
 * 网站的二维码是定死的，不在运行时编码，也就不加编码的依赖。网址改了要重新生成：
 *
 *   nix shell --inputs-from path:$PWD/.nix nixpkgs#qrencode --command \
 *     qrencode -l M -m 0 -t ASCII 'https://cpp.orz.tools'
 *
 * 纠错级别 M，版本 2（25×25）。输出每行 50 个字符，每两个字符并成一格，「##」是深色。
 */

export const SITE_URL = 'https://cpp.orz.tools'

export const SITE_QR: readonly string[] = [
  '#######  #####  # #######',
  '#     #  #   ###  #     #',
  '# ### # ##    ### # ### #',
  '# ### # #  ###### # ### #',
  '# ### # # ## #  # # ### #',
  '#     # ###  ###  #     #',
  '####### # # # # # #######',
  '        # # # # #        ',
  '# #####  #  ###   #####  ',
  '       #  # ##   # #   # ',
  ' #  # ### ### ##  #### ##',
  '#    # ##  ##     #     #',
  '#  #  #### #### ### # ###',
  '#    # ## #   # ## # # # ',
  '# # # ## # ### #  #### ##',
  '# ###     ##  #   ###   #',
  '# # #### # #   ###### #  ',
  '        ##  ##  #   ##   ',
  '#######      ## # # # ###',
  '#     # # # ##  #   ## ##',
  '# ### # ### # ####### ###',
  '# ### # # #     # # #####',
  '# ### # ## ##   #    ## #',
  '#     #  # #  #### ###  #',
  '####### # ##       ######',
]

function num(n: number): string {
  return String(Math.round(n * 1000) / 1000)
}

/** 一行里连着的深色格并成一个矩形，整张拼成一条 path 的 d；module 是一格的边长 */
export function qrPath(rows: readonly string[], module: number): string {
  const parts: string[] = []
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== '#') continue
      let end = x
      while (end < row.length && row[end] === '#') end++
      const w = (end - x) * module
      parts.push(`M${num(x * module)} ${num(y * module)}h${num(w)}v${num(module)}h${num(-w)}z`)
      x = end
    }
  })
  return parts.join('')
}
