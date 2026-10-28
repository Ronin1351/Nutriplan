import { describe, expect, it } from 'vitest';
import { getScaledDimensions, parseExifOrientation } from './imagePreprocess';

describe('receipt image preprocessing', () => {
  it('scales a phone photo down to the maximum long edge', () => {
    expect(getScaledDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(getScaledDimensions(1200, 2000, 1600)).toEqual({ width: 960, height: 1600 });
  });

  it('keeps already-small images unchanged', () => {
    expect(getScaledDimensions(1200, 800, 1600)).toEqual({ width: 1200, height: 800 });
  });

  it('normalizes EXIF orientation values and defaults missing metadata', () => {
    expect(parseExifOrientation(6)).toBe(6);
    expect(parseExifOrientation(0)).toBe(1);
    expect(parseExifOrientation(undefined)).toBe(1);
  });
});
