export const DEMO_LOCATIONS: Array<[city: string, country: string]> = [
  ['Mumbai', 'India'],
  ['Delhi', 'India'],
  ['Bangalore', 'India'],
  ['Goa', 'India'],
  ['Jaipur', 'India'],
  ['Lisbon', 'Portugal'],
  ['Bali', 'Indonesia'],
  ['Bangkok', 'Thailand'],
];

export function pickDemoLocation(seed: number): [string, string] {
  return DEMO_LOCATIONS[seed % DEMO_LOCATIONS.length];
}
