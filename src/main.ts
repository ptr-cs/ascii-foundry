import './style.css'
import { Asciify2D } from '@sister.software/asciify'
import { createAsciiTextExport, type AsciiTextExport } from './ascii-export'
import { createHtmlPageExport } from './html-export'
import { CHARACTER_SETS, type CharacterSetName } from './lib/core.js'
import { adjustImageTone, quantizeColors, type ColorMode } from './quantize'
import { convertVideoToAscii } from './video'

const CELL_SIZE = 10
const MAX_CANVAS_EDGE = 12_000
const SAMPLE_PATH = '/sample-forest.jpg'

type RenderSettings = {
  columns: number
  colorMode: ColorMode
  characterSet: CharacterSetName
  contrast: number
  brightness: number
  imageContrast: number
  saturation: number
  scale: number
  background: string
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root was not found')
}

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="wordmark" href="#" aria-label="ASCII Foundry home">
        <span class="wordmark-mark" aria-hidden="true">[::]</span>
        <span>ASCII FOUNDRY</span>
      </a>
      <div class="local-badge"><span aria-hidden="true"></span> Local processing</div>
    </header>

    <main>
      <section class="intro" aria-labelledby="page-title">
        <div>
          <p class="eyebrow">Image → character study</p>
          <h1 id="page-title">Turn pixels into <em>type.</em></h1>
        </div>
        <p class="intro-copy">
          A browser-based ASCII renderer with precise control over character density and color depth.
          Your images and videos never leave this device.
        </p>
      </section>

      <section class="studio" aria-label="ASCII art converter">
        <aside class="control-panel">
          <div class="panel-heading">
            <span>01</span>
            <div>
              <p class="eyebrow">Source & settings</p>
              <h2>Build the render</h2>
            </div>
          </div>

          <label class="dropzone" id="dropzone" for="image-input">
            <input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/quicktime,video/mp4,.mov" />
            <span class="upload-glyph" aria-hidden="true">↥</span>
            <span class="dropzone-copy">
              <strong>Drop an image or H.264 MOV here</strong>
              <small>or click to browse · PNG, JPG, WebP, GIF, MOV</small>
            </span>
          </label>

          <div class="source-file" id="source-file">
            <img id="source-thumbnail" alt="Selected source preview" />
            <div>
              <strong id="source-name">Loading sample…</strong>
              <span id="source-meta">—</span>
            </div>
            <button class="icon-button" id="replace-button" type="button" aria-label="Choose another image">↻</button>
          </div>

          <div class="settings-group">
            <div class="setting-heading">
              <label for="resolution">Character resolution</label>
              <output id="resolution-value" for="resolution">160 columns</output>
            </div>
            <input id="resolution" class="range" type="range" min="48" max="320" step="8" value="160" />
            <div class="range-labels" aria-hidden="true"><span>48</span><span>More detail</span><span>320</span></div>
          </div>

          <fieldset class="settings-group">
            <legend>Color depth</legend>
            <div class="palette-grid">
              <label class="palette-option">
                <input type="radio" name="color-mode" value="ansi16" />
                <span><b>Terminal</b><small>16 ANSI colors</small></span>
              </label>
              <label class="palette-option">
                <input type="radio" name="color-mode" value="ansi256" />
                <span><b>8-bit</b><small>256 colors</small></span>
              </label>
              <label class="palette-option">
                <input type="radio" name="color-mode" value="rgb565" />
                <span><b>16-bit</b><small>65K colors</small></span>
              </label>
              <label class="palette-option">
                <input type="radio" name="color-mode" value="truecolor" checked />
                <span><b>24-bit</b><small>16.7M colors</small></span>
              </label>
            </div>
          </fieldset>

          <div class="two-up">
            <label class="select-field">
              <span>Character ramp</span>
              <select id="character-set">
                <option value="classic">Classic ASCII</option>
                <option value="detailed">Detailed ASCII</option>
                <option value="minimal">Minimal ASCII</option>
              </select>
            </label>
            <label class="select-field">
              <span>Export scale</span>
              <select id="export-scale">
                <option value="1">1×</option>
                <option value="2" selected>2×</option>
                <option value="3">3×</option>
              </select>
            </label>
          </div>

          <div class="settings-group compact">
            <div class="setting-heading">
              <label for="contrast">Glyph contrast</label>
              <output id="contrast-value" for="contrast">3</output>
            </div>
            <input id="contrast" class="range" type="range" min="0" max="10" step="1" value="3" />
          </div>

          <div class="settings-group compact tonal-control">
            <div class="setting-heading">
              <label for="brightness">Image brightness</label>
              <output id="brightness-value" for="brightness">+100%</output>
            </div>
            <input id="brightness" class="range" type="range" min="-40" max="100" step="1" value="100" />
          </div>

          <div class="settings-group compact tonal-control">
            <div class="setting-heading">
              <label for="image-contrast">Image contrast</label>
              <output id="image-contrast-value" for="image-contrast">-8%</output>
            </div>
            <input id="image-contrast" class="range" type="range" min="-40" max="80" step="1" value="-8" />
          </div>

          <div class="settings-group compact tonal-control">
            <div class="setting-heading">
              <label for="saturation">Color saturation</label>
              <output id="saturation-value" for="saturation">+150%</output>
            </div>
            <input id="saturation" class="range" type="range" min="-100" max="150" step="1" value="150" />
          </div>

          <label class="color-field">
            <span>Background</span>
            <span class="color-input-wrap">
              <input id="background" type="color" value="#050604" />
              <code id="background-value">#050604</code>
            </span>
          </label>

          <button class="primary-button" id="render-button" type="button">
            <span>Render ASCII</span><span aria-hidden="true">→</span>
          </button>

          <section class="video-export" id="video-export" hidden aria-labelledby="video-export-heading">
            <div class="video-export-heading">
              <div>
                <p class="eyebrow">Frame sequence</p>
                <h3 id="video-export-heading">Export video frames</h3>
              </div>
              <code id="video-output-name">video_ascii</code>
            </div>
            <p class="video-note">A new directory inside this project will contain the numbered PNG frames. Processing stays on this device.</p>
            <p class="folder-name" id="folder-name">Output: preparing…</p>
            <label class="video-frame-field" for="start-frame">
              <span>Start at frame</span>
              <input id="start-frame" type="number" min="1" step="1" value="1" inputmode="numeric" />
            </label>
            <div class="video-progress" id="video-progress" hidden>
              <div><span id="video-progress-label">Preparing video…</span><strong id="video-progress-percent">0%</strong></div>
              <progress id="video-progress-bar" max="1" value="0"></progress>
            </div>
            <div class="video-actions">
              <button class="primary-button" id="convert-video-button" type="button" disabled>
                <span>Convert all frames</span><span aria-hidden="true">→</span>
              </button>
              <button class="cancel-button" id="cancel-video-button" type="button" hidden>Cancel</button>
            </div>
            <p class="compatibility-note" id="compatibility-note"></p>
          </section>
        </aside>

        <section class="preview-panel" aria-labelledby="preview-heading">
          <div class="preview-heading">
            <div>
              <p class="eyebrow">02 · Live output</p>
              <h2 id="preview-heading">Preview</h2>
            </div>
            <div class="status" id="status"><span></span><b>Ready</b></div>
          </div>

          <div class="canvas-stage" id="canvas-stage">
            <div class="empty-state" id="empty-state">
              <span aria-hidden="true">+:+</span>
              <p>Choose an image or H.264 MOV to begin</p>
            </div>
            <canvas id="preview-canvas" aria-label="Rendered ASCII art preview"></canvas>
          </div>

          <div class="output-bar">
            <div class="output-facts">
              <span>Output</span>
              <strong id="output-size">—</strong>
              <span class="divider" aria-hidden="true"></span>
              <span>Grid</span>
              <strong id="grid-size">—</strong>
            </div>
            <div class="output-actions">
              <button class="download-button" id="download-text-button" type="button" disabled>
                <span aria-hidden="true">↓</span> ASCII .txt
              </button>
              <button class="download-button" id="download-colors-button" type="button" disabled>
                <span aria-hidden="true">↓</span> Colors .txt
              </button>
              <button class="download-button" id="download-html-button" type="button" disabled title="Generate an HTML and CSS pair">
                <span aria-hidden="true">&lt;/&gt;</span> To HTML
              </button>
              <button class="download-button" id="download-button" type="button" disabled>
                <span aria-hidden="true">↓</span> PNG
              </button>
            </div>
          </div>
        </section>
      </section>
    </main>

    <footer>
      <span>Runs entirely in your browser.</span>
      <span>Rasterized with <a href="https://www.npmjs.com/package/@sister.software/asciify" target="_blank" rel="noreferrer">@sister.software/asciify</a>.</span>
    </footer>
  </div>
