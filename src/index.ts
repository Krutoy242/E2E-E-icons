import yargs from 'yargs'
import * as fs from 'fs-extra'
import { bracketsSearch } from './searcher'

const yargsOpts = {
  input: {
    alias: 'i',
    type: 'string',
    describe: 'Input file path',
    default: 'README.md',
  },
  treshold: {
    alias: 't',
    type: 'number',
    describe: 'Levenshtein name mistake treshold',
    default: 0,
  },
  silent: { alias: 's', type: 'boolean', describe: 'Do not any prompt' },
} as const

export type CliOpts = {
  [key in keyof typeof yargsOpts]: string | number
}

const argv = yargs(process.argv.slice(2))
  .options(yargsOpts)
  .version(false)
  .wrap(null)
  .parseSync()

bracketsSearch(
  argv as unknown as CliOpts,
  fs.readFileSync(argv.input, 'utf8'),
  (replaced) => fs.writeFileSync(argv.input, replaced)
)
