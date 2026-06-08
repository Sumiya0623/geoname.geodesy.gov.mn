export function c2geo(x, y, z) {
    const ellipsoid = { a: 6378137.0, b: 6356752.314245 };
    const a = ellipsoid.a; // Semi-major axis
    const b = ellipsoid.b; // Semi-minor axis

    const e2 = (a * a - b * b) / (a * a); // First eccentricity squared
    const epsilon2 = (a * a - b * b) / (b * b); // Second eccentricity squared

    const p = Math.sqrt(x * x + y * y);

    // Iterative solution for parametric lat (or use Bowring's closed-form if available)
    let beta = Math.atan2(z * a, p * b); // Initial guess
    for (let i = 0; i < 5; i++) { // Iterate for convergence
        const sinBeta = Math.sin(beta);
        const cosBeta = Math.cos(beta);
        beta = Math.atan2(z + epsilon2 * b * sinBeta * sinBeta * sinBeta, p - e2 * a * cosBeta * cosBeta * cosBeta);
    }

    const lat = Math.atan2(z + epsilon2 * b * Math.pow(Math.sin(beta), 3), p - e2 * a * Math.pow(Math.cos(beta), 3));
    const lon = Math.atan2(y, x);

    const sinLat = Math.sin(lat);
    const nu = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    return {
        lat: lat * 180 / Math.PI, // Convert to degrees
        lon: lon * 180 / Math.PI, // Convert to degrees
    };
}