`

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing required element: ${selector}`)
  return element
}

const imageInput = getElement<HTMLInputElement>('#image-input')
const dropzone = getElement<HTMLElement>('#dropzone')
const sourceFile = getElement<HTMLElement>('#source-file')
const sourceThumbnail = getElement<HTMLImageElement>('#source-thumbnail')
const sourceName = getElement<HTMLElement>('#source-name')
const sourceMeta = getElement<HTMLElement>('#source-meta')
const replaceButton = getElement<HTMLButtonElement>('#replace-button')
const resolutionInput = getElement<HTMLInputElement>('#resolution')
const resolutionValue = getElement<HTMLOutputElement>('#resolution-value')
const characterSetInput = getElement<HTMLSelectElement>('#character-set')
const exportScaleInput = getElement<HTMLSelectElement>('#export-scale')
const contrastInput = getElement<HTMLInputElement>('#contrast')
const contrastValue = getElement<HTMLOutputElement>('#contrast-value')
const brightnessInput = getElement<HTMLInputElement>('#brightness')
const brightnessValue = getElement<HTMLOutputElement>('#brightness-value')
const imageContrastInput = getElement<HTMLInputElement>('#image-contrast')
const imageContrastValue = getElement<HTMLOutputElement>('#image-contrast-value')
const saturationInput = getElement<HTMLInputElement>('#saturation')
const saturationValue = getElement<HTMLOutputElement>('#saturation-value')
const backgroundInput = getElement<HTMLInputElement>('#background')
const backgroundValue = getElement<HTMLElement>('#background-value')
const renderButton = getElement<HTMLButtonElement>('#render-button')
const previewCanvas = getElement<HTMLCanvasElement>('#preview-canvas')
const emptyState = getElement<HTMLElement>('#empty-state')
const status = getElement<HTMLElement>('#status')
const outputSize = getElement<HTMLElement>('#output-size')
const gridSize = getElement<HTMLElement>('#grid-size')
const downloadButton = getElement<HTMLButtonElement>('#download-button')
const downloadTextButton = getElement<HTMLButtonElement>('#download-text-button')
const downloadColorsButton = getElement<HTMLButtonElement>('#download-colors-button')
const downloadHtmlButton = getElement<HTMLButtonElement>('#download-html-button')
const videoExport = getElement<HTMLElement>('#video-export')
const videoOutputName = getElement<HTMLElement>('#video-output-name')
const folderName = getElement<HTMLElement>('#folder-name')
const startFrameInput = getElement<HTMLInputElement>('#start-frame')
const videoProgress = getElement<HTMLElement>('#video-progress')
const videoProgressLabel = getElement<HTMLElement>('#video-progress-label')
const videoProgressPercent = getElement<HTMLElement>('#video-progress-percent')
const videoProgressBar = getElement<HTMLProgressElement>('#video-progress-bar')
const convertVideoButton = getElement<HTMLButtonElement>('#convert-video-button')
const cancelVideoButton = getElement<HTMLButtonElement>('#cancel-video-button')
const compatibilityNote = getElement<HTMLElement>('#compatibility-note')

