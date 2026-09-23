export function parseYoutubePlaylistId(url: string): string | null {
  const regex = /[?&]list=([^#\&\?]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

export function generateFallbackPlaylist(url: string) {
  const id = parseYoutubePlaylistId(url) || 'custom-id';
  
  return {
    id: `custom-${id}`,
    title: 'Özel Youtube Oynatma Listesi',
    subject: 'Diğer',
    channelName: 'Özel Kanal',
    playlistUrl: url,
    colorTag: 'bg-gray-500',
    totalDurationMinutes: 20 * 45,
    videos: Array.from({ length: 20 }).map((_, i) => ({
      id: `custom-${id}-${i}`,
      title: `Özel Video ${i + 1}`,
      durationMinutes: 45,
      videoUrl: url,
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false
    }))
  };
}
