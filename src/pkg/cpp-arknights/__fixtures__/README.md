# 物品价值验收数据

`itemValue.acceptance.test.ts` 用这两份文件离线运行价值计算，并与明日方舟一图流的结果比较。

## `yituliu-acceptance.json`

- 来源：明日方舟一图流 <https://ark.yituliu.cn/material/value>，采集于 2026-11-16T04:41:09Z（国服）。
- 授权：明日方舟一图流的数据采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可，这里仅用作测试数据。
- 内容：各配置 case 的选项与一图流导出的物品价值表；`inputs.penguinMatrix` 是一图流处理后的企鹅物流掉落矩阵副本，不是企鹅物流的原始数据。
- 只含输入、配置和输出数值，不含一图流的算法。

由审查后的采集文件裁剪而来：保留 `capturedAt`、`source`、`server`、掉落矩阵（元数据与 `body.matrix`）、`items` 和 `cases`（`name`、`options`、`values`、`observed`）；去掉一图流的关卡表、配置界面目录和操作步骤，以及矩阵中 `end` 早于 `capturedAt` 的行。紧凑格式，无缩进。

重新生成：取得新的审查后采集文件，按上面的规则重新裁剪。

## `arknights-game-inputs.zh_CN.json`

- 来源：[Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 经 cpp-data 发布的国服游戏数据，版本见文件中的 `gameDataVersion`（当前为 `6f63c14e27b847ef74b53b00fe51fc322b3cd7ff`）。
- 内容：`exportItemValueGameInputs()` 的输出，只从游戏数据导出，与掉落矩阵和配置无关。

重新生成：`pnpm dev`，以国服打开 `/arknights`，在控制台执行 `copy(JSON.stringify($ga.exportItemValueGameInputs()))`，覆盖本文件。游戏数据版本变化后，两份文件的采集时间不再一致，偏差报告会随之变化。
