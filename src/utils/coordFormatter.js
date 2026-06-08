


//// Example usage:
//const input = "100 25 34.34";
//const output = coordFormatter(input);
//console.log(output); // 100° 25' 34.34"
/**
 * 
 * @param {String} input 
 * @returns 
 */
export const coordFormatter = (input) => {

    const parts = input.split(" ");

    if (parts.length !== 3) return input;

    const [deg, min, sec] = parts;

    return `${deg}° ${min}' ${sec}"`;
}

