import type { FC } from 'react';
import type { RoadmapStats, UserPreferences } from '../types';

interface Props {
  stats: RoadmapStats;
  preferences: UserPreferences;
}

export const StatsBar: FC<Props> = ({ stats, preferences }) => {
  const speedUpBenefitHours = Math.round(stats.totalMinutes * (1 - 1/preferences.playbackSpeed) / 60);

  return (
    <div className="bg-slate-800 p-4 m-4 rounded-lg shadow-lg text-white">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        
        <div className="flex-1 w-full">
          <div className="flex justify-between mb-1">
            <span className="font-semibold text-sm">Genel İlerleme</span>
            <span className="text-sm">{stats.progressPercent}% ({stats.completedVideos}/{stats.totalVideos})</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5">
            <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${stats.progressPercent}%` }}></div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-2">
            <span>🎯</span>
            <div className="text-sm">
              <div className="text-slate-400 text-xs">Bitiş Tarihi</div>
              <div className="font-bold">{new Date(stats.estimatedFinishDate).toLocaleDateString('tr-TR')}</div>
            </div>
          </div>
          
          <div className="bg-slate-700 px-3 py-1.5 rounded-md flex items-center gap-2">
            <span>⏳</span>
            <div className="text-sm">
              <div className="text-slate-400 text-xs">Kalan Süre</div>
              <div className="font-bold">{stats.effectiveRemainingHours} Saat</div>
            </div>
          </div>

          {preferences.playbackSpeed > 1 && (
            <div className="bg-indigo-600/30 border border-indigo-500/50 px-3 py-1.5 rounded-md flex items-center gap-2">
              <span>🚀</span>
              <div className="text-sm text-indigo-300">
                {preferences.playbackSpeed}x hız ile <strong>{Math.max(0, speedUpBenefitHours)} saat</strong> kazandın!
              </div>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
};
