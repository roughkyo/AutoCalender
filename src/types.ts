export interface CalendarEvent {
  title: string;
  startDate: string;
  endDate: string;
  category: string;
  description?: string;
}

export type Step = 'login' | 'upload' | 'parsing' | 'review' | 'syncing' | 'complete';
