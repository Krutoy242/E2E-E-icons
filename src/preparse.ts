import * as fs from 'fs-extra'
import _ from 'lodash'
import { tree, Item, Tree } from './Tree'
import { iterateAllImages } from './utils'

const dot = () => process.stdout.write('.')

async function init() {
  console.log('starting loop...')
  let i = 0
  await iterateAllImages((_fullPath, _filename, g, sNBT) => {
    tree.add(
      new Item(
        g.namespace ?? 'fluid__',
        g.name ?? g.fluid,
        parseInt(g.meta ?? '0'),
        g.hash ?? '',
        sNBT
      )
    )

    if (i % 500 == 0) dot()
    i++
  })

  const exportTree: Tree = {}

  function metaIsSingle(meta: { [key: string]: string | undefined }): boolean {
    if (Object.entries(meta).length == 1) {
      const [k] = Object.entries(meta)[0]
      if (k == '') return true
    }
    return false
  }

  for (const [key_source, source] of Object.entries(tree.tree)) {
    exportTree[key_source] = {}

    for (const [key_entry, entry] of Object.entries(source)) {
      exportTree[key_source][key_entry] = {}

      if (Object.entries(entry).length == 1) {
        const [k, metaDict] = Object.entries(entry)[0]
        if (k == '0' && metaIsSingle(metaDict)) continue
      }

      for (const [key_meta, metaDict] of Object.entries(entry)) {
        exportTree[key_source][key_entry][key_meta] = {}

        if (metaIsSingle(metaDict)) continue

        for (const [key_hash, hash] of Object.entries(metaDict)) {
          exportTree[key_source][key_entry][key_meta][key_hash] = hash ?? ''
        }
      }
    }
  }

  fs.writeFileSync('src/parsed_items.json', JSON.stringify(exportTree, null, 2))

  //##################################################################
  //
  // Item names
  //
  //##################################################################

  const crafttweaker_raw = fs.readFileSync(
    'D:/mc_client/Instances/Enigmatica2Expert - Extended/crafttweaker_raw.log',
    'utf8'
  )
  type CrlogRawType = {
    [mod: string]: [
      display: string,
      stack: string,
      snbt?: string,
      burnTime?: number
    ][]
  }
  const modMap: CrlogRawType = JSON.parse(crafttweaker_raw)?.all_items
  if (!modMap) {
    console.log('something wrong with parseCrafttweakerLog_raw')
    process.exit(1)
  }

  const nameLines = _(modMap)
    .values()
    .flatten()
    .map(([display, stack, snbt]) => {
      if (display.startsWith('Cable Facade - ')) return undefined
      const [mod, id, meta] = stack.split(':')
      const arr: Array<string | number> = [
        display.replace(/§./g, ''),
        `${mod}:${id}`,
      ]
      const hasNBT = snbt && snbt != '{}'
      if (meta || hasNBT) arr.push(meta ?? 0)
      if (hasNBT) arr.push(snbt)
      return JSON.stringify(arr)
    })
    .filter()
    .unshift(
      ..._(modMap)
        .entries()
        .map(([modName, [[, id]]]) =>
          JSON.stringify([modName, id.split(':')[0]])
        )
        .value()
    )

  fs.writeFileSync(
    'src/parsed_names.json',
    `[
${nameLines.join(',\n')}
]`
  )
}
init()
