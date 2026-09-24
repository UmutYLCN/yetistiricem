import { validatePlaylistUrl } from '../../utils/youtubeParser';

export interface CampFieldValues {
  title: string;
  subject: string;
  /** Empty = follow the subject's default colour. */
  colorKey: string;
  channelName: string;
  playlistUrl: string;
}

export const EMPTY_CAMP_FIELDS: CampFieldValues = {
  title: '',
  subject: 'Matematik',
  colorKey: '',
  channelName: '',
  playlistUrl: '',
};

export function campFieldErrors(values: CampFieldValues): Partial<Record<keyof CampFieldValues, string>> {
  const errors: Partial<Record<keyof CampFieldValues, string>> = {};
  if (!values.title.trim()) errors.title = 'Kampa bir ad ver.';
  else if (values.title.trim().length > 80) errors.title = 'Ad en fazla 80 karakter olabilir.';
  if (values.playlistUrl.trim()) {
    const check = validatePlaylistUrl(values.playlistUrl);
    if (!check.ok) errors.playlistUrl = check.error;
  }
  return errors;
}

/** Normalised playlist link to store ('' when empty). */
export function storedPlaylistUrl(values: CampFieldValues): string {
  if (!values.playlistUrl.trim()) return '';
  const check = validatePlaylistUrl(values.playlistUrl);
  return check.ok ? check.value.url : '';
}
