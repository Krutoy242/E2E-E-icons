import * as path from 'path'
import * as glob from 'glob'
import * as fs from 'fs-extra'

export type IterateCallback = (
  fullPath: string,
  filename: string,
  g: { [key: string]: string },
  sNBT?: string
) => void

export function iterateAllImages(cb: IterateCallback): void {
  for (const fullPath of glob.sync('x32/*.png')) {
    const filename = path.parse(fullPath).name

    const g = filename.match(
      /(?<namespace>.+?)__(?<name>.+?)__(?<meta>\d+)(__(?<hash>.+))?|fluid__(?<fluid>.+)/
    )?.groups

    if (!g) {
      console.log('groups are wrong :>> ', filename)
      continue
    }

    // If we have hashed nbt
    let sNBT: string | undefined
    if (g.hash != null) {
      sNBT = fs.readFileSync(`x32/${filename}.txt`, 'utf8')
    }

    cb(fullPath, filename, g, sNBT)
  }
}

export function escapeRegex(s: string): string {
  return s.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
}
