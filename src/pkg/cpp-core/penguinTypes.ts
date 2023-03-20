export interface PenguinMatrix {
  matrix: PenguinMatrixItem[]
}

export interface PenguinMatrixItem {
  stageId: string
  itemId: string
  times: number
  quantity: number
  stdDev: number
  start: number
  end: number | null
}
