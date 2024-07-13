/// Generated for reverse1999-enigmaticnebula-jp
export type CppData_Reverse1999EnigmaticnebulaJp = {
    exChapters: {
        id: number;
        chapterIndex: string;
        type: number;
        name: string;
    }[];
    exEpisodes: {
        id: number;
        type: number;
        chapterId: number;
        preEpisode: number;
        cost: string;
        battleId: number;
        name: string;
    }[];
    exCharacters: {
        id: number;
        isOnline: "1" | "0";
        name: string;
        nameEng: string;
        rare: number;
        career: number;
        dmgType: number;
        skinId: number;
        heroType: number;
    }[];
    exItems: {
        id: number;
        name: string;
        subType: number;
        rare: number;
        icon: string;
        isShow: number;
    }[];
    exCurrencies: {
        id: number;
        name: string;
        icon: string;
    }[];
    exFormulas: {
        id: number;
        type: number;
        produce: string;
        costMaterial: string;
        costScore: string;
    }[];
    exCharacterRank: {
        heroId: number;
        rank: number;
        consume: string;
    }[];
    exCharacterConsume: {
        rare: number;
        cosume: string;
        level: number;
    }[];
    exCharacterTalent: {
        talentId: number;
        talentMould: number;
        heroId: number;
        consume: string;
        requirement: number;
    }[];
    exTalentStyleCost: {
        heroId: number;
        styleId: number;
        consume: string;
    }[];
    exTalentStyle: {
        talentMould: number;
        styleId: number;
        level: 0 | 10;
        name: string;
        tagicon: string;
        color: "" | string;
    }[];
}