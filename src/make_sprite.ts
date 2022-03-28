import { createCanvas, loadImage } from 'canvas'
import * as fs from 'fs-extra'
import iconIterator from './utils'
import _ from 'lodash'

const RES = 2 ** 13
const canvas = createCanvas(RES, RES)
const ctx = canvas.getContext('2d')

let x = 0
let y = 0
function moveCursor() {
  x += 32
  if (x > RES - 32) {
    process.stdout.write('.')
    x = 0
    y += 32
    if (y > RES - 32) {
      throw new Error('Out of Sprite')
    }
  }
}

const sheet: { [itemID: string]: string[][] } = {}

async function init() {
  console.log('wrighting :>> ')
  for (const icon of iconIterator('x32')) {
    ctx.drawImage(await loadImage(icon.filePath), x, y)

    const entry = [`${x} ${y}`]
    if (icon.sNbt) entry.push(icon.sNbt)
    const stackDef = `${icon.namespace}:${icon.name}:${icon.meta}`
    ;(sheet[stackDef] ??= []).push(entry)

    moveCursor()
  }

  // Write the image to file
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync('assets/spritesheet.png', buffer)

  fs.writeFileSync(
    'assets/spritesheet.json',
    '{\n' +
      _(sheet)
        .toPairs()
        .map(([id, list]) => `"${id}":${JSON.stringify(list)}`)
        .join(',\n') +
      '\n}'
  )
}

init()
