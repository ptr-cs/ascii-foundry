import { type ColorMode } from './color.js';
export declare const CHARACTER_SETS: {
    readonly classic: " .,:;irsXA253hMHGS#9B&@";
    readonly detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
    readonly minimal: " .:-=+*#%@";
};
export type CharacterSetName = keyof typeof CHARACTER_SETS;
export type CharacterSet = CharacterSetName | string | readonly string[];
export type RgbaImage = {
    data: Uint8Array | Uint8ClampedArray;
    width: number;
    height: number;
};
export type AsciiGrid = {
    characters: string;
    colors: string;
    columns: number;
    rows: number;
};
export type AsciiRenderOptions = {
    characterSet?: CharacterSet;
    contrast?: number;
    brightness?: number;
    imageContrast?: number;
    saturation?: number;
    colorMode?: ColorMode;
};
export declare const DEFAULT_ASCII_OPTIONS: {
    readonly columns: 160;
    readonly characterSet: "classic";
    readonly contrast: 3;
    readonly brightness: 100;
    readonly imageContrast: -8;
    readonly saturation: 150;
    readonly colorMode: "truecolor";
};
export declare function createAsciiGridFromRgba(image: RgbaImage, options?: AsciiRenderOptions): AsciiGrid;
//# sourceMappingURL=core.d.ts.map