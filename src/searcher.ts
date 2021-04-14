import * as fs from 'fs-extra'
import { Base, Tree } from './Tree'
import gitio from 'gitio'
import _ from 'lodash'
import chalk from 'chalk'
import TrieSearch from 'trie-search'

const write=(s='.')=>process.stdout.write(s)

//##################################################################
// 
// Preparations
// 
//##################################################################

type DictEntry = {
  name:string
  id:string
  modid:string
  modname:string
  meta:string
  nbt:string
}


const trieSearch = new TrieSearch(['name', 'id', 'modid', 'modname', 'meta', 'nbt'],{splitOnRegEx:false, idFieldOrFunction: 'uniq_id'});

function initTrie() {
  if(trieSearch.size) return
  write(' Init dictionary...')
  const nameDictionary:DictEntry[] = (JSON.parse(fs.readFileSync('src/parsed_names.json', 'utf8')) as string[])
  .map(([name, id, meta, nbt], i)=>({
    name,
    id,
    meta,
    nbt,
    modid:   id.split(':')[0],
    modname: id.split(':')[0],
    uniq_id: i
  }))
  write(' Map Trie...')
  trieSearch.addAll(nameDictionary);
  write(' done.\n')
}

//##################################################################
// 
// Find words
// 
//##################################################################

//#########################
// Brackeds method
//#########################
export function bracketsSearch(md:string, callback:(replaced:string)=>void):void {
  const replaces: {from:string, base:Base, name:string}[] = []
  const unclears: string[] = []

  write('Looking for Item names ')

  const capture_rgx = /\[(?<capture>[^\]]+)\](?!\()(?<tail>\s+\((?<option>[^)]+)\))?/gmi

  for (const match of md.matchAll(capture_rgx)) {
    initTrie()
    write()
    if(handleMatch(match)) continue
  }


  //#########################
  // Handlers
  //#########################
  function abbr1(str:string){
    return str
    .replace(/[^\w ]/, '') // Remove special chars
    .split(' ').map(s=>s[0]).join('') // First letter of each word
  }

  // function abbr2(str:string){
  //   return str
  //   .replace(/[^A-Z0-9]/, '') // Remove special chars
  // }

  function handleMatch(
    match: RegExpMatchArray
  ):boolean {
    const {capture, option} = match.groups
    
    // 1 Match
    const searchResult:DictEntry[] = trieSearch.get(capture);
    function handleSingleMatch(result:DictEntry[]):boolean {
      if(result.length === 1) {
        pushForReplacing(result[0], match)
        return true
      }
      
      const exacts = result.filter(r=>r.name.toLowerCase() === capture.toLowerCase())
      if(exacts.length==1) {
        pushForReplacing(exacts[0], match)
        return true
      }
    }
    if(handleSingleMatch(searchResult)) return true

    // MANY Matches
    if(searchResult.length > 1) {

      const subSearch = new TrieSearch(['modid', 'modname', 'meta', 'nbt'],{splitOnRegEx:false});
      subSearch.addAll(searchResult);
      console.log('option :>> ', option);
      console.log('subSearch :>> ', subSearch.get(option));
      console.log('subSearch :>> ', subSearch.get(abbr1(option)));

      if(option) {
        // Option lookup
        if(handleSingleMatch(subSearch.get(option))) return true

        // Option with Abbreviatures (mod name like IC2)
        if(handleSingleMatch(subSearch.get(abbr1(option)))) return true
      }

      pushUnclear(capture, searchResult)
      return false
    }

    pushUnclear(capture)

    return false
  }

  function pushUnclear(capture: string, itemArr: DictEntry[]=[]) {
    let s = '['+chalk.bgGreen.black(capture)+']'

    if(itemArr.length) s+=' have alts'

    const uniqMods = _.uniqBy(itemArr, 'mod')
    if(uniqMods.length > 1) {
      s += (` from different mods.`+
      ` Specify by adding mod name, mod abbr. or mod id.`+
      example(`${capture} (${uniqMods[0].modid})`))
    } else {
      const metas = itemArr.map(o=>parseInt(o.meta)).sort()
      const uniq_metas = _.uniq(metas)

      if(metas.length != uniq_metas.length) {
        const last = itemArr.pop()
        s += (` with different meta AND definition.`+
        ` Use braket handlers instead of names.`+
        example(`<${last['Registry name']}:${last.meta}>`))
      } else {
        s += (` with different meta.`+
        ` Add meta in brackets.`+
        example(`${capture} (${metas.pop()})`))
      }
    }

    function example(str:string):string {
      return ` Example: ${chalk.green(str)}`
    }

    unclears.push(s)
  }

  function pushForReplacing(item: DictEntry, match: RegExpMatchArray) {
    replaces.push({
      name: item.name,
      from: match[0],
      base: [...item.id.split(':'), item.meta, item.nbt] as unknown as Base
    })
  }

  // Sort to parsing longest first
  replaces.sort((a, b) => b.name.length - a.name.length)

  console.log(' done')

  if(unclears.length)
    console.log(unclears.join('\n'))

  if(replaces.length) {
    console.log('found names: ', chalk.bold.yellow(replaces.length))
  } else {
    console.log('No replacables found.')
    process.exit(0)
  }

  //##################################################################
  // 
  // Replace words with links
  // 
  //##################################################################

  const parsed: Tree = JSON.parse(fs.readFileSync('src/parsed_items.json', 'utf8'))

  function getSerialized(base: Base): string {
    const [bOwner, bName, bMeta, bNBT] = base
    const definition = parsed[bOwner]?.[bName]
    if(!definition) return undefined
    const s = `${bOwner}__${bName}`

    const stack = definition[bMeta]
    if(stack==null) return `${s}__0`

    for (const [key_hash, sNBT] of Object.entries(stack)) {
      if(sNBT!= '' && sNBT == bNBT) return `${s}__${bMeta}__${key_hash}`
    }

    return `${s}__${bMeta}`
  }

  write('Replacing ');

  let tmpMd = md;
  const shortReplaces: {from:string, name:string, p: Promise<string>}[] = []
  for (const r of replaces) {
    const ser = getSerialized(r.base)
    if(!ser) continue;


    tmpMd = tmpMd.replace(r.from, () => {
      const p:Promise<string> = gitio(`https://github.com/Krutoy242/E2E-E-icons/raw/main/x32/${ser}.png`)
      p.then(()=>write())
      shortReplaces.push({p, ...r})
      return ''
    })
  }


  Promise.all(shortReplaces.map(r=>r.p)).then((shorts)=>{
    shorts.forEach((short,i)=>{
      md = md.replace(shortReplaces[i].from, (...args) =>
        `${args.pop().prefix ?? ''}![](${short} "${shortReplaces[i].name}")`
      )
    })

    callback(md)
    console.log(' done');
  })
}