let sourceBitmap: ImageBitmap | null = null
let sourceDisplayName = 'image'
let sourceObjectUrl: string | null = null
let renderSequence = 0
let renderTimer: number | null = null
let videoFile: File | null = null
let videoAbortController: AbortController | null = null
let sourceLoadSequence = 0
let latestTextExport: AsciiTextExport | null = null

function updateVideoActionState(): void {
  const isConverting = videoAbortController !== null
  convertVideoButton.disabled = isConverting || !videoFile || !('VideoDecoder' in window)
}

function getSettings(): RenderSettings {
  const colorMode = getElement<HTMLInputElement>('input[name="color-mode"]:checked').value as ColorMode

  return {
    columns: Number(resolutionInput.value),
    colorMode,
    characterSet: characterSetInput.value as CharacterSetName,
    contrast: Number(contrastInput.value),
    brightness: Number(brightnessInput.value),
    imageContrast: Number(imageContrastInput.value),
    saturation: Number(saturationInput.value),
    scale: Number(exportScaleInput.value),
    background: backgroundInput.value,
  }
}

function setStatus(message: string, state: 'ready' | 'working' | 'error' = 'ready'): void {
  status.className = `status ${state}`
  status.querySelector('b')!.textContent = message
}

function updateControlLabels(): void {
  resolutionValue.value = `${resolutionInput.value} columns`
  resolutionValue.textContent = `${resolutionInput.value} columns`
  contrastValue.value = contrastInput.value
  contrastValue.textContent = contrastInput.value
  brightnessValue.value = `${formatSigned(Number(brightnessInput.value))}%`
  brightnessValue.textContent = `${formatSigned(Number(brightnessInput.value))}%`
  imageContrastValue.value = `${formatSigned(Number(imageContrastInput.value))}%`
  imageContrastValue.textContent = `${formatSigned(Number(imageContrastInput.value))}%`
  saturationValue.value = `${formatSigned(Number(saturationInput.value))}%`
  saturationValue.textContent = `${formatSigned(Number(saturationInput.value))}%`
  backgroundValue.textContent = backgroundInput.value.toUpperCase()
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getVideoOutputDirectoryName(): string {
  const safeName = sourceDisplayName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/^[. ]+|[. ]+$/g, '')
  return `${safeName || 'video'}_ascii_out`
}

