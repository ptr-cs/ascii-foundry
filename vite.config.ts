import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const OUTPUT_ROUTE = '/api/ascii-output/'

function safeSegment(value: string): string | null {
  return /^[a-zA-Z0-9._ -]+$/.test(value) && value !== '.' && value !== '..' ? value : null
}

function localOutputPlugin(): Plugin {
  const configure = (server: { middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void } }) => {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith(OUTPUT_ROUTE)) return next()

      try {
        const url = new URL(request.url, 'http://localhost')
        const parts = url.pathname.slice(OUTPUT_ROUTE.length).split('/').map(decodeURIComponent)
        const directoryName = safeSegment(parts[0] ?? '')
        const filename = parts[1] ? safeSegment(parts[1]) : null
        if (!directoryName || (parts[1] && !filename)) {
          response.statusCode = 400
          response.end('Invalid output name')
          return
        }

        const projectRoot = resolve(process.cwd())
        const outputDirectory = resolve(projectRoot, directoryName)
        if (!outputDirectory.startsWith(`${projectRoot}${sep}`)) throw new Error('Unsafe output path')
        await mkdir(outputDirectory, { recursive: true })

        if (request.method === 'POST' && !filename) {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ directory: directoryName }))
          return
        }

        if (request.method === 'PUT' && filename && /\.(?:png|html|css)$/i.test(filename)) {
          const chunks: Buffer[] = []
          for await (const chunk of request) chunks.push(Buffer.from(chunk))
          await writeFile(resolve(outputDirectory, filename), Buffer.concat(chunks))
          response.statusCode = 204
          response.end()
          return
        }

        response.statusCode = 405
        response.end('Method not allowed')
      } catch (error) {
        console.error(error)
        response.statusCode = 500
        response.end(error instanceof Error ? error.message : 'Output failed')
      }
    })
  }

  return {
    name: 'local-ascii-output',
    configureServer: configure,
    configurePreviewServer: configure,
  }
}

export default defineConfig({
  plugins: [localOutputPlugin()],
})
