export const MAX_RECEIPT_LONG_EDGE = 1600;

export interface ImageDimensions {
  width: number;
  height: number;
}

export function getScaledDimensions(width: number, height: number, maxLongEdge = MAX_RECEIPT_LONG_EDGE): ImageDimensions {
  if (width <= 0 || height <= 0) throw new Error('Receipt image dimensions are invalid.');
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function parseExifOrientation(value: number | undefined): number {
  return value && value >= 1 && value <= 8 ? value : 1;
}

function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file, { imageOrientation: 'from-image' });
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Receipt image could not be decoded.')); };
    image.src = url;
  });
}

export async function preprocessReceiptImage(file: Blob, maxLongEdge = MAX_RECEIPT_LONG_EDGE): Promise<Blob> {
  if (!file.size) throw new Error('Receipt image is empty.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP receipt image.');

  const image = await loadImage(file);
  const dimensions = getScaledDimensions(image.width, image.height, maxLongEdge);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Receipt image preprocessing is unavailable in this browser.');
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  if ('close' in image && typeof image.close === 'function') image.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Receipt image could not be prepared.')), 'image/jpeg', 0.9);
  });
}
