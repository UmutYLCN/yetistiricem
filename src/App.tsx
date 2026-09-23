import { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { ActivePlaylistsDrawer } from './components/ActivePlaylistsDrawer';
import { TimelineFeed } from './components/TimelineFeed';
import { SettingsModal } from './components/SettingsModal';
import { AddPlaylistModal } from './components/AddPlaylistModal';
import type { SubjectPlaylist, UserPreferences, DailyPlanItem } from './types';
import { defaultPreferences, loadData, saveData } from './utils/storage';
import { generateRoadmap, calculateStats, shiftDayPlan } from './utils/roadmapEngine';
import confetti from 'canvas-confetti';

const App = () => {
  const [preferences, setPreferences] = useState<UserPreferences>(loadData('yt_prefs', defaultPreferences));
  const [playlists, setPlaylists] = useState<SubjectPlaylist[]>(loadData('yt_playlists', []));
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>(loadData('yt_completed', {}));
  const [lastShiftedDate, setLastShiftedDate] = useState<string | null>(loadData('yt_shifted_date', null));
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);

  // Save on change
  useEffect(() => { saveData('yt_prefs', preferences); }, [preferences]);
  useEffect(() => { saveData('yt_playlists', playlists); }, [playlists]);
  useEffect(() => { saveData('yt_completed', completedMap); }, [completedMap]);
  useEffect(() => { saveData('yt_shifted_date', lastShiftedDate); }, [lastShiftedDate]);

  // Derived state
  const dailyPlans = useMemo(() => {
    let plans = generateRoadmap(playlists, preferences, completedMap);
    if (lastShiftedDate) {
      plans = shiftDayPlan(lastShiftedDate, plans);
    }
    return plans;
  }, [playlists, preferences, completedMap, lastShiftedDate]);

  const stats = useMemo(() => {
    const totalVideos = playlists.reduce((acc, pl) => acc + pl.videos.length, 0);
    const completedCount = Object.values(completedMap).filter(Boolean).length;
    return calculateStats(dailyPlans, totalVideos, completedCount);
  }, [dailyPlans, playlists, completedMap]);

  const handleShift = (date: string) => {
    setLastShiftedDate(date);
  };


  const handleToggleItem = (item: DailyPlanItem, date: string) => {
    const newCompleted = { ...completedMap, [item.videoId]: !item.completed };
    setCompletedMap(newCompleted);

    // If we just completed it, check if the day is fully completed
    if (!item.completed) {
      const plan = dailyPlans.find(p => p.date === date);
      if (plan) {
        const allCompleted = plan.items.every(i => i.videoId === item.videoId || newCompleted[i.videoId]);
        if (allCompleted) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
    }
  };

  const handleAddPlaylist = (pl: SubjectPlaylist) => {
    if (!playlists.find(p => p.id === pl.id)) {
      setPlaylists([...playlists, pl]);
    }
  };

  const handleRemovePlaylist = (id: string) => {
    setPlaylists(playlists.filter(p => p.id !== id));
  };

  const handleReset = () => {
    setPreferences(defaultPreferences);
    setPlaylists([]);
    setCompletedMap({});
    localStorage.removeItem('yt_prefs');
    localStorage.removeItem('yt_playlists');
    localStorage.removeItem('yt_completed');
  };

  const handleBackup = () => {
    const data = {
      preferences,
      playlists,
      completedMap
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yetistiricem-yedek-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 font-sans text-slate-200 overflow-hidden">
      <Navbar onReset={handleReset} onBackup={handleBackup} />
      
      {playlists.length > 0 && <StatsBar stats={stats} preferences={preferences} />}

      <div className="flex flex-1 overflow-hidden">
        <ActivePlaylistsDrawer playlists={playlists} onRemove={handleRemovePlaylist} />
        
        <div className="flex-1 flex flex-col relative">
          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <button 
              onClick={() => setShowAddPlaylist(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2"
            >
              <span>+</span> Yeni Kamp
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded shadow-lg"
            >
              ⚙️ Ayarlar
            </button>
          </div>
          
          <TimelineFeed plans={dailyPlans} onToggleItem={handleToggleItem} onShift={handleShift} />
        </div>
      </div>

      {showSettings && (
        <SettingsModal 
          preferences={preferences} 
          onUpdate={setPreferences} 
          onClose={() => setShowSettings(false)} 
        />
      )}
      
      {showAddPlaylist && (
        <AddPlaylistModal 
          onAdd={handleAddPlaylist} 
          onClose={() => setShowAddPlaylist(false)} 
        />
      )}
    </div>
  );
};

export default App;
