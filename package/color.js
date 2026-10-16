const ANSI_16 = [
    [0, 0, 0],
    [128, 0, 0],
    [0, 128, 0],
    [128, 128, 0],
    [0, 0, 128],
    [128, 0, 128],
    [0, 128, 128],
    [192, 192, 192],
    [128, 128, 128],
    [255, 0, 0],
    [0, 255, 0],
    [255, 255, 0],
    [0, 0, 255],
    [255, 0, 255],
    [0, 255, 255],
    [255, 255, 255],
];
const XTERM_LEVELS = [0, 95, 135, 175, 215, 255];
function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
export function adjustImageTone(pixels, brightnessPercent, contrastPercent, saturationPercent) {
    if (brightnessPercent === 0 && contrastPercent === 0 && saturationPercent === 0)
        return;
    const brightness = clamp(brightnessPercent, -90, 200);
    const contrast = clamp(contrastPercent, -90, 200);
    const saturation = clamp(saturationPercent, -100, 300);
    const gamma = brightness >= 0 ? 1 / (1 + brightness / 100) : 1 - brightness / 100;
    const contrastFactor = 1 + contrast / 100;
    const saturationFactor = 1 + saturation / 100;
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0)
            continue;
        const adjusted = [0, 0, 0];
        for (let channel = 0; channel < 3; channel += 1) {
            const normalized = pixels[index + channel] / 255;
            const brightened = 255 * normalized ** gamma;
            adjusted[channel] = clamp((brightened - 128) * contrastFactor + 128, 0, 255);
        }
        const luminance = adjusted[0] * 0.2126 + adjusted[1] * 0.7152 + adjusted[2] * 0.0722;
        pixels[index] = clamp(luminance + (adjusted[0] - luminance) * saturationFactor, 0, 255);
        pixels[index + 1] = clamp(luminance + (adjusted[1] - luminance) * saturationFactor, 0, 255);
        pixels[index + 2] = clamp(luminance + (adjusted[2] - luminance) * saturationFactor, 0, 255);
    }
}
function colorDistance(red, green, blue, candidate) {
    const redDelta = red - candidate[0];
    const greenDelta = green - candidate[1];
    const blueDelta = blue - candidate[2];
    return redDelta * redDelta + greenDelta * greenDelta + blueDelta * blueDelta;
}
function nearestFromPalette(red, green, blue, palette) {
    let best = palette[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of palette) {
        const distance = colorDistance(red, green, blue, candidate);
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }
    return best;
}
function nearestLevel(value) {
    let best = XTERM_LEVELS[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const level of XTERM_LEVELS) {
        const distance = Math.abs(value - level);
        if (distance < bestDistance) {
            best = level;
            bestDistance = distance;
        }
    }
    return best;
}
function nearestXtermColor(red, green, blue) {
    const cube = [nearestLevel(red), nearestLevel(green), nearestLevel(blue)];
    const average = (red + green + blue) / 3;
    const grayIndex = Math.max(0, Math.min(23, Math.round((average - 8) / 10)));
    const grayLevel = 8 + grayIndex * 10;
    const gray = [grayLevel, grayLevel, grayLevel];
    const ansi = nearestFromPalette(red, green, blue, ANSI_16);
    const candidates = [cube, gray, ansi];
    return nearestFromPalette(red, green, blue, candidates);
}
function toRgb565(red, green, blue) {
    const red5 = Math.round((red / 255) * 31);
    const green6 = Math.round((green / 255) * 63);
    const blue5 = Math.round((blue / 255) * 31);
    return [
        Math.round((red5 / 31) * 255),
        Math.round((green6 / 63) * 255),
        Math.round((blue5 / 31) * 255),
    ];
}
export function quantizeColors(pixels, mode) {
    if (mode === 'truecolor')
        return;
    for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] === 0)
            continue;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const color = mode === 'ansi16'
            ? nearestFromPalette(red, green, blue, ANSI_16)
            : mode === 'ansi256'
                ? nearestXtermColor(red, green, blue)
                : toRgb565(red, green, blue);
        pixels[index] = color[0];
        pixels[index + 1] = color[1];
        pixels[index + 2] = color[2];
    }
}
//# sourceMappingURL=color.js.map