import { avatarPhotoUrl } from '../../lib/catalogApi';
import type { AvatarShape } from '../../lib/studentProfile';
import { isAvatarPhoto, isAvatarShape } from '../../lib/studentProfile';
import { SHAPE_ART } from './shapeArt';
import { msg } from '../../lib/messages';


const tileOf = (color: string) => `color-mix(in srgb, ${color} 20%, var(--color-card))`;

export function ShapeSvg({ shape }: { shape: AvatarShape }) {
  const { color, art } = SHAPE_ART[shape];
  return (
    <svg
      viewBox="0 0 64 64"
      className="size-full"
      fill="currentColor"
      style={{ color, background: tileOf(color), ['--avatar-tile' as string]: tileOf(color) }}
      aria-hidden="true"
    >
      <g transform="translate(32 32) scale(0.82) translate(-32 -32)">{art}</g>
    </svg>
  );
}

/**
 * The student's picture: one of the drawn shapes, an uploaded photo, or the
 * initial of their name when they chose neither.
 */
export function ProfileAvatar({ avatar, name, size = 32, className = '' }: { avatar: string | null | undefined; name: string; size?: number; className?: string }) {
  const box = `relative grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-line-strong ${className}`;
  const style = { width: size, height: size };
  if (isAvatarShape(avatar)) {
    return (
      <span className={box} style={style} aria-hidden="true">
        <ShapeSvg shape={avatar} />
      </span>
    );
  }
  const photo = isAvatarPhoto(avatar) ? avatarPhotoUrl(avatar) : null;
  if (photo) {
    return (
      <span className={`${box} bg-sunk`} style={style} aria-hidden="true">
        <img src={photo} alt={msg("")} className="size-full object-cover" draggable={false} loading="lazy" decoding="async" />
      </span>
    );
  }
  const initial = name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';
  return (
    <span className={`${box} bg-sunk font-semibold text-ink-2`} style={{ ...style, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {initial}
    </span>
  );
}
