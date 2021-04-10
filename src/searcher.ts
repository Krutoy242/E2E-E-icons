import * as fs from 'fs-extra'
import csv_parse from 'csv-parse/lib/sync'
import RegexEscape from 'regex-escape'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { Base, Tree } from './Tree'
import gitio from 'gitio'
import _ from 'lodash'
import chalk from 'chalk'


// actuallyadditions__battery_bauble__0__486c93ecf7a496392b74e28a24f1966f
// actuallyadditions__battery_bauble__0

const write=(s='.')=>process.stdout.write(s)

//##################################################################
// 
// Preparations
// 
//##################################################################

const argv = yargs(hideBin(process.argv)).argv

// Argument warning
if(!argv.filename) {
  const userArgs = Object.entries(argv).filter(a=>a[0]!='_' && a[0]!='$0')
  console.log('Run this task with --filename="path/to/file.md" argument')
  if(userArgs.length>0) console.log('Arguments:', userArgs)
  // process.exit(0)
}

// Temp for tests
argv.filename ??= 'README.md'

let md = fs.readFileSync(argv.filename as string, 'utf8')

// Make set from CSV
type TellmeEntry = {
  "Mod name": string
  "Registry name": string
  "Item ID": string
  "Meta/dmg": string
  "Subtypes": string
  "Display name": string
  "Ore Dict keys": string
  "NBT": string
}

const csv: TellmeEntry[] = csv_parse(fs.readFileSync('items-with-nbt-csv.csv', 'utf8'), {columns: true})
const nameMap = new Map<string, TellmeEntry[]>()

csv.forEach(c=>{
  const name = c['Display name'].replace(/§./, '')
  nameMap.set(name, nameMap.get(name) ?? [])
  nameMap.get(name).push(c)
})

// const map = [...nameMap].sort((a,b)=>b[1].length - a[1].length).filter(o=>o[1].length>1)


//##################################################################
// 
// Find words
// 
//##################################################################


// Find this words in text file
const replaces: {from:string, base:Base, name:string}[] = []
const unclears: string[] = []

write('Looking for Item names ')

;(argv.u || argv.uncaptured) 
  ? uncapturedSearch()
  : bracketsSearch()

//#########################
// Forced method
//#########################
function uncapturedSearch() {
  let namesCount = 0
  for (const [itemName, sameItemNameArr] of nameMap) {
    if(itemName == '') continue
    if(namesCount%1000==0) write()
    namesCount++

    const itemName_escaped:string = RegexEscape(itemName)
    const capture_rgx = new RegExp(`(?<prefix>^|[^\\[\\w"])(?<capture>${itemName_escaped})(?!\\]|\\w|")(?<tail>\\s+\\((?<option>[^\\)]+)\\))?`, 'gmi')

    for (const match of md.matchAll(capture_rgx)) {
      handleMatch(match, sameItemNameArr)
    }
  }
}

//#########################
// Brackeds method
//#########################
function bracketsSearch() {
  const capture_rgx = /\[(?<capture>[^\]]+)\](?!\()(?<tail>\s+\((?<option>[^)]+)\))?/gmi

  function lookupInNameMap(match: RegExpMatchArray, name:string) {
    // Find if there is item with exact name
    const sameItemNameArr = nameMap.get(name)
    if(sameItemNameArr) {
      handleMatch(match, sameItemNameArr)
      return true
    }

    const partialMatches:string[] = []
    for (const [itemName] of nameMap)
      if(itemName.toLowerCase().startsWith(name.toLowerCase()))
        partialMatches.push(itemName)

    if(partialMatches.length > 0) {
      // Find if name is starting of words
      if(partialMatches.length === 1) {
        handleMatch(match, nameMap.get(partialMatches[0]))
        return true
      }

      // We have many partial matches.
      // Pick one with most symbols in it
      partialMatches.sort((a, b) => b.length - a.length)
      handleMatch(match, nameMap.get(partialMatches[0]))
      return true
    }

    return false
  }

  for (const match of md.matchAll(capture_rgx)) {
    write()

    const itemName = match.groups.capture

    if(lookupInNameMap(match, itemName)) continue
    if(lookupInNameMap(match, abbr1(itemName))) continue
    if(lookupInNameMap(match, abbr2(itemName))) continue

    unclears.push(`[${chalk.bgYellow.black(itemName)}] cant be found`)
  }
}


//#########################
// Handlers
//#########################
function abbr1(str:string){
  return str
  .replace(/[^\w ]/, '') // Remove special chars
  .split(' ').map(s=>s[0]).join('') // First letter of each word
}

function abbr2(str:string){
  return str
  .replace(/[^A-Z0-9]/, '') // Remove special chars
}

function handleMatch(
  match: RegExpMatchArray,
  sameItemNameArr: TellmeEntry[]
) {
  const itemName = match.groups.capture
  if(sameItemNameArr.length === 1) return pushForReplacing(itemName, match[0], sameItemNameArr[0])

  if(!match.groups.option) {
    // This name have no options
    pushUnclear(itemName, sameItemNameArr)
    pushForReplacing(itemName, match[0], sameItemNameArr.pop())
    return
  }

  const option = match.groups.option
  // const glob_rgx = new RegExp(`(?<capture>${RegexEscape(itemName)}${RegexEscape(match.groups.tail)})`, 'gmi')
  const num = parseInt(option)
  if(!isNaN(num)) return pushForReplacing(itemName, match[0], sameItemNameArr.find(o=> parseInt(o['Meta/dmg']) == num))
  
  const opLow = option.toLowerCase()
  for (const f of [
    (o:TellmeEntry)=>o['Mod name'].toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>abbr1(o['Mod name']).toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>abbr2(o['Mod name']).toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>o['Registry name'].split(':')[0].startsWith(opLow),
  ]) {
    const optedItem = sameItemNameArr.find(f)
    if(optedItem) {
      pushForReplacing(itemName, match[0], optedItem)
      break
    }
  }
}


function pushUnclear(itemName: string, itemArr: TellmeEntry[]) {
  let s = (`${chalk.bgGreen.black(itemName)} have alts`)

  function example(str:string):string {
    return ` Example: ${chalk.green(str)}`
  }

  const uniqMods = _.uniqBy(itemArr, 'Mod name')
  if(uniqMods.length > 1) {
    s += (` from different mods.`+
    ` Specify by adding `+`mod name, mod abbr. or mod id.`+
    example(`${itemName} (${uniqMods[0]['Mod name']})`))
  } else {
    const metas = itemArr.map(o=>parseInt(o['Meta/dmg'])).sort()
    const uniq_metas = _.uniq(metas)

    if(metas.length != uniq_metas.length) {
      const last = itemArr.pop()
      s += (` with different meta AND definition.`+
      ` Use braket handlers instead of names.`+
      example(`<${last['Registry name']}:${last['Meta/dmg']}>`))
    } else {
      s += (` with different meta.`+
      ` Add meta in brackets.`+
      example(`${itemName} (${metas.pop()})`))
    }
  }

  unclears.push(s)
}


function pushForReplacing(itemName: string, from: string, item: TellmeEntry) {
  replaces.push({
    name: item['Display name'],
    from,
    base: [...item['Registry name'].split(':'), item['Meta/dmg'], item['NBT'].replace('""', '"')] as unknown as Base
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



const parsed: Tree = JSON.parse(fs.readFileSync('parsed_items.json', 'utf8'))

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

  fs.writeFileSync(argv.filename as string, md)
  console.log(' done');
})