function setSourcePreview(url: string, name: string, detail: string): void {
  sourceThumbnail.src = url
  sourceName.textContent = name
  sourceMeta.textContent = detail
  sourceFile.classList.add('visible')
  dropzone.classList.add('has-source')
}

function isVideoFile(file: File): boolean {
  return file.type === 'video/quicktime' || file.type === 'video/mp4' || /\.mov$/i.test(file.name)
}

function setImageMode(): void {
  videoFile = null
  latestTextExport = null
  videoExport.hidden = true
  renderButton.hidden = false
  downloadButton.hidden = false
  downloadTextButton.hidden = false
  downloadColorsButton.hidden = false
  downloadHtmlButton.hidden = false
  downloadButton.disabled = true
  downloadTextButton.disabled = true
  downloadColorsButton.disabled = true
  downloadHtmlButton.disabled = true
  sourceThumbnail.classList.remove('video-thumbnail')
}

async function readVideoMetadata(url: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => resolve({
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
    })
    video.onerror = () => reject(new Error('The browser could not read this video.'))
    video.src = url
  })
}

async function loadVideoFile(file: File, sequence: number): Promise<void> {
  setStatus('Reading video…', 'working')
  videoAbortController?.abort()
  sourceBitmap?.close()
  sourceBitmap = null
  videoFile = file
  sourceDisplayName = file.name.replace(/\.[^.]+$/, '') || 'video'
  folderName.textContent = `Output: ${getVideoOutputDirectoryName()}/ (inside project)`
  updateVideoActionState()

  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl)
  sourceObjectUrl = URL.createObjectURL(file)

  try {
    const metadata = await readVideoMetadata(sourceObjectUrl)
    if (sequence !== sourceLoadSequence) return
    const duration = Number.isFinite(metadata.duration) ? `${metadata.duration.toFixed(1)} sec` : 'duration unavailable'
    sourceThumbnail.src = '/favicon.svg'
    sourceThumbnail.classList.add('video-thumbnail')
    setSourcePreview(sourceThumbnail.src, file.name, `${metadata.width} × ${metadata.height} · ${duration} · ${formatBytes(file.size)}`)
    videoOutputName.textContent = `${sourceDisplayName}_ascii`
    startFrameInput.value = '1'
    startFrameInput.max = ''
    videoExport.hidden = false
    renderButton.hidden = true
    downloadButton.hidden = true
    downloadTextButton.hidden = true
    downloadColorsButton.hidden = true
    downloadHtmlButton.hidden = true
    latestTextExport = null
    previewCanvas.classList.remove('visible')
    emptyState.classList.remove('hidden')
    emptyState.querySelector('p')!.textContent = 'Choose an output location, then convert the video'
    outputSize.textContent = 'PNG sequence'
    gridSize.textContent = 'Awaiting conversion'

    const supported = 'VideoDecoder' in window
    updateVideoActionState()
    compatibilityNote.textContent = supported
      ? 'Requires H.264 video. PNG frames are written through the local Vite server.'
      : 'Video export requires a browser with WebCodecs support.'
    setStatus(supported ? 'Video ready' : 'Browser unsupported', supported ? 'ready' : 'error')
  } catch (error) {
    console.error(error)
    setStatus('Could not read that video', 'error')
  }
}

