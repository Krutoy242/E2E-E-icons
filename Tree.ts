
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

export class ConstituentTree {
  // source -> entry -> meta -> []
  public tree = {} as {
    [key: string]: {
      [key: string]: {
        [key: number]: {
          [key: string]: string
        }
      }
    }
  }

  public add(item: Item) {
    (((this.tree
      [item.source] ??= {})
      [item.entry]  ??= {})
      [item.meta]   ??= {})
      [item.hash] = item.nbt
  }
}

export const tree = new ConstituentTree()