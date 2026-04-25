declare module '@vizualmodel/vmblu-runtime/rt-als' {
  export function scaffold(nodeList: unknown[], filterList?: unknown[]): any;
  export function enableSafety(options?: { mode?: string }, tx?: { send?: (name: string, payload: unknown) => unknown }): { uninstall: () => void };
}
