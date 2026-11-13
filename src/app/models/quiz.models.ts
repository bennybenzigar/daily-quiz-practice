export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  answer: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface QuizSet {
  id: string;
  topic: string;
  subtopic: string;
  description?: string;
  questions: QuizQuestion[];
  importedAt: string;
}

export interface PracticeAnswer {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
}

export interface PracticeSession {
  id: string;
  topic: string;
  subtopic: string;
  date: string;
  total: number;
  correct: number;
  answers: PracticeAnswer[];
  completedAt: string;
}

export interface QuizImportPayload {
  topic: string;
  subtopic: string;
  description?: string;
  questions: Array<{
    id?: string;
    question: string;
    options: Array<string | { id?: string; text?: string; label?: string }>;
    answer: string;
    explanation?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  }>;
}
