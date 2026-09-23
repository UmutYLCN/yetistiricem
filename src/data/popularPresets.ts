import type { SubjectPlaylist } from '../types';

export const POPULAR_PRESETS: SubjectPlaylist[] = [
  {
    id: 'preset-mert-mat',
    title: '70 Günde TYT Matematik Kampı',
    subject: 'Matematik',
    channelName: 'Mert Hoca',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-indigo-500',
    totalDurationMinutes: 70 * 45, // roughly
    videos: Array.from({ length: 70 }).map((_, i) => ({
      id: `mert-mat-${i + 1}`,
      title: `${i + 1}. Gün | TYT Matematik - Temel Kavramlar ${i + 1}`,
      durationMinutes: Math.floor(Math.random() * 30) + 30, // 30-60 mins
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  },
  {
    id: 'preset-eyup-geo',
    title: 'TYT Geometri VDD',
    subject: 'Geometri',
    channelName: 'Eyüp B.',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-emerald-500',
    totalDurationMinutes: 40 * 50,
    videos: Array.from({ length: 40 }).map((_, i) => ({
      id: `eyup-geo-${i + 1}`,
      title: `Üçgenler #${i + 1} - TYT Geometri`,
      durationMinutes: Math.floor(Math.random() * 20) + 40, 
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  },
  {
    id: 'preset-vip-fizik',
    title: 'VIP Fizik TYT Kampı',
    subject: 'Fizik',
    channelName: 'VIP Fizik',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-blue-500',
    totalDurationMinutes: 50 * 40,
    videos: Array.from({ length: 50 }).map((_, i) => ({
      id: `vip-fizik-${i + 1}`,
      title: `TYT Fizik | Madde ve Özellikleri ${i + 1}`,
      durationMinutes: Math.floor(Math.random() * 20) + 30, 
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  },
  {
    id: 'preset-gorkem-kimya',
    title: 'TYT Kimya Kampı',
    subject: 'Kimya',
    channelName: 'Görkem Şahin',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-purple-500',
    totalDurationMinutes: 45 * 40,
    videos: Array.from({ length: 45 }).map((_, i) => ({
      id: `gorkem-kimya-${i + 1}`,
      title: `TYT Kimya | Kimya Bilimi ${i + 1}`,
      durationMinutes: Math.floor(Math.random() * 20) + 35, 
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  },
  {
    id: 'preset-dr-biyoloji',
    title: 'TYT Biyoloji Kampı',
    subject: 'Biyoloji',
    channelName: 'Dr. Biyoloji',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-green-600',
    totalDurationMinutes: 40 * 35,
    videos: Array.from({ length: 40 }).map((_, i) => ({
      id: `dr-biyo-${i + 1}`,
      title: `TYT Biyoloji | Canlıların Ortak Özellikleri ${i + 1}`,
      durationMinutes: Math.floor(Math.random() * 15) + 30, 
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  },
  {
    id: 'preset-kadir-turkce',
    title: 'TYT Türkçe Kampı',
    subject: 'Türkçe',
    channelName: 'Kadir Gümüş',
    playlistUrl: 'https://youtube.com/playlist?list=PL...',
    colorTag: 'bg-red-500',
    totalDurationMinutes: 55 * 45,
    videos: Array.from({ length: 55 }).map((_, i) => ({
      id: `kadir-turkce-${i + 1}`,
      title: `TYT Türkçe | Sözcükte Anlam ${i + 1}`,
      durationMinutes: Math.floor(Math.random() * 25) + 35, 
      videoUrl: 'https://youtube.com/watch?v=sample',
      thumbnailUrl: 'https://via.placeholder.com/150',
      completed: false,
    }))
  }
];
