import type { FC } from 'react';
import type { SubjectPlaylist } from '../types';

interface Props {
  playlists: SubjectPlaylist[];
  onRemove: (id: string) => void;
}

export const ActivePlaylistsDrawer: FC<Props> = ({ playlists, onRemove }) => {
  return (
    <div className="w-full md:w-80 bg-slate-800 p-4 border-r border-slate-700 overflow-y-auto">
      <h3 className="text-lg font-bold text-white mb-4">Aktif Kamplar</h3>
      
      {playlists.length === 0 ? (
        <div className="text-slate-400 text-sm italic">Henüz bir kamp eklemediniz.</div>
      ) : (
        <div className="space-y-4">
          {playlists.map(pl => {
            const completedCount = pl.videos.filter(v => v.completed).length;
            const progress = pl.videos.length > 0 ? (completedCount / pl.videos.length) * 100 : 0;
            
            return (
              <div key={pl.id} className="bg-slate-700 p-3 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-slate-400">{pl.channelName}</div>
                    <div className="text-sm font-semibold text-white leading-tight">{pl.title}</div>
                  </div>
                  <button onClick={() => onRemove(pl.id)} className="text-red-400 hover:text-red-300 text-xs">
                    Kaldır
                  </button>
                </div>
                
                <div className="w-full bg-slate-800 rounded-full h-1.5 mb-1 mt-3">
                  <div className={`h-1.5 rounded-full ${pl.colorTag.replace('bg-', 'bg-')}`} style={{ width: `${progress}%` }}></div>
                </div>
                <div className="text-xs text-slate-400 text-right">
                  {completedCount} / {pl.videos.length} Tamamlandı
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
