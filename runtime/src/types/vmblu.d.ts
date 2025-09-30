// minimal: just silence the error
declare module '@vizualmodel/vmblu';

// or slightly nicer:
declare module '@vizualmodel/vmblu' {
  export function scaffold(nodeList: unknown[], filterList?: unknown[]): any;
}
