const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type AvatarImageResult = { ok: true; blob: Blob; extension: 'webp' | 'jpg' } | { ok: false; error: string };

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    image.src = url;
  });
}

/**
 * A chosen photo cropped to the centre at `width` × `height` px, ready to
 * upload: WebP where the browser can write it, JPEG otherwise, within `maxBytes`.
 */
async function prepareImage(file: File, width: number, height: number, maxBytes: number): Promise<AvatarImageResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Bir fotoğraf dosyası seç (JPG, PNG ya da WebP).' };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, error: 'Bu fotoğraf çok büyük. 15 MB’tan küçük bir dosya seç.' };
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, error: 'Bu fotoğraf açılamadı. Başka bir dosya dene.' };
  }
  const ratio = width / height;
  const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * ratio);
  const cropHeight = cropWidth / ratio;
  if (cropWidth < 16 || cropHeight < 16) return { ok: false, error: 'Bu fotoğraf çok küçük.' };
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return { ok: false, error: 'Tarayıcın fotoğrafı hazırlayamadı.' };
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, width, height);
  for (const quality of [0.86, 0.72, 0.55]) {
    let blob = await toBlob(canvas, 'image/webp', quality);
    let extension: 'webp' | 'jpg' = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', quality);
      extension = 'jpg';
    }
    if (blob && blob.size <= maxBytes) return { ok: true, blob, extension };
  }
  return { ok: false, error: 'Bu fotoğraf küçültülemedi. Başka bir dosya dene.' };
}

/** A profile photo: a 256 px square (the `avatars` bucket takes up to 256 KB). */
export function avatarFromFile(file: File): Promise<AvatarImageResult> {
  return prepareImage(file, 256, 256, 250 * 1024);
}

/** A camp's cover photo: 1200 × 750 px, the 16:10 of Keşfet's cards (the `camp-covers` bucket takes up to 1 MB). */
export function coverFromFile(file: File): Promise<AvatarImageResult> {
  return prepareImage(file, 1200, 750, 1000 * 1024);
}
