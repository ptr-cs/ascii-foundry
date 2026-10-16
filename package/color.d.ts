export type ColorMode = 'ansi16' | 'ansi256' | 'rgb565' | 'truecolor';
export declare function adjustImageTone(pixels: Uint8ClampedArray, brightnessPercent: number, contrastPercent: number, saturationPercent: number): void;
export declare function quantizeColors(pixels: Uint8ClampedArray, mode: ColorMode): void;
//# sourceMappingURL=color.d.ts.map