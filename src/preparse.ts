import * as fs from 'fs-extra'
import _ from 'lodash'
import {tree, Item, Tree} from './Tree'
import { iterateAllImages } from './utils'


const dot=()=>process.stdout.write('.')

console.log('starting loop...')
let i=0
iterateAllImages((fullPath, filename, g, sNBT)=>{
  tree.add(new Item(
    g.namespace ?? 'fluid__',
    g.name ?? g.fluid,
    parseInt(g.meta ?? '0'),
    g.hash ?? '',
    sNBT,
  ))

  if(i%500==0) dot()
  i++
})


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

type CrlogRawType = { [mod:string]: [display:string, stack:string, snbt?:string][] }

const crafttweaker_raw = fs.readFileSync('D:/mc_client/Instances/Enigmatica2Expert - Extended/crafttweaker_raw.log', 'utf8')
let modMap_txt = crafttweaker_raw.match(/~~ All items list\n([\s\S\n\r]*)\n~~ End of All items list/m)?.[1]
if(!modMap_txt) {
  console.log('something wrong with parseCrafttweakerLog_raw')
  process.exit(1)
}

// Fix errors
modMap_txt = modMap_txt.replace(/\["(.*?)","(.*?)"(?:,'(.*)')?\]/g, (...m)=>
  `[${m.slice(1,4).filter(o=>o).map(s=>'"'+s.replace(/"/g, '\\"')+'"').join(',')}]`
).replace('],\n}',']}')

let modMap:CrlogRawType={}
try {
  modMap = JSON.parse(modMap_txt)
} catch (e) {
  console.log(e.message)
  console.log(modMap_txt.substring(7171780, 7171980))
  process.exit(1)
}

const nameLines = _(modMap).values().flatten()
.map(([display, stack, snbt]) => {
  if(display.startsWith('Cable Facade - ')) return undefined
  const [mod, id, meta] = stack.split(':')
  const arr = [display.replace(/§./g, ''), `${mod}:${id}`, parseInt(meta||'0')]
  if(snbt) arr.push(snbt)
  return JSON.stringify(arr)
})
.filter()

fs.writeFileSync(
  'src/parsed_names.json',
`[
${nameLines.join(',\n')}
]`
)
