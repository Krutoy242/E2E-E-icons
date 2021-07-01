import images from "images"
import * as fs from 'fs-extra'
import { iterateAllImages } from "./utils"
import _ from "lodash"

const RES = 8192
const img = images(RES, RES)

let x = 0
let y = 0
function moveCursor() {
  x += 32
  if(x > RES-32) {
    x = 0
    y += 32
    if(y > RES-32) {
      throw new Error("Out of Sprite")
    }
  }
}

const sheet:{[itemID:string]: string[][]} = {}
let k = 0;

iterateAllImages((fullPath, filename, groups, sNBT)=>{
  img.draw(images(fullPath), x, y)

  const {namespace, name, meta, _hash, fluid} = groups

  const entry = [`${x} ${y}`]
  if(sNBT) entry.push(sNBT)
  const stackDef = `${namespace ?? 'fluid'}:${name ?? fluid}:${meta ?? 0}`
  ;(sheet[stackDef] ??= []).push(entry)

  moveCursor()
})

img.save("spritesheet.png", {quality: 90});

fs.writeFileSync(
  'spritesheet.json',
  '{\n'+_(sheet).toPairs().map(([id, list])=>`"${id}":${JSON.stringify(list)}`).join(',\n')+'\n}'
)