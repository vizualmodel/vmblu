import {Path} from '../arl/index.js'
import {convert} from '../util/index.js'
import {ModelBlueprint} from './index.js'
import {ModelCompiler} from './index.js'
import {Look, GroupNode, SourceNode} from '../node/index.js'

// The x values of the elements of the test model
const X = {
    gap:100,
    sequencer: 100,
    bus: 0,
    mirror: 0,
    nut:0
}
const Y = {
    headroom: 50,
    gap: 100
}

const mirrorName = node => node.name + 'Mirror'

export const TestHandling = {

    makeTestArl(testFolder) {
        const arl = this.getArl()
        const modelName = Path.nameOnly(arl.userPath)
        const split = Path.split(modelName)
        return arl.resolve(testFolder + '/' + split.name + '.tst.blu')
    },

    addSequencePins(look, master) {

        // the state of the pin
        const is = {
            input: !master,
            left: !master,
            channel: false,
            multi: false,
            zombie: false
        }

        // The position - set y to NaN for auto placement
        const pos = {x:0, y:NaN}

        // add the interface
        look.addIfName('sequence')

        // Add three pins to the sequencer
        look.addPin('sequence.start',pos,is)
        look.addPin('sequence.stop',pos,is)

        is.input = master
        look.addPin('sequence.result',pos,is)
    },

    makeSequencer() {

        // The look
        const seqLook = new Look({x: X.sequencer, y: Y.headroom, w:0, h:0})

        // The node
        const sequencer = new SourceNode(seqLook, 'sequencer')

        // Add the pins as master
        this.addSequencePins(seqLook, true)

        // done
        return sequencer
    },

    connectViaBus(root, sequencer, mirrorList) {

        // add a bus
        const bus = root.addBus('sequencer.bus', {x:X.bus, y:Y.headroom})

        // make it as long as the mirror list
        const rc = mirrorList.at(-1).look.rect 
        bus.drawXY({x:X.bus, y:rc.y + rc.h + Y.gap})

        // connect the sequencer
        for (const pinName of ['sequence.start', 'sequence.stop', 'sequence.result']) {
            const pin = sequencer.look.widgets.find( pin => pin.is.pin && pin.name === pinName)
            if (pin) bus.makeRoute(pin)
        }

        // connect the mirrors to the list
        for (const mirror of mirrorList) {

            for (const pinName of ['sequence.start', 'sequence.stop', 'sequence.result']) {
                const pin = mirror.look.widgets.find( pin => pin.is.pin && pin.name === pinName)

                if (pin) bus.makeRoute(pin)
            }
        }
    },

    // Node under test is added as a linked node
    addNuts(root, refArl, nutList) {

        // copy the model, but make it relative to this model !
        const refModel = this.copy()
        refModel.getArl().makeRelative(refArl)


        let yDelta = Y.headroom
        for (const nut of nutList) {

            // position the nut
            nut.look.moveTo(X.nut, yDelta )

            // change y position
            yDelta += (nut.look.rect.h + Y.gap)

            //all pins to the left
            for(const w of nut.look.widgets) {
                if (w.is.pin && !w.is.left) w.leftRightSwap()
            }

            // make the factory relative (maybe not necessary..)
            if (nut.factory?.arl) nut.factory.arl.makeRelative( refArl )

            // make the nut a linked node
            nut.setLink(refModel, nut.name)

            // add
            root.nodes.push(nut)
        }
    },

    addMirrors(root, refArl, mirrorList) {

        let yDelta = Y.headroom
        let maxWidth = 0
        for (const mirror of mirrorList) {

            // position the mirror
            mirror.look.moveTo(X.mirror, yDelta)

            yDelta += (mirror.look.rect.h + Y.gap)

            // change the name of the node
            mirror.name = mirrorName(mirror)

            // add
            root.nodes.push(mirror)

            // all pins to the right
            for(const w of mirror.look.widgets) {

                if (w.is.pin) {

                    // all pins to the right
                    if (w.is.left) w.leftRightSwap()

                    // change i/o
                    w.ioSwitch()
                }

                if (w.is.header) {
                    w.title = mirror.name
                    mirror.look.headerChanged(w,'?')
                }
            }

            // Add the sequencer pins for the mirror - master = false
            this.addSequencePins(mirror.look, false)

            // add the factory for the mirror
            mirror.factory.resolve(mirror.name, './mirrors/' + mirror.name + '.js', refArl)

            // find the maxWidth
            if (mirror.look.rect.w > maxWidth) maxWidth = mirror.look.rect.w
        }
        return maxWidth
    },

    mirrorToNutConnect(root, mirrorList, nutList) {

        for (const nut of nutList) {

            // find the mirror node
            const mirror = mirrorList.find( mirror => mirror.name === mirrorName(nut))

            // check
            if (!mirror) continue

            // connect
            for (const pin of nut.look.widgets) {

                // check
                if (!pin.is.pin) continue

                // find the corresponding pin
                const mPin = mirror.look.widgets.find( mPin => mPin.is.pin && (mPin.name === pin.name))

                // check
                if (!mPin) continue

                // make a route
                root.createRoute(pin, mPin)
            }
        }
    },

    makeTestApp(testFolder, node) {

        // The node must be a group node
        if (!node.is.group) return

        // The arl for the test model
        const testArl = this.makeTestArl(testFolder)

        // The root of the model
        const testRoot = new GroupNode(new Look({x:0, y:0, w:0, h:0}))

        // make a Sequencer node
        const sequencer = this.makeSequencer()

        // add to the model
        testRoot.addNode(sequencer)

        // position of the mirror nodes
        X.bus = X.sequencer + sequencer.look.rect.w + X.gap
        X.mirror = X.bus + X.gap

        // make a copy of all source nodes
        const mirrorList = []
        node.makeSourceList(mirrorList)

        // convert the nodes into test mirrors
        const width = this.addMirrors(testRoot, testArl, mirrorList)

        // set the position of the nuts
        X.nut = X.mirror + width + X.gap

        // make a second copy of all source nodes (nut = node under test)
        const nutList = []
        node.makeSourceList(nutList)

        // copy the node to the new model - place all pins to the left - nut = node under test
        this.addNuts(testRoot, testArl, nutList)

        // connect all node to the mirror nodes
        this.mirrorToNutConnect(testRoot, mirrorList, nutList)

        // make a bus and connect the sequencer and the mirror nodes
        this.connectViaBus(testRoot, sequencer, mirrorList)

        // create a new model
        const testModel = new ModelBlueprint(testArl)

        // save the test model
        const compiler = new ModelCompiler()

        // Use the compiler to encode the model to a raw jason structure
        testModel.raw = compiler.encode(testRoot, testModel)

        // split and save the model in the two files
        testModel.saveRaw()
    }
}