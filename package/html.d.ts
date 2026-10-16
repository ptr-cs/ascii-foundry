import type { AsciiGrid } from './core.js';
export type AsciiHtmlOptions = {
    className?: string;
    label?: string;
    decorative?: boolean;
    selectable?: boolean;
};
export type AsciiHtmlFragment = AsciiGrid & {
    className: string;
    html: string;
    css: string;
    styleTag: string;
};
export declare function createAsciiColorMapDataUrl(art: AsciiGrid): string;
export declare function createAsciiHtmlFragment(art: AsciiGrid, options?: AsciiHtmlOptions): AsciiHtmlFragment;
//# sourceMappingURL=html.d.ts.map