import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { PracticeSession, QuizImportPayload, QuizQuestion, QuizSet } from '../models/quiz.models';
import { environment } from '../../environments/environment';

interface ImportResult { added: number; topic: string; subtopic: string; }
interface BackupData { version: number; quizSets: QuizSet[]; sessions: PracticeSession[]; }

@Injectable({ providedIn: 'root' })
export class QuizStoreService {
  private readonly quizSubject = new BehaviorSubject<QuizSet[]>([]);
  private readonly sessionSubject = new BehaviorSubject<PracticeSession[]>([]);
  readonly quizSets$ = this.quizSubject.asObservable();
  readonly sessions$ = this.sessionSubject.asObservable();
  private readonly api = environment.apiUrl;

  constructor(private readonly http: HttpClient) {
    void this.refresh();
  }

  get quizSets(): QuizSet[] { return this.quizSubject.value; }
  get sessions(): PracticeSession[] { return this.sessionSubject.value; }

  async refresh(): Promise<void> {
    const [sets, sessions] = await Promise.all([
      firstValueFrom(this.http.get<QuizSet[]>(`${this.api}/quiz-sets`)),
      firstValueFrom(this.http.get<PracticeSession[]>(`${this.api}/sessions`))
    ]);
    this.quizSubject.next(sets);
    this.sessionSubject.next(sessions);
  }

  async importPayload(payload: QuizImportPayload): Promise<ImportResult> {
    const normalized = this.validatePayload(payload);
    const result = await firstValueFrom(this.http.post<ImportResult>(`${this.api}/quiz-sets/import`, normalized));
    await this.refresh();
    return result;
  }

  private validatePayload(payload: QuizImportPayload): QuizImportPayload {
    const topic = payload.topic?.trim();
    const subtopic = payload.subtopic?.trim();
    if (!topic || !subtopic) throw new Error('Topic and subtopic are required.');
    if (!Array.isArray(payload.questions) || payload.questions.length === 0) throw new Error('The JSON must contain at least one question.');
    payload.questions.forEach((q, index) => {
      if (!q.question?.trim()) throw new Error(`Question ${index + 1} has no question text.`);
      if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`Question ${index + 1} must have at least two options.`);
      const options = q.options.map((o, i) => typeof o === 'string' ? { id: String.fromCharCode(65+i), text: o } : { id: o.id ?? String.fromCharCode(65+i), text: o.text ?? o.label ?? '' });
      const answer = String(q.answer ?? '').trim().toLowerCase();
      if (!options.some(o => o.id.toLowerCase() === answer || o.text.toLowerCase() === answer)) throw new Error(`Question ${index + 1}: answer must match an option ID or option text.`);
    });
    return { ...payload, topic, subtopic };
  }

  async addSession(session: PracticeSession): Promise<void> {
    await firstValueFrom(this.http.post(`${this.api}/sessions`, session));
    await this.refresh();
  }

  async deleteSet(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/quiz-sets/${id}`));
    await this.refresh();
  }

  async exportData(): Promise<string> {
    const backup = await firstValueFrom(this.http.get<BackupData>(`${this.api}/backup`));
    return JSON.stringify(backup, null, 2);
  }

  async importBackup(data: unknown): Promise<void> {
    if (!data || typeof data !== 'object' || !('quizSets' in data) || !Array.isArray((data as {quizSets: unknown}).quizSets)) {
      throw new Error('Invalid application backup file.');
    }
    await firstValueFrom(this.http.post(`${this.api}/backup/restore`, data));
    await this.refresh();
  }
}
