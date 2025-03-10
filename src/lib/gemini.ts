import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { getEnv, hasEnv } from './env';

const apiKey = getEnv('VITE_GOOGLE_API_KEY');

// Initialize Gemini AI model once
let model: any = null;

function initializeModel() {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please add VITE_GOOGLE_API_KEY to your environment variables.');
  }

  if (!model) {
    const genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }
  return model;
}

interface ParsedRecipe {
  title: string;
  description: string;
  ingredients: {
    name: string;
    amount: number | null;
    unit: string | null;
    isSection?: boolean;
  }[];
  instructions: string;
}

// Helper function to check if error is retryable
function isRetryableError(error: any): boolean {
  return (
    error?.message?.includes('503') ||
    error?.message?.includes('RESOURCE_EXHAUSTED') ||
    error?.message?.includes('overloaded')
  );
}

// Exponential backoff with jitter
function getBackoffDelay(attempt: number, minDelay = 1000, maxDelay = 10000) {
  const baseDelay = Math.min(maxDelay, minDelay * Math.pow(2, attempt));
  return baseDelay + Math.random() * 1000; // Add random jitter between 0-1000ms
}

// Helper function to clean ingredient name
function cleanIngredientName(name: string): string {
  // Remove any numbers and units from the start of the name
  return name.replace(/^[\d\s.,/½¼¾⅓⅔⅛]+\s*(?:g|gram|grams|kg|ml|l|liter|liters|cup|cups|tbsp|tsp|tablespoon|tablespoons|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|piece|pieces|slice|slices|pinch|pinches|handful|handfuls|dash|dashes)\s*/i, '').trim();
}

