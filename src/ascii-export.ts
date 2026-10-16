export type AsciiTextExport = {
  characters: string
  colors: string
  columns: number
  rows: number
}

type CharacterLookup = (luminance: number) => string

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase()
}

export function createAsciiTextExport(
  pixels: Uint8ClampedArray,
  columns: number,
  rows: number,
  getCharacterFromLuminance: CharacterLookup,
): AsciiTextExport {
  if (pixels.length < columns * rows * 4) {
    throw new Error('The sampled image data does not contain the complete character grid.')
  }

  const characterRows: string[] = []
  const colorRows: string[] = []

  for (let row = 0; row < rows; row += 1) {
    let characters = ''
    const colors: string[] = []

    for (let column = 0; column < columns; column += 1) {
      const index = (row * columns + column) * 4
      const red = pixels[index]
      const green = pixels[index + 1]
      const blue = pixels[index + 2]
      const luminance = (red + red + red + blue + green + green + green + green) >> 3

      characters += getCharacterFromLuminance(luminance)
      colors.push(`#${toHex(red)}${toHex(green)}${toHex(blue)}`)
    }

    characterRows.push(characters)
    colorRows.push(colors.join(' '))
  }

  return {
    characters: characterRows.join('\n'),
    colors: colorRows.join('\n'),
    columns,
    rows,
  }
}
