import {julianDateFromUTC, kmAU, AUkm} from './equations-and-constants'
  
export const celestialOrbHandlers = {

    '-> presentation user change'({what, solsys}) {

        switch (what) {

            case 'label on/off':
                this.label.visible = solsys.labels.on
                break

            case 'magnify':
                
                // Magnify contains several scales (stars, planet, moons) - so we have to call the specific function for each
                this.setScale(solsys.magnify)

                // and now scale 
                this.scale()
                break
        }
    },

    '-> simulation user change'({what, simulate}) {

        switch (what) {

            case 'speed':
                this.speedFactor = simulate.speed.current
                break

            case 'start date':
                
                // calculate julian date
                this.jd = julianDateFromUTC(simulate.start)

                // recalculate the epoch
                this.adjustEpoch(this.jd)
                break
        }
    },


}