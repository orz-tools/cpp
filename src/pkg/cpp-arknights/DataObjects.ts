import { CppData_ArknightsKengxxiaoEnUs } from '../cpp-data-schemas/arknights-kengxxiao-en_US'
import { CppData_ArknightsKengxxiaoZhCn } from '../cpp-data-schemas/arknights-kengxxiao-zh_CN'
import { CONTAINER_TYPE, CONTAINER_VERSION, CppRepoObject, DataContainerObject, IDataContainer } from '../dccache'
import { PenguinMatrix } from './sources/penguinTypes'
import { YituliuValue } from './sources/yituliuTypes'

export class ArknightsKengxxiaoObject extends CppRepoObject<
  CppData_ArknightsKengxxiaoZhCn | CppData_ArknightsKengxxiaoEnUs
> {
  public requiredSchema = 2

  public constructor(public readonly lang: 'en_US' | 'zh_CN') {
    super(`arknights-kengxxiao-${lang}`)
  }
}

export class ArknightsYituliuObject extends DataContainerObject<YituliuValue[]> {
  public autoUpdateNotificationThreshold = 86400_000 * 3

  public readonly name: string = 'arknights-yituliu'

  public getData(): Promise<IDataContainer<YituliuValue[]>> {
    return Promise.reject(new Error('ArknightsYituliuObject.getData is useless.'))
  }

