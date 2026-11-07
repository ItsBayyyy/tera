/** Locations are rounded to 3 decimals (~110 m) before leaving the device. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
