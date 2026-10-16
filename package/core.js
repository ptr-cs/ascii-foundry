import { adjustImageTone, quantizeColors } from './color.js';
export const CHARACTER_SETS = {
    classic: ' .,:;irsXA253hMHGS#9B&@',
    detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    minimal: ' .:-=+*#%@',
};
export const DEFAULT_ASCII_OPTIONS = {
    columns: 160,
    characterSet: 'classic',
    contrast: 3,
    brightness: 100,
    imageContrast: -8,
    saturation: 150,
    colorMode: 'truecolor',
};
function assertDimension(value, name) {
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new TypeError(`${name} must be a positive integer.`);
    }
}
function resolveCharacterSet(value) {
    const preset = typeof value === 'string' && Object.hasOwn(CHARACTER_SETS, value)
        ? CHARACTER_SETS[value]
        : value;
    const characters = typeof preset === 'string' ? Array.from(preset) : Array.from(preset);
    if (characters.length === 0 || characters.some((character) => character.length === 0)) {
        throw new TypeError('characterSet must contain at least one non-empty character.');
    }
    return characters;
}
function toHex(value) {
    return value.toString(16).padStart(2, '0').toUpperCase();
}
export function createAsciiGridFromRgba(image, options = {}) {
    assertDimension(image.width, 'image.width');
    assertDimension(image.height, 'image.height');
    const expectedLength = image.width * image.height * 4;
    if (image.data.length < expectedLength) {
        throw new RangeError(`Expected ${expectedLength} RGBA values but received ${image.data.length}.`);
    }
    const pixels = new Uint8ClampedArray(image.data.subarray(0, expectedLength));
    const brightness = options.brightness ?? DEFAULT_ASCII_OPTIONS.brightness;
    const imageContrast = options.imageContrast ?? DEFAULT_ASCII_OPTIONS.imageContrast;
    const saturation = options.saturation ?? DEFAULT_ASCII_OPTIONS.saturation;
    const colorMode = options.colorMode ?? DEFAULT_ASCII_OPTIONS.colorMode;
    const contrast = Math.min(255, Math.max(0, Math.trunc(options.contrast ?? DEFAULT_ASCII_OPTIONS.contrast)));
    const characters = resolveCharacterSet(options.characterSet ?? DEFAULT_ASCII_OPTIONS.characterSet);
    adjustImageTone(pixels, brightness, imageContrast, saturation);
    quantizeColors(pixels, colorMode);
    for (let index = 0; index < contrast; index += 1)
        characters.unshift(' ');
    const characterRows = [];
    const colorRows = [];
    for (let row = 0; row < image.height; row += 1) {
        let characterRow = '';
        const colorRow = [];
        for (let column = 0; column < image.width; column += 1) {
            const index = (row * image.width + column) * 4;
            const red = pixels[index];
            const green = pixels[index + 1];
            const blue = pixels[index + 2];
            const luminance = (red + red + red + blue + green + green + green + green) >> 3;
            const characterIndex = Math.floor((luminance / 256) * characters.length);
            characterRow += characters[characterIndex];
            colorRow.push(`#${toHex(red)}${toHex(green)}${toHex(blue)}`);
        }
        characterRows.push(characterRow);
        colorRows.push(colorRow.join(' '));
    }
    return {
        characters: characterRows.join('\n'),
        colors: colorRows.join('\n'),
        columns: image.width,
        rows: image.height,
    };
}
//# sourceMappingURL=core.js.map