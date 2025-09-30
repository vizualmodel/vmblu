// The router for the settings bus
export function PlanetRouter() {

}
PlanetRouter.prototype = {

    // the filter function can return an array of names or a single name
    filter(nodeNames, pinName, messageParam) {

        // the name of the planet is in the planet parameter !
        return messageParam.planet
    }
}