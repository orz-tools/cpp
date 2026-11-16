type VisibilityDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>

export interface UpdateSchedulerOptions {
  /** One background check */
  check: () => Promise<void>
  /** Called every time the page comes back to the foreground, however recent the last check */
  onVisible?: () => void
  /** How often to check while the page is visible */
  interval?: number
  /** The least time between the starts of two checks */
  minGap?: number
  doc?: VisibilityDocument
}

/** Checks for newer game data on start, every interval while the page is visible, and when it comes back into view. */
export class UpdateScheduler {
  private readonly interval: number
  private readonly minGap: number
  private readonly doc: VisibilityDocument
  private lastStart = -Infinity
  private running = false
  private timer?: ReturnType<typeof setInterval>

  public constructor(private readonly options: UpdateSchedulerOptions) {
    this.interval = options.interval ?? 3600_000
    this.minGap = options.minGap ?? 600_000
    this.doc = options.doc ?? document
  }

  public start() {
    this.doc.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.timer = setInterval(() => {
      if (this.doc.visibilityState === 'visible') this.run()
    }, this.interval)
    this.run()
  }

  public stop() {
    this.doc.removeEventListener('visibilitychange', this.handleVisibilityChange)
    clearInterval(this.timer)
    this.timer = undefined
  }

  private readonly handleVisibilityChange = () => {
    if (this.doc.visibilityState !== 'visible') return
    this.options.onVisible?.()
    this.run()
  }

  private run() {
    if (this.running || Date.now() - this.lastStart < this.minGap) return
    this.running = true
    this.lastStart = Date.now()
    void (async () => {
      try {
        await this.options.check()
      } catch (e) {
        console.warn('Background check for game data updates failed', e)
      } finally {
        this.running = false
      }
    })()
  }
}
