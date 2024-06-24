/// Generated for arknights-kengxxiao-en_US
export type CppData_ArknightsKengxxiaoEnUs = {
    exCharacters: {
        [x: string]: {
            name: string;
            description: string | null;
            displayNumber: string | null;
            appellation: string;
            profession: "CASTER" | "MEDIC" | "PIONEER" | "SNIPER" | "SPECIAL" | "SUPPORT" | "TANK" | "WARRIOR" | "TRAP" | "TOKEN";
            rarity: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5" | "TIER_6";
            skills: {
                skillId: string | null;
                levelUpCostCond?: {
                    unlockCond: {
                        phase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                        level: number;
                    };
                    lvlUpTime: number;
                    levelUpCost: {
                        id: string;
                        count: number;
                        type: "MATERIAL" | "GOLD";
                    }[] | null;
                }[] | undefined;
            }[];
            allSkillLvlup: {
                unlockCond: {
                    phase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                    level: number;
                };
                lvlUpCost: {
                    id: string;
                    count: number;
                    type: "MATERIAL" | "GOLD";
                }[] | null;
            }[];
            phases: {
                maxLevel: number;
                evolveCost: {
                    id: string;
                    count: number;
                    type: "MATERIAL" | "GOLD";
                }[] | null;
            }[];
        };
    };
    exPatchCharacters: {
        infos: {
            [x: string]: {
                tmplIds: string[];
                default: string;
            };
        };
        patchChars: {
            [x: string]: {
                name: string;
                description: string | null;
                displayNumber: string | null;
                appellation: string;
                profession: "CASTER" | "MEDIC" | "PIONEER" | "SNIPER" | "SPECIAL" | "SUPPORT" | "TANK" | "WARRIOR" | "TRAP" | "TOKEN";
                rarity: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5" | "TIER_6";
                skills: {
                    skillId: string | null;
                    levelUpCostCond?: {
                        unlockCond: {
                            phase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                            level: number;
                        };
                        lvlUpTime: number;
                        levelUpCost: {
                            id: string;
                            count: number;
                            type: "MATERIAL" | "GOLD";
                        }[] | null;
                    }[] | undefined;
                }[];
                allSkillLvlup: {
                    unlockCond: {
                        phase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                        level: number;
                    };
                    lvlUpCost: {
                        id: string;
                        count: number;
                        type: "MATERIAL" | "GOLD";
                    }[] | null;
                }[];
                phases: {
                    maxLevel: number;
                    evolveCost: {
                        id: string;
                        count: number;
                        type: "MATERIAL" | "GOLD";
                    }[] | null;
                }[];
            };
        };
    };
    exSkin: {
        buildinEvolveMap: {
            [x: string]: {
                [x: string]: string;
            };
        };
        buildinPatchMap: {
            [x: string]: {
                [x: string]: string;
            };
        };
    };
    exSkills: {
        [x: string]: {
            skillId: string;
            iconId: string | null;
            levels: {
                name: string;
            }[];
        };
    };
    exUniEquips: {
        equipDict: {
            [x: string]: {
                uniEquipId: string;
                charId: string;
                unlockEvolvePhase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                typeName1: string;
                typeName2: string | null;
                uniEquipName: string;
                equipShiningColor: string;
                charEquipOrder: number;
                typeIcon: string;
                itemCost: {
                    [x: string]: {
                        id: string;
                        count: number;
                        type: "MATERIAL" | "GOLD";
                    }[];
                } | null;
            };
        };
        charEquip: {
            [x: string]: string[];
        };
    };
    exItems: {
        items: {
            [x: string]: {
                itemId: string;
                iconId: string;
                name: string;
                rarity: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5" | "TIER_6";
                sortId: number;
                itemType: string;
                classifyType: string;
            };
        };
        expItems: {
            [x: string]: {
                id: string;
                gainExp: number;
            };
        };
    };
    exBuilding: {
        workshopFormulas: {
            [x: string]: {
                sortId: number;
                formulaId: string;
                itemId: string;
                count: number;
                goldCost: number;
                apCost: number;
                formulaType: "F_BUILDING" | "F_ASC" | "F_EVOLVE" | "F_SKILL";
                extraOutcomeRate: number;
                extraOutcomeGroup: {
                    weight: number;
                    itemId: string;
                    itemCount: number;
                }[];
                costs: {
                    id: string;
                    count: number;
                    type: "MATERIAL" | "GOLD";
                }[];
            };
        };
        manufactFormulas: {
            [x: string]: {
                formulaId: string;
                itemId: string;
                count: number;
                costs: {
                    id: string;
                    count: number;
                    type: "MATERIAL" | "GOLD";
                }[];
                formulaType: "F_EXP" | "F_ASC" | "F_GOLD" | "F_DIAMOND";
            };
        };
    };
    exStage: {
        stages: {
            [x: string]: {
                stageId: string;
                zoneId: string;
                code: string;
                name: string | null;
                difficulty: "NORMAL" | "FOUR_STAR";
                diffGroup: "NONE" | "EASY" | "NORMAL" | "TOUGH" | "ALL";
                apCost: number;
            };
        };
    };
    exRetro: {
        zoneToRetro: {
            [x: string]: string;
        };
        retroActList: {
            [x: string]: {
                retroId: string;
                index: number;
                name: string;
            };
        };
        stageList: {
            [x: string]: {
                stageId: string;
                zoneId: string;
                code: string;
                name: string | null;
                difficulty: "NORMAL" | "FOUR_STAR";
                diffGroup: "NONE" | "EASY" | "NORMAL" | "TOUGH" | "ALL";
                apCost: number;
            };
        };
    };
    exZone: {
        zones: {
            [x: string]: {
                zoneID: string;
                zoneIndex: number;
                zoneNameFirst: string | null;
                zoneNameSecond: string | null;
                type: "MAINLINE" | "WEEKLY" | "CAMPAIGN" | "CLIMB_TOWER" | "ACTIVITY" | "SIDESTORY" | "GUIDE" | "ROGUELIKE" | "BRANCHLINE";
            };
        };
    };
}