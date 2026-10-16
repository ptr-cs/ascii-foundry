<img width="3840" height="2160" alt="Ascii-foundry-preview" src="https://github.com/user-attachments/assets/21a83952-331e-4fb6-b551-d2548cfacbdc" />

# ASCII Foundry

A local Vite + TypeScript app and Node.js package for converting images into colored ASCII art. The browser app exports PNGs, character/color grids, responsive HTML/CSS pages, and H.264 MOV frame sequences. The package creates HTML fragments for static sites, blogs, and other TypeScript build pipelines.

The browser app rasterizes with [`@sister.software/asciify`](https://www.npmjs.com/package/@sister.software/asciify). The reusable Node.js API decodes and samples source images with [Sharp](https://sharp.pixelplumbing.com/) and then uses the same tone, palette, character-ramp, and compact color-map code as the app.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

`npm run build:app` builds only the browser tool. `npm run build:lib` builds the reusable package to `package/`.

## Use from another TypeScript project

Install this repository as a local package while developing:

```bash
cd ../my-blog
npm install "../Ascii Art"
```

The package runs at build time under Node.js 20.9 or newer. It accepts an image path, `Uint8Array`, or `ArrayBuffer` and returns one scoped `<pre>` plus CSS containing its compact color map. It does not require browser JavaScript in the resulting page.

```ts
import { createAsciiHtmlFromImage } from 'ascii-foundry'
import { writeFile } from 'node:fs/promises'

const art = await createAsciiHtmlFromImage({
  input: './content/images/forest.jpg',
  columns: 120,
  label: 'Sunlight filtering through a forest canopy',
  // These defaults match the browser tool:
  brightness: 100,
  imageContrast: -8,
  saturation: 150,
})

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="post.css" />
    <title>Forest notes</title>
  </head>
  <body>
    <article class="post-hero">
      <div class="post-hero__art">${art.html}</div>
      <div class="post-hero__copy">
        <p>Field notes</p>
        <h1>Forest systems</h1>
      </div>
    </article>
  </body>
</html>`

const css = `${art.css}

.post-hero {
  position: relative;
  isolation: isolate;
  min-height: 70svh;
  overflow: hidden;
  container-type: size;
  background: #050604;
  color: white;
}

.post-hero__art {
  position: absolute;
  z-index: -1;
  inset: 0;
  overflow: hidden;
}

.post-hero__art .${art.className} {
  position: absolute;
  left: 50%;
  top: 50%;
  --ascii-font-size: max(
    calc(110cqw / ${art.columns}),
    calc(110cqh / ${art.rows})
  );
  opacity: 0.72;
  transform: translate(-50%, -50%);
}

.post-hero__copy {
  padding: clamp(2rem, 8vw, 8rem);
}`

await Promise.all([
  writeFile('./dist/post.html', html),
  writeFile('./dist/post.css', css),
])
```

The result also includes `characters`, `colors`, `columns`, and `rows` for pipelines that want to store or transform the intermediate grids. Class names are content-derived and scoped, so a build can concatenate the `css` returned for several images and insert each image's `html` wherever its post template needs it.

For a non-filesystem image, pass the downloaded bytes as `input`. To supply already sampled RGBA pixels or build a different wrapper, import `createAsciiGridFromRgba` and `createAsciiHtmlFragment`. Browser-safe helpers are also available from `ascii-foundry/core` and `ascii-foundry/html`; the main entry point is intended for Node.js build scripts.

## Color modes

- Terminal: nearest color in the standard 16-color ANSI palette
- 8-bit: nearest color in the xterm 256-color palette
- 16-bit: RGB565 (65,536 possible colors)
- 24-bit: source RGB colors without palette reduction

All processing stays local. The app works in the browser, and the package works on the machine running the blog build; neither uploads image data.

## Text and color-map exports

After rendering a still image, use **ASCII .txt** to download the exact character grid used by the renderer. Use **Colors .txt** to download its matching color grid. Each color-map line corresponds to the same character-grid line and contains one space-separated CSS hex color (`#RRGGBB`) for every character cell. Both files use the same source name, color mode, and column count in their filenames.

Use **To HTML** to generate a self-contained HTML/CSS pair with responsive ASCII background examples and foreground content. The CSS demonstrates cover, contain, offset-crop, and wrapping flex layouts. The local Vite server writes both files to `<project>/<generated-name>_html_out/`, keeping the relative stylesheet link intact. Run the app with `npm run dev` or `npm run preview` so the output endpoint is available.

The generated page keeps the characters in a single, non-selectable `<pre>` template. A compact, embedded one-pixel-per-cell color map is clipped through cloned text and shared by every background treatment, avoiding per-character spans and large cloned DOM trees.

## H.264 MOV frame sequences

Drop a `.mov` and click **Convert all frames**. The app uses MP4Box.js and WebCodecs to decode every encoded video frame, applies the current ASCII/color settings, and writes files such as `frame_000001.png` to `<project>/<video-name>_ascii_out/`.

Video conversion requires a browser with WebCodecs support and must run through `npm run dev` or `npm run preview`; the local Vite server creates and writes the output directory. Existing frames are preserved when a conversion starts, while newly generated frames overwrite files with matching frame numbers. Nothing is uploaded.
