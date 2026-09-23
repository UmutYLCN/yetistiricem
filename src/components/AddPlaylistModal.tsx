import { useState } from 'react';
import type { FC } from 'react';
import type { SubjectPlaylist } from '../types';
import { POPULAR_PRESETS } from '../data/popularPresets';
import { generateFallbackPlaylist } from '../utils/youtubeParser';

interface Props {
  onAdd: (playlist: SubjectPlaylist) => void;
  onClose: () => void;
}

export const AddPlaylistModal: FC<Props> = ({ onAdd, onClose }) => {
  const [tab, setTab] = useState<'preset' | 'url'>('preset');
  const [url, setUrl] = useState('');

  const handleAddUrl = () => {
    if (!url) return;
    const pl = generateFallbackPlaylist(url);
    onAdd(pl);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 text-white p-6 rounded-xl w-full max-w-2xl shadow-2xl h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Kamp / Oynatma Listesi Ekle</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
        </div>

        <div className="flex space-x-2 border-b border-slate-700 mb-4">
          <button 
            className={`px-4 py-2 ${tab === 'preset' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}
            onClick={() => setTab('preset')}
          >
            Popüler Kamplar
          </button>
          <button 
            className={`px-4 py-2 ${tab === 'url' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}
            onClick={() => setTab('url')}
          >
            Link ile Ekle
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === 'preset' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {POPULAR_PRESETS.map(preset => (
                <div key={preset.id} className="bg-slate-700 p-4 rounded-lg flex flex-col justify-between border border-slate-600 hover:border-slate-500">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{preset.channelName}</div>
                    <div className="font-semibold mb-2">{preset.title}</div>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`w-3 h-3 rounded-full ${preset.colorTag}`}></span>
                      <span className="text-sm text-slate-300">{preset.subject}</span>
                      <span className="text-sm text-slate-400 ml-auto">{preset.videos.length} Video</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { onAdd(preset); onClose(); }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-sm font-medium transition-colors"
                  >
                    Programa Ekle
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">YouTube Oynatma Listesi Linki</label>
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/playlist?list=..."
                  className="w-full bg-slate-700 border border-slate-600 rounded p-3 text-white focus:outline-none focus:border-indigo-500" 
                />
              </div>
              <button 
                onClick={handleAddUrl}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded font-medium transition-colors"
              >
                Analiz Et ve Ekle
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
