export const isGrav = (network) => {
    if (!network) return false;
    
    const networkName = typeof network === 'string' ? network : network.name;
    if (!networkName) return false;
    
    const lower = networkName.toLowerCase();
    return lower.includes("грав") || 
           lower.includes("grav") || 
           lower.includes("гравиметр");
}