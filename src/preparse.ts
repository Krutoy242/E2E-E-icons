import * as path from 'path'
import * as glob from 'glob'
import {tree, Item, Tree} from './Tree'
import * as fs from 'fs-extra'


const dot=()=>process.stdout.write('.')

console.log('starting loop...')
let i=0
for(const filePath of glob.sync('x32/*.png')) {
  const filename = path.parse(filePath).name

  const g = filename.match(/(?<namespace>.+?)__(?<name>.+?)__(?<meta>\d+)(__(?<hash>.+))?|fluid__(?<fluid>.+)/)?.groups

  if(!g) {
    console.log('groups are wrong :>> ', filename);
    continue
  }

  // If we have hashed nbt
  let nbtText:string = null
  if(g.hash != null) {
    nbtText = fs.readFileSync(`x32/${filename}.txt`, 'utf8')
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


const exportTree:Tree = {}

function metaIsSingle(meta:{[key: string]: string}): boolean {
  if(Object.entries(meta).length == 1) {
    const [k] = Object.entries(meta)[0]
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
  'src/parsed_items.json',
  JSON.stringify(exportTree, null, 2)
)


//##################################################################
// 
// Item names
// 
//##################################################################
// Sequoia Fence Gate Cover=>thermaldynamics:cover:0=>{Meta:0b,Block:"forestry:fence.gates.sequoia"}

const crafttweaker_raw = fs.readFileSync(`src/crafttweaker_raw.log`, 'utf8')

const nameLines = crafttweaker_raw
.split('\n')
.map(l=>{
  const match = l.match(/^(?<name>.*)=>(?<id>[^:]+:[^:]+):(?<meta>\d+)=>(?<nbt>\{.*\})$/)
  if(!match && l!='') console.log('cant match :>> ', l)
  return match?.groups
})
.filter(m=>m)
.map(g=>{
  g.meta = parseInt(g.meta) as unknown as string
  g.name = g.name.replace(/§./, '')
  return JSON.stringify(Object.values(g))
})

fs.writeFileSync(
  'src/parsed_names.json',
`[
${nameLines.join(',\n')}
]`
)
