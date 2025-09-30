// ------------------------------------------------------------------
// Source node: HorizonsAPI
// Creation date 7/27/2024, 11:43:13 AM
// ------------------------------------------------------------------

//Constructor for Horizons API
export function HorizonsAPI(tx, sx) {

    this.tx = tx

    // keep a cache of the ephemerides
    this.ephemerides = null
}

HorizonsAPI.prototype = {

	// Output pins of the node

	sends: [
	],

    // Example usage: fetchPlanetaryData('399', '2024-01-01', '2024-01-02');
    async fetchPlanetaryData(planetId, startTime, endTime) {

        // the nasa base url
        const baseUrl = "https://ssd.jpl.nasa.gov/api/horizons.api";

        // set the parameters for the request
        const params = new URLSearchParams({
            format: "json",
            COMMAND: planetId,
            EPHEM_TYPE: "VECTORS",
            START_TIME: startTime,
            STOP_TIME: endTime,
            STEP_SIZE: "1d",
            REF_PLANE: "ECLIPTIC",
            CENTER: "500@10"  // Heliocentric reference frame
        });
    
        // get the data
        try {
            const response = await fetch(`${baseUrl}?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();

            console.log(data);

            return data;

        } catch (error) {
            console.error('Failed to fetch planetary data:', error);
        }
    },
    
	// Input pins and handlers of the node
	async "-> ephemeris"({planetId}) {

        const ephemeris = await this.fetchPlanetaryData(planetId,'2024-07-27', '2024-07-28')

        this.tx.reply(ephemeris)
	},

} // Horizons API.prototype