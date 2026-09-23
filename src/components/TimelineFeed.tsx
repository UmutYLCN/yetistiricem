import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import type { DailyPlan, DailyPlanItem } from '../types';

interface Props {
  plans: DailyPlan[];
  onToggleItem: (item: DailyPlanItem, date: string) => void;
  onShift: (date: string) => void;
}

export const TimelineFeed: FC<Props> = ({ plans, onToggleItem, onShift }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to today on mount
  useEffect(() => {
    if (containerRef.current) {
      const todayEl = containerRef.current.querySelector('[data-istoday="true"]');
      if (todayEl) {
        todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [plans]);

  if (plans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 p-8 text-center">
        <div>
          <div className="text-4xl mb-4">📭</div>
          <p>Henüz bir plan oluşturulmadı.</p>
          <p className="text-sm mt-2">Sol menüden kamp ekleyerek başlayabilirsiniz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8" ref={containerRef}>
      <div className="max-w-3xl mx-auto space-y-8">
        {plans.map((plan, index) => (
          <div 
            key={plan.date} 
            data-istoday={plan.isToday}
            className={`relative pl-8 md:pl-0 ${plan.isPast ? 'opacity-70' : ''}`}
          >
            {/* Timeline Line */}
            <div className="absolute left-3 md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-700 md:-ml-px"></div>
            
            {/* Timeline Dot */}
            <div className={`absolute left-3 md:left-1/2 top-6 w-4 h-4 rounded-full border-4 border-slate-900 md:-ml-2 z-10 
              ${plan.isToday ? 'bg-indigo-500' : plan.isPast ? 'bg-slate-500' : 'bg-slate-400'}`}>
            </div>

            <div className={`md:w-1/2 ${index % 2 === 0 ? 'md:pr-12 md:ml-auto md:pl-12' : 'md:pl-12 md:mr-auto'}`}>
              
              <div className={`bg-slate-800 p-5 rounded-xl shadow-lg border 
                ${plan.isToday ? 'border-indigo-500/50 shadow-indigo-500/20' : 'border-slate-700'} 
                ${plan.isRestDay || plan.isMockExamDay ? 'bg-slate-800/50' : ''}`}>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                      {new Date(plan.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                      {plan.isToday && <span className="bg-indigo-500 text-xs px-2 py-0.5 rounded text-white">Bugün</span>}
                    </h4>
                    <div className="text-sm text-slate-400">{plan.dayName}</div>
                  </div>
                  
                  {plan.items.length > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Tahmini Süre</div>
                      <div className="font-mono text-indigo-400 font-semibold">{Math.round(plan.totalMinutes)} dk</div>
                    </div>
                  )}
                </div>

                {plan.isRestDay && (
                  <div className="text-center py-6 text-slate-400 flex flex-col items-center">
                    <span className="text-3xl mb-2">☕</span>
                    <p>Dinlenme Günü</p>
                  </div>
                )}

                {plan.isMockExamDay && (
                  <div className="text-center py-6 text-slate-400 flex flex-col items-center">
                    <span className="text-3xl mb-2">📝</span>
                    <p>Deneme Sınavı Günü</p>
                  </div>
                )}

                {!plan.isRestDay && !plan.isMockExamDay && plan.items.length > 0 && (
                  <div className="space-y-3">
                    {plan.items.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex items-start gap-3 p-3 rounded-lg border ${item.completed ? 'bg-slate-700/50 border-slate-600/50' : 'bg-slate-700 border-slate-600'}`}
                      >
                        <div className="pt-1">
                          <input 
                            type="checkbox" 
                            checked={item.completed}
                            onChange={() => onToggleItem(item, plan.date)}
                            className="w-5 h-5 rounded border-slate-500 text-indigo-500 focus:ring-indigo-500 bg-slate-800"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${item.completed ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                            {item.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-slate-400">{item.subject}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-slate-400">{item.durationMinutes} dk</span>
                          </div>
                        </div>
                        <a 
                          href={item.videoUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-indigo-400"
                          title="Videoya Git"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
                {plan.isPast && !plan.isRestDay && !plan.isMockExamDay && !plan.isAllCompleted && plan.items.length > 0 && (
                  <button 
                    onClick={() => onShift(plan.date)}
                    className="mt-4 w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded border border-slate-600 transition-colors"
                  >
                    Tamamlanmayanları Kaydır (Telafi Et)
                  </button>
                )}

              </div>
            </div>
          </div>
        ))}
        
        {/* End of roadmap marker */}
        <div className="relative pl-8 md:pl-0 py-8">
           <div className="absolute left-3 md:left-1/2 top-8 w-4 h-4 rounded-full border-4 border-slate-900 bg-emerald-500 md:-ml-2 z-10"></div>
           <div className="md:w-1/2 md:mx-auto text-center pl-8 md:pl-0">
             <div className="inline-block bg-slate-800 text-emerald-400 px-4 py-2 rounded-full font-bold text-sm border border-emerald-500/30">
               Hedefine Ulaştın! 🎓
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
