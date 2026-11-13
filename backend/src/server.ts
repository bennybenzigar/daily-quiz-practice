
import dns from 'node:dns';

// Configure DNS before MongoDB connection
dns.setServers(['8.8.8.8', '1.1.1.1']);

import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { api } from './routes/api.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const mongoUri = process.env.MONGODB_URI||'';

if (!mongoUri) {
  console.error('Missing MONGODB_URI. Copy .env.example to .env and configure MongoDB Atlas.');
  process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:4200')
  .split(',')
  .map(x => x.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  }
}));

app.use(express.json({ limit: '2mb' }));

app.use('/api', rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

app.use('/api', api);

const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request data.',
      details: err.issues
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      message: 'A record with this value already exists.'
    });
  }

  const status = Number(err?.status || 500);
  console.error(err);

  res.status(status >= 400 && status < 600 ? status : 500).json({
    message: err instanceof Error ? err.message : 'Unexpected server error.'
  });
};

app.use(errors);

async function startServer() {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });

    console.log('Connected to MongoDB.');

    app.listen(port, () => {
      console.log(`Daily Quiz API listening on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
}

startServer();
