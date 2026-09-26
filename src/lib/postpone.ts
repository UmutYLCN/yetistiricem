import type { DailyPlanItem, PostponeReason } from '../types';

// What the app says about postponing: the reasons offered when tasks are
// carried forward, and the small, concrete step suggested for each one
// (cognitive-behavioural "micro interventions": shrink the first step, remove
// the trigger, plan the when). Plain text; the dialog adds the icons.

export interface ReasonCopy {
  label: string;
  /** In the student's own words, under the label. */
  hint: string;
  /** Lower-case form for sentences: "Ertelemelerinin %55'i sosyal medya kaynaklı." */
  phrase: string;
}

export const REASON_COPY: Record<PostponeReason, ReasonCopy> = {
  distraction: {
    label: 'Sosyal medya / dikkat dağınıklığı',
    hint: 'Telefona daldım, odaklanamadım.',
    phrase: 'sosyal medya ve dikkat dağınıklığı',
  },
  difficult: {
    label: 'Ders ağır geldi',
    hint: 'Konuyu anlamakta zorlandım, gözüm korktu.',
    phrase: 'dersin ağır gelmesi',
  },
  exhausted: {
    label: 'Yorgunluk / düşük enerji',
    hint: 'Uykusuzdum ya da gün çok yoğundu.',
    phrase: 'yorgunluk ve düşük enerji',
  },
  emergency: {
    label: 'Zaman yetmedi / acil durum',
    hint: 'Beklenmedik bir işim çıktı.',
    phrase: 'zaman yetmemesi ve acil durumlar',
  },
  low_motivation: {
    label: 'İsteksizlik / motivasyon kaybı',
    hint: 'Hiç içimden gelmedi.',
    phrase: 'isteksizlik',
  },
};

/** Label of events saved without a reason (older versions, or the question was skipped). */
export const UNSPECIFIED_LABEL = 'Belirtilmedi';

export interface MicroTip {
  title: string;
  body: string;
}

/** The shortest task that was carried forward, offered as the "one small win". */
export interface ShortTask {
  title: string;
  minutes: number;
}

export function microTipFor(reason: PostponeReason): MicroTip {
  switch (reason) {
    case 'difficult':
      return {
        title: '2 dakika kuralı',
        body: 'Videonun sadece ilk 5 dakikasını izlemeyi dene, sonra bırakmak serbest. Başlamak işin en zor kısmı; gerisi çoğu zaman kendiliğinden gelir.',
      };
    case 'distraction':
      return {
        title: 'Dikkat kalkanı',
        body: 'Telefonu başka bir odaya koy, 20 dakikalık bir sayaç kur ve yalnızca tek bir videoya odaklan. Kısa ama kesintisiz bir blok, dağınık bir saatten verimlidir.',
      };
    case 'exhausted':
      return {
        title: 'Küçük zafer',
        body: 'Tamamını bitiremesen de tek 1 kısa video ile günü zaferle kapatabilirsin. Dinlenmek de planın parçası.',
      };
    case 'emergency':
      return {
        title: 'Eğer–o zaman planı',
        body: 'Beklenmedik şeyler olur; görevlerin kaybolmadı, sadece ileri taşındı. Yarın için net bir an seç: “Akşam yemeğinden sonra masaya oturunca ilk videoyu açacağım.”',
      };
    case 'low_motivation':
      return {
        title: 'Önce hareket, sonra motivasyon',
        body: 'Motivasyon çoğu zaman başladıktan sonra gelir. Bir sonraki videoya küçük bir ödül bağla: bitirince 10 dakika mola ya da sevdiğin bir şarkı.',
      };
  }
}

/** From this many postponements on, a task is flagged as critical. */
export const CRITICAL_POSTPONES = 3;

export function isCriticallyPostponed(item: Pick<DailyPlanItem, 'postponeCount' | 'completed'>): boolean {
  return !item.completed && (item.postponeCount ?? 0) >= CRITICAL_POSTPONES;
}

/** "Kritik · 3 kez ertelendi" */
export function criticalLabel(count: number): string {
  return `Kritik · ${count} kez ertelendi`;
}
