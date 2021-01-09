import * as path from 'path'
import * as glob from 'glob'
import {tree, Item} from './Tree'
import * as fs from 'fs-extra'

const dot=()=>process.stdout.write('.')

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
  }

  tree.add(new Item(
    g.namespace ?? 'fluid__',
    g.name ?? g.fluid,
    parseInt(g.meta ?? '0'),
    g.hash ?? '',
    nbtText,
  ))

  if(i%500==0) dot()
  i++
}


const exportTree:object = {}

function metaIsSingle(meta:{[key: string]: string}): boolean {
  if(Object.entries(meta).length == 1) {
    const [k, v] = Object.entries(meta)[0]
    if(k=='') return true
  }
  return false
}

for (const [key_source, source] of Object.entries(tree.tree)) {
  exportTree[key_source] = {}

  for (const [key_entry, entry] of Object.entries(source)) {
    exportTree[key_source][key_entry] = {}

    if(Object.entries(entry).length == 1) {
      const [k, v] = Object.entries(entry)[0]
      if(k=='0' && metaIsSingle(v)) continue
    }

    for (const [key_meta, meta] of Object.entries(entry)) {
      exportTree[key_source][key_entry][key_meta] = {}

      if(metaIsSingle(meta)) continue

      for (const [key_hash, hash] of Object.entries(meta)) {
        exportTree[key_source][key_entry][key_meta][key_hash] = hash ?? ''
      }
    }
  }
}

fs.writeFileSync(
  'parsed_items.json',
  JSON.stringify(exportTree, null, 2)
)
