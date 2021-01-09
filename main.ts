import * as fs from 'fs-extra'
import csv_parse from 'csv-parse/lib/sync'
import RegexEscape from 'regex-escape'
import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import { Base } from './Tree'



// actuallyadditions__battery_bauble__0__486c93ecf7a496392b74e28a24f1966f
// actuallyadditions__battery_bauble__0

const dot=(s='.')=>process.stdout.write(s)

const argv = yargs(hideBin(process.argv)).argv

// Argument warning
if(!argv.filename) {
  const userArgs = Object.entries(argv).filter(a=>a[0]!='_' && a[0]!='$0')
  console.log('Run this task with --filename="path/to/file.md" argument')
  if(userArgs.length>0) console.log('Arguments:', userArgs)
  process.exit(0)
}

// Temp for tests
// argv.filename ??= 'README.md'

let md = fs.readFileSync(argv.filename as string, 'utf8')

// Make set from CSV
const csv: {[key:string]:string}[] = csv_parse(fs.readFileSync('items-with-nbt-csv.csv', 'utf8'), {columns: true})
const nameSet = new Set<string>(csv.map(o=>o['Display name']))

// Find this words in text file
const replaces: {from:RegExp, base:Base, name:string}[] = []
let namesCount = 0
dot('Looking for Item names ')
for (const itemName of nameSet) {
  if(itemName == '') continue

  const rgx = new RegExp(`(^|[^\\[])(${RegexEscape(itemName)})(?!\\]|\\w)`, 'gm')
  const match = md.match(rgx)
  if(match) {
    pushForReplacing(itemName, rgx);
  }
  if(namesCount%1000==0) dot()
  namesCount++
}

function pushForReplacing(itemName: string, rgx: RegExp) {
  const item = csv.find(o=>o['Display name']==itemName)
  replaces.push({
    name:itemName,
    from: rgx,
    base: [...item['Registry name'].split(':'), item['Meta/dmg'], item['NBT'].replace('""','"')] as Base
  })
}

console.log('')
console.log('found items: ', replaces.map(o=>o.name))


const parsed = JSON.parse(fs.readFileSync('parsed_items.json', 'utf8'))

function getSerialized(base: Base): string {
  const definition = parsed[base[0]]?.[base[1]]
  if(!definition) return undefined
  let s = `${base[0]}__${base[1]}`

  const stack = definition[base[2]]
  if(!stack) return `${s}__0`

  for (const [key_hash, sNBT] of Object.entries(stack)) {
    if(sNBT == base[3]) return `${s}__${base[2]}__${key_hash}`
  }

  return `${s}__${base[2]}`
}

replaces.forEach(r => {
  const ser = getSerialized(r.base)
  if(!ser) return;

  md = md.replace(r.from, `$1![${r.name}](https://github.com/Krutoy242/E2E-E-icons/raw/main/x32/${ser}.png)`)
})

fs.writeFileSync(argv.filename as string, md)