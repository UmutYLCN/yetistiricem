export const Navbar = ({ onReset, onBackup }: { onReset: () => void, onBackup: () => void }) => {
  const handleReset = () => {
    if (window.confirm('Tüm ilerlemeyi ve kampları silmek istediğinize emin misiniz?')) {
      onReset();
    }
  };

  return (
    <nav className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-50">
      <div className="flex items-center space-x-2">
        <span className="text-2xl">🔥</span>
        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Yetiştiricem</h1>
      </div>
      <div className="hidden md:block text-slate-300 italic text-sm">"Yetişir mi deme, yetiştiricem de!"</div>
      <div className="flex space-x-2">
        <button onClick={onBackup} className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm transition-colors">Yedekle</button>
        <button onClick={handleReset} className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors">Sıfırla</button>
      </div>
    </nav>
  );
};
