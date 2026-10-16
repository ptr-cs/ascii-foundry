const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const CSS_CLASS_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
function bytesToBase64(bytes) {
    let output = '';
    for (let index = 0; index < bytes.length; index += 3) {
        const first = bytes[index];
        const second = bytes[index + 1];
        const third = bytes[index + 2];
        const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
        output += BASE64_ALPHABET[(combined >> 18) & 63];
        output += BASE64_ALPHABET[(combined >> 12) & 63];
        output += second === undefined ? '=' : BASE64_ALPHABET[(combined >> 6) & 63];
        output += third === undefined ? '=' : BASE64_ALPHABET[combined & 63];
    }
    return output;
}
function hashGrid(art) {
    let hash = 0x811c9dc5;
    const input = `${art.columns}x${art.rows}\0${art.characters}\0${art.colors}`;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}
function validateArt(art) {
    if (!Number.isSafeInteger(art.columns) || art.columns < 1) {
        throw new TypeError('art.columns must be a positive integer.');
    }
    if (!Number.isSafeInteger(art.rows) || art.rows < 1) {
        throw new TypeError('art.rows must be a positive integer.');
    }
    const characterRows = art.characters.split('\n');
    if (characterRows.length !== art.rows || characterRows.some((row) => Array.from(row).length !== art.columns)) {
        throw new RangeError('The character grid dimensions do not match art.columns and art.rows.');
    }
}
// A one-pixel-per-cell bitmap preserves truecolor output without a DOM node per glyph.
export function createAsciiColorMapDataUrl(art) {
    validateArt(art);
    const colors = art.colors.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    const expectedColors = art.columns * art.rows;
    if (colors.length !== expectedColors) {
        throw new RangeError(`Expected ${expectedColors} ASCII colors but received ${colors.length}.`);
    }
    const headerSize = 54;
    const rowSize = Math.ceil((art.columns * 3) / 4) * 4;
    const pixelDataSize = rowSize * art.rows;
    const bitmap = new Uint8Array(headerSize + pixelDataSize);
    const view = new DataView(bitmap.buffer);
    bitmap[0] = 0x42;
    bitmap[1] = 0x4d;
    view.setUint32(2, bitmap.length, true);
    view.setUint32(10, headerSize, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, art.columns, true);
    view.setInt32(22, art.rows, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, 24, true);
    view.setUint32(34, pixelDataSize, true);
    view.setInt32(38, 2835, true);
    view.setInt32(42, 2835, true);
    for (let outputRow = 0; outputRow < art.rows; outputRow += 1) {
        const sourceRow = art.rows - outputRow - 1;
        for (let column = 0; column < art.columns; column += 1) {
            const rgb = Number.parseInt(colors[sourceRow * art.columns + column].slice(1), 16);
            const offset = headerSize + outputRow * rowSize + column * 3;
            bitmap[offset] = rgb & 0xff;
            bitmap[offset + 1] = (rgb >> 8) & 0xff;
            bitmap[offset + 2] = (rgb >> 16) & 0xff;
        }
    }
    return `data:image/bmp;base64,${bytesToBase64(bitmap)}`;
}
export function createAsciiHtmlFragment(art, options = {}) {
    validateArt(art);
    const className = options.className ?? `ascii-art-${hashGrid(art)}`;
    if (!CSS_CLASS_PATTERN.test(className)) {
        throw new TypeError('className must be a CSS identifier containing only letters, numbers, underscores, and hyphens.');
    }
    const decorative = options.decorative ?? options.label === undefined;
    const accessibility = decorative
        ? 'aria-hidden="true"'
        : `role="img" aria-label="${escapeHtml(options.label ?? 'ASCII art')}"`;
    const interactionCss = options.selectable
        ? '  pointer-events: auto;\n  -webkit-user-select: text;\n  user-select: text;'
        : '  pointer-events: none;\n  -webkit-user-select: none;\n  user-select: none;';
    const colorMapDataUrl = createAsciiColorMapDataUrl(art);
    const html = `<pre class="ascii-art ${className}" ${accessibility}>${escapeHtml(art.characters)}</pre>`;
    const css = `.${className} {
  width: ${art.columns}ch;
  height: ${art.rows}ch;
  margin: 0;
  padding: 0;
  display: block;
  overflow: hidden;
  contain: layout paint style;
  color: var(--ascii-fallback-color, #fff);
  font-family: var(--ascii-font-family, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-size: var(--ascii-font-size, 6px);
  font-kerning: none;
  font-variant-ligatures: none;
  letter-spacing: 0;
  line-height: 1ch;
${interactionCss}
  white-space: pre;
}

@supports ((background-clip: text) or (-webkit-background-clip: text)) {
  .${className} {
    color: transparent;
    background-image: url("${colorMapDataUrl}");
    background-position: 0 0;
    background-repeat: no-repeat;
    background-size: 100% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    image-rendering: pixelated;
  }
}`;
    return {
        ...art,
        className,
        html,
        css,
        styleTag: `<style data-ascii-art="${className}">\n${css}\n</style>`,
    };
}
//# sourceMappingURL=html.js.map