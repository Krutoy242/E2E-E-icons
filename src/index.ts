import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs-extra'
import { bracketsSearch } from './searcher'

const argv = yargs(hideBin(process.argv)).argv

// Argument warning
if(!argv['filename']) {
  const userArgs = Object.entries(argv).filter(a=>a[0]!='_' && a[0]!='$0')
  console.log('Run this task with --filename="path/to/file.md" argument')
  if(userArgs.length>0) console.log('Arguments:', userArgs)
  // process.exit(0)
}

// Temp for tests
argv['filename'] ??= 'README.md'

// Aliases
if (argv['s']) argv['silent'] = true
if (argv['silent']) argv['s'] = true

bracketsSearch(
  argv as any,
  fs.readFileSync(argv['filename'] as string, 'utf8'),
  replaced=>fs.writeFileSync(argv['filename'] as string, replaced)
)