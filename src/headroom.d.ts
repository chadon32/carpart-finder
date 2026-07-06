// headroom.js ships no TypeScript declarations. Model just the surface we use.
declare module 'headroom.js' {
  interface HeadroomOptions {
    offset?: number | { up: number; down: number }
    tolerance?: number | { up: number; down: number }
    zIndex?: number
  }
  export default class Headroom {
    constructor(element: HTMLElement, options?: HeadroomOptions)
    init(): this
    destroy(): void
    pin(): void
    unpin(): void
    freeze(): void
    unfreeze(): void
  }
}