  public async getHeader(force?: boolean | undefined): Promise<IDataContainer<YituliuValue[]>> {
    let res: Response
    try {
      res = await fetch('https://backend.yituliu.site/item/export/json')
      if (!res.ok) {
        throw new Error(`Failed to fetch yituliu: ${res.status} ${res.statusText}`)
      }
    } catch (e) {
      console.error('yituliu failed', e, force)
      return this.loadFallbackData()
    }

    const now = new Date()
    let data = await res.json()
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch (e) {
        console.error('fuck', data)
      }
    }
    if (!data || !Array.isArray(data)) {
      console.error('fuck', data)
      data = []
    }
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 0,
        sources: ['https://yituliu.site/'],
        timestamp: now.getTime(),
      },
      data: data as YituliuValue[],
    }
  }

  private loadFallbackData() {
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: '2023-12-25T10:37:30.768Z',
        text: '2023-12-25T10:37:30.768Z',
        schema: 0,
        sources: ['https://yituliu.site/'],
        timestamp: 1703500650768,
      },
      data: [
        {
          itemId: '7003',
          itemName: '寻访凭证',
          itemValue: 562.5,
          itemValueAp: 450,
          rarity: 5,
        },
        {
          itemId: '30145',
          itemName: '晶体电子单元',
          itemValue: 401.755531,
          itemValueAp: 321.404425,
          rarity: 5,
        },
        {
          itemId: '30155',
          itemName: '烧结核凝晶',
          itemValue: 370.962816,
          itemValueAp: 296.770253,
          rarity: 5,
        },
        {
          itemId: '30135',
          itemName: 'D32钢',
          itemValue: 329.991809,
          itemValueAp: 263.993447,
          rarity: 5,
        },
        {
          itemId: '30115',
          itemName: '聚合剂',
          itemValue: 321.048059,
          itemValueAp: 256.838447,
          rarity: 5,
        },
        {
          itemId: '30125',
          itemName: '双极纳米片',
          itemValue: 298.857516,
          itemValueAp: 239.086013,
          rarity: 5,
        },
        {
          itemId: '3223',
          itemName: '近卫双芯片',
          itemValue: 253.924,
          itemValueAp: 203.1392,
          rarity: 5,
        },
        {
          itemId: '3233',
          itemName: '重装双芯片',
          itemValue: 253.924,
          itemValueAp: 203.1392,
          rarity: 5,
        },
        {
          itemId: '3273',
          itemName: '辅助双芯片',
          itemValue: 239.62,
          itemValueAp: 191.696,
          rarity: 5,
        },
        {
          itemId: '3213',
          itemName: '先锋双芯片',
          itemValue: 239.62,
          itemValueAp: 191.696,
          rarity: 5,
        },
        {
          itemId: '3243',
          itemName: '狙击双芯片',
          itemValue: 239.62,
          itemValueAp: 191.696,
          rarity: 5,
        },
        {
          itemId: '3253',
          itemName: '术师双芯片',
          itemValue: 239.62,
          itemValueAp: 191.696,
          rarity: 5,
        },
        {
          itemId: '3263',
          itemName: '医疗双芯片',
          itemValue: 225.31,
          itemValueAp: 180.248,
          rarity: 5,
        },
        {
          itemId: '3283',
          itemName: '特种双芯片',
          itemValue: 225.31,
          itemValueAp: 180.248,
          rarity: 5,
        },
        {
          itemId: 'mod_unlock_token',
          itemName: '模组数据块',
          itemValue: 204,
          itemValueAp: 163.2,
          rarity: 5,
        },
        {
          itemId: '4002',
          itemName: '至纯源石',
          itemValue: 168.75,
          itemValueAp: 135,
          rarity: 4,
        },
        {
          itemId: '32001',
          itemName: '芯片助剂',
          itemValue: 152.99,
          itemValueAp: 122.392,
          rarity: 4,
        },
        {
          itemId: '30044',
          itemName: '异铁块',
          itemValue: 135.431658,
          itemValueAp: 108.345327,
          rarity: 4,
        },
        {
          itemId: 'charm_coin_4',
          itemName: '翡翠庭院至臻',
          itemValue: 125,
          itemValueAp: 100,
          rarity: 5,
        },
        {
          itemId: '30054',
          itemName: '酮阵列',
          itemValue: 124.683181,
          itemValueAp: 99.746545,
          rarity: 4,
        },
        {
          itemId: '30064',
          itemName: '改量装置',
          itemValue: 122.670126,
          itemValueAp: 98.136101,
          rarity: 4,
        },
        {
          itemId: '31084',
          itemName: '环烃预制体',
          itemValue: 122.509043,
          itemValueAp: 98.007234,
          rarity: 4,
        },
        {
          itemId: '30104',
          itemName: 'RMA70-24',
          itemValue: 119.097553,
          itemValueAp: 95.278042,
          rarity: 4,
        },
        {
          itemId: '30084',
          itemName: '三水锰矿',
          itemValue: 117.690564,
          itemValueAp: 94.152451,
          rarity: 4,
        },
        {
          itemId: '30024',
          itemName: '糖聚块',
          itemValue: 117.178351,
          itemValueAp: 93.742681,
          rarity: 4,
        },
        {
          itemId: '30034',
          itemName: '聚酸酯块',
          itemValue: 113.696374,
          itemValueAp: 90.957099,
          rarity: 4,
        },
        {
          itemId: '30094',
          itemName: '五水研磨石',
          itemValue: 113.26592,
          itemValueAp: 90.612736,
          rarity: 4,
        },
        {
          itemId: '31074',
          itemName: '固化纤维板',
          itemValue: 112.706335,
          itemValueAp: 90.165068,
          rarity: 4,
        },
        {
          itemId: '31024',
          itemName: '炽合金块',
          itemValue: 111.731708,
          itemValueAp: 89.385367,
          rarity: 4,
        },
        {
          itemId: '31034',
          itemName: '晶体电路',
          itemValue: 111.269781,
          itemValueAp: 89.015825,
          rarity: 4,
        },
        {
          itemId: '31064',
          itemName: '转质盐聚块',
          itemValue: 100.726334,
          itemValueAp: 80.581067,
          rarity: 4,
        },
        {
          itemId: '31014',
          itemName: '聚合凝胶',
          itemValue: 99.408134,
          itemValueAp: 79.526507,
          rarity: 4,
        },
        {
          itemId: '31044',
          itemName: '精炼溶剂',
          itemValue: 99.118341,
          itemValueAp: 79.294673,
          rarity: 4,
        },
        {
          itemId: '30074',
          itemName: '白马醇',
          itemValue: 98.124809,
          itemValueAp: 78.499847,
          rarity: 4,
        },
        {
          itemId: '31054',
          itemName: '切削原液',
          itemValue: 92.062027,
          itemValueAp: 73.649622,
          rarity: 4,
        },
        {
          itemId: '4004',
          itemName: '高级凭证 ',
          itemValue: 82.848825,
          itemValueAp: 66.27906,
          rarity: 5,
        },
        {
          itemId: '30014',
          itemName: '提纯源岩',
          itemValue: 80.995447,
          itemValueAp: 64.796357,
          rarity: 4,
        },
        {
          itemId: 'trap_oxygen_3',
          itemName: '沙兹专业镀膜装置',
          itemValue: 56.25,
          itemValueAp: 45,
          rarity: 5,
        },
        {
          itemId: '3222',
          itemName: '近卫芯片组',
          itemValue: 49.992,
          itemValueAp: 39.9936,
          rarity: 4,
        },
        {
          itemId: '3232',
          itemName: '重装芯片组',
          itemValue: 49.992,
          itemValueAp: 39.9936,
          rarity: 4,
        },
        {
          itemId: '30103',
          itemName: 'RMA70-12',
          itemValue: 46.737918,
          itemValueAp: 37.390334,
          rarity: 3,
        },
        {
          itemId: '31083',
          itemName: '环烃聚质',
          itemValue: 46.540261,
          itemValueAp: 37.232209,
          rarity: 3,
        },
        {
          itemId: '30063',
          itemName: '全新装置',
          itemValue: 45.4581,
          itemValueAp: 36.36648,
          rarity: 3,
        },
        {
          itemId: '3272',
          itemName: '辅助芯片组',
          itemValue: 42.84,
          itemValueAp: 34.272,
          rarity: 4,
        },
        {
          itemId: '3212',
          itemName: '先锋芯片组',
          itemValue: 42.84,
          itemValueAp: 34.272,
          rarity: 4,
        },
        {
          itemId: '3242',
          itemName: '狙击芯片组',
          itemValue: 42.84,
          itemValueAp: 34.272,
          rarity: 4,
        },
        {
          itemId: '3252',
          itemName: '术师芯片组',
          itemValue: 42.84,
          itemValueAp: 34.272,
          rarity: 4,
        },
        {
          itemId: '31073',
          itemName: '褐素纤维',
          itemValue: 40.896995,
          itemValueAp: 32.717596,
          rarity: 3,
        },
        {
          itemId: '31063',
          itemName: '转质盐组',
          itemValue: 40.421879,
          itemValueAp: 32.337503,
          rarity: 3,
        },
        {
          itemId: '30093',
          itemName: '研磨石',
          itemValue: 39.389348,
          itemValueAp: 31.511479,
          rarity: 3,
        },
        {
          itemId: '31013',
          itemName: '凝胶',
          itemValue: 38.755311,
          itemValueAp: 31.004249,
          rarity: 3,
        },
        {
          itemId: '31043',
          itemName: '半自然溶剂',
          itemValue: 37.854025,
          itemValueAp: 30.28322,
          rarity: 3,
        },
        {
          itemId: 'charm_r2',
          itemName: '标志物 - 40代金券',
          itemValue: 37.5,
          itemValueAp: 30,
          rarity: 3,
        },
        {
          itemId: '3262',
          itemName: '医疗芯片组',
          itemValue: 35.685,
          itemValueAp: 28.548,
          rarity: 4,
        },
        {
          itemId: '3282',
          itemName: '特种芯片组',
          itemValue: 35.685,
          itemValueAp: 28.548,
          rarity: 4,
        },
        {
          itemId: '30053',
          itemName: '酮凝集组',
          itemValue: 34.536958,
          itemValueAp: 27.629566,
          rarity: 3,
        },
        {
          itemId: 'STORY_REVIEW_COIN',
          itemName: '事相碎片',
          itemValue: 34,
          itemValueAp: 27.2,
          rarity: 5,
        },
        {
          itemId: '30043',
          itemName: '异铁组',
          itemValue: 33.768563,
          itemValueAp: 27.01485,
          rarity: 3,
        },
        {
          itemId: '30083',
          itemName: '轻锰矿',
          itemValue: 33.158836,
          itemValueAp: 26.527069,
          rarity: 3,
        },
        {
          itemId: '31023',
          itemName: '炽合金',
          itemValue: 32.234352,
          itemValueAp: 25.787481,
          rarity: 3,
        },
        {
          itemId: '7001',
          itemName: '招聘许可',
          itemValue: 30.085,
          itemValueAp: 24.068,
          rarity: 4,
        },
        {
          itemId: '30073',
          itemName: '扭转醇',
          itemValue: 28.936461,
          itemValueAp: 23.149169,
          rarity: 3,
        },
        {
          itemId: '31053',
          itemName: '化合切削液',
          itemValue: 27.859096,
          itemValueAp: 22.287277,
          rarity: 3,
        },
        {
          itemId: '30023',
          itemName: '糖组',
          itemValue: 27.800522,
          itemValueAp: 22.240418,
          rarity: 3,
        },
        {
          itemId: '30033',
          itemName: '聚酸酯组',
          itemValue: 27.786524,
          itemValueAp: 22.229219,
          rarity: 3,
        },
        {
          itemId: 'act24side_melding_5',
          itemName: '兽之泪',
          itemValue: 25,
          itemValueAp: 20,
          rarity: 5,
        },
        {
          itemId: '3221',
          itemName: '近卫芯片',
          itemValue: 24.996,
          itemValueAp: 19.9968,
          rarity: 3,
        },
        {
          itemId: '3231',
          itemName: '重装芯片',
          itemValue: 24.996,
          itemValueAp: 19.9968,
          rarity: 3,
        },
        {
          itemId: '31033',
          itemName: '晶体元件',
          itemValue: 22.815105,
          itemValueAp: 18.252084,
          rarity: 3,
        },
        {
          itemId: '30013',
          itemName: '固源岩组',
          itemValue: 21.586385,
          itemValueAp: 17.269108,
          rarity: 3,
        },
        {
          itemId: '3271',
          itemName: '辅助芯片',
          itemValue: 21.42,
          itemValueAp: 17.136,
          rarity: 3,
        },
        {
          itemId: '3211',
          itemName: '先锋芯片',
          itemValue: 21.42,
          itemValueAp: 17.136,
          rarity: 3,
        },
        {
          itemId: '3241',
          itemName: '狙击芯片',
          itemValue: 21.42,
          itemValueAp: 17.136,
          rarity: 3,
        },
        {
          itemId: '3251',
          itemName: '术师芯片',
          itemValue: 21.42,
          itemValueAp: 17.136,
          rarity: 3,
        },
        {
          itemId: 'charm_r1',
          itemName: '标志物 - 20代金券',
          itemValue: 18.75,
          itemValueAp: 15,
          rarity: 1,
        },
        {
          itemId: '3261',
          itemName: '医疗芯片',
          itemValue: 17.843,
          itemValueAp: 14.2744,
          rarity: 3,
        },
        {
          itemId: '3281',
          itemName: '特种芯片',
          itemValue: 17.843,
          itemValueAp: 14.2744,
          rarity: 3,
        },
        {
          itemId: 'randomMaterial_8',
          itemName: '罗德岛物资补给Ⅳ',
          itemValue: 14.1,
          itemValueAp: 11.28,
          rarity: 2,
        },
        {
          itemId: '3303',
          itemName: '技巧概要·卷3',
          itemValue: 13.230729,
          itemValueAp: 10.584583,
          rarity: 4,
        },
        {
          itemId: 'act24side_melding_4',
          itemName: '凶豕兽的厚实皮',
          itemValue: 12.5,
          itemValueAp: 10,
          rarity: 4,
        },
        {
          itemId: '30062',
          itemName: '装置',
          itemValue: 11.50367,
          itemValueAp: 9.202936,
          rarity: 2,
        },
        {
          itemId: '30052',
          itemName: '酮凝集',
          itemValue: 8.773384,
          itemValueAp: 7.018707,
          rarity: 2,
        },
        {
          itemId: '30042',
          itemName: '异铁',
          itemValue: 8.581285,
          itemValueAp: 6.865028,
          rarity: 2,
        },
        {
          itemId: '30022',
          itemName: '糖',
          itemValue: 7.089275,
          itemValueAp: 5.67142,
          rarity: 2,
        },
        {
          itemId: '30032',
          itemName: '聚酸酯',
          itemValue: 7.085776,
          itemValueAp: 5.668621,
          rarity: 2,
        },
        {
          itemId: 'act24side_melding_3',
          itemName: '鬣犄兽的尖锐齿',
          itemValue: 6.25,
          itemValueAp: 5,
          rarity: 3,
        },
        {
          itemId: '2004',
          itemName: '高级作战记录',
          itemValue: 5.625,
          itemValueAp: 4.5,
          rarity: 5,
        },
        {
          itemId: '3302',
          itemName: '技巧概要·卷2',
          itemValue: 5.204086,
          itemValueAp: 4.163269,
          rarity: 3,
        },
        {
          itemId: '30012',
          itemName: '固源岩',
          itemValue: 4.428593,
          itemValueAp: 3.542874,
          rarity: 2,
        },
        {
          itemId: '30061',
          itemName: '破损装置',
          itemValue: 3.847243,
          itemValueAp: 3.077794,
          rarity: 1,
        },
        {
          itemId: 'act24side_melding_2',
          itemName: '源石虫的硬壳',
          itemValue: 3.75,
          itemValueAp: 3,
          rarity: 2,
        },
        {
          itemId: '30051',
          itemName: '双酮',
          itemValue: 2.937148,
          itemValueAp: 2.349718,
          rarity: 1,
        },
        {
          itemId: '30041',
          itemName: '异铁碎片',
          itemValue: 2.873115,
          itemValueAp: 2.298492,
          rarity: 1,
        },
        {
          itemId: '2003',
          itemName: '中级作战记录',
          itemValue: 2.8125,
          itemValueAp: 2.25,
          rarity: 4,
        },
        {
          itemId: 'act24side_melding_1',
          itemName: '破碎的骨片',
          itemValue: 2.5,
          itemValueAp: 2,
          rarity: 1,
        },
        {
          itemId: '30021',
          itemName: '代糖',
          itemValue: 2.375778,
          itemValueAp: 1.900622,
          rarity: 1,
        },
        {
          itemId: '30031',
          itemName: '酯原料',
          itemValue: 2.374611,
          itemValueAp: 1.899689,
          rarity: 1,
        },
        {
          itemId: '3114',
          itemName: '碳素组',
          itemValue: 2.13875,
          itemValueAp: 1.711,
          rarity: 4,
        },
        {
          itemId: '3301',
          itemName: '技巧概要·卷1',
          itemValue: 2.046941,
          itemValueAp: 1.637553,
          rarity: 2,
        },
        {
          itemId: '4003sp',
          itemName: '合成玉(搓玉)',
          itemValue: 1.792975,
          itemValueAp: 1.43438,
          rarity: 5,
        },
        {
          itemId: '3113',
          itemName: '碳素',
          itemValue: 1.71,
          itemValueAp: 1.368,
          rarity: 3,
        },
        {
          itemId: '4006',
          itemName: '采购凭证',
          itemValue: 1.7,
          itemValueAp: 1.36,
          rarity: 3,
        },
        {
          itemId: '30011',
          itemName: '源岩',
          itemValue: 1.488884,
          itemValueAp: 1.191107,
          rarity: 1,
        },
        {
          itemId: '2002',
          itemName: '初级作战记录',
          itemValue: 1.125,
          itemValueAp: 0.9,
          rarity: 3,
        },
        {
          itemId: '3003',
          itemName: '赤金',
          itemValue: 1.11,
          itemValueAp: 0.888,
          rarity: 4,
        },
        {
          itemId: '3112',
          itemName: '碳',
          itemValue: 1.09,
          itemValueAp: 0.872,
          rarity: 2,
        },
        {
          itemId: 'charm_coin_2',
          itemName: '错版硬币',
          itemValue: 1.019089,
          itemValueAp: 0.815271,
          rarity: 3,
        },
        {
          itemId: '4003',
          itemName: '合成玉',
          itemValue: 0.9375,
          itemValueAp: 0.75,
          rarity: 5,
        },
        {
          itemId: '2001',
          itemName: '基础作战记录',
          itemValue: 0.5625,
          itemValueAp: 0.45,
          rarity: 2,
        },
        {
          itemId: 'charm_coin_3',
          itemName: '双日城大乐透',
          itemValue: 0.049436,
          itemValueAp: 0.039549,
          rarity: 4,
        },
        {
          itemId: 'base_ap',
          itemName: '无人机',
          itemValue: 0.046875,
          itemValueAp: 0.0375,
          rarity: 4,
        },
        {
          itemId: 'charm_coin_1',
          itemName: '黄金筹码',
          itemValue: 0.019626,
          itemValueAp: 0.015701,
          rarity: 1,
        },
        {
          itemId: '4001',
          itemName: '龙门币',
          itemValue: 0.0045,
          itemValueAp: 0.0036,
          rarity: 4,
        },
        {
          itemId: 'ap_supply_lt_010',
          itemName: '应急理智小样',
          itemValue: 0,
          itemValueAp: 0,
          rarity: 4,
        },
        {
          itemId: 'act24side_gacha',
          itemName: '炼金池',
          itemValue: 0,
          itemValueAp: 0,
          rarity: 5,
        },
        {
          itemId: '0',
          itemName: '0',
          itemValue: 0,
          itemValueAp: 0,
          rarity: 1,
        },
      ] satisfies YituliuValue[],
    }
  }
}

export class ArknightsPenguinObject extends DataContainerObject<PenguinMatrix> {
  public autoUpdateNotificationThreshold = 86400_000 * 3

  public constructor(public readonly server: 'CN') {
    super()
    this.name = 'arknights-penguin-' + server
  }

  public readonly name: string

  public getData(): Promise<IDataContainer<PenguinMatrix>> {
    return Promise.reject(new Error('ArknightsPenguinObject.getData is useless.'))
  }

  public async getHeader(): Promise<IDataContainer<PenguinMatrix>> {
    const res = await fetch(
      `https://penguin-stats.cn/PenguinStats/api/v2/result/matrix?${new URLSearchParams({
        server: this.server,
      })}`,
    )
    if (!res.ok) {
      throw new Error(`Failed to fetch penguin: ${res.status} ${res.statusText}`)
    }

    const now = new Date()
    return {
      '@type': CONTAINER_TYPE,
      '@version': CONTAINER_VERSION,
      name: this.name,
      version: {
        id: now.toJSON(),
        text: now.toJSON(),
        schema: 1,
        sources: ['https://penguin-stats.io'],
        timestamp: now.getTime(),
      },
      data: (await res.json()) as PenguinMatrix,
    }
  }
}
