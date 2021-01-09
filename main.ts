import * as path from 'path'
import * as fs from 'fs-extra'
import * as glob from 'glob'

import {tree, Item} from './Tree'
import { parse as parseNBT  } from "nbt-ts"

// actuallyadditions__battery_bauble__0__486c93ecf7a496392b74e28a24f1966f
// actuallyadditions__battery_bauble__0

console.log('starting loop...')
let i=0
for(const filePath of glob.sync('x16/*.png')) {
  const filename = path.parse(filePath).name

  const g = filename.match(/(?<namespace>.+?)__(?<name>.+?)__(?<meta>\d+)(__(?<hash>.+))?|fluid__(?<fluid>.+)/)?.groups

  if(!g) {
    console.log('groups are wrong :>> ', filename);
    continue
  }

  // If we have hashed nbt
  // let nbtObj: object
  let nbtText:string = null
  if(g.hash != null) {
    nbtText = fs.readFileSync(`x16/${filename}.txt`, 'utf8')
    // try {
    //   nbtObj = eval(`(${nbtText})`)
    // } catch (error) {
    //   console.log('nbtText :>> ', nbtText);
    //   const parsed = parseNBT(nbtText)
    //   console.log('parsed :>> ', parsed);
    // }
  }

  tree.add(new Item(
    g.namespace ?? 'fluid__',
    g.name ?? g.fluid,
    parseInt(g.meta ?? '0'),
    g.hash ?? '',
    nbtText,
  ))

  if(i%500==0) process.stdout.write('.')
  i++
}

// console.log('tree :>> ', tree);


const exportTree:object = {}

for (const [key_source, source] of Object.entries(tree.tree)) {
  exportTree[key_source] = {}

  for (const [key_entry, entry] of Object.entries(source)) {
    exportTree[key_source][key_entry] = {}

    for (const [key_meta, meta] of Object.entries(entry)) {
      exportTree[key_source][key_entry][key_meta] = {}

      for (const [key_hash, hash] of Object.entries(meta)) {
        exportTree[key_source][key_entry][key_meta][key_hash] = hash
      }
    }
  }
}

fs.writeFileSync(
  'parsed_items.json',
  JSON.stringify(exportTree, null, 2)
)