async function decodeBlob(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(blob)
  }
}

async function loadFile(file: File): Promise<void> {
  const sequence = ++sourceLoadSequence
  if (isVideoFile(file)) {
    await loadVideoFile(file, sequence)
    return
  }
  if (!file.type.startsWith('image/')) {
    setStatus('Choose an image or H.264 MOV', 'error')
    return
  }

  setStatus('Reading image…', 'working')

  try {
    setImageMode()
    const nextBitmap = await decodeBlob(file)
    if (sequence !== sourceLoadSequence) {
      nextBitmap.close()
      return
    }
    sourceBitmap?.close()
    sourceBitmap = nextBitmap
    sourceDisplayName = file.name.replace(/\.[^.]+$/, '') || 'ascii-art'

    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl)
    sourceObjectUrl = URL.createObjectURL(file)
    setSourcePreview(
      sourceObjectUrl,
      file.name,
      `${nextBitmap.width} × ${nextBitmap.height} · ${formatBytes(file.size)}`,
    )
    await renderAscii()
  } catch (error) {
    console.error(error)
    setStatus('Could not read that image', 'error')
  }
}

async function loadStarterImage(): Promise<void> {
  const sequence = sourceLoadSequence
  setStatus('Loading sample…', 'working')

  try {
    setImageMode()
    const response = await fetch(SAMPLE_PATH)
    if (!response.ok) throw new Error(`Sample returned ${response.status}`)
    const blob = await response.blob()
    const bitmap = await decodeBlob(blob)
    if (sequence !== sourceLoadSequence) {
      bitmap.close()
      return
    }
    sourceBitmap = bitmap
    sourceDisplayName = 'simulations-temp-art'
    setSourcePreview(
      SAMPLE_PATH,
      'simulations temp art.JPG',
      `${sourceBitmap.width} × ${sourceBitmap.height} · local sample`,
    )
    await renderAscii()
  } catch (error) {
    console.error(error)
    setStatus('Choose an image to begin', 'ready')
  }
}

function scheduleRender(): void {
  updateControlLabels()
  if (!sourceBitmap) return
  latestTextExport = null
  downloadButton.disabled = true
  downloadTextButton.disabled = true
  downloadColorsButton.disabled = true
  downloadHtmlButton.disabled = true
  if (renderTimer !== null) window.clearTimeout(renderTimer)
  renderTimer = window.setTimeout(() => {
    void renderAscii()
  }, 140)
}

