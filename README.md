# RecipeKeeper

A modern web application for managing, sharing, and organizing recipes with meal planning capabilities.

## Features

- Recipe management with rich descriptions and step-by-step instructions
- Recipe sharing with other users
- Meal planning functionality
- Shopping list generation
- Recipe image upload and AI-powered image extraction

## Technologies

- React with TypeScript
- Vite for fast development and optimized builds
- Supabase for database and authentication
- Tailwind CSS for styling

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your Supabase credentials
3. Run `npm install` to install dependencies
4. Run `npm run dev` to start the development server

## Environment Variables

Required:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key

Optional:
- `VITE_GOOGLE_API_KEY`: Google Gemini API key for recipe extraction from images
- `VITE_OPENAI_API_KEY`: OpenAI API key for image generation

## Database Structure

The application uses Supabase (PostgreSQL) with the following main tables:
- `recipes`: Store recipe details
- `ingredients`: Ingredients for each recipe
- `tags`: Recipe categories
- `cooking_logs`: Track cooking history
- `meal_plans`: Weekly meal planning
- `grocery_lists`: Shopping lists

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request