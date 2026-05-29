export {Runtime}

import {Runtime as SharedRuntime} from '../shared/runtime.js'
import {runtimeSettings} from './runtime-settings.js'

class Runtime extends SharedRuntime {}

Runtime.prototype.settings = runtimeSettings
