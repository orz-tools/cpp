/// Generated for arknights-kengxxiao-details-en_US
export type CppData_ArknightsKengxxiaoDetailsEnUs = {
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
}