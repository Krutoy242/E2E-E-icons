import chalk from 'chalk'
import { DictEntry } from './searcher'
import _ from 'lodash'
import {terminal as term} from 'terminal-kit'

function linesOfMatch(match: RegExpMatchArray, lines = 0):string {
  let k = lines
  let start = match.index
  while(start-- && (match.input[start] !== '\n' || k--));

  k = lines
  let end = match.index
  while(match.input.length > ++end && (match.input[end] !== '\n' || k--));

  return ` in line:\n`+chalk.gray(match.input.substring(start, end))+`\n`
}

function nbtToString(nbt: string):string {
  if(!nbt) return ''
  return chalk` {rgb(33,173,204) ${nbt.length > 50 ? nbt.substring(0,49)+"…" : nbt}}`
}

function gridMenuBuilder(itemArr:DictEntry[]) {
return async (cb:(d: DictEntry)=>string) => {
  const trimedArr = itemArr.slice(0, term.height - 8).map(cb)
  const diff = itemArr.length - trimedArr.length
  if(diff) trimedArr.push(`{and other ${diff} variants}`)
  return itemArr[(await term.singleColumnMenu(trimedArr, {cancelable:true}).promise).selectedIndex]
}}

export class Unclear {
  // private unclears: string[] = []
  private unfounds: string[] = []

  print():void {
    if(this.unfounds.length) {
      console.log(chalk`{bgGrey.black ❌ can't be found:}`)

      const maxLen = _.maxBy(this.unfounds, 'length').length
      const width = process.stdout.columns
      const columns = ((width / (maxLen + 4)) | 0) || 1
      console.log(
        _.chunk(this.unfounds.map(s=>'['+(chalk.bgGreen.black(s)+']').padEnd(maxLen)), columns)
        .map(r=>r.join('  '))
        .join('\n')
        + '\n'
      )
    }
  }

  cantBeFound(capture: string):void {
    this.unfounds.push(capture)
  }

  async doYouMean(capture: string, wholeDict: DictEntry[], match: RegExpMatchArray):Promise<DictEntry> {
    const inLine = linesOfMatch(match)

    const gridMenu = gridMenuBuilder(wholeDict)

    term`\n❗ can't be found: [`.bgGreen.black(capture)(`]`+inLine)`\nDo you mean (ESC - skip):\n`
    return gridMenu(d=>chalk`[{green ${d.name}}] <{rgb(0,158,145) ${d.id}:${d.meta}}>`+nbtToString(d.nbt))
  }

  async resolve(capture: string, full_itemArr: DictEntry[], match: RegExpMatchArray):Promise<DictEntry> {
    const exactArr = full_itemArr.filter(r=>r.name.toLowerCase() === capture.toLowerCase())
    const itemArr = exactArr.length>1 ? exactArr : full_itemArr

    // Conditions
    if(!itemArr.length) return this.cantBeFound(capture), undefined

    const is_allItemsHasUniqNames = itemArr.length === _.uniqBy(itemArr, 'name').length
    const is_allModsAreDifferent = _(itemArr).countBy('modid').every(v=>v===1)
    const is_sameMod_metasDifferent = _.uniqBy(itemArr, 'modid').length===1 && _(itemArr).countBy('meta').every(v=>v===1)
    const gridMenu = gridMenuBuilder(itemArr)
    const inLine = linesOfMatch(match)

    if(is_allItemsHasUniqNames) {
      term`\nSelect full name of [`.bgGreen.black(capture).styleReset()(`]`+inLine)
      return gridMenu(d=>chalk`[{green ${d.name}}]`)
    }

    if(is_allModsAreDifferent) {
      term`\nSelect `.bgColorRgb(0, 98, 143).black`mod`.styleReset()` for [`.bgGreen.black(capture).styleReset()(`]`+inLine)
      return gridMenu(d=>chalk`({rgb(0, 98, 143) ${d.modname}})`)
    }

    if(is_sameMod_metasDifferent) {
      term`\nSelect `.bgCyan.black(`meta`).styleReset()` of [`.bgGreen.black(capture).styleReset()(`]`+inLine)
      return gridMenu(d=>chalk`({cyan ${d.meta}})`)
    }

    {
      term`\nHave no clue what you looking for [`.bgGreen.black(capture)(`]`+inLine)`\nSelect Any variant:\n`
      return gridMenu(d=>chalk`[{green ${d.name}}] <{rgb(0,158,145) ${d.id}:${d.meta}}>`+nbtToString(d.nbt))
    }
  }
}