import { Asciify2D } from '@sister.software/asciify'
import {
  DataStream,
  MP4BoxBuffer,
  createFile,
  type Movie,
  type Sample,
  type Track,
} from 'mp4box'
import { adjustImageTone, quantizeColors, type ColorMode } from './quantize'

const CELL_SIZE = 10
const MAX_CANVAS_EDGE = 12_000

export type VideoRenderSettings = {
  columns: number
  colorMode: ColorMode
  characterSet: string
  contrast: number
  brightness: number
  imageContrast: number
  saturation: number
  scale: number
  background: string
  startFrame: number
}

export type VideoMetadata = {
  codec: string
  width: number
  height: number
  totalFrames: number
}

export type VideoProgress = VideoMetadata & {
  completedFrames: number
  outputWidth: number
  outputHeight: number
  columns: number
  rows: number
}

type VideoCallbacks = {
  onMetadata?: (metadata: VideoMetadata) => void
  onProgress?: (progress: VideoProgress, preview: OffscreenCanvas) => void
}

export type FrameWriter = (filename: string, png: Blob) => Promise<void>

type AvcSampleEntry = Sample['description'] & {
  avcC?: { write: (stream: DataStream) => void }
}

function abortError(): DOMException {
  return new DOMException('Video conversion was cancelled.', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}

function getAvcDescription(sample: Sample): Uint8Array<ArrayBuffer> {
  const avcC = (sample.description as AvcSampleEntry).avcC
  if (!avcC) throw new Error('This H.264 track does not contain an AVC decoder configuration.')

  const stream = new DataStream(undefined, 0)
  avcC.write(stream)
  const buffer = stream.buffer
  return new Uint8Array(buffer.slice(8))
}

async function extractVideo(file: File, signal?: AbortSignal): Promise<{
  metadata: VideoMetadata
  samples: Sample[]
  description: Uint8Array<ArrayBuffer>
}> {
  throwIfAborted(signal)
  const bytes = await file.arrayBuffer()
  throwIfAborted(signal)

  return new Promise((resolve, reject) => {
    const mp4 = createFile()
    let settled = false

    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    mp4.onError = (message) => fail(new Error(`Could not parse the MOV file: ${message}`))
    mp4.onReady = (info: Movie) => {
      try {
        throwIfAborted(signal)
        const track = info.videoTracks[0] as Track | undefined
        if (!track) throw new Error('The MOV file does not contain a video track.')
        if (!/^avc[13]/i.test(track.codec)) {
          throw new Error(`The video codec is ${track.codec}; this converter currently requires H.264/AVC.`)
        }

        const samples: Sample[] = []
        mp4.onSamples = (_id, _user, batch) => {
          samples.push(...batch)
          if (samples.length < track.nb_samples || settled) return
          try {
            const first = samples[0]
            if (!first) throw new Error('No decodable video frames were found.')
            const description = getAvcDescription(first)
            settled = true
            resolve({
              metadata: {
                codec: track.codec,
                width: track.video?.width ?? Math.round(track.track_width),
                height: track.video?.height ?? Math.round(track.track_height),
                totalFrames: track.nb_samples,
              },
              samples,
              description,
            })
          } catch (error) {
            fail(error)
          }
        }

        mp4.setExtractionOptions(track.id, undefined, { nbSamples: Math.max(1, track.nb_samples) })
        mp4.start()
      } catch (error) {
        fail(error)
      }
    }

    try {
      mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(bytes, 0), true)
      mp4.flush()
    } catch (error) {
      fail(error)
    }
  })
}

function waitForCapacity(notify: (resolve: () => void) => void): Promise<void> {
  return new Promise((resolve) => notify(resolve))
}

export async function convertVideoToAscii(
  file: File,
  writeFrame: FrameWriter,
  settings: VideoRenderSettings,
  callbacks: VideoCallbacks = {},
  signal?: AbortSignal,
): Promise<number> {
  if (!('VideoDecoder' in window) || !('EncodedVideoChunk' in window)) {
    throw new Error('This browser does not support WebCodecs. Use a current Chrome or Edge release.')
  }

  const extracted = await extractVideo(file, signal)
  callbacks.onMetadata?.(extracted.metadata)
  const { metadata, samples, description } = extracted
  const startFrame = Math.min(metadata.totalFrames, Math.max(1, Math.floor(settings.startFrame)))
  const outputFrameCount = metadata.totalFrames - startFrame + 1
  const rows = Math.max(1, Math.round(settings.columns * (metadata.height / metadata.width)))
  const baseWidth = settings.columns * CELL_SIZE
  const baseHeight = rows * CELL_SIZE
  if (baseWidth * settings.scale > MAX_CANVAS_EDGE || baseHeight * settings.scale > MAX_CANVAS_EDGE) {
    throw new Error('Reduce character resolution or export scale before converting this video.')
  }

  const config: VideoDecoderConfig = {
    codec: metadata.codec,
    codedWidth: metadata.width,
    codedHeight: metadata.height,
    description,
    optimizeForLatency: false,
  }
  const support = await VideoDecoder.isConfigSupported(config)
  if (!support.supported) throw new Error(`This browser cannot decode ${metadata.codec}.`)

  const output = new OffscreenCanvas(1, 1)
  const renderer = new Asciify2D(output, {
    characterSet: settings.characterSet,
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
  const sampleContext = sampleCanvas.getContext('2d', { alpha: true, willReadFrequently: true })
  if (!sampleContext) throw new Error('Canvas 2D is not available.')
  sampleContext.imageSmoothingEnabled = true
  sampleContext.imageSmoothingQuality = 'high'

  const digits = Math.max(6, String(metadata.totalFrames).length)
  let completedFrames = 0
  let receivedFrames = 0
  let pendingRenders = 0
  let renderChain: Promise<void> = Promise.resolve()
  let renderFailure: unknown
  const capacityWaiters = new Set<() => void>()
  const notifyCapacity = (): void => {
    for (const resolve of capacityWaiters) resolve()
    capacityWaiters.clear()
  }

  const decoder = new VideoDecoder({
    output: (frame) => {
      const frameNumber = ++receivedFrames
      if (frameNumber < startFrame) {
        frame.close()
        notifyCapacity()
        return
      }
      pendingRenders += 1
      renderChain = renderChain
        .then(async () => {
          throwIfAborted(signal)
          sampleContext.clearRect(0, 0, renderer.columnCount, renderer.rowCount)
          sampleContext.drawImage(frame, 0, 0, renderer.columnCount, renderer.rowCount)
          const imageData = sampleContext.getImageData(0, 0, renderer.columnCount, renderer.rowCount)
          adjustImageTone(imageData.data, settings.brightness, settings.imageContrast, settings.saturation)
          quantizeColors(imageData.data, settings.colorMode)
          renderer.rasterize(imageData.data)

          const blob = await output.convertToBlob({ type: 'image/png' })
          const filename = `frame_${String(frameNumber).padStart(digits, '0')}.png`
          await writeFrame(filename, blob)
          completedFrames += 1
          callbacks.onProgress?.({
            ...metadata,
            totalFrames: outputFrameCount,
            completedFrames,
            outputWidth: output.width,
            outputHeight: output.height,
            columns: renderer.columnCount,
            rows: renderer.rowCount,
          }, output)
        })
        .catch((error) => {
          renderFailure = error
        })
        .finally(() => {
          pendingRenders -= 1
          frame.close()
          notifyCapacity()
        })
    },
    error: (error) => {
      renderFailure = error
      notifyCapacity()
    },
  })

  try {
    decoder.configure(support.config ?? config)
    for (const sample of samples) {
      throwIfAborted(signal)
      if (renderFailure) throw renderFailure
      while (decoder.decodeQueueSize > 6 || pendingRenders > 2) {
        await waitForCapacity((resolve) => capacityWaiters.add(resolve))
        throwIfAborted(signal)
        if (renderFailure) throw renderFailure
      }
      if (!sample.data) throw new Error(`Frame ${sample.number} has no encoded data.`)
      decoder.decode(new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: Math.round((sample.cts * 1_000_000) / sample.timescale),
        duration: Math.round((sample.duration * 1_000_000) / sample.timescale),
        data: sample.data,
      }))
    }
    await decoder.flush()
    await renderChain
    throwIfAborted(signal)
    if (renderFailure) throw renderFailure
    return completedFrames
  } finally {
    if (decoder.state !== 'closed') decoder.close()
  }
}
