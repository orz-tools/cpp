/// Generated for arknights-kengxxiao-ko_KR
export type CppData_ArknightsKengxxiaoKoKr = {
    exCharacters: {
        [x: string]: {
            name: string;
            description: string | null;
            displayNumber: string | null;
            appellation: string;
            profession: "CASTER" | "MEDIC" | "PIONEER" | "SNIPER" | "SPECIAL" | "SUPPORT" | "TANK" | "WARRIOR" | "TRAP" | "TOKEN";
            position: "MELEE" | "RANGED" | "ALL" | "NONE";
            rarity: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5" | "TIER_6";
            spTargetType: string;
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
                position: "MELEE" | "RANGED" | "ALL" | "NONE";
                rarity: "TIER_1" | "TIER_2" | "TIER_3" | "TIER_4" | "TIER_5" | "TIER_6";
                spTargetType: string;
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
        charSkins: {
            [x: string]: {
                skinId: string;
                charId: string;
                tmplId: string | null;
                dynIllust: boolean;
                displaySkin: {
                    skinName: string | null;
                    skinGroupId: string | null;
                    skinGroupName: string | null;
                    sortId: number;
                    getTime: number;
                    obtainApproach: string | null;
                    displayTagId: string | null;
                };
            };
        };
        brandList: {
            [x: string]: {
                brandId: string;
                brandName: string;
                brandCapitalName: string | null;
                sortId: number;
                groupList: {
                    skinGroupId: string;
                }[];
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
                tmplId: string | null;
                missionList: string[];
            };
        };
        missionList: {
            [x: string]: {
                template: string;
                desc: string;
                paramList: string[];
                uniEquipId: string;
                uniEquipMissionSort: number;
                jumpStageId: string | null;
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
                itemType: string | number;
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
        rooms: {
            [x: string]: {
                name: string;
            };
        };
        buffs: {
            [x: string]: {
                buffName: string;
                roomType: string;
                skillIcon: string;
                efficiency: number;
                sortId: number;
            };
        };
        chars: {
            [x: string]: {
                buffChar: {
                    buffData: {
                        buffId: string;
                        cond: {
                            phase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                            level: number;
                        };
                    }[];
                }[];
            };
        };
    };
    exStage: {
        stages: {
            [x: string]: {
                stageId: string;
                zoneId: string;
                code: string | null;
                name: string | null;
                difficulty: "NORMAL" | "FOUR_STAR" | "SIX_STAR";
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
                code: string | null;
                name: string | null;
                difficulty: "NORMAL" | "FOUR_STAR" | "SIX_STAR";
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
                type: "MAINLINE" | "WEEKLY" | "CAMPAIGN" | "CLIMB_TOWER" | "ACTIVITY" | "SIDESTORY" | "GUIDE" | "ROGUELIKE" | "BRANCHLINE" | "MAINLINE_ACTIVITY" | "MAINLINE_RETRO";
            };
        };
    };
    exEnemies: {
        enemyData: {
            [x: string]: {
                name: string;
                enemyLevel: "NORMAL" | "ELITE" | "BOSS";
            };
        };
    };
    exShop: {
        recommendList: {
            tagName: string;
            startDatetime: number;
            endDatetime: number;
            skins: {
                skinId: string;
                goodId: string | null;
            }[];
        }[];
        carousels: {
            skinId: string;
            startTime: number;
            endTime: number;
        }[];
    };
    exSpecialOperators: {
        modeData: {
            type: string;
            typeName: string;
        }[];
        operatorBasicData: {
            [x: string]: {
                soCharId: string;
                targetType: string;
                targetTopicName: string;
            };
        };
        operatorDetailData: {
            [x: string]: {
                specialOperatorExpMap: number[][];
                nodeUnlockData: {
                    [x: string]: {
                        nodeId: string;
                        nodeType: "EVOLVE" | "SKILL" | "UNIEQUIP" | "MASTER";
                        unlockEvolvePhase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                        unlockLevel: number;
                        unlockTaskId: string | null;
                        frontNodeId: string | null;
                    };
                };
                evolveNodeData: {
                    [x: string]: {
                        nodeId: string;
                        toEvolvePhase: "PHASE_0" | "PHASE_1" | "PHASE_2";
                    };
                };
                skillNodeData: {
                    [x: string]: {
                        nodeId: string;
                        skillKey: string;
                        skillLevel: number;
                        skillSpLevel: number;
                    };
                };
                uniEquipNodeData: {
                    [x: string]: {
                        nodeId: string;
                        uniEquipId: string;
                        equipLevel: number;
                    };
                };
                masterNodeData: {
                    [x: string]: {
                        nodeId: string;
                        masterId: string;
                        level: number;
                    };
                };
            };
        };
        nodeUnlockMissionData: {
            [x: string]: {
                id: string;
                description: string;
            };
        };
        masterNames: {
            [x: string]: string;
        };
    };
    exRecruit: {
        tags: {
            tagId: number;
            tagName: string;
        }[];
        pool: {
            charId: string;
            tags: number[];
        }[];
    };
}