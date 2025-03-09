/**
 * Script to push the project to GitHub
 * 
 * This script will:
 * 1. Initialize a Git repository if needed
 * 2. Add all files to the repository
 * 3. Commit the changes
 * 4. Set up a GitHub remote
 * 5. Push to GitHub
 */

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Execute a shell command and handle errors
 */
function runCommand(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    console.error(`\x1b[31mCommand failed: ${command}\x1b[0m`);
    if (error.stdout) console.error(`stdout: ${error.stdout}`);
    if (error.stderr) console.error(`stderr: ${error.stderr}`);
    throw error;
  }
}

/**
 * Prompt user for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(`\x1b[36m${question}\x1b[0m `, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Check if Git is installed
 */
function checkGitInstalled() {
  try {
    runCommand('git --version', { silent: true });
    return true;
  } catch (error) {
    console.error('\x1b[31mGit is not installed or not available in the PATH\x1b[0m');
    return false;
  }
}

/**
 * Check if directory is already a Git repository
 */
function isGitRepo() {
  try {
    runCommand('git rev-parse --is-inside-work-tree', { silent: true });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize a new Git repository
 */
function initGitRepo() {
  console.log('\x1b[34mInitializing Git repository...\x1b[0m');
  runCommand('git init');
}

/**
 * Configure Git user information
 */
async function configureGit() {
  let name, email;
  
  try {
    name = runCommand('git config --get user.name', { silent: true }).trim();
  } catch (error) {
    name = '';
  }
  
  try {
    email = runCommand('git config --get user.email', { silent: true }).trim();
  } catch (error) {
    email = '';
  }
  
  if (!name) {
    name = await prompt('Enter your Git username:');
    runCommand(`git config user.name "${name}"`);
  }
  
  if (!email) {
    email = await prompt('Enter your Git email:');
    runCommand(`git config user.email "${email}"`);
  }
  
  console.log(`\x1b[32mGit configured with user: ${name} <${email}>\x1b[0m`);
}

/**
 * Stage all files
 */
function stageFiles() {
  console.log('\x1b[34mStaging all files...\x1b[0m');
  runCommand('git add .');
}

/**
 * Create initial commit
 */
function commitChanges() {
  // Check if there are changes to commit
  const status = runCommand('git status --porcelain', { silent: true });
  
  if (!status.trim()) {
    console.log('\x1b[33mNo changes to commit\x1b[0m');
    return false;
  }
  
  console.log('\x1b[34mCommitting changes...\x1b[0m');
  runCommand('git commit -m "Initial commit: RecipeKeeper application"');
  return true;
}

/**
 * Add GitHub remote
 */
async function addGitHubRemote() {
  try {
    const remotes = runCommand('git remote', { silent: true });
    
    if (remotes.includes('origin')) {
      const url = runCommand('git remote get-url origin', { silent: true }).trim();
      console.log(`\x1b[33mRemote 'origin' already exists: ${url}\x1b[0m`);
      
      const change = await prompt('Do you want to change it? (y/n):');
      if (change.toLowerCase() !== 'y') {
        return;
      }
      
      runCommand('git remote remove origin');
    }
    
    const repoUrl = await prompt('Enter your GitHub repository URL (https://github.com/username/repo.git):');
    if (!repoUrl) {
      console.log('\x1b[33mSkipping remote setup (no URL provided)\x1b[0m');
      return;
    }
    
    console.log('\x1b[34mAdding GitHub remote...\x1b[0m');
    runCommand(`git remote add origin ${repoUrl}`);
    console.log(`\x1b[32mRemote 'origin' added: ${repoUrl}\x1b[0m`);
  } catch (error) {
    console.error('\x1b[31mFailed to add GitHub remote\x1b[0m');
    throw error;
  }
}

/**
 * Push to GitHub
 */
async function pushToGitHub() {
  console.log('\x1b[34mPushing to GitHub...\x1b[0m');
  try {
    runCommand('git push -u origin master || git push -u origin main');
    console.log('\x1b[32mSuccessfully pushed to GitHub\x1b[0m');
  } catch (error) {
    console.error('\x1b[31mFailed to push to GitHub\x1b[0m');
    console.log('\x1b[33mYou may need to authenticate with GitHub. Try the following:\x1b[0m');
    console.log('1. Set up a Personal Access Token: https://github.com/settings/tokens');
    console.log('2. Use it when prompted for password');
    
    const retry = await prompt('Do you want to try again? (y/n):');
    if (retry.toLowerCase() === 'y') {
      try {
        runCommand('git push -u origin master || git push -u origin main');
        console.log('\x1b[32mSuccessfully pushed to GitHub\x1b[0m');
      } catch (retryError) {
        console.error('\x1b[31mFailed to push to GitHub after retry\x1b[0m');
        console.log('You can push manually later using "git push -u origin main"');
      }
    }
  }
}

/**
 * Create GitHub repository creation instructions
 */
function showGitHubRepoInstructions() {
  console.log('\n\x1b[36mTo create a new GitHub repository:\x1b[0m');
  console.log('1. Go to https://github.com/new');
  console.log('2. Enter "RecipeKeeper" as the repository name');
  console.log('3. Choose whether it should be public or private');
  console.log('4. Do NOT initialize with README, .gitignore, or license');
  console.log('5. Click "Create repository"');
  console.log('6. Copy the repository URL for the next step\n');
}

/**
 * Create a README.md file if it doesn't exist
 */
function createReadmeIfNeeded() {
  const readmePath = path.join(process.cwd(), 'README.md');
  
  if (!fs.existsSync(readmePath)) {
    console.log('\x1b[34mCreating README.md file...\x1b[0m');
    
    const content = `# RecipeKeeper

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
2. Copy \`.env.example\` to \`.env\` and fill in your Supabase credentials
3. Run \`npm install\` to install dependencies
4. Run \`npm run dev\` to start the development server

## Environment Variables

Required:
- \`VITE_SUPABASE_URL\`: Your Supabase project URL
- \`VITE_SUPABASE_ANON_KEY\`: Your Supabase anonymous key

Optional:
- \`VITE_GOOGLE_API_KEY\`: Google Gemini API key for recipe extraction from images
- \`VITE_OPENAI_API_KEY\`: OpenAI API key for image generation
`;
    
    fs.writeFileSync(readmePath, content);
    console.log('\x1b[32mREADME.md created\x1b[0m');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\x1b[35m=== GitHub Repository Setup ===\x1b[0m\n');
  
  if (!checkGitInstalled()) {
    console.log('Please install Git and try again.');
    process.exit(1);
  }
  
  if (!isGitRepo()) {
    initGitRepo();
  } else {
    console.log('\x1b[32mGit repository already initialized\x1b[0m');
  }
  
  await configureGit();
  createReadmeIfNeeded();
  stageFiles();
  
  const hasChanges = commitChanges();
  if (!hasChanges) {
    console.log('No changes to push. Make sure you have changes before pushing to GitHub.');
  }
  
  showGitHubRepoInstructions();
  await addGitHubRemote();
  await pushToGitHub();
  
  console.log('\n\x1b[32m✅ Process completed!\x1b[0m');
  rl.close();
}

// Run the main function
main().catch(error => {
  console.error('\x1b[31mAn error occurred:\x1b[0m', error);
  rl.close();
  process.exit(1);
});