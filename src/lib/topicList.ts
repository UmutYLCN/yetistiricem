import { parseDurationInput } from '../utils/youtubeParser.ts';

// Lessons typed by hand (the "Elle ekle" source): a topic name and how long
// it takes, with no link. Kept free of React so the rules are tested directly.

export interface TopicLine {
  title: string;
  /** As written; '' when the line gave none. */
  duration: string;
}

/**
 * Reads pasted lines as topics, each ending with its duration when it has
 * one ("Atom ve Periyodik Sistem 45", "Mol Kavramı | 38:20", "Karışımlar - 1 sa 5 dk").
 * Empty lines are skipped.
 */
export function parseTopicLines(text: string): TopicLine[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const words = line.split(/\s+/);
      // The longest trailing run of words that reads as a duration ("1 sa 20 dk").
      for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
        const duration = words.slice(-n).join(' ');
        if (parseDurationInput(duration).ok) {
          return { title: words.slice(0, -n).join(' ').replace(/[\s|,;:–—-]+$/, ''), duration };
        }
      }
      return { title: line, duration: '' };
    });
}
