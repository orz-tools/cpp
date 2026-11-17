/// Generated for arknights-kengxxiao-details-ja_JP
export type CppData_ArknightsKengxxiaoDetailsJaJp = {
    skills: {
        [x: string]: {
            skillType: string;
            spType: string;
            durationType: string;
            texts: string[];
            levels: {
                text: number;
                duration: number;
                spCost: number;
                initSp: number;
                bb: [
                    string,
                    number
                ][];
            }[];
        };
    };
    equips: {
        [x: string]: {
            phases: {
                attr: [
                    string,
                    number
                ][];
                parts: {
                    target: string;
                    isToken: boolean;
                    trait: {
                        add: string | null;
                        over: string | null;
                        bb: [
                            string,
                            number
                        ][];
                        potential: number;
                    }[];
                    talent: {
                        name: string | null;
                        upgrade: string | null;
                        desc: string | null;
                        bb: [
                            string,
                            number
                        ][];
                        potential: number;
                    }[];
                }[];
            }[];
        };
    };
    terms: {
        [x: string]: {
            name: string;
            desc: string;
        };
    };
    buildingBuffs: {
        [x: string]: {
            text: string;
            effects?: ({
                k: "flat";
                m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                v: number;
                of?: ({
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                })[] | undefined;
                to?: (("self" | "room" | "one" | "allDorms" | "elsewhere") | {
                    all: string;
                } | {
                    at: string;
                }) | undefined;
            } | {
                k: "ramp";
                m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                v0: number;
                v1: number;
            } | {
                k: "per";
                m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                v: number;
                each: {
                    n: number;
                    unit: "op" | "room" | "level" | "point" | "line" | "slot";
                    what: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[];
                };
                of?: ({
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                })[] | undefined;
                maxCount?: number | undefined;
                maxValue?: number | undefined;
            } | {
                k: "zero";
                m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
            } | {
                k: "res";
                what: {
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                };
                v: number;
                each?: {
                    n: number;
                    unit: "op" | "room" | "level" | "point" | "line" | "slot";
                    what: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[];
                } | undefined;
            } | {
                k: "conv";
                from: {
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                };
                fromN: number;
                to: {
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                };
                toN: number;
            } | {
                k: "note";
                note: "missingClue" | "missingClueExchange" | "ownedClue" | "clueOf" | "goldOrderUp" | "fixedOrder" | "goldPerOrder" | "noMoodCost" | "noMoodCostFor" | "byproductIs" | "lessGold";
                what?: ({
                    ref: string;
                    text: string;
                } | {
                    room: string;
                } | {
                    word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                })[] | undefined;
                v?: number | undefined;
            } | {
                k: "if";
                when: {
                    c: "with";
                    who: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[];
                    group: boolean;
                } | {
                    c: "at";
                    who: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[];
                    where: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    }) | ("base" | "work" | "here");
                    min?: number | undefined;
                } | {
                    c: "mastery";
                    level: number;
                } | {
                    c: "trainee";
                    who: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[];
                } | {
                    c: "alone";
                } | {
                    c: "mood";
                    op: ">" | "<";
                    v: number;
                } | {
                    c: "moodGap";
                    v: number;
                } | {
                    c: "hours";
                    v: number;
                } | {
                    c: "dormOthers";
                } | {
                    c: "recipeMood";
                    v: number;
                    orMore?: boolean | undefined;
                };
                then: ({
                    k: "flat";
                    m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                    v: number;
                    of?: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[] | undefined;
                    to?: (("self" | "room" | "one" | "allDorms" | "elsewhere") | {
                        all: string;
                    } | {
                        at: string;
                    }) | undefined;
                } | {
                    k: "ramp";
                    m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                    v0: number;
                    v1: number;
                } | {
                    k: "per";
                    m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                    v: number;
                    each: {
                        n: number;
                        unit: "op" | "room" | "level" | "point" | "line" | "slot";
                        what: ({
                            ref: string;
                            text: string;
                        } | {
                            room: string;
                        } | {
                            word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                        })[];
                    };
                    of?: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[] | undefined;
                    maxCount?: number | undefined;
                    maxValue?: number | undefined;
                } | {
                    k: "zero";
                    m: "prod" | "order" | "charge" | "clue" | "contact" | "train" | "byprod" | "recycle" | "cap" | "olimit" | "cost" | "recover";
                } | {
                    k: "res";
                    what: {
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    };
                    v: number;
                    each?: {
                        n: number;
                        unit: "op" | "room" | "level" | "point" | "line" | "slot";
                        what: ({
                            ref: string;
                            text: string;
                        } | {
                            room: string;
                        } | {
                            word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                        })[];
                    } | undefined;
                } | {
                    k: "conv";
                    from: {
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    };
                    fromN: number;
                    to: {
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    };
                    toN: number;
                } | {
                    k: "note";
                    note: "missingClue" | "missingClueExchange" | "ownedClue" | "clueOf" | "goldOrderUp" | "fixedOrder" | "goldPerOrder" | "noMoodCost" | "noMoodCostFor" | "byproductIs" | "lessGold";
                    what?: ({
                        ref: string;
                        text: string;
                    } | {
                        room: string;
                    } | {
                        word: "exp" | "gold" | "originium" | "chip" | "eliteMaterial" | "skillSummary" | "buildingMaterial" | "anyMaterial" | "sameRoomOthers" | "emptyOrder" | "hireSlot" | "droneCap" | "clue.penguin" | "clue.karlan" | "clue.rhodes" | "prof.PIONEER" | "prof.WARRIOR" | "prof.TANK" | "prof.SNIPER" | "prof.CASTER" | "prof.MEDIC" | "prof.SUPPORT" | "prof.SPECIAL";
                    })[] | undefined;
                    v?: number | undefined;
                })[];
            })[] | undefined;
        };
    };
}