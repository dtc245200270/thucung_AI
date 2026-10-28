import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động nạp file .env từ thư mục gốc của dự án
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  APP_URL: (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'PetCare PRO AI <no-reply@petcare.ai>',
  DEV_MODE_ALLOW_CONSOLE_EMAIL: process.env.DEV_MODE_ALLOW_CONSOLE_EMAIL === 'true',

  // --- Cấu hình Ollama tập trung ---
  // Đọc từ .env, không gán cứng tên model ở nơi khác
  OLLAMA_BASE_URL: (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  OLLAMA_VISION_MODEL: process.env.OLLAMA_VISION_MODEL || 'moondream:1.8b',
  OLLAMA_TEXT_MODEL: process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:1.5b',
  OLLAMA_CHAT_MODEL: process.env.OLLAMA_CHAT_MODEL || process.env.OLLAMA_TEXT_MODEL || 'qwen2.5:1.5b',
  OLLAMA_EMBED_MODEL: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma',
  // Timeout phân tích ảnh phù hợp phần cứng cục bộ (120 giây cho CPU, ngắn hơn với GPU)
  OLLAMA_VISION_TIMEOUT_MS: parseInt(process.env.OLLAMA_VISION_TIMEOUT_MS || '120000', 10),
  // Timeout phản hồi chatbot cục bộ (30 giây)
  OLLAMA_CHAT_TIMEOUT_MS: parseInt(process.env.OLLAMA_CHAT_TIMEOUT_MS || '30000', 10),
};

export const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-dev';
