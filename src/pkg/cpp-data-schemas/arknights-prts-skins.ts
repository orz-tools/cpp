/// Generated for arknights-prts-skins
export type CppData_ArknightsPrtsSkins = {
    skins: {
        [x: string]: {
            windows: {
                kind: "first" | "rerun" | "retro";
                n: number;
                channel: "shop" | "retro" | "certificate" | "record" | "contract" | "milestone" | "mission" | "event";
                start: number;
                end: number | null;
                price: string | null;
                unit: string | null;
            }[];
            noVoucher: boolean;
            dynamic: boolean;
        };
    };
}