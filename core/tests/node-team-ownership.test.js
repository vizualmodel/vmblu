import test from 'node:test'
import assert from 'node:assert/strict'
import {ModelCompiler, UIDGenerator} from '../types/model/index.js'
import {ModelHeader} from '../types/model/header.js'
import {GroupNode, SourceNode} from '../types/node/index.js'
import {nodeHandling} from '../types/view/view-node.js'
import {redoxNode} from '../nodes/model-manager/redox-node.js'

function fixture(color = '#ff9900') {
    const header = new ModelHeader()
    header.setTeams({default: {color: '#0066ff'}, ui: {color}})
    const model = {header, fullPath: () => 'team.mod.blu', getArl: () => null}
    const root = new ModelCompiler(new UIDGenerator()).compileRawNode(model, {kind: 'group', name: 'Root', nodes: []})
    return {model, root}
}

for (const source of [true, false]) {
    test(`new ${source ? 'source' : 'group'} nodes change team color immediately and after undo/redo`, () => {
        const {model, root} = fixture()
        const view = {root, selection: {singleNode() {}}, beginTextEdit() {}, hit: {xyLocal: {}}}
        const node = nodeHandling.newEmptyNode.call(view, {x: 100, y: 100}, source)
        assert.equal(node.model, model)
        redoxNode.changeNodeSettings.doit({node, sx: null, team: 'ui'})
        assert.equal(node.resolveTeamStyle().rgb, '#ff9900')
        const action = source ? redoxNode.newSourceNode : redoxNode.newGroupNode
        action.undo({view, node})
        action.redo({view, node})
        assert.equal(node.model, model)
        assert.equal(node.resolveTeamStyle().rgb, '#ff9900')
        redoxNode.changeNodeSettings.doit({node, sx: null, team: null})
        assert.equal(node.resolveTeamStyle().rgb, '#0066ff')
    })
}

test('inserting and restoring nested groups adopts the destination palette recursively', () => {
    const origin = fixture('#ff9900'), destination = fixture('#00cc88')
    const group = new GroupNode(), nested = new GroupNode(), leaf = new SourceNode()
    group.addNode(nested)
    nested.addNode(leaf)
    origin.root.addNode(group)
    for (const node of [group, nested, leaf]) node.team = 'ui'
    origin.root.removeNode(group)
    destination.root.addNode(group)
    for (const node of [group, nested, leaf]) {
        assert.equal(node.model, destination.model)
        assert.equal(node.resolveTeamStyle().rgb, '#00cc88')
    }
    destination.root.removeNode(group)
    origin.root.restoreNode(group)
    for (const node of [group, nested, leaf]) {
        assert.equal(node.model, origin.model)
        assert.equal(node.resolveTeamStyle().rgb, '#ff9900')
    }
})

test('temporary groups without a model preserve existing node ownership', () => {
    const {model, root} = fixture()
    const node = new SourceNode()
    root.addNode(node)
    root.removeNode(node)
    const temporary = new GroupNode()
    temporary.addNode(node)
    assert.equal(node.model, model)
})
