export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function parseAddressCoordinates(address: string): Coordinates | null {
  const coordRegex = /\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/;
  const match = address.match(coordRegex);
  
  if (match) {
    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }
  
  return null;
}

export function calculateAerialDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371;
  
  const toRadians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };
  
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  const distanceKm = R * c;
  
  return Math.round(distanceKm * 10) / 10;
}

export function getDistanceFromAddresses(
  pickupAddress: string,
  dropoffAddress: string
): number | null {
  const pickupCoords = parseAddressCoordinates(pickupAddress);
  const dropoffCoords = parseAddressCoordinates(dropoffAddress);
  
  if (!pickupCoords || !dropoffCoords) {
    console.log("Could not parse coordinates from addresses", { pickupAddress, dropoffAddress });
    return null;
  }
  
  return calculateAerialDistance(pickupCoords, dropoffCoords);
}

export function removeCoordinatesFromAddress(address: string): string {
  const coordRegex = /\s*\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)\s*$/;
  return address.replace(coordRegex, '').trim();
}
