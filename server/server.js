import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Simple health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Airports endpoint reads from data/airports.json
app.get('/airports', (_req, res) => {
  try {
    const airportsPath = path.resolve(__dirname, '../data/airports.json');
    if (!fs.existsSync(airportsPath)) {
      return res.status(404).json({ error: 'airports.json not found. Generate it via the notebook.' });
    }
    const data = fs.readFileSync(airportsPath, 'utf-8');
    const airports = JSON.parse(data);
    // Ensure alphabetical sort by AirportName for client convenience
    airports.sort((a, b) => String(a.AirportName).localeCompare(String(b.AirportName)));
    res.json(airports);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load airports', details: String(err) });
  }
});

// Predict endpoint: expects query params day_of_week and airport_id
// It shells out to inline Python (no separate file) that loads model.pkl and returns probabilities
app.get('/predict', (req, res) => {
  const day = Number(req.query.day_of_week);
  const airport = Number(req.query.airport_id);

  if (!Number.isFinite(day) || day < 1 || day > 7) {
    return res.status(400).json({ error: 'day_of_week must be an integer 1-7' });
  }
  if (!Number.isFinite(airport)) {
    return res.status(400).json({ error: 'airport_id must be a number' });
  }
console.log('bro')
  // Inline Python to load the pickle model and compute predict_proba
  const pyCode = `
import sys, json, pickle
day = int(sys.argv[1])
airport = int(sys.argv[2])
# model.pkl is expected to be in the server/ working directory
with open('model.pkl', 'rb') as f:
    model = pickle.load(f)
proba = model.predict_proba([[day, airport]])[0]
# Ensure numeric floats
try:
    certainty = float(proba[0])
    delay = float(proba[1])
except Exception:
    # Fallback similar to the Flask sample if proba is a string-like repr
    parts = str(proba).replace('[', '').replace(']', '').split()
    certainty = float(parts[0])
    delay = float(parts[1])
print(json.dumps({'certainty': certainty, 'delay': delay}))
`;
  console.log('hej')
  // Prefer python3, fall back to python if needed
  const pythonCmd = process.env.PYTHON || 'python3';

  const child = spawn(pythonCmd, ['-c', pyCode, String(day), String(airport)], {
    cwd: __dirname,
    env: process.env,
  });

  let stdout = '';
  let stderr = '';
  let finished = false;
console.log('work')
  // Timeout to avoid hanging the request
  const timeoutMs = 10_000_000;
  const timer = setTimeout(() => {
    if (!finished) {
      finished = true;
      child.kill('SIGKILL');
      return res.status(504).json({ error: 'Prediction timed out' });
    }
  }, timeoutMs);

  child.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  child.on('error', (err) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    // If python3 is missing, try fallback once
    if (pythonCmd === 'python3') {
      const fallback = spawn('python', ['-c', pyCode, String(day), String(airport)], { cwd: __dirname, env: process.env });
      let fbOut = '';
      let fbErr = '';
      fallback.stdout.on('data', (d) => (fbOut += d.toString()));
      fallback.stderr.on('data', (d) => (fbErr += d.toString()));
      fallback.on('close', (code) => {
        if (code === 0) {
          try {
            const parsed = JSON.parse(fbOut.trim());
            return res.json(parsed);
          } catch (e) {
            return res.status(500).json({ error: 'Failed to parse prediction output', details: String(e), raw: fbOut });
          }
        }
        return res.status(500).json({ error: 'Prediction process failed', details: fbErr || String(err) });
      });
      return;
    }
    return res.status(500).json({ error: 'Prediction process could not start', details: String(err) });
  });

  child.on('close', (code) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (code !== 0) {
      return res.status(500).json({ error: 'Prediction process failed', details: stderr || `Exited with code ${code}` });
    }
    try {
      const parsed = JSON.parse(stdout.trim());
      return res.json(parsed);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse prediction output', details: String(e), raw: stdout });
    }
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
