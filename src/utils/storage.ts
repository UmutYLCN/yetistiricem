import type { UserPreferences } from '../types';

export const loadData = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    if (item) {
      return JSON.parse(item);
    }
  } catch (error) {
    console.error('Error loading data', error);
  }
  return defaultValue;
};

export const saveData = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving data', error);
  }
};

export const defaultPreferences: UserPreferences = {
  dailyStudyHours: 4,
  playbackSpeed: 1,
  practiceMultiplier: 0.2, // 20% extra time for practice
  maxSubjectsPerDay: 3,
  activeDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
  restDays: [0], // Sunday
  mockExamDays: [],
  startDate: new Date().toISOString()
};
