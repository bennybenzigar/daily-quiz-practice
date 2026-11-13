import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuizImportPayload, QuizQuestion, QuizSet, PracticeAnswer, PracticeSession } from './models/quiz.models';
import { QuizStoreService } from './services/quiz-store.service';

type Page = 'dashboard' | 'import' | 'practice' | 'progress';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent {
  readonly sampleFormat = `{
  "topic": "History",
  "subtopic": "Vasco da Gama",
  "questions": [
    {
      "question": "In which year...",
      "options": ["1492", "1497", "1498", "1502"],
      "answer": "1498",
      "explanation": "He reached Calicut in 1498."
    }
  ]
}`;
  private readonly store = inject(QuizStoreService);
  readonly quizSets = signal<QuizSet[]>(this.store.quizSets);
  readonly sessions = signal<PracticeSession[]>(this.store.sessions);
  readonly page = signal<Page>('dashboard');
  readonly selectedTopic = signal('');
  readonly selectedSubtopic = signal('');
  readonly questionCount = signal(10);
  readonly examMode = signal(false);
  readonly currentIndex = signal(0);
  readonly answers = signal<Record<string, string>>({});
  readonly submitted = signal(false);
  readonly importTopic = signal('');
  readonly importSubtopic = signal('');
  readonly importJson = signal('');
  readonly importError = signal('');
  readonly importSuccess = signal('');
  readonly fileName = signal('');
  readonly newTopic = signal('');
  readonly newSubtopic = signal('');
  readonly showTopicCreator = signal(false);
  readonly showSubtopicCreator = signal(false);
  readonly activeQuestions = signal<QuizQuestion[]>([]);
  readonly completedSession = signal<PracticeSession | null>(null);

  readonly topics = computed(() => [...new Set(this.quizSets().map(s => s.topic))].sort());
  readonly subtopics = computed(() => this.quizSets().filter(s => s.topic === this.selectedTopic()).map(s => s.subtopic));
  readonly selectedSets = computed(() => this.quizSets().filter(s => s.topic === this.selectedTopic() && s.subtopic === this.selectedSubtopic()));
  readonly totalQuestions = computed(() => this.quizSets().reduce((sum, s) => sum + s.questions.length, 0));
  readonly totalAttempts = computed(() => this.sessions().length);
  readonly overallAccuracy = computed(() => {
    const total = this.sessions().reduce((sum, s) => sum + s.total, 0);
    const correct = this.sessions().reduce((sum, s) => sum + s.correct, 0);
    return total ? Math.round(correct / total * 100) : 0;
  });
  readonly currentQuestion = computed(() => this.activeQuestions()[this.currentIndex()]);
  readonly selectedAnswer = computed(() => this.currentQuestion() ? this.answers()[this.currentQuestion().id] ?? '' : '');
  readonly score = computed(() => this.activeQuestions().filter(q => this.answers()[q.id] === q.answer).length);
  readonly answeredCount = computed(() => Object.keys(this.answers()).length);
  readonly progressPercent = computed(() => this.activeQuestions().length ? this.answeredCount() / this.activeQuestions().length * 100 : 0);
  readonly dailyStreak = computed(() => {
    const days = new Set(this.sessions().map(s => s.date));
    let count = 0;
    const cursor = new Date();
    while (days.has(this.localDate(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  });

  constructor() {
    this.store.quizSets$.subscribe(v => this.quizSets.set(v));
    this.store.sessions$.subscribe(v => this.sessions.set(v));
  }

  go(page: Page): void { this.page.set(page); }
  chooseTopic(topic: string): void {
    this.selectedTopic.set(topic);
    const first = this.quizSets().find(s => s.topic === topic);
    this.selectedSubtopic.set(first?.subtopic ?? '');
  }
  chooseSubtopic(subtopic: string): void { this.selectedSubtopic.set(subtopic); }

  createTopic(): void {
    const topic = this.newTopic().trim();
    if (!topic) return;
    this.importTopic.set(topic);
    this.selectedTopic.set(topic);
    this.newTopic.set('');
    this.showTopicCreator.set(false);
  }

  createSubtopic(): void {
    const subtopic = this.newSubtopic().trim();
    if (!subtopic) return;
    this.importSubtopic.set(subtopic);
    this.selectedSubtopic.set(subtopic);
    this.newSubtopic.set('');
    this.showSubtopicCreator.set(false);
  }

  loadSampleJson(): void {
    this.importJson.set(JSON.stringify({
      topic: 'History',
      subtopic: 'Vasco da Gama',
      questions: [{
        question: 'In which year did Vasco da Gama reach India?',
        options: ['1492', '1497', '1498', '1502'],
        answer: '1498',
        explanation: 'He reached Calicut on 20 May 1498.'
      }]
    }, null, 2));
    this.importError.set('');
    this.importSuccess.set('');
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileName.set(file.name);
    try {
      this.importJson.set(await file.text());
      this.importError.set('');
    } catch { this.importError.set('Unable to read this file.'); }
  }

  async importQuestions(): Promise<void> {
    this.importError.set('');
    this.importSuccess.set('');
    try {
      const parsed = JSON.parse(this.importJson()) as QuizImportPayload;
      const payload: QuizImportPayload = {
        ...parsed,
        topic: this.importTopic().trim() || parsed.topic,
        subtopic: this.importSubtopic().trim() || parsed.subtopic
      };
      const result = await this.store.importPayload(payload);
      this.importSuccess.set(`Imported ${result.added} questions into ${result.topic} → ${result.subtopic}.`);
      this.importTopic.set(result.topic);
      this.importSubtopic.set(result.subtopic);
      this.selectedTopic.set(result.topic);
      this.selectedSubtopic.set(result.subtopic);
      this.importJson.set('');
      this.fileName.set('');
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'Could not import JSON.');
    }
  }

  startPractice(): void {
    const pool = this.selectedSets().flatMap(s => s.questions);
    if (!pool.length) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    this.activeQuestions.set(shuffled.slice(0, Math.min(this.questionCount(), shuffled.length)));
    this.answers.set({});
    this.currentIndex.set(0);
    this.submitted.set(false);
    this.completedSession.set(null);
    this.page.set('practice');
  }

  selectAnswer(optionId: string): void {
    if (this.submitted() || !this.currentQuestion()) return;
    this.answers.update(current => ({ ...current, [this.currentQuestion().id]: optionId }));
  }

  previous(): void { this.currentIndex.update(i => Math.max(0, i - 1)); }
  next(): void { this.currentIndex.update(i => Math.min(this.activeQuestions().length - 1, i + 1)); }

  async submitPractice(): Promise<void> {
    if (this.submitted()) return;
    const questions = this.activeQuestions();
    const answerList: PracticeAnswer[] = questions.map(q => ({
      questionId: q.id,
      selectedOptionId: this.answers()[q.id] ?? '',
      correct: this.answers()[q.id] === q.answer
    }));
    const correct = answerList.filter(a => a.correct).length;
    const session: PracticeSession = {
      id: crypto.randomUUID(),
      topic: this.selectedTopic(),
      subtopic: this.selectedSubtopic(),
      date: this.localDate(new Date()),
      total: questions.length,
      correct,
      answers: answerList,
      completedAt: new Date().toISOString()
    };
    await this.store.addSession(session);
    this.completedSession.set(session);
    this.submitted.set(true);
  }

  optionState(q: QuizQuestion, optionId: string): string {
    if (!this.submitted()) return this.answers()[q.id] === optionId ? 'chosen' : '';
    if (q.answer === optionId) return 'correct';
    if (this.answers()[q.id] === optionId) return 'wrong';
    return '';
  }

  getQuestionNumber(q: QuizQuestion): number {
    return this.activeQuestions().findIndex(x => x.id === q.id) + 1;
  }

  optionText(q: QuizQuestion, optionId: string | undefined): string {
    return q.options.find(option => option.id === optionId)?.text ?? 'Not answered';
  }

  correctOptionText(q: QuizQuestion): string {
    return this.optionText(q, q.answer);
  }

  deleteSet(set: QuizSet): void {
    if (confirm(`Delete ${set.topic} → ${set.subtopic} and its questions?`)) this.store.deleteSet(set.id);
  }

 async exportBackup(): Promise<void> {
  const data = await this.store.exportData();

  const blob = new Blob([data], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'daily-quiz-backup.json';
  link.click();

  URL.revokeObjectURL(url);
}

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await this.store.importBackup(JSON.parse(await file.text()));
      alert('Backup restored successfully.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Invalid backup.');
    }
    input.value = '';
  }

  private localDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
