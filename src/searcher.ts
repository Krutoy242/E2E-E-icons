import { Base, Tree } from './Tree'
import _ from 'lodash'
import chalk from 'chalk'
import { Reducer, TrieSearch } from '@committed/trie-search'
import { escapeRegex } from './utils'
import { Unclear } from './unclear'
import levenshtein from 'fast-levenshtein'
import parsed_names_json from './parsed_names.json'
import parsed_items_json from './parsed_items.json'
import { CliOpts } from '.'

const parsed_names = parsed_names_json as [
  name: string,
  id: `${string}${'' | `':'+${string}`}`,
  n_meta?: number,
  nbt?: string
][]
const parsed_items = parsed_items_json as Tree

const write = (s = '.') => process.stdout.write(s)

//##################################################################
//
// Preparations
//
//##################################################################

export type DictEntry = {
  name: string
  name_low: string
  id: string
  modid: string
  modname: string
  modAbbr: string
  meta: number
  nbt: string | undefined
  uniq_id: number
}

const trieSearch = new TrieSearch<DictEntry>(
  ['name', 'id', 'modid', 'modname', 'meta' /* , 'nbt' */],
  { /* splitOnRegEx:false,  */ idFieldOrFunction: 'uniq_id' }
)
const nameDictionary: DictEntry[] = []
const nameAliases: Record<string, string> = {}
const lookupTree: {
  [modid: string]: {
    [definition: string]: {
      [meta: number]: DictEntry
    }
  }
} = {}

function initTrie() {
  if (trieSearch.size) return
  write(' Init dictionary...')
  parsed_names.forEach(([name, id, n_meta, nbt], i) => {
    const [modid, definition] = id.split(':')
    if (!name || !id) return
    if (!definition) {
      nameAliases[modid] = name
      return
    }
    const meta = n_meta ?? 0
    const modname = nameAliases[modid]

    const newEntry: DictEntry = {
      name,
      id,
      meta,
      nbt,
      modid,
      modname,
      name_low: name.toLowerCase(),
      modAbbr: abbr1(modname),
      uniq_id: i,
    }
    nameDictionary.push(newEntry)

    const oldEntry = ((lookupTree[modid] ??= {})[definition] ??= {})[meta]
    if (!oldEntry || oldEntry.nbt)
      lookupTree[modid][definition][meta] = newEntry
  })
  write(' Map Trie...')
  trieSearch.addAll(nameDictionary)
  write(' done.\n')

  // console.log('trieSearch.get(capture) :>> ', getTrieSearch('Tier Installer'));
}

function getTrieSearch(s: string, subTrie = trieSearch): DictEntry[] {
  return subTrie.get(
    s.split(/\s/),
    TrieSearch.UNION_REDUCER as unknown as Reducer<DictEntry>
  )
}

export type LevDict = [number, DictEntry]
function doYouMean(capture: string): LevDict[] {
  const capture_low = capture.toLowerCase()
  const lev = nameDictionary.map(
    (o) => [levenshtein.get(o.name_low, capture_low), o] as LevDict
  )
  return _.sortBy(lev, 0)
}

function abbr1(str: string) {
  return str
    .replace(/[^\w ]/, '') // Remove special chars
    .split(' ')
    .map((s) => s[0])
    .join('') // First letter of each word
}

//##################################################################
//
// Find words
//
//##################################################################

export interface RgxExecIconMatch extends RegExpMatchArray {
  index: number
  input: string
  groups: {
    capture: string
    tail?: string
    option?: string
  }
}

