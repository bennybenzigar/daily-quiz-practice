import mongoose, { Schema } from 'mongoose';

const AnswerSchema = new Schema({
  questionId: { type: String, required: true },
  selectedOptionId: { type: String, default: '' },
  correct: { type: Boolean, required: true }
}, { _id: false });

const PracticeSessionSchema = new Schema({
  clientId: { type: String, required: true, unique: true },
  topic: { type: String, required: true },
  subtopic: { type: String, required: true },
  date: { type: String, required: true, index: true },
  total: { type: Number, required: true, min: 1 },
  correct: { type: Number, required: true, min: 0 },
  answers: { type: [AnswerSchema], default: [] },
  completedAt: { type: Date, required: true }
}, { timestamps: true });

export const PracticeSessionModel = mongoose.model('PracticeSession', PracticeSessionSchema);