async function renderAscii(): Promise<void> {
  if (!sourceBitmap) {
    imageInput.click()
    return
  }

  const sequence = ++renderSequence
  const settings = getSettings()
  const rows = Math.max(1, Math.round(settings.columns * (sourceBitmap.height / sourceBitmap.width)))
  const baseWidth = settings.columns * CELL_SIZE
  const baseHeight = rows * CELL_SIZE
  const pixelWidth = baseWidth * settings.scale
  const pixelHeight = baseHeight * settings.scale

  if (pixelWidth > MAX_CANVAS_EDGE || pixelHeight > MAX_CANVAS_EDGE) {
    setStatus('Reduce resolution or export scale', 'error')
    return
  }

  setStatus('Rendering…', 'working')
  latestTextExport = null
  renderButton.disabled = true
  downloadButton.disabled = true
  downloadTextButton.disabled = true
  downloadColorsButton.disabled = true
  downloadHtmlButton.disabled = true

  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

  try {
    const output = new OffscreenCanvas(1, 1)
    const renderer = new Asciify2D(output, {
      characterSet: CHARACTER_SETS[settings.characterSet],
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: CELL_SIZE,
      characterSpacingRatio: 1,
      colorize: true,
      backgroundColor: settings.background,
      pixelRatio: settings.scale,
      contrastRatio: settings.contrast,
    })

    renderer.setSize(baseWidth, baseHeight)

    const sampleCanvas = new OffscreenCanvas(renderer.columnCount, renderer.rowCount)
    const sampleContext = sampleCanvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
    })

    if (!sampleContext) throw new Error('Canvas 2D is not available')

    sampleContext.imageSmoothingEnabled = true
    sampleContext.imageSmoothingQuality = 'high'
    sampleContext.drawImage(sourceBitmap, 0, 0, renderer.columnCount, renderer.rowCount)

    const imageData = sampleContext.getImageData(0, 0, renderer.columnCount, renderer.rowCount)
    adjustImageTone(
      imageData.data,
      settings.brightness,
      settings.imageContrast,
      settings.saturation,
    )
    quantizeColors(imageData.data, settings.colorMode)
    renderer.rasterize(imageData.data)

    const textExport = createAsciiTextExport(
      imageData.data,
      renderer.columnCount,
      renderer.rowCount,
      (luminance) => renderer.getCharacterFromLuminance(luminance),
    )

    if (sequence !== renderSequence) return

    previewCanvas.width = output.width
    previewCanvas.height = output.height
    const previewContext = previewCanvas.getContext('2d')
    if (!previewContext) throw new Error('Preview canvas is not available')
    previewContext.drawImage(output, 0, 0)

    emptyState.classList.add('hidden')
    previewCanvas.classList.add('visible')
    outputSize.textContent = `${output.width.toLocaleString()} × ${output.height.toLocaleString()} px`
    gridSize.textContent = `${renderer.columnCount} × ${renderer.rowCount} chars`
    latestTextExport = textExport
    downloadButton.disabled = false
    downloadTextButton.disabled = false
    downloadColorsButton.disabled = false
    downloadHtmlButton.disabled = false
    setStatus('Rendered', 'ready')
  } catch (error) {
    console.error(error)
    setStatus('Render failed', 'error')
  } finally {
    if (sequence === renderSequence) renderButton.disabled = false
  }
}

function downloadPng(): void {
  previewCanvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Could not create PNG', 'error')
      return
    }

    const settings = getSettings()
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `${sourceDisplayName}-ascii-${settings.colorMode}-${settings.columns}col.png`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }, 'image/png')
}

