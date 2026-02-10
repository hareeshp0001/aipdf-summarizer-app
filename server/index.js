import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload PDF and get summary
app.post('/api/summarize', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const summaryLength = req.body.length || 'medium';

    // Extract text from PDF
    const pdfData = await pdfParse(req.file.buffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Could not extract text from PDF. The file may be image-based or empty.' });
    }

    // Truncate text if too long for API
    const maxChars = 12000;
    const textForSummary = extractedText.length > maxChars
      ? extractedText.substring(0, maxChars) + '\n\n[Text truncated due to length...]'
      : extractedText;

    const lengthInstructions = {
      short: 'Provide a brief summary in 2-3 sentences.',
      medium: 'Provide a comprehensive summary in 1-2 paragraphs.',
      long: 'Provide a detailed summary covering all key points, organized with bullet points and sections.',
    };

    // Call Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are an expert document summarizer. ${lengthInstructions[summaryLength] || lengthInstructions.medium} Use clear, professional language. Format your response in markdown.`,
        },
        {
          role: 'user',
          content: `Please summarize the following document:\n\n${textForSummary}`,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.3,
      max_tokens: 2048,
    });

    const summary = chatCompletion.choices[0]?.message?.content || 'Unable to generate summary.';

    // Store in Supabase
    const { data, error } = await supabase.from('summaries').insert({
      original_filename: req.file.originalname,
      file_size: req.file.size,
      page_count: pdfData.numpages,
      extracted_text: extractedText.substring(0, 50000),
      summary,
      summary_length: summaryLength,
    }).select().single();

    if (error) {
      console.error('Supabase insert error:', error);
    }

    res.json({
      id: data?.id,
      filename: req.file.originalname,
      pageCount: pdfData.numpages,
      textLength: extractedText.length,
      summary,
      summaryLength,
      createdAt: data?.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Summarize error:', err);
    res.status(500).json({ error: err.message || 'Failed to process PDF' });
  }
});

// Get all summaries (history)
app.get('/api/summaries', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, original_filename, file_size, page_count, summary, summary_length, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Fetch summaries error:', err);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

// Get single summary
app.get('/api/summaries/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('summaries')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Summary not found' });
    res.json(data);
  } catch (err) {
    console.error('Fetch summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Delete summary
app.delete('/api/summaries/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('summaries')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Summary deleted' });
  } catch (err) {
    console.error('Delete summary error:', err);
    res.status(500).json({ error: 'Failed to delete summary' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
