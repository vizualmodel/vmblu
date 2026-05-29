declare module '@vizualmodel/vmblu-runtime/rt-als' {
  export class Runtime {
    constructor(nodeList?: unknown[], options?: Record<string, unknown>);
    scaffold(nodeList?: unknown[]): this;
    start(): void;
    stop(): void;
  }
  export const safety: {
    enable(options?: { mode?: string }, tx?: { send?: (name: string, payload: unknown) => unknown }): { uninstall: () => void };
  };
}
