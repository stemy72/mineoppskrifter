import OpenAI from "openai";
import { getEnv, hasEnv } from './env';

const apiKey = getEnv('VITE_OPENAI_API_KEY');

// Create OpenAI client only if API key is available
const openai = apiKey ? new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true
}) : null;

export async function generateRecipeImage(title: string, description: string): Promise<string | null> {
  if (!hasEnv('VITE_OPENAI_API_KEY')) {
    throw new Error('OpenAI API key not configured. Please add VITE_OPENAI_API_KEY to your environment variables.');
  }

  if (!openai) {
    throw new Error('OpenAI client not initialized. Missing API key.');
  }

  try {
    const prompt = `Create a professional, appetizing photo of "${title}". ${description}. 
Style: Professional food photography, well-lit, high-resolution, appetizing presentation.
The image should look realistic and appetizing, like a professional food photograph.`;

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
      style: "natural",
      response_format: "b64_json"
    });

    if (response.data[0]?.b64_json) {
      return `data:image/png;base64,${response.data[0].b64_json}`;
    }

    return null;
  } catch (error: any) {
    console.error('Error generating image:', error);
    throw new Error(error.message || 'Failed to generate recipe image');
  }
}