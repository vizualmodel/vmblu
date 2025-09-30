import {orbitalData} from './orbital-data.js'

export function Ephemerides(tx, sx) {

    this.tx = tx

    this.skyMap = new Map()

    // fill the map with the planetary data from the file
    this.setUp()
}
Ephemerides.prototype = {

    setUp() {

        // add the sun
        this.skyMap.set("Sun", orbitalData.Sun)

        // add the planets
        for(const planet of orbitalData.planets) {

            // add the planet
            this.skyMap.set(planet.name,planet)

            // add the moons of each planet
            for(const moon of planet.moons) {

                this.skyMap.set(moon.name, moon)
            }
        }
    },

    "=> ephemeris"(name) {

        // get the requested data
        this.tx.reply(this.skyMap.get(name))
    }
}