//#########################
// Brackeds method
//#########################
export async function bracketsSearch(
  argv: CliOpts,
  md: string,
  callback: (replaced: string) => void
): Promise<void> {
  const replaces: { from: string; to: { base: Base; name: string }[] }[] = []
  const unclear = new Unclear(argv)

  write('Looking for Item names ')

  const capture_rgx =
    /\[(?<capture>[^\][]+)\](?!\()(?<tail>\s+\((?<option>[^)]+)\))?/gim

  for (const match of md.matchAll(capture_rgx)) {
    initTrie()
    write()
    await handleMatch(match as RgxExecIconMatch)
  }

  //#########################
  // Handlers
  //#########################

  async function handleMatch(match: RgxExecIconMatch): Promise<void> {
    const { option } = match.groups
    let { capture } = match.groups
    const fullCapture = capture

    // Skip if empty (or Markdown list)
    if (!capture.trim() || /^x$/i.test(capture)) return

    // Remove wildcards
    let isAny = false
    let isEvery = false
    capture = capture
      .replace(/\s*\(Any\)\s*/gi, () => ((isAny = true), ' '))
      .replace(/\s*\(Every\)\s*/gi, () => ((isEvery = true), ' '))
      .trim()

    const commandGroups = capture.match(
      /^<(?<id>[^:]+:[^:]+)(:(?<meta>\d+))?>$/
    )?.groups as unknown as CommandStringGroups | undefined

    const searchResult: DictEntry[] = commandGroups
      ? getCommandStringSearch(commandGroups)
      : getTrieSearch(capture)

    // 1 Match
    if (handleSingleMatch(searchResult)) return
    function handleSingleMatch(result: DictEntry[]): boolean {
      // Only one match
      if (result.length === 1) {
        pushForReplacing(result[0], match)
        return true
      }

      // Many matches, but only one is exact
      const exacts = result.filter(
        (r) => r.name.toLowerCase() === capture.toLowerCase()
      )
      if (exacts.length == 1) {
        pushForReplacing(exacts[0], match)
        return true
      } else {
        // Exact one item from Minecraft - this probably what user want
        const fromMC = exacts.filter((r) => r.modid === 'minecraft')
        if (fromMC.length === 1) {
          pushForReplacing(fromMC[0], match)
          return true
        }
      }

      // We have Tank with same name. This is fluid
      const fluidTank = result.filter(
        (r) => r.name.toLowerCase() === capture.toLowerCase() + ' tank'
      )
      if (fluidTank.length === 1) {
        pushForReplacing(fluidTank[0], match, (de) =>
          de.name.replace(/ Tank$/, '')
        )
        return true
      }

      // Many matches, but they all same item with different NBT
      if (
        _(result)
          .map((d) => _(d).pick(['name', 'id', 'meta']))
          .uniqWith(_.isEqual)
          .value().length === 1
      ) {
        pushForReplacing(result[0], match)
        return true
      }

      if (isAny && result.length > 1) {
        const matchTest = new RegExp(
          match.groups.capture.replace(
            /\s*\(Any\)\s*(.*)/gi,
            (__, r1) => '.*' + escapeRegex(r1)
          ),
          'i'
        )
        if (result.every((r) => matchTest.test(r.name))) {
          pushForReplacing(result[0], match)
          return true
        }
      }

      if (isEvery && result.length > 1) {
        const matchTest = new RegExp(
          match.groups.capture.replace(
            /\s*\(Every\)\s*(.*)/gi,
            (__, r1) => '.*' + escapeRegex(r1)
          ),
          'i'
        )
        if (result.every((r) => matchTest.test(r.name))) {
          pushForReplacing(result, match)
          return true
        }
      }
      return false
    }

    // MANY Matches
    if (searchResult.length > 1) {
      let reducedSearchResult = searchResult
      const reduceMagic = (a: DictEntry[]) =>
        a.length > 1 ? (reducedSearchResult = a) : a
      if (option) {
        // Option with Abbreviatures
        const abbrSearch = new TrieSearch<DictEntry>(['modAbbr'], {
          splitOnRegEx: undefined,
          idFieldOrFunction: 'uniq_id',
        })
        abbrSearch.addAll(searchResult)
        if (handleSingleMatch(reduceMagic(getTrieSearch(option, abbrSearch))))
          return

        // Option lookup
        const subSearch = new TrieSearch<DictEntry>(
          ['modid', 'modname', 'meta' /* , 'nbt' */],
          { splitOnRegEx: undefined, idFieldOrFunction: 'uniq_id' }
        )
        subSearch.addAll(searchResult)
        if (handleSingleMatch(reduceMagic(getTrieSearch(option, subSearch))))
          return
      }

      const resolved = await unclear.resolve(
        fullCapture,
        reducedSearchResult,
        match
      )
      if (resolved) pushForReplacing(resolved, match)
      return
    }

    // No matches, try do_you_mean
    if (searchResult.length == 0) {
      const levDict = doYouMean(capture)
      const treshold = Number(argv.treshold) || 0
      const t1 = levDict[0][0]
      const t2 = levDict[1][0]
      const isTresholdPass = t1 < t2 && t1 <= treshold
      const resolved = isTresholdPass
        ? levDict[0][1]
        : await unclear.doYouMean(fullCapture, levDict, match)
      if (resolved) pushForReplacing(resolved, match)
      return
    }

    unclear.cantBeFound(fullCapture)
  }

  function pushForReplacing(
    de_arr: DictEntry | DictEntry[],
    match: RegExpMatchArray,
    getDEName = (de: DictEntry) => de.name
  ) {
    replaces.push({
      to: (Array.isArray(de_arr) ? de_arr : [de_arr]).map((de) => ({
        name: getDEName(de),
        base: [...de.id.split(':'), de.meta, de.nbt] as unknown as Base,
      })),
      from: match[0],
    })
  }

  // Sort to parsing longest first
  replaces.sort((a, b) => b.from.length - a.from.length)

  console.log(' done')

  unclear.print()

  if (replaces.length) {
    console.log('found names: ', chalk`{bold.yellow ${replaces.length}}`)
  } else {
    console.log('No replacables found.')
    process.exit(0)
  }

  //##################################################################
  //
  // Replace words with links
  //
  //##################################################################

  function getSerialized(base: Base): string | undefined {
    const [bOwner, bName, bMeta, bNBT] = base
    const definition = parsed_items[bOwner]?.[bName]
    if (!definition) return undefined
    const s = `${bOwner}__${bName}`

    const stack = definition[bMeta]
    if (stack == null) return `${s}__0`

    for (const [key_hash, sNBT] of Object.entries(stack)) {
      if (sNBT != '' && sNBT == bNBT) return `${s}__${bMeta}__${key_hash}`
    }

    return `${s}__${bMeta}`
  }

  write('Replacing ')

  let tmpMd = md
  // Get all promises
  const actualReplaces: typeof replaces = []
  const shortURL_promises: Promise<string>[] = []
  for (const repl of replaces) {
    tmpMd = tmpMd.replace(repl.from, (match) => {
      const serialized = repl.to
        .map((r) => getSerialized(r.base))
        .filter((r) => r)
      if (serialized.length > 0) {
        actualReplaces.push(repl)

        for (const ser of serialized) {
          const p = gitio(
            `https://github.com/Krutoy242/E2E-E-icons/raw/main/x32/${ser}.png`
          )
          p.then(() => write())
          shortURL_promises.push(p)
        }
        return ''
      }
      return match
    })
  }

  Promise.all(shortURL_promises).then((shortURLs) => {
    let k = 0
    actualReplaces.forEach((repl) => {
      md = md.replace(repl.from, (...args) =>
        repl.to
          .map(
            (item) =>
              `${args.pop()?.prefix ?? ''}![](${shortURLs[k++]} "${item.name}")`
          )
          .join('')
      )
    })

    callback(md)
    console.log(' done')
  })

  // process.exit()
}

interface CommandStringGroups {
  id: `${string}:${string}`
  meta?: `${number}`
}

function getCommandStringSearch(groups: CommandStringGroups): DictEntry[] {
  const [modid, definition] = groups.id.split(':')
  return [lookupTree[modid][definition][Number(groups.meta) || 0]]
}
