import { Check } from 'lucide-react';

/**
 * Step indicator of a multi-step dialog. Earlier steps can be revisited;
 * `canVisit` decides which later ones are reachable.
 */
export function WizardStepper({
  label,
  titles,
  step,
  reached,
  canVisit,
  onVisit,
}: {
  label: string;
  titles: readonly string[];
  step: number;
  reached: number;
  canVisit: (step: number) => boolean;
  onVisit: (step: number) => void;
}) {
  return (
    <nav aria-label={label}>
      <p className="mb-2 text-[12.5px] font-semibold text-ink-3 sm:hidden">
        Adım {step + 1} / {titles.length} · <span className="text-ink">{titles[step]}</span>
      </p>
      <ol className="flex items-center gap-1.5 sm:gap-2">
        {titles.map((title, index) => {
          const done = index !== step && index < Math.max(step, reached);
          const current = index === step;
          const enabled = !current && canVisit(index);
          return (
            <li key={title} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className={`wizard-step ${current ? 'is-current' : done ? 'is-done' : ''}`}
                onClick={() => onVisit(index)}
                disabled={!enabled}
                aria-current={current ? 'step' : undefined}
              >
                <span className="wizard-step-dot tnum" aria-hidden="true">
                  {done ? <Check strokeWidth={3} /> : index + 1}
                </span>
                <span className="truncate max-sm:sr-only">{title}</span>
                {done && <span className="sr-only">(tamamlandı)</span>}
              </button>
              {index < titles.length - 1 && (
                <span className={`h-0.5 min-w-3 flex-1 rounded-full ${index < step ? 'bg-forest' : 'bg-line'}`} aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
