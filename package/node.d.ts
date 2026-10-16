import { type AsciiRenderOptions } from './core.js';
import { type AsciiHtmlFragment, type AsciiHtmlOptions } from './html.js';
export type ImageInput = string | ArrayBuffer | Uint8Array | Uint8ClampedArray;
export type CreateAsciiHtmlFromImageOptions = AsciiRenderOptions & AsciiHtmlOptions & {
    input: ImageInput;
    columns?: number;
    rows?: number;
};
export declare function createAsciiHtmlFromImage({ input, columns: requestedColumns, rows: requestedRows, characterSet, contrast, brightness, imageContrast, saturation, colorMode, className, label, decorative, selectable, }: CreateAsciiHtmlFromImageOptions): Promise<AsciiHtmlFragment>;
//# sourceMappingURL=node.d.ts.map