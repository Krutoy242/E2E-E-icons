
let constituentsCount = 0

interface Base {
  source: string,
  entry: string,
  meta: string,
  nbt: string,
}

interface Item extends Base {

}

export class ConstituentTree {
  // source -> entry -> meta -> []
  private tree = {} as {
    [key: string]: {
      [key: string]: {
        [key: number]: Item[] 
      }
    }
  }

  private get(base: Base): Item|undefined {
    return this.tree[base.source]?.[base.entry]?.[base.meta]?.find(b=>b.nbt===base.nbt)
  }

  private add(item: Item) {
    (((this.tree
      [item.source] ??= {})
      [item.entry]  ??= {})
      [item.meta]   ??= [])
      .push(item)
  }
}

export const tree = new ConstituentTree()