// minimal: just silence the error
declare module '@vizualmodel/vmblu-runtime';

// or slightly nicer:
declare module '@vizualmodel/vmblu-runtime' {
  export function scaffold(nodeList: unknown[], filterList?: unknown[]): any;
}
