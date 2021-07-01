import chalk from 'chalk'
import { DictEntry } from './searcher'
import _ from 'lodash'


export class Unclear {
  private unclears: string[] = []

  print():void {
    if(this.unclears.length) console.log(this.unclears.join('\n'))
  }

  add(capture: string, full_itemArr: DictEntry[]=[]):void {
    let s = '['+chalk.bgGreen.black(capture)+']'

    const exactArr = full_itemArr.filter(r=>r.name.toLowerCase() === capture.toLowerCase())
    const itemArr = exactArr.length>1 ? exactArr : full_itemArr
    if(itemArr.length) s+=' ❔ have alts'

    // Conditions
    const is_noClue = itemArr.length > 0
    const is_allItemsHasUniqNames = itemArr.length === _.uniqBy(itemArr, 'name').length
    const is_allModsAreDifferent = _(itemArr).countBy('modid').every(v=>v===1)
    const is_sameMod_metasDifferent = _.uniqBy(itemArr, 'modid').length===1 && _(itemArr).countBy('meta').every(v=>v===1)

    const unclearKinds: (()=>string|boolean)[] = [
      ()=> !is_noClue && (s+=
        chalk`{bgGrey.black ❌ cant be found}`
      ),

      ()=> is_allItemsHasUniqNames && (s+=
        chalk` with different {bgGreen.black names}. Write one of full names:\n`+
        itemArr.map(d=>chalk`[{green ${d.name}}]`).join('\n')
      ),

      ()=> is_allModsAreDifferent && (s+=
        chalk` from different {bgRgb(0, 98, 143).black mods}. Specify by adding mod name, mod abbr. or mod id:\n`+
        itemArr.map(d=>chalk`[{green ${d.name}}] ({rgb(0, 98, 143) ${d.modname}})`).join('\n')
      ),

      ()=> is_sameMod_metasDifferent && (s+=
        chalk` with different {bgCyan.black metas}. Add meta in brackets:\n`+
        itemArr.map(d=>chalk`[{green ${d.name}}] ({green ${d.meta}})`).join('\n')
      ),

      ()=> (s+=
        chalk`. Have {red no clue} what you looking for. Try using brackets:\n`+
        itemArr.map(d=>chalk`[{green ${d.name}}] ({green ${d.meta}}) is <{rgb(0,158,145) ${d.id}:${d.meta}}>`).join('\n')
      ),
    ]

    unclearKinds.some(p=>p())

    this.unclears.push(s)
  }
}