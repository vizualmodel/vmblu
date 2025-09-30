
// The astronomical unit
export const AUkm =  149_597_870.7
export const kmAU = 1/AUkm

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// If the speed-up factor is bigger then 1 week per second, we don't rotate ...
export const MAX_SPEED_FOR_ROTATION = 7

// small helper function
export const degToRad = deg => deg * Math.PI / 180;

export function solveKeplerEquation(M, e, tolerance = 1e-6) {
    
    let E = M;  // Initial guess: mean anomaly
    let deltaE;
    do {
        deltaE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
        E += deltaE;
    } while (Math.abs(deltaE) > tolerance);
    return E;
}

// Calculates the julian date Example usage:
// const day = 1, month = 1, year = 2000;     // January 1, 2000
// const hour = 12, minute = 0, second = 0;   // 12:00:00 UTC
// const jd = julianDate(day, month, year, hour, minute, second);
// console.log(`Julian Date: ${jd}`);         // Output: 2451545.0

export function julianDate(day, month, year, hour, minute, second) {
    // Adjust month and year if January or February
    if (month <= 2) {
        year -= 1;
        month += 12;
    }
    
    // Calculate the Julian Day Number (JDN)
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    
    const JDN = Math.floor(365.25 * (year + 4716)) 
                + Math.floor(30.6001 * (month + 1)) 
                + day + B - 1524.5;
    
    // Add the fraction of the day
    const jd = JDN + (hour / 24) + (minute / 1440) + (second / 86400);
    
    return jd;
}

// Helper function to format the date in local time as 'YYYY-MM-DD HH:MM:SS'
function formatDate(date) {

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function julianDateFromUTC(utcString) {
    // Parse the input UTC string
    const date = new Date(utcString);

    // Extract the date and time components
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;  // Months are zero-based, so add 1
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();

    // Adjust month and year if January or February
    let adjustedYear = year;
    let adjustedMonth = month;
    if (month <= 2) {
        adjustedYear -= 1;
        adjustedMonth += 12;
    }

    // Calculate the Julian Day Number (JDN)
    const A = Math.floor(adjustedYear / 100);
    const B = 2 - A + Math.floor(A / 4);

    const JDN = Math.floor(365.25 * (adjustedYear + 4716)) 
              + Math.floor(30.6001 * (adjustedMonth + 1)) 
              + day + B - 1524.5;

    // Add the fraction of the day
    const jd = JDN + (hour / 24) + (minute / 1440) + (second / 86400);

    return jd;
}


export function julianToGregorian(date, jd) {
    // Calculate the number of days since the beginning of the Julian period
    let J = jd + 0.5;
    let Z = Math.floor(J);
    let F = J - Z;

    let A;
    if (Z < 2299161) {
        A = Z;
    } else {
        let alpha = Math.floor((Z - 1867216.25) / 36524.25);
        A = Z + 1 + alpha - Math.floor(alpha / 4);
    }

    let B = A + 1524;
    let C = Math.floor((B - 122.1) / 365.25);
    let D = Math.floor(365.25 * C);
    let E = Math.floor((B - D) / 30.6001);

    // Calculate the day
    let day = B - D - Math.floor(30.6001 * E) + F;

    // Calculate the month
    let month;
    if (E < 14) {
        month = E - 1;
    } else {
        month = E - 13;
    }

    // Calculate the year
    let year;
    if (month > 2) {
        year = C - 4716;
    } else {
        year = C - 4715;
    }

    // Extract the hour, minute, and second from the fractional day
    let dayFraction = day - Math.floor(day);
    let hours = Math.floor(dayFraction * 24);
    let minutes = Math.floor((dayFraction * 24 - hours) * 60);
    let seconds = Math.floor(((dayFraction * 24 - hours) * 60 - minutes) * 60);

    // Update the passed Date object with the calculated date and time in UTC
    date.setUTCFullYear(year, month - 1, Math.floor(day));
    date.setUTCHours(hours, minutes, seconds, 0); // Set milliseconds to 0 for precision

    // Return the date in ISO string format (UTC)
    return formatDate(date);
}

// Get the earth rotational offset based on the Greenwich Mean Sidereal Time 
// The reference date is January 1, 2000, 12:00 UT
export function getAngularOffset(jd) {

    // Calculate number of days since J2000 (JD 2451545.0)
    const d = jd - 2451545.0;
  
    // GMST in hours
    const gmstHours = 18.697374558 + 24.06570982441908 * d;
    const gmstDegrees = (gmstHours % 24) * 15; // Convert hours to degrees
  
    // Convert degrees to radians for Three.js
    return (gmstDegrees*Math.PI)/180;
}

// Helper function
function DMSToDecimal(degrees, minutes, seconds, direction) {
    let decimal = degrees + minutes / 60 + seconds / 3600;
    if (direction === "S" || direction === "W") {
      decimal *= -1;
    }
    return decimal;
}

// Helper function
function decimalToDMS(decimal) {
    const degrees = Math.floor(decimal);
    const minutesDecimal = Math.abs((decimal - degrees) * 60);
    const minutes = Math.floor(minutesDecimal);
    const seconds = ((minutesDecimal - minutes) * 60).toFixed(1);
    return { degrees, minutes, seconds };
};

export function parseCoordinates(coordinateStr) {
    
    // Split the input string into latitude and longitude parts
    const [latStr, longStr] = coordinateStr.split(' ');

    // Validate the input strings for latitude and longitude
    if (!latStr || !longStr) return null;

    // Regular expressions to match DMS (Degrees, Minutes, Seconds) coordinates
    // Minutes and seconds are now optional
    const latMatch = latStr.match(/(\d+)\u00b0(\d+)?'?(\d+\.?\d*)?"?([NS])/);
    const longMatch = longStr.match(/(\d+)\u00b0(\d+)?'?(\d+\.?\d*)?"?([EW])/);

    // Check if both latitude and longitude match the expected format
    if (!latMatch || !longMatch) return null;

    try {
        // Extract values, defaulting to 0 for omitted parts
        const latitude = DMSToDecimal(
            parseInt(latMatch[1]), // Degrees
            parseInt(latMatch[2] || 0), // Minutes (default to 0)
            parseFloat(latMatch[3] || 0), // Seconds (default to 0)
            latMatch[4] // Direction (N/S)
        );

        const longitude = DMSToDecimal(
            parseInt(longMatch[1]), // Degrees
            parseInt(longMatch[2] || 0), // Minutes (default to 0)
            parseFloat(longMatch[3] || 0), // Seconds (default to 0)
            longMatch[4] // Direction (E/W)
        );

        return { latitude, longitude };
    } catch (error) {
        // Return null if any error occurs during parsing
        return null;
    }
}

export function formatCoordinates(latitude, longitude) {

    // Convert latitude to DMS
    const latDMS = decimalToDMS(latitude);
    const latDirection = latitude >= 0 ? 'N' : 'S';

    // Convert longitude to DMS
    const lonDMS = decimalToDMS(longitude);
    const lonDirection = longitude >= 0 ? 'E' : 'W';

    // Format the result as a string
    const formattedLatitude = `${Math.abs(latDMS.degrees)}°${latDMS.minutes}'${latDMS.seconds}"${latDirection}`;
    const formattedLongitude = `${Math.abs(lonDMS.degrees)}°${lonDMS.minutes}'${lonDMS.seconds}"${lonDirection}`;

    return `${formattedLatitude} ${formattedLongitude}`;
}



