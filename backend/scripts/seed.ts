import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';\nimport { randomUUID } from 'node:crypto';
import { QuizSetModel } from '../src/models/QuizSet.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required.');
const sample = JSON.parse(fs.readFileSync(new URL('../../sample-data/vasco-da-gama.json', import.meta.url), 'utf8'));
await mongoose.connect(uri);
const exists = await QuizSetModel.findOne({ topic: sample.topic, subtopic: sample.subtopic });
if (exists) console.log('Vasco da Gama sample bank already exists; no duplicate inserted.');
else {
  const questions = sample.questions.map((q: any, index: number) => {
    const options = q.options.map((text: string, i: number) => ({ id: String.fromCharCode(65 + i), text }));
    const answer = options.find((o: any) => o.text.toLowerCase() === q.answer.toLowerCase());
    if (!answer) throw new Error(`Invalid answer in sample question ${index + 1}`);
    return { id: q.id || randomUUID(), question: q.question, options, answer: answer.id, explanation: q.explanation || '', difficulty: q.difficulty || 'medium' };
  });
  await QuizSetModel.create({ topic: sample.topic, subtopic: sample.subtopic, description: sample.description || '', questions });
  console.log(`Seeded ${questions.length} Vasco da Gama questions.`);
}
await mongoose.disconnect();
