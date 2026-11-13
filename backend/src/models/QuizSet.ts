import mongoose, { Schema } from 'mongoose';

const OptionSchema = new Schema({ id: { type: String, required: true }, text: { type: String, required: true } }, { _id: false });
const QuestionSchema = new Schema({
  id: { type: String, required: true },
  question: { type: String, required: true },
  options: { type: [OptionSchema], validate: (v: unknown[]) => v.length >= 2 },
  answer: { type: String, required: true },
  explanation: { type: String, default: '' },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' }
}, { _id: false });

const QuizSetSchema = new Schema({
  topic: { type: String, required: true, trim: true, index: true },
  subtopic: { type: String, required: true, trim: true, index: true },
  description: { type: String, default: '' },
  questions: { type: [QuestionSchema], default: [] }
}, { timestamps: true });

QuizSetSchema.index({ topic: 1, subtopic: 1 }, { unique: true });
export const QuizSetModel = mongoose.model('QuizSet', QuizSetSchema);
