
let constituentsCount = 0

export class Item {
  constructor(
    public source: string,
    public entry: string,
    public meta: number,
    public hash: string,
    public nbt: string,
  ) {
    
  }
}

export type Tree = {
  [key: string]: {
    [key: string]: {
      [key: number]: {
        [key: string]: string
      }
    }
  }
}

export type Base = [string, string, number, string]

export class ConstituentTree {
  // source -> entry -> meta -> nbtHash -> sNBT
  public tree: Tree = {}

  public add(item: Item) {
    (((this.tree
      [item.source] ??= {})
      [item.entry]  ??= {})
      [item.meta]   ??= {})
      [item.hash] = item.nbt
  }
}

export const tree = new ConstituentTree()