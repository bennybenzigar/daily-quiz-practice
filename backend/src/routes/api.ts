import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { QuizSetModel } from '../models/QuizSet.js';
import { PracticeSessionModel } from '../models/PracticeSession.js';

export const api = Router();

const optionSchema = z.union([
  z.string().min(1),
  z.object({ id: z.string().optional(), text: z.string().optional(), label: z.string().optional() })
]);
const importSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  subtopic: z.string().trim().min(1).max(120),
  description: z.string().optional(),
  questions: z.array(z.object({
    id: z.string().optional(),
    question: z.string().trim().min(1).max(2000),
    options: z.array(optionSchema).min(2).max(10),
    answer: z.string().min(1),
    explanation: z.string().max(3000).optional(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional()
  })).min(1).max(1000)
});

api.get('/health', (_req, res) => res.json({ status: 'ok', service: 'daily-quiz-api' }));

api.get('/quiz-sets', async (_req, res, next) => {
  try {
    const sets = await QuizSetModel.find().sort({ topic: 1, subtopic: 1 }).lean();
    res.json(sets.map(s => ({ id: s._id.toString(), topic: s.topic, subtopic: s.subtopic, description: s.description, questions: s.questions, importedAt: s.createdAt })));
  } catch (e) { next(e); }
});

api.post('/quiz-sets/import', async (req, res, next) => {
  try {
    const parsed = importSchema.parse(req.body);
    const incoming = parsed.questions.map((q, index) => {
      const options = q.options.map((option, i) => {
        const id = typeof option === 'string' ? String.fromCharCode(65 + i) : (option.id || String.fromCharCode(65 + i));
        const text = typeof option === 'string' ? option.trim() : (option.text || option.label || '').trim();
        if (!text) throw new Error(`Question ${index + 1}, option ${i + 1} is empty.`);
        return { id, text };
      });
      const answer = q.answer.trim().toLowerCase();
      const match = options.find(o => o.id.toLowerCase() === answer || o.text.toLowerCase() === answer);
      if (!match) throw new Error(`Question ${index + 1}: answer must match an option ID or option text.`);
      return {
        id: q.id || randomUUID(),
        question: q.question,
        options,
        answer: match.id,
        explanation: q.explanation || '',
        difficulty: q.difficulty || 'medium'
      };
    });

    let set = await QuizSetModel.findOne({ topic: parsed.topic, subtopic: parsed.subtopic });
    if (!set) set = new QuizSetModel({ topic: parsed.topic, subtopic: parsed.subtopic, description: parsed.description || '', questions: [] });
    const ids = new Set(set.questions.map(q => q.id));
    for (const q of incoming) {
      if (ids.has(q.id)) q.id = randomUUID();
      ids.add(q.id);
    }
    set.questions.push(...incoming);
    if (parsed.description) set.description = parsed.description;
    await set.save();
    res.status(201).json({ added: incoming.length, topic: set.topic, subtopic: set.subtopic });
  } catch (e) { next(e); }
});

api.delete('/quiz-sets/:id', async (req, res, next) => {
  try {
    const deleted = await QuizSetModel.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Question bank not found.' });
    res.status(204).send();
  } catch (e) { next(e); }
});

api.get('/sessions', async (_req, res, next) => {
  try {
    const sessions = await PracticeSessionModel.find().sort({ completedAt: -1 }).lean();
    res.json(sessions.map(s => ({
      id: s.clientId, topic: s.topic, subtopic: s.subtopic, date: s.date,
      total: s.total, correct: s.correct, answers: s.answers, completedAt: s.completedAt
    })));
  } catch (e) { next(e); }
});

api.post('/sessions', async (req, res, next) => {
  try {
    const schema = z.object({
      id: z.string().min(1), topic: z.string().min(1), subtopic: z.string().min(1),
      date: z.string().min(8), total: z.number().int().min(1),
      correct: z.number().int().min(0), answers: z.array(z.object({
        questionId: z.string(), selectedOptionId: z.string(), correct: z.boolean()
      })), completedAt: z.string().datetime()
    });
    const s = schema.parse(req.body);
    const doc = await PracticeSessionModel.findOneAndUpdate(
      { clientId: s.id },
      { ...s, clientId: s.id, completedAt: new Date(s.completedAt) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ id: doc.clientId });
  } catch (e) { next(e); }
});

api.get('/backup', async (_req, res, next) => {
  try {
    const [sets, sessions] = await Promise.all([
      QuizSetModel.find().lean(),
      PracticeSessionModel.find().lean()
    ]);
    res.json({
      version: 2,
      quizSets: sets.map(s => ({ id: s._id.toString(), topic: s.topic, subtopic: s.subtopic, description: s.description, questions: s.questions, importedAt: s.createdAt })),
      sessions: sessions.map(s => ({ id: s.clientId, topic: s.topic, subtopic: s.subtopic, date: s.date, total: s.total, correct: s.correct, answers: s.answers, completedAt: s.completedAt }))
    });
  } catch (e) { next(e); }
});

api.post('/backup/restore', async (req, res, next) => {
  try {
    const body = z.object({ quizSets: z.array(z.any()), sessions: z.array(z.any()).optional() }).parse(req.body);
    const operations = body.quizSets.map((set: any) => ({
      updateOne: {
        filter: { topic: set.topic, subtopic: set.subtopic },
        update: { $set: { description: set.description || '', questions: set.questions || [] } },
        upsert: true
      }
    }));
    if (operations.length) await QuizSetModel.bulkWrite(operations);
    if (body.sessions?.length) {
      const sessionOps = body.sessions.map((s: any) => ({
        updateOne: {
          filter: { clientId: s.id },
          update: { $set: { clientId: s.id, topic: s.topic, subtopic: s.subtopic, date: s.date, total: s.total, correct: s.correct, answers: s.answers || [], completedAt: new Date(s.completedAt) } },
          upsert: true
        }
      }));
      await PracticeSessionModel.bulkWrite(sessionOps);
    }
    res.json({ restoredBanks: operations.length, restoredSessions: body.sessions?.length || 0 });
  } catch (e) { next(e); }
});
