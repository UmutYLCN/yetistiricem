import type { ChangeEvent, FC } from 'react';
import type { UserPreferences } from '../types';

interface Props {
  preferences: UserPreferences;
  onUpdate: (prefs: UserPreferences) => void;
  onClose: () => void;
}

export const SettingsModal: FC<Props> = ({ preferences, onUpdate, onClose }) => {
  const handleSpeedChange = (e: ChangeEvent<HTMLSelectElement>) => {
    onUpdate({ ...preferences, playbackSpeed: parseFloat(e.target.value) });
  };

  const handleHoursChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({ ...preferences, dailyStudyHours: parseInt(e.target.value) || 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 text-white p-6 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Ayarlar</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Günlük Çalışma Hedefi (Saat)</label>
            <input 
              type="number" 
              value={preferences.dailyStudyHours} 
              onChange={handleHoursChange}
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white focus:outline-none focus:border-indigo-500" 
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">İzleme Hızı</label>
            <select 
              value={preferences.playbackSpeed} 
              onChange={handleSpeedChange}
              className="w-full bg-slate-700 border border-slate-600 rounded p-2 text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={1}>1.0x (Normal)</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-medium transition-colors">
              Kaydet ve Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
