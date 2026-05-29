declare module '@vizualmodel/vmblu-runtime/rt-base' {
  export class Runtime {
    constructor(nodeList?: unknown[], options?: Record<string, unknown>);
    scaffold(nodeList?: unknown[]): this;
    start(): void;
    stop(): void;
  }
}
