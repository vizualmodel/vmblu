export function createScaffold({createRuntime, RuntimeNode, setRuntime}) {
    return function scaffold(nodeList, filterList = []) {

        const runtime = createRuntime()
        setRuntime(runtime)

        for (const rawNode of nodeList) {
            runtime.actors.push(new RuntimeNode(rawNode))
        }

        runtime.actors.forEach(actor => actor.resolveUIDs(runtime.actors))

        return runtime
    }
}
