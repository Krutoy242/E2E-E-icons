import * as fs from 'fs-extra'
import csv_parse from 'csv-parse/lib/sync'
import RegexEscape from 'regex-escape'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { Base, Tree } from './Tree'
import gitio from 'gitio'
import _ from 'lodash'
import chalk from 'chalk'


//##################################################################
// 
// Preparations
// 
//##################################################################

// actuallyadditions__battery_bauble__0__486c93ecf7a496392b74e28a24f1966f
// actuallyadditions__battery_bauble__0

const write=(s='.')=>process.stdout.write(s)

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
  const name = c['Display name']
  nameMap.set(name, nameMap.get(name) ?? [])
  nameMap.get(name).push(c)
})

const map = [...nameMap].sort((a,b)=>b[1].length - a[1].length).filter(o=>o[1].length>1)


//##################################################################
// 
// Find words
// 
//##################################################################


// Find this words in text file
const replaces: {from:RegExp, base:Base, name:string}[] = []
const unclears: string[] = []
let namesCount = 0
write('Looking for Item names ')
for (const [itemName, itemArr] of nameMap) {
  if(itemName == '') continue
  if(namesCount%1000==0) write()
  namesCount++

  const escaped:string = RegexEscape(itemName)
  const rgx = new RegExp(`(?<prefix>^|[^\\[\\w])(?<capture>${escaped})(?!\\]|\\w)`, 'gmi')

  for (const match of md.matchAll(rgx)) {
    handleMatch(match, itemName, itemArr, rgx, escaped)
  }
}

function handleMatch(match: RegExpMatchArray, itemName: string, itemArr: TellmeEntry[], rgx: RegExp, escaped:string) {
  if(itemArr.length === 1) return pushForReplacing(itemName, rgx, itemArr[0])

  const sub_md = md.substring(match.index)
  const rgx_tail = '(?<tail>\\s*\\((?<option>[^\\)]+)\\))'
  const opts_rgx = new RegExp(`^${escaped}${rgx_tail}`, 'mi')
  const sub_match = sub_md.match(opts_rgx)
  if(!sub_match) {
    pushUnclear(itemName, itemArr)
    pushForReplacing(itemName, rgx, itemArr.pop())
    return
  }

  const option = sub_match.groups.option
  const glob_rgx = new RegExp(`(?<capture>${escaped}${RegexEscape(sub_match.groups.tail)})`, 'gmi')
  const num = parseInt(option)
  if(!isNaN(num)) return pushForReplacing(itemName, glob_rgx, itemArr.find(o=> parseInt(o['Meta/dmg']) == num))
  
  const modToAbbr1 = (str:string)=>str
    .replace(/[^\w ]/, '') // Remove special chars
    .split(' ').map(s=>s[0]).join('') // First letter of each word

  const modToAbbr2 = (str:string)=>str
    .replace(/[^A-Z0-9]/, '') // Remove special chars
  
  const opLow = option.toLowerCase()
  for (const f of [
    (o:TellmeEntry)=>o['Mod name'].toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>modToAbbr1(o['Mod name']).toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>modToAbbr2(o['Mod name']).toLowerCase().startsWith(opLow),
    (o:TellmeEntry)=>o['Registry name'].split(':')[0].startsWith(opLow),
  ]) {
    const optedItem = itemArr.find(f)
    if(optedItem) {
      pushForReplacing(itemName, glob_rgx, optedItem)
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

function pushForReplacing(itemName: string, rgx: RegExp, item: TellmeEntry) {
  replaces.push({
    name:itemName,
    from: rgx,
    base: [...item['Registry name'].split(':'), item['Meta/dmg'], item['NBT'].replace('""','"')] as Base
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
  const definition = parsed[base[0]]?.[base[1]]
  if(!definition) return undefined
  let s = `${base[0]}__${base[1]}`

  const stack = definition[base[2]]
  if(stack==null) return `${s}__0`

  for (const [key_hash, sNBT] of Object.entries(stack)) {
    if(sNBT!= '' && sNBT == base[3]) return `${s}__${base[2]}__${key_hash}`
  }

  return `${s}__${base[2]}`
}

write('Replacing ');

let tmpMd = md;
const shortReplaces: {from:RegExp, name:string, p: Promise<string>}[] = []
replaces.forEach(r=>{
  const ser = getSerialized(r.base)
  if(!ser) return;

  tmpMd = tmpMd.replace(r.from, () => {
    const p:Promise<string> = gitio(`https://github.com/Krutoy242/E2E-E-icons/raw/main/x32/${ser}.png`)
    p.then(()=>write())
    shortReplaces.push({p, ...r})
    return ''
  })
})

Promise.all(shortReplaces.map(r=>r.p)).then((shorts)=>{
  shorts.forEach((short,i)=>{
    md = md.replace(shortReplaces[i].from, `$<prefix>![${shortReplaces[i].name}](${short})`)
  })

  fs.writeFileSync(argv.filename as string, md)
  console.log(' done');
})
