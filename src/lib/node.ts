import sharp from 'sharp'
import {
  createAsciiGridFromRgba,
  DEFAULT_ASCII_OPTIONS,
  type AsciiRenderOptions,
} from './core.js'
import {
  createAsciiHtmlFragment,
  type AsciiHtmlFragment,
  type AsciiHtmlOptions,
} from './html.js'

export type ImageInput = string | ArrayBuffer | Uint8Array | Uint8ClampedArray

export type CreateAsciiHtmlFromImageOptions = AsciiRenderOptions & AsciiHtmlOptions & {
  input: ImageInput
  columns?: number
  rows?: number
}

function validateDimension(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer.`)
  }
  return value
}

export async function createAsciiHtmlFromImage({
  input,
  columns: requestedColumns = DEFAULT_ASCII_OPTIONS.columns,
  rows: requestedRows,
  characterSet,
  contrast,
  brightness,
  imageContrast,
  saturation,
  colorMode,
  className,
  label,
  decorative,
  selectable,
}: CreateAsciiHtmlFromImageOptions): Promise<AsciiHtmlFragment> {
  const columns = validateDimension(requestedColumns, 'columns')
  const metadata = await sharp(input).metadata()
  const orientedWidth = metadata.autoOrient?.width ?? metadata.width
  const orientedHeight = metadata.autoOrient?.height ?? metadata.height

  if (!orientedWidth || !orientedHeight) {
    throw new Error('The source image does not report usable width and height metadata.')
  }

  const rows = requestedRows === undefined
    ? Math.max(1, Math.round(columns * (orientedHeight / orientedWidth)))
    : validateDimension(requestedRows, 'rows')
  const { data, info } = await sharp(input)
    .autoOrient()
    .resize({
      width: columns,
      height: rows,
      fit: 'fill',
      kernel: 'lanczos3',
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  if (info.channels !== 4) {
    throw new Error(`Expected a four-channel RGBA image but Sharp returned ${info.channels} channels.`)
  }

  const art = createAsciiGridFromRgba(
    {
      data: new Uint8ClampedArray(data),
      width: info.width,
      height: info.height,
    },
    {
      characterSet,
      contrast,
      brightness,
      imageContrast,
      saturation,
      colorMode,
    },
  )

  return createAsciiHtmlFragment(art, {
    className,
    label,
    decorative,
    selectable,
  })
}
