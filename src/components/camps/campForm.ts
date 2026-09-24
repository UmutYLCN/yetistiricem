import { MAX_BRANCH_NAME } from '../../lib/studyCamp';
import { validatePlaylistUrl } from '../../utils/youtubeParser';

export interface CampFieldValues {
  /** Source list name. */
  title: string;
  /** Branch name shown in the plan. */
  subject: string;
  /** Empty = follow the subject's default colour. */
  colorKey: string;
  channelName: string;
  playlistUrl: string;
}

export const MAX_SOURCE_NAME = 120;

export function campFieldErrors(values: CampFieldValues): Partial<Record<keyof CampFieldValues, string>> {
  const errors: Partial<Record<keyof CampFieldValues, string>> = {};
  if (!values.subject.trim()) errors.subject = 'Branşa bir ad ver.';
  else if (values.subject.trim().length > MAX_BRANCH_NAME) errors.subject = `Branş adı en fazla ${MAX_BRANCH_NAME} karakter olabilir.`;
  if (!values.title.trim()) errors.title = 'Kaynağa bir ad ver.';
  else if (values.title.trim().length > MAX_SOURCE_NAME) errors.title = `Ad en fazla ${MAX_SOURCE_NAME} karakter olabilir.`;
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
