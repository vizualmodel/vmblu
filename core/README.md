# @vizualmodel/vmblu-core

Core model, editor, routing, and visualization types for [vmblu](https://vmblu.dev/).

## Install

```bash
npm install @vizualmodel/vmblu-core
```

The main entry point exports the model APIs. More focused public entry points are
available below `@vizualmodel/vmblu-core/types/*`, including `model`, `arl`, `node`,
`elk`, `util`, `view`, and `widget`.

```js
import * as vmblu from '@vizualmodel/vmblu-core'
import * as model from '@vizualmodel/vmblu-core/types/model'
```

vmblu packages in the same `major.minor` compatibility family are compatible.

## License

Apache-2.0 © Vizual Model
