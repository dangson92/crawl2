export enum TaskStatus {
  IDLE = 'IDLE',
  WAITING = 'WAITING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface HotelData {
  name: string;
  address: string;
  rating: number;
  images: string[];
  // Additional fields from real crawler
  facilities?: string[];
  faqs?: Array<{ question: string; answer: string }>;
  about?: string;
  reviewCount?: number;
  ratingCategory?: string;
  houseRules?: {
    checkIn?: string;
    checkOut?: string;
    cancellationPolicy?: string;
    childPolicies?: string[];
    ageRestriction?: string;
    pets?: string;
    acceptedCards?: string[];
    cashPolicy?: string;
  };
}

export interface Task {
  id: string;
  url: string;
  status: TaskStatus;
  progress: number; // 0 to 100
  logs: LogEntry[];
  result?: HotelData;
  error?: string;
  createdAt: number;
  finishedAt?: number;
}

export interface AppConfig {
  concurrency: number;
  delayPerLink: number; // in seconds
  batchWait: number; // wait after X links
  batchWaitTime: number; // in seconds
  headless: boolean;
  userAgent: string;
}

export interface QueueStats {
  total: number;
  waiting: number;
  processing: number;
  completed: number;
  error: number;
}
