// The YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference),
// loaded once on demand for the focus player. Only the calls the app makes
// are typed here. Nothing is sent to YouTube but the video id the user added.

export const PLAYER_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

export interface YTPlayerEvent<T = unknown> {
  target: YTPlayer;
  data: T;
}

export interface YTPlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: YTPlayerEvent) => void;
    onStateChange?: (event: YTPlayerEvent<number>) => void;
    onPlaybackRateChange?: (event: YTPlayerEvent<number>) => void;
    onError?: (event: YTPlayerEvent<number>) => void;
  };
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api';
const LOAD_TIMEOUT_MS = 15_000;
let loading: Promise<YTNamespace> | null = null;

/** Loads the IFrame API script once; rejects when it is blocked or offline (the caller shows a fallback). */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const fail = () => {
      loading = null;
      reject(new Error('YouTube player API unavailable'));
    };
    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail();
    };
    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      script.remove();
      fail();
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Why the player cannot play, from its error code (`api`: the script itself did not load). */
export function playerErrorMessage(code: number | 'api'): { title: string; body: string } {
  if (code === 101 || code === 150) {
    return {
      title: 'Bu video burada oynatılamıyor',
      body: 'Videonun sahibi başka sitelerde oynatılmasını kapatmış. YouTube’da izleyip bitirince “İzledim” ile işaretleyebilirsin.',
    };
  }
  if (code === 100) {
    return { title: 'Video bulunamadı', body: 'Video kaldırılmış ya da gizli olabilir. Bağlantıyı YouTube’da kontrol edebilirsin.' };
  }
  if (code === 'api') {
    return {
      title: 'Oynatıcı yüklenemedi',
      body: 'YouTube oynatıcısına ulaşılamadı (bağlantı ya da bir engelleyici eklenti olabilir). Videoyu YouTube’da açabilirsin.',
    };
  }
  return { title: 'Video oynatılamadı', body: 'Oynatıcı bu videoyu açamadı. YouTube’da açmayı deneyebilirsin.' };
}