export async function extractRecipeFromImage(imageData: string): Promise<ParsedRecipe> {
  if (!hasEnv('VITE_GOOGLE_API_KEY')) {
    throw new Error('Gemini API key not configured');
  }

  // Initialize model
  const model = initializeModel();

  // Validate image data
  if (!imageData.startsWith('data:image/')) {
    throw new Error('Invalid image format');
  }

  // Extract base64 data
  const base64Data = imageData.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid image data');
  }

  const prompt = `Analyze this recipe image and extract as much information as possible. Return ONLY a valid JSON object with no additional text. The JSON must follow this exact structure:

{
  "error": null,
  "title": "Recipe title",
  "description": "Brief description",
  "servings": null,
  "cookingTime": null,
  "ingredients": [
    {
      "name": "ONLY the ingredient name, NO amounts or units here, start with capital letters",
      "amount": 0,
      "unit": "unit",
      "isSection": false
    }
  ],
  "instructions": "Cooking instructions",
  "confidence": {
    "title": 0.0,
    "ingredients": 0.0,
    "servings": 0.0,
    "cookingTime": 0.0,
    "instructions": 0.0,
    "language": "detected language code (e.g., 'en', 'no', 'de', etc.)"
  }
}

CRITICAL INGREDIENT PARSING RULES:
1. For each ingredient line like "150g flour":
   - name: ONLY "Flour" (no amounts or units!)
   - amount: 150
   - unit: "g"

2. For each ingredient line like "2 cups milk":
   - name: ONLY "Milk" (no amounts or units!)
   - amount: 2
   - unit: "cups"

3. For ingredient sections starting with "#":
   - isSection: true
   - name: section name without "#"
   - amount: null
   - unit: null

4. NEVER include amounts or measurements in the name field!
   WRONG: name: "150g flour"
   RIGHT: name: "flour", amount: 150, unit: "g"

SERVINGS AND COOKING TIME RULES:
1. Extract servings if mentioned (e.g., "Serves 4", "4 portions", "4-6 servings")
2. Extract cooking time in minutes (e.g., "30 minutes", "1 hour" = 60 minutes)
3. Set to null if not found or unclear
4. Only use numeric values
5. For ranges (e.g., "4-6 servings"), use the lower number
6. Use capital letters at the start of sentences and for proper nouns, and lowercase letters in regular text otherwise, following natural language conventions
7. Remove unnecessary line breaks while keeping the content intact

SPELLING AND LANGUAGE RULES:
1. First detect the language of the recipe (add to confidence.language)
2. For each detected language:
   - English (en): Fix common spelling mistakes while preserving British/American variations
   - Norwegian (no): Fix common Norwegian spelling mistakes, follow Bokmål rules
   - German (de): Fix German spelling mistakes, follow new spelling rules
   - Other languages: Fix obvious typos while preserving dialect variations

3. Apply spelling fixes to:
   - Recipe title
   - Ingredient names (but keep special/regional ingredient names as is),
   - Instructions
   - Description

4. CRITICAL: Only fix clear spelling mistakes, DO NOT:
   - Change dialectal variations
   - Translate anything
   - Change special ingredient names
   - Modify cooking terms specific to the region

GENERAL RULES:
1. NEVER translate any text - keep ALL text in the EXACT same language as the image
2. If generating a description, use the SAME LANGUAGE as the recipe title and instructions
3. Preserve ALL original formatting, spacing
4. Keep ALL measurements in their original format and language
5. Remove unnecessary line breaks in instructions

PARTIAL RECIPE HANDLING:
- If any required field is missing or unclear, still return all other detected information
- Set confidence scores between 0.0 and 1.0 for each major component:
  * title: How confident the title is correct and complete
  * ingredients: How confident the ingredients list is complete
  * instructions: How confident the instructions are complete
  * language: How confident about the detected language
- For missing sections, use empty values and set confidence to 0.0
- For partially detected sections, set confidence proportional to completeness

Additional rules:
- Return ONLY the JSON object, no other text
- Use null for error field if any recipe content is found
- Convert fractions to decimals
- Use null for missing amounts or units
- Ensure valid JSON syntax
- No comments in JSON
- Preserve line breaks with \\n
- If no description exists, generate one in the SAME LANGUAGE as the recipe using:
  * Recipe title
  * Main ingredients
  * Cooking method
  * Keep under 100 characters
  * Match the style and tone of the original text`;

  const maxRetries = 5;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        },
        prompt
      ]);

      const response = await result.response;
      const text = response.text().trim();
      
      if (!text) {
        throw new Error('No text could be extracted from the image. Please ensure the image is clear and well-lit.');
      }

      // Remove any potential markdown code block markers
      const cleanedText = text.replace(/^```json\s*|\s*```$/g, '');

      try {
        let parsedResponse;
        try {
          parsedResponse = JSON.parse(cleanedText);
        } catch (parseError) {
          throw new Error('Failed to parse recipe data from image');
        }

        // Check if AI detected no recipe content at all
        if (parsedResponse.confidence && 
            parsedResponse.confidence.title === 0 && 
            parsedResponse.confidence.ingredients === 0 && 
            parsedResponse.confidence.instructions === 0) {
          throw new Error('No recipe content detected in image');
        }

        // Validate and clean ingredients
        const cleanedIngredients = (parsedResponse.ingredients || []).map((ing: any) => {
          if (!ing.name?.trim()) {
            return null; // Skip invalid ingredients
          }

          // For non-section ingredients, ensure name doesn't include amounts/units
          if (!ing.isSection) {
            return {
              name: cleanIngredientName(ing.name.trim()),
              amount: ing.amount ? Number(ing.amount) : null,
              unit: ing.unit?.trim() || null,
              isSection: false
            };
          }

          // For sections, keep the name as is but ensure other fields are null
          return {
            name: ing.name.trim(),
            amount: null,
            unit: null,
            isSection: true
          };
        }).filter(Boolean); // Remove null entries

        // If no description was provided or generated, make one final attempt
        if (!parsedResponse.description && parsedResponse.title) {
          const descriptionPrompt = `Generate a brief, appealing description (under 100 characters) for this recipe.
CRITICAL: Use EXACTLY the same language as this title: "${parsedResponse.title}"
Language detected: ${parsedResponse.confidence?.language || 'unknown'}

Context:
- Main ingredients: ${cleanedIngredients.filter(i => !i.isSection).slice(0, 3).map(i => i.name).join(', ')}
- First instruction: ${parsedResponse.instructions?.split('\n')[0] || ''}

Return ONLY the description text, no other formatting or explanation.
The description MUST be in the same language as the title.
Fix any obvious spelling mistakes while preserving dialectal variations.`;

          try {
            const descResult = await model.generateContent(descriptionPrompt);
            const description = (await descResult.response).text().trim();
            parsedResponse.description = description;
          } catch (descError) {
            console.error('Error generating description:', descError);
            parsedResponse.description = parsedResponse.title;
          }
        }

        // Build user-friendly error message for partial extractions
        let errorMessage = '';
        if (parsedResponse.confidence) {
          if (parsedResponse.confidence.title < 0.5) {
            errorMessage += 'Recipe title may be incomplete or unclear. ';
          }
          if (parsedResponse.confidence.ingredients < 0.5) {
            errorMessage += 'Ingredient list may be incomplete. ';
          }
          if (parsedResponse.confidence.instructions < 0.5) {
            errorMessage += 'Instructions may be incomplete. ';
          }
        }

        if (errorMessage) {
          throw new Error(`Partial recipe detected: ${errorMessage.trim()} Please verify and complete any missing information.`);
        }

        return {
          title: parsedResponse.title?.trim() || 'Untitled Recipe',
          description: parsedResponse.description?.trim() || '',
          servings: parsedResponse.servings,
          cookingTime: parsedResponse.cookingTime,
          ingredients: cleanedIngredients,
          instructions: parsedResponse.instructions?.trim() || ''
        };
      } catch (parseError: any) {
        throw new Error(parseError.message || 'Could not extract complete recipe from image. Some information may be missing or unclear.');
      }
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (isRetryableError(error) && attempt < maxRetries - 1) {
        attempt++;
        if (attempt < maxRetries) {
          const delay = getBackoffDelay(attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        // Non-retryable error or max retries reached
        break;
      }
    }
  }

  // If we've exhausted all retries or hit a non-retryable error, throw a user-friendly error
  let errorMessage = 'Failed to process the recipe image';
  
  if (lastError instanceof Error) {
    if (lastError.message.includes('400')) {
      errorMessage = 'Could not process the image. Please try a clearer photo with visible recipe text.';
    } else if (lastError.message.includes('429')) {
      errorMessage = 'Too many requests. Please try again in a moment.';
    } else if (isRetryableError(lastError)) {
      errorMessage = 'Service temporarily unavailable. Please try again.';
    } else {
      errorMessage = lastError.message;
    }
  } else if (isRetryableError(lastError)) {
    errorMessage = 'The service is currently experiencing high demand. Please try again in a few moments.';
  }
  
  throw new Error(`${errorMessage}. For handwritten recipes, please ensure the image is well-lit and the writing is clear.`);
}