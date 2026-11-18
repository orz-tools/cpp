/**
 * 合成按钮的档位，从大到小：24、12、6、3、1 里不超过「够做几次」的，再加上「够做几次」本身（有心情消耗时最多加到 24）。
 * maxTimes 为 0 时是 [1]，画成灰的
 */
export function synthesisTimes(maxTimes: number, apCost: number | undefined): number[] {
  const times = [24, 12, 6, 3, 1]
  if (maxTimes <= 0) return [1]
  while (times[0] > maxTimes) times.shift()
  if (times[0] !== maxTimes && ((apCost && maxTimes < 24) || !apCost)) times.unshift(maxTimes)
  return times
}
