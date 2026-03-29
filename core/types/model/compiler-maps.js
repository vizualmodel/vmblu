import {FactoryMap} from './factory-map.js'
import {ModelBlueprint} from './blueprint.js'

export const CompilerMapHandling = {

async ensureModelCurrent(model) {

    if (!model) return false

    if (model.is.main && model.raw) {
        model.preCook()
        if (model.sourceProfileOrigin !== 'host') {
            await model.handleSourceProfile().catch(() => {})
        }
        model.stamp = await model.readStamp().catch(() => null)
        return true
    }

    const stamp = await model.readStamp().catch(() => null)
    const needsReload = !model.raw || !stamp || !model.stamp || (stamp !== model.stamp)

    if (!needsReload) {
        model.blu.is.fresh = false
        model.viz.is.fresh = false
        return true
    }

    // we need to reload
    if (!await model.getRaw()) return false
    if (!model.raw) return false

    model.preCook()
    if (model.sourceProfileOrigin !== 'host') {
        await model.handleSourceProfile().catch(() => {})
    }
    model.stamp = stamp ?? await model.readStamp().catch(() => null)
    return true
},

// This function will only get models that are not yet read or that need to be updated.
async refreshRaw(model) {

    const arl = model?.getArl?.()
    if (!arl) return

    // do we know the model already
    const knownModel = this.models.findArl(arl)

    // take the model found or the model that is new
    const activeModel = knownModel ?? model

    // load or reload
    if (!await this.ensureModelCurrent(activeModel)) return

    // if the model is valid and new, store it...
    if (!knownModel) this.models.add(activeModel)

    // bundels have no links anymore !
    if (activeModel.isBundle()) return

    // Now handle the imports
    await this.addImports(activeModel, activeModel.raw.imports)
},

async addImports(model, imports) {

    // const imports = activeModel.raw.imports
    if (!(imports?.length > 0)) return;

    const pList = []
    for (const rawModel of imports) {
        const linkedArl = model.blu.arl.resolve(rawModel)
        if (!linkedArl) continue
        const linkedModel = this.models.findArl(linkedArl) ?? new ModelBlueprint(linkedArl)
        pList.push(this.refreshRaw(linkedModel))
    }

    await Promise.all(pList)
},

async getFactories(model) {

    await this.refreshRaw(model)

    const factories = new FactoryMap()
    const visited = new Set()

    const collect = (linkedModel) => {
        if (!linkedModel?.raw) return

        const fullPath = linkedModel.fullPath()
        if (!fullPath || visited.has(fullPath)) return
        visited.add(fullPath)

        if (linkedModel.raw.factories?.length > 0) factories.cook(linkedModel)

        if (linkedModel.isBundle()) return

        for (const rawImport of linkedModel.raw.imports ?? []) {
            const linkedArl = linkedModel.blu.arl.resolve(rawImport)
            const importedModel = linkedArl ? this.models.findArl(linkedArl) : null
            if (importedModel) collect(importedModel)
        }
    }

    collect(model)
    return factories
},

}
