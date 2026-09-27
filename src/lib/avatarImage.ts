import { MAX_AVATAR_DATA_URL } from './studentProfile';

const SIDE = 256;
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

export type AvatarImageResult = { ok: true; dataUrl: string } | { ok: false; error: string };

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
 * A chosen photo as a small square picture (centre crop, 256 px) the profile
 * can store: WebP where the browser can write it, JPEG otherwise.
 */
export async function avatarFromFile(file: File): Promise<AvatarImageResult> {
  if (!file.type.startsWith('image/')) return { ok: false, error: 'Bir fotoğraf dosyası seç (JPG, PNG ya da WebP).' };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, error: 'Bu fotoğraf çok büyük. 15 MB’tan küçük bir dosya seç.' };
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch {
    return { ok: false, error: 'Bu fotoğraf açılamadı. Başka bir dosya dene.' };
  }
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  if (crop < 16) return { ok: false, error: 'Bu fotoğraf çok küçük.' };
  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;
  const context = canvas.getContext('2d');
  if (!context) return { ok: false, error: 'Tarayıcın fotoğrafı hazırlayamadı.' };
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2, crop, crop, 0, 0, SIDE, SIDE);
  for (const quality of [0.86, 0.72, 0.55]) {
    let dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_URL) return { ok: true, dataUrl };
  }
  return { ok: false, error: 'Bu fotoğraf küçültülemedi. Başka bir dosya dene.' };
}
