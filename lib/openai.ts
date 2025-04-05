import OpenAI from 'openai';

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY environment variable');
}

export const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});