function downloadFile(contents: string, filename: string, type: string): void {
  const blob = new Blob([contents], { type })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function downloadTextFile(contents: string, suffix: string): void {
  const settings = getSettings()
  const filename = `${sourceDisplayName}-ascii-${settings.colorMode}-${settings.columns}col-${suffix}.txt`
  downloadFile(contents, filename, 'text/plain;charset=utf-8')
}

function downloadAsciiText(): void {
  if (!latestTextExport) {
    setStatus('Render an image before exporting text', 'error')
    return
  }
  downloadTextFile(latestTextExport.characters, 'characters')
}

function downloadAsciiColors(): void {
  if (!latestTextExport) {
    setStatus('Render an image before exporting colors', 'error')
    return
  }
  downloadTextFile(latestTextExport.colors, 'colors')
}

function getHtmlExportBaseName(): string {
  const settings = getSettings()
  const safeSourceName = sourceDisplayName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
  return `${safeSourceName || 'ascii-art'}-ascii-${settings.colorMode}-${settings.columns}col`
}

async function downloadHtmlPage(): Promise<void> {
  if (!latestTextExport) {
    setStatus('Render an image before exporting HTML', 'error')
    return
  }

  const baseFilename = getHtmlExportBaseName()
  const settings = getSettings()
  const page = createHtmlPageExport({
    art: latestTextExport,
    background: settings.background,
    baseFilename,
    title: sourceDisplayName,
  })
  const htmlFilename = `${baseFilename}.html`
  const cssFilename = `${baseFilename}.css`
  const directoryName = `${baseFilename}_html_out`

  downloadHtmlButton.disabled = true
  downloadHtmlButton.setAttribute('aria-busy', 'true')

  try {
    const directoryUrl = `/api/ascii-output/${encodeURIComponent(directoryName)}`
    const initialize = await fetch(directoryUrl, { method: 'POST' })
    const initializeType = initialize.headers.get('content-type') ?? ''
    if (!initialize.ok || !initializeType.includes('application/json')) {
      const detail = initialize.ok ? '' : (await initialize.text()).trim()
      throw new Error(
        detail
          ? `Output server error: ${detail}`
          : 'The local output server is unavailable. Stop and restart the app with npm run dev.',
      )
    }

    const files = [
      { filename: htmlFilename, contents: page.html, type: 'text/html;charset=utf-8' },
      { filename: cssFilename, contents: page.css, type: 'text/css;charset=utf-8' },
    ]
    await Promise.all(files.map(async ({ filename, contents, type }) => {
      const response = await fetch(`${directoryUrl}/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        headers: { 'Content-Type': type },
        body: contents,
      })
      if (!response.ok) {
        const detail = (await response.text()).trim()
        throw new Error(detail ? `Could not write ${filename}: ${detail}` : `Could not write ${filename}.`)
      }
    }))

    setStatus(`Saved to ${directoryName}/`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : 'Could not export HTML + CSS', 'error')
  } finally {
    downloadHtmlButton.removeAttribute('aria-busy')
    downloadHtmlButton.disabled = latestTextExport === null
  }
}

function copyVideoPreview(output: OffscreenCanvas): void {
  previewCanvas.width = output.width
  previewCanvas.height = output.height
  const context = previewCanvas.getContext('2d')
  if (!context) return
  context.clearRect(0, 0, output.width, output.height)
  context.drawImage(output, 0, 0)
  emptyState.classList.add('hidden')
  previewCanvas.classList.add('visible')
}

async function convertVideo(): Promise<void> {
  if (!videoFile) {
    setStatus('Choose an H.264 MOV first', 'error')
    return
  }

  const file = videoFile
  const settings = getSettings()
  const requestedStartFrame = Math.max(1, Math.floor(Number(startFrameInput.value) || 1))
  videoAbortController = new AbortController()
  convertVideoButton.setAttribute('aria-busy', 'true')
  updateVideoActionState()
  cancelVideoButton.hidden = false
  videoProgress.hidden = false
  videoProgressBar.removeAttribute('value')
  videoProgressLabel.textContent = 'Reading H.264 frames…'
  videoProgressPercent.textContent = '0%'
  setStatus('Preparing video…', 'working')

  try {
    const directoryName = getVideoOutputDirectoryName()
    const initialize = await fetch(`/api/ascii-output/${encodeURIComponent(directoryName)}`, { method: 'POST' })
    const initializeType = initialize.headers.get('content-type') ?? ''
    if (!initialize.ok || !initializeType.includes('application/json')) {
      const detail = initialize.ok ? '' : (await initialize.text()).trim()
      throw new Error(
        detail
          ? `Output server error: ${detail}`
          : 'The local output server is unavailable. Stop and restart the app with npm run dev.',
      )
    }
    folderName.textContent = `Output: ${directoryName}/ (inside project)`

    const count = await convertVideoToAscii(
      file,
      async (filename, png) => {
        const response = await fetch(
          `/api/ascii-output/${encodeURIComponent(directoryName)}/${encodeURIComponent(filename)}`,
          { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: png },
        )
        if (!response.ok) {
          const detail = (await response.text()).trim()
          throw new Error(detail ? `Could not write ${filename}: ${detail}` : `Could not write ${filename}.`)
        }
      },
      {
        ...settings,
        characterSet: CHARACTER_SETS[settings.characterSet],
        startFrame: requestedStartFrame,
      },
      {
        onMetadata: (metadata) => {
          startFrameInput.max = String(metadata.totalFrames)
          const actualStartFrame = Math.min(metadata.totalFrames, requestedStartFrame)
          startFrameInput.value = String(actualStartFrame)
          const outputFrames = metadata.totalFrames - actualStartFrame + 1
          videoProgressBar.max = outputFrames
          videoProgressBar.value = 0
          videoProgressLabel.textContent = `0 / ${outputFrames.toLocaleString()} frames · starting at ${actualStartFrame.toLocaleString()}`
          sourceMeta.textContent = `${metadata.width} × ${metadata.height} · ${metadata.codec} · ${metadata.totalFrames.toLocaleString()} frames`
        },
        onProgress: (progress, output) => {
          videoProgressBar.value = progress.completedFrames
          const percent = Math.round((progress.completedFrames / progress.totalFrames) * 100)
          videoProgressPercent.textContent = `${percent}%`
          videoProgressLabel.textContent = `${progress.completedFrames.toLocaleString()} / ${progress.totalFrames.toLocaleString()} frames`
          outputSize.textContent = `${progress.outputWidth.toLocaleString()} × ${progress.outputHeight.toLocaleString()} px`
          gridSize.textContent = `${progress.columns} × ${progress.rows} chars`
          if (progress.completedFrames === 1 || progress.completedFrames === progress.totalFrames || progress.completedFrames % 10 === 0) {
            copyVideoPreview(output)
          }
          setStatus(`Frame ${progress.completedFrames} of ${progress.totalFrames}`, 'working')
        },
      },
      videoAbortController.signal,
    )
    setStatus(`${count.toLocaleString()} PNG frames saved`)
    videoProgressLabel.textContent = `${count.toLocaleString()} frames complete`
    videoProgressPercent.textContent = '100%'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      setStatus('Conversion cancelled')
      videoProgressLabel.textContent = 'Cancelled · completed PNGs were kept'
    } else {
      console.error(error)
      setStatus(error instanceof Error ? error.message : 'Video conversion failed', 'error')
      videoProgressLabel.textContent = 'Conversion stopped'
    }
  } finally {
    videoAbortController = null
    convertVideoButton.removeAttribute('aria-busy')
    cancelVideoButton.hidden = true
    updateVideoActionState()
  }
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0]
  if (file) void loadFile(file)
})

replaceButton.addEventListener('click', () => imageInput.click())
renderButton.addEventListener('click', () => void renderAscii())
downloadButton.addEventListener('click', downloadPng)
downloadTextButton.addEventListener('click', downloadAsciiText)
downloadColorsButton.addEventListener('click', downloadAsciiColors)
downloadHtmlButton.addEventListener('click', () => void downloadHtmlPage())
convertVideoButton.addEventListener('click', () => void convertVideo())
cancelVideoButton.addEventListener('click', () => videoAbortController?.abort())

for (const eventName of ['dragenter', 'dragover']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropzone.classList.add('dragging')
  })
}

for (const eventName of ['dragleave', 'drop']) {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropzone.classList.remove('dragging')
  })
}

dropzone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files[0]
  if (file) void loadFile(file)
})

resolutionInput.addEventListener('input', scheduleRender)
contrastInput.addEventListener('input', scheduleRender)
brightnessInput.addEventListener('input', scheduleRender)
imageContrastInput.addEventListener('input', scheduleRender)
saturationInput.addEventListener('input', scheduleRender)
backgroundInput.addEventListener('input', scheduleRender)
characterSetInput.addEventListener('change', scheduleRender)
exportScaleInput.addEventListener('change', scheduleRender)

for (const colorInput of document.querySelectorAll<HTMLInputElement>('input[name="color-mode"]')) {
  colorInput.addEventListener('change', scheduleRender)
}

updateControlLabels()
void loadStarterImage()
