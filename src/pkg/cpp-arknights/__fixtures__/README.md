# 测试数据

`itemValue.acceptance.test.ts` 用 `yituliu-acceptance.json` 和 `arknights-game-inputs.zh_CN.json` 离线运行价值计算，并与明日方舟一图流的结果比较；`moduleMissions.test.ts` 用 `module-missions.zh_CN.json`；`details.test.ts`、`richText.test.ts` 用 `details-quercus.json`；`specialOperators.test.ts` 用 `special-operators.json`。

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

## `module-missions.zh_CN.json`

- 来源：[Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 经 cpp-data 发布的国服游戏数据 `arknights-kengxxiao-zh_CN.json`（schema 4，带模组任务、干员位置和敌人等级），版本见文件中的 `version`（当前为 `7e560050b03c34661db1d322d008733072352b2a`）。
- 内容：下面十关上绑定任务所属的模组，各带两条任务（`exUniEquips.missionList`）和 `equipDict` 项；这些模组的干员（阿米娅带上 `exPatchCharacters.patchChars` 的近卫、医疗形态）的 `name`、`profession`、`rarity`、`position`；任务里提到的敌人和技能；这十关的 `code`、`name`、`apCost`。键名和发布的数据相同，紧凑格式。
- 关卡：`main_03-08`、`main_04-02`、`main_04-03`、`main_04-06`、`sub_02-03`、`main_02-04`、`main_07-06`、`main_03-04`、`main_11-02`、`main_02-10`。

重新生成：取得 schema 4 以上的 `arknights-kengxxiao-zh_CN.json`（cpp-data 的 `files/` 下，或本地跑 cpp-data-worker 的 `arknights-kengxxiao-zh_CN` 任务生成），执行 `node scripts/extract-module-mission-fixture.js <arknights-kengxxiao-zh_CN.json>`，覆盖本文件。游戏数据更新后任务的数量和分法可能变化，测试里的期望值要随之核对。

## `details-quercus.json`

- 来源：cpp-data-worker 的 `arknights-kengxxiao-details-zh_CN`，由 [Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData) 生成，版本见文件中的 `version`。
- 内容：`data` 里只留夏栎的两个技能（`skchr_quercu_1`、`skchr_quercu_2`）、模组 `uniequip_002_quercu` 和术语 `ba.protect`，结构和完整文件相同。`details.test.ts`、`richText.test.ts` 用它。

重新生成：在 cpp-data-worker 里跑 `arknights-kengxxiao-details-zh_CN`，从 `files/arknights-kengxxiao-details-zh_CN.json` 按上面的键截出。紧凑格式，无缩进。

## `special-operators.json`

- 来源：[Kengxxiao/ArknightsGameData](https://github.com/Kengxxiao/ArknightsGameData)（国服）和 [ArknightsAssets/ArknightsGamedata](https://github.com/ArknightsAssets/ArknightsGamedata)（美、日、韩服）经 cpp-data 发布的 `arknights-kengxxiao-<lang>.json`（schema 8，带特殊干员的解锁任务），各区服的版本见文件中的 `version`。
- 内容：四个区服的 `exSpecialOperators`，原样不裁剪，键名是区服（`zh_CN`、`en_US`、`ja_JP`、`ko_KR`）。国服有电弧、机械师，其余三个区服只有电弧。紧凑格式。

重新生成：取得四个区服 schema 8 以上的 `arknights-kengxxiao-<lang>.json`（cpp-data 的 `files/` 下，或本地跑 cpp-data-worker 的四个 `arknights-kengxxiao-<lang>` 任务生成），执行 `node scripts/extract-special-operator-fixture.js <zh_CN.json> <en_US.json> <ja_JP.json> <ko_KR.json>`，覆盖本文件。游戏数据更新后节点、任务和精通可能变化，测试里的期望值要随之核对。
