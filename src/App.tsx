import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Heading from '@tiptap/extension-heading';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import axios from 'axios';
import { STEP_1_PROMPT_TEMPLATE } from './step1Prompt';
import { STEP_2_PROMPT_TEMPLATE } from './step2Prompt'; // Medium
import { RECIPE_REWRITE_PROMPT } from './recipeRewritePrompt'; // Hard
import { STEP_4_MASTER_PROMPT_TEMPLATE } from './step4MasterPrompt'; // Master
import { STEP_5_PROMPT_TEMPLATE } from './step5Prompt'; // High (Added)
import { RECIPE_ARTICLE_PROMPT_TEMPLATE } from './recipeArticlePrompt'; // Recipe Article Flow 1
import { RECIPE_ARTICLE_FLOW2_PROMPT_TEMPLATE } from './recipeArticleFlow2Prompt'; // Recipe Article Flow 2
import { ImagePlacer } from './components/ImagePlacer';
import { PROMPT_CHUNK_1, PROMPT_CHUNK_2, PROMPT_CHUNK_3, buildChunkedPrompt } from './recipeRewritePromptChunked';
import './App.css'; // We'll add styles later
import { generateImage as generateAIImage } from './services/imageGenerator';
import { generateImagePrompts } from './services/imagePromptGenerator';

// Shared alt text prompt template to ensure consistency
export const SHARED_ALT_TEXT_PROMPT = `Write a concise, SEO-optimized alt text (max 125 characters) for a recipe image. Include the focus keyword: '{focusKeyword}'. Describe the visual elements of the dish, including presentation, ingredients, and serving style. Focus on what someone would see in the photo and what would make it appealing to both users and search engines.`;

// Prompt for generating WordPress image titles
export const IMAGE_TITLE_PROMPT = `You are a content assistant for WordPress images.

Input: A blog post title (e.g., "Barbie Cake Recipe")

Goal: Write a human-readable image title for WordPress, used in the media library "Title" field. The title should:
- Be clear and natural, like a short headline
- Contain relevant SEO keywords from the input
- Be properly capitalized (title case)
- Avoid hyphens, AI phrases, or unnatural formatting
- Be easy to understand for humans and screen readers
- Not exceed about 70 characters

Output:
A single sentence-style or headline-style image title, no extra text.

Example output:
Barbie Cake Recipe with Pink Buttercream Frosting

Input: "{recipeTitle}"

Output:`;

// Function to get the blog post content from the editor
export function getBlogPostContent(editor: any): string {
  return editor ? editor.getHTML() : '';
}

// Define the structure for API keys - Now includes image generation APIs
interface ApiKeys {
  openRouter: string;
  stabilityAi: string;
  leonardoAi: string;
}
// Helper to get or create tag IDs from tag names
async function getTagIds(tagNames: string[], wordpressSettings: WordPressSettings, authHeader: string) {
  const tagIds: number[] = [];
  for (const name of tagNames) {
    // 1. Try to find the tag
    const searchRes = await axios.get(
      `${wordpressSettings.url}/wp-json/wp/v2/tags?search=${encodeURIComponent(name)}`,
      { headers: { 'Authorization': authHeader } }
    );
    if (searchRes.data.length > 0) {
      tagIds.push(searchRes.data[0].id);
    } else {
      // 2. Create the tag if it doesn't exist
      const createRes = await axios.post(
        `${wordpressSettings.url}/wp-json/wp/v2/tags`,
        { name },
        { headers: { 'Authorization': authHeader } }
      );
      tagIds.push(createRes.data.id);
    }
  }
  return tagIds;
}

// Define WordPress connection settings
interface WordPressSettings {
  url: string;
  username: string;
  password: string;
  isConnected: boolean;
}

// Define the available models, including the specific DeepSeek ones
const models = [
  { id: 'openrouter/auto', name: 'OpenRouter: Auto (best for prompt)' },
  { id: 'openai/gpt-4-turbo', name: 'OpenAI: GPT-4 Turbo' },
  { id: 'openai/gpt-3.5-turbo', name: 'OpenAI: GPT-3.5 Turbo' },
  { id: 'anthropic/claude-3-opus', name: 'Claude: Claude 3 Opus' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude: Claude 3 Sonnet' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude: Claude 3 Haiku' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek: DeepSeek V3' },
  { id: 'deepseek/deepseek-chat:free', name: 'DeepSeek: DeepSeek V3 (free)' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek: R1' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek: R1 (free)' },
  { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek: R1 Distill Llama 70B' },
  { id: 'deepseek/deepseek-r1-distill-llama-70b:free', name: 'DeepSeek: R1 Distill Llama 70B (free)' },
  { id: 'deepseek/deepseek-r1-distill-qwen-14b', name: 'DeepSeek: R1 Distill Qwen 14B' },
  { id: 'deepseek/deepseek-r1-distill-qwen-14b:free', name: 'DeepSeek: R1 Distill Qwen 14B (free)' },
  { id: 'deepseek/deepseek-r1-distill-qwen-1.5b', name: 'DeepSeek: R1 Distill Qwen 1.5B' },
  { id: 'deepseek/deepseek-r1-distill-qwen-32b', name: 'DeepSeek: R1 Distill Qwen 32B' },
  { id: 'deepseek/deepseek-r1-distill-qwen-32b:free', name: 'DeepSeek: R1 Distill Qwen 32B (free)' },
  { id: 'deepseek/deepseek-r1-zero:free', name: 'DeepSeek: DeepSeek R1 Zero (free)' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek: DeepSeek V3 0324 (free)' },
  { id: 'deepseek/deepseek-v3-base:free', name: 'DeepSeek: DeepSeek V3 Base (free)' },
  { id: 'meta-llama/llama-4-maverick', name: 'Meta: Llama 4 Maverick' },
{ id: 'meta-llama/llama-4-maverick:free', name: 'Meta: Llama 4 Maverick (free)' },
{ id: 'google/gemini-2.5-pro-preview-03-25', name: 'Google: Gemini 2.5 Pro Preview' },
{ id: 'google/gemini-pro-1.5', name: 'Google: Gemini 1.5 Pro' },
{ id: 'qwen/qwq-32b:free', name: 'Qwen: QwQ 32B (free)' },
{ id: 'qwen/qwq-32b', name: 'Qwen: QwQ 32B' },
{ id: 'qwen/qwen-vl-max', name: 'Qwen: Qwen VL Max' }
];

// Filter models for the second dropdown (must be DeepSeek)
const deepSeekModels = models.filter(model => model.id.startsWith('deepseek/'));

// Define available image generation services
const imageGenerationServices = [
  { id: 'stability', name: 'Stability AI' },
  { id: 'leonardo', name: 'Leonardo AI' }
];

function App() {
  // Store all API keys
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ 
    openRouter: '', 
    stabilityAi: '',
    leonardoAi: ''
  });
  
  // Handler for API key changes
  const handleApiKeyChange = (key: keyof ApiKeys, value: string) => {
    const updatedKeys = {
      ...apiKeys,
      [key]: value
    };
    setApiKeys(updatedKeys);
    
    // Save to localStorage
    localStorage.setItem('apiKeys', JSON.stringify(updatedKeys));
  };

  // State for image generation
  const [isGeneratingBlogImages, setIsGeneratingBlogImages] = useState<boolean>(false);
  const [blogImageError, setBlogImageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedImageService, setSelectedImageService] = useState<string>(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('preferredImageService');
    return saved || 'stability'; // Default to Stability AI
  });
  // State for storing image alt texts
  const [blogImageAltTexts, setBlogImageAltTexts] = useState<{[key: string]: string}>({});
  // State for storing external links from Flow 1
  const [externalLinks, setExternalLinks] = useState<string[]>([]);
  // State for two models
  const [selectedModel1, setSelectedModel1] = useState<string>(models[0].id); // Default to first model
  const [selectedModel2, setSelectedModel2] = useState<string>(deepSeekModels[0]?.id || ''); // Default to first DeepSeek model or empty if none
  const [recipeTitle, setRecipeTitle] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('medium'); // Default to medium
  const [articleToRewrite, setArticleToRewrite] = useState<string>(''); // For Hard rewrite
  const [focusKeyword, setFocusKeyword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false); // Loading state for main generation
  const [error, setError] = useState<string | null>(null);
  const [isSidebarContentVisible, setIsSidebarContentVisible] = useState<boolean>(false); // Controls sidebar section visibility
  const [generatedTitles, setGeneratedTitles] = useState<{ text: string; score: number }[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [generatedMetaDescriptions, setGeneratedMetaDescriptions] = useState<string[]>([]);
  const [selectedMetaDescription, setSelectedMetaDescription] = useState<string | null>(null);
  // Auto-select the first meta description when they are generated and none is selected yet
  useEffect(() => {
    if (generatedMetaDescriptions.length > 0 && !selectedMetaDescription) {
      setSelectedMetaDescription(generatedMetaDescriptions[0]);
    }
  }, [generatedMetaDescriptions, selectedMetaDescription]);
  const [extractedKeywords, setExtractedKeywords] = useState<string[]>([]);
  const [isGeneratingSidebarContent, setIsGeneratingSidebarContent] = useState<boolean>(false); // Loading state for sidebar tasks
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('seo'); // 'seo', 'image', 'settings', 'wordpress'
  
  // WebP conversion states
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionStep, setConversionStep] = useState<string>('');
  const [conversionProgress, setConversionProgress] = useState<number>(0);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [isWebP, setIsWebP] = useState<boolean>(false);
  
  // WordPress connection states
  const [wordpressSettings, setWordpressSettings] = useState<WordPressSettings>({
    url: '',
    username: '',
    password: '',
    isConnected: false
  });
  const [wpCategories, setWpCategories] = useState<{id: number, name: string, count: number}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [postStatus, setPostStatus] = useState<string>('draft'); // 'draft' or 'publish'
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [publishingResult, setPublishingResult] = useState<{success: boolean, message: string, link?: string} | null>(null);
  const [publishOptions, setPublishOptions] = useState({
    includeTitle: true,
    includeFocusKeyword: true,
    includeSlug: true,
    includeMetaDescription: true,
    includeFeaturedImage: true,
    includeTags: true
  });
  
  // Load settings from localStorage on initial render
  useEffect(() => {
    const savedKeysJson = localStorage.getItem('apiKeys');
    // Load model selections
    const savedModel1 = localStorage.getItem('selectedModel1');
    const savedModel2 = localStorage.getItem('selectedModel2');

    if (savedKeysJson) {
      try {
        const savedKeys = JSON.parse(savedKeysJson);
        // Ensure only openRouter key is loaded, even if old format exists
        setApiKeys({ 
          openRouter: savedKeys?.openRouter || '', 
          stabilityAi: savedKeys?.stabilityAi || '',
          leonardoAi: savedKeys?.leonardoAi || ''
        });
      } catch (e) {
        console.error("Failed to parse saved API keys:", e);
        setApiKeys({ 
          openRouter: '', 
          stabilityAi: '',
          leonardoAi: ''
        }); // Reset if parsing fails
      }
    }
    // Set loaded models, falling back to defaults if not found or invalid
    setSelectedModel1(savedModel1 || models[0].id);
    // Ensure loaded model 2 is actually a deepseek model, otherwise default
    if (savedModel2 && deepSeekModels.some(m => m.id === savedModel2)) {
        setSelectedModel2(savedModel2);
    } else {
        setSelectedModel2(deepSeekModels[0]?.id || ''); // Default to first deepseek or empty
    }
  }, []); // Empty dependency array means this runs only once on mount

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  // Save selected models to localStorage
  useEffect(() => {
    localStorage.setItem('selectedModel1', selectedModel1);
  }, [selectedModel1]);

  useEffect(() => {
    localStorage.setItem('selectedModel2', selectedModel2);
  }, [selectedModel2]);

  // Load WordPress settings from localStorage on initial render
  useEffect(() => {
    const savedWpSettings = localStorage.getItem('wordpressSettings');
    if (savedWpSettings) {
      try {
        const parsedSettings = JSON.parse(savedWpSettings);
        setWordpressSettings(parsedSettings);
      } catch (e) {
        console.error('Failed to parse saved WordPress settings:', e);
      }
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image.configure({
        inline: true,
        allowBase64: true
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Underline
    ],
    content: '<p>Your generated blog post will appear here...</p>',
    editable: false, // Start as non-editable
  });

  // --- Sidebar Content Generation Functions --- (Moved after editor initialization)
  // Now using Flow 1 output from the primary model for SEO data
  
  // Handle selecting a meta description
  const handleSelectMetaDescription = (desc: string) => {
    setSelectedMetaDescription(desc);
  };

  // Handle cleaning meta descriptions
  const handleCleanMetaDescriptions = (metaDescriptions: string[]) => {
    if (selectedMetaDescription) {
      return metaDescriptions.filter(d => d === selectedMetaDescription);
    }
    return metaDescriptions;
  };
  
  // Note: generateInitialMetaDescriptions and extractKeywords functions have been removed
  // as they are no longer needed. SEO data is now extracted from Flow 1 output. in the handleGenerate function

  const handleSelectTitle = (titleText: string) => {
    setSelectedTitle(titleText);
  };

  const handleCleanTitles = () => {
    if (selectedTitle) {
      setGeneratedTitles(prev => prev.filter(t => t.text === selectedTitle));
    } else {
      // Optional: Show a message asking the user to select a title first
      console.warn("No title selected to clean.");
    }
  };

  const generateInitialMetaDescriptions = useCallback(async () => {
    if (!editor || !apiKeys.openRouter || !selectedModel2) return; // Use selectedModel2
    setIsGeneratingSidebarContent(true);
    setError(null);

    const blogContent = editor.getText();
    if (!blogContent || blogContent.length < 50) {
        console.warn("Not enough content to generate meta descriptions.");
        setIsGeneratingSidebarContent(false);
        return;
    }
    const context = blogContent.substring(0, 1500); // Slightly less context might be needed
    const titleToUse = selectedTitle || generatedTitles[0]?.text || recipeTitle; // Use selected/first generated/original title

    const prompt = `Act as a professional food copywriter and SEO expert.\nYour job is to write a single SEO-optimized meta description of no more than 140 characters for a recipe blog post.\nFollow these strict rules:\nStart with the exact focus keyword (no delay)Focus Keyword: "${focusKeyword}",.\nMust sound 100% natural, human, emotional, and useful.\nInclude a subtle benefit, unique hook, or use-case (e.g., quick dinner, freezer-friendly, 1-pot, 5-min prep, etc.).\nUse a natural call to action if space allows (like "Make it tonight", "Try it now", "Save this one", "Get the recipe").\nAvoid generic fluff like "tasty" or "yummy" unless part of a real phrase that would be spoken by a food blogger.\nNo AI-sounding terms like "easy to make", "delicious recipe" unless rewritten into conversational tone.\nNever exceed 140 characters — short, scroll-stopping, and mobile-friendly. Output *only* the descriptions, each on a new line, with no extra text, numbering, or quotes\n\nBlog Post Context:\n---\n${context}\n---`;

    try {
        console.log("Generating initial meta descriptions using model:", selectedModel2); // Use selectedModel2
        const response = await callApiModel(prompt, selectedModel2, apiKeys); // Use selectedModel2
        const descriptions = response.split('\n').map(d => d.trim()).filter(d => d.length > 0 && d.length <= 160); // Filter by length
        const firstTwo = descriptions.slice(0, 2);
        setGeneratedMetaDescriptions(firstTwo);
        if (firstTwo.length > 0) {
          setSelectedMetaDescription(firstTwo[0]);
        }
        console.log("Generated meta descriptions:", descriptions);
    } catch (err: any) {
        console.error("Error generating meta descriptions:", err);
        setError(`Error generating meta descriptions: ${err.message || 'Unknown error'}`);
    } finally {
        setIsGeneratingSidebarContent(false);
    }
  }, [editor, apiKeys, selectedModel2, recipeTitle, focusKeyword, selectedTitle, generatedTitles]); // Updated dependencies

  const generateAdditionalMetaDescription = useCallback(async () => {
    if (!editor || !apiKeys.openRouter || !selectedModel2 || generatedMetaDescriptions.length >= 3) return; // Use selectedModel2
    setIsGeneratingSidebarContent(true);
    setError(null);

    const blogContent = editor.getText();
     if (!blogContent || blogContent.length < 50) {
        console.warn("Not enough content to generate additional meta description.");
        setIsGeneratingSidebarContent(false);
        return;
    }
    const context = blogContent.substring(0, 1500);
    const titleToUse = selectedTitle || generatedTitles[0]?.text || recipeTitle;
    const existingDescriptions = generatedMetaDescriptions.map(d => `- ${d}`).join('\n');

    const prompt = `Act as a professional food copywriter and SEO expert.\nYour job is to write a single SEO-optimized meta description of no more than 140 characters for a recipe blog post.\nFollow these strict rules:\nStart with the exact focus keyword (no delay)Focus Keyword: "${focusKeyword}",.\nMust sound 100% natural, human, emotional, and useful.\nInclude a subtle benefit, unique hook, or use-case (e.g., quick dinner, freezer-friendly, 1-pot, 5-min prep, etc.).\nUse a natural call to action if space allows (like "Make it tonight", "Try it now", "Save this one", "Get the recipe").\nAvoid generic fluff like "tasty" or "yummy" unless part of a real phrase that would be spoken by a food blogger.\nNo AI-sounding terms like "easy to make", "delicious recipe" unless rewritten into conversational tone.\nNever exceed 140 characters — short, scroll-stopping, and mobile-friendly. Output *only* the descriptions, each on a new line, with no extra text, numbering, or quotes\n\nExisting Meta Descriptions:\n${existingDescriptions}\n\nBlog Post Context:\n---\n${context}\n---`;

     try {
        console.log("Generating additional meta description using model:", selectedModel2); // Use selectedModel2
        const response = await callApiModel(prompt, selectedModel2, apiKeys); // Use selectedModel2
        const newDescription = response.trim();
        if (newDescription && newDescription.length <= 160 && !generatedMetaDescriptions.includes(newDescription)) {
            setGeneratedMetaDescriptions(prev => [...prev, newDescription]);
            console.log("Generated additional meta description:", newDescription);
        } else {
             console.warn("Generated meta description was empty, too long, or a duplicate.");
        }
    } catch (err: any) {
        console.error("Error generating additional meta description:", err);
        setError(`Error generating meta description: ${err.message || 'Unknown error'}`);
    } finally {
        setIsGeneratingSidebarContent(false);
    }
  }, [editor, apiKeys, selectedModel2, recipeTitle, focusKeyword, selectedTitle, generatedTitles, generatedMetaDescriptions]); // Updated dependencies

  // Function to extract keywords from the generated content
  const extractKeywords = useCallback(async () => {
    if (!editor || !apiKeys.openRouter || !selectedModel1) return;
    setIsGeneratingSidebarContent(true);
    setError(null);
    
    try {
      const content = editor.getText();
      if (!content || content.length < 50) {
        console.warn("Not enough content to extract keywords.");
        setIsGeneratingSidebarContent(false);
        return;
      }
      
      let keywords: string[] = [];
      let extractedKeywords: string[] = [];
      
      // Extract keywords from the content
      const keywordMatches = content.match(/Keywords:([^\n]+)/i);
      if (keywordMatches && keywordMatches[1]) {
        const keywordText = keywordMatches[1].trim();
        extractedKeywords = keywordText.split(',').map(k => k.trim());
        console.log('Extracted keywords from content:', extractedKeywords);
      } else {
        // Try other patterns
        const tableMatches = content.match(/\|\s*Keywords\s*\|([^\|]+)\|/i);
        if (tableMatches && tableMatches[1]) {
          extractedKeywords = tableMatches[1].trim().split(',').map(k => k.trim());
          console.log('Extracted keywords from table:', extractedKeywords);
        } else {
          // Try pattern 3: Look for sections with "Keywords:" followed by a list
          const sections = content.split('\n\n');
          for (const section of sections) {
            if (section.toLowerCase().includes('keywords:')) {
              const parts = section.split(':');
              if (parts.length > 1) {
                const rowKeywords = parts[1].trim().split(',').map(k => k.trim());
                extractedKeywords.push(...rowKeywords);
              }
            }
          }
          
          if (extractedKeywords.length > 0) {
            keywords = extractedKeywords.filter(k => 
              k.length > 0 && 
              k.toLowerCase() !== 'keywords' && 
              k.toLowerCase() !== 'cluster name'
            );
            console.log('Extracted keywords using pattern 3:', keywords);
          }
        }
      }
      
      // If we found keywords, save them
      if (keywords.length > 0) {
        setExtractedKeywords(keywords);
        console.log('Final extracted SEO keywords:', keywords);
      } else {
        // If we still don't have keywords, create default ones
        const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
        setExtractedKeywords(defaultKeywords);
        console.log('Using default keywords:', defaultKeywords);
      }
    } catch (err: any) {
      console.error('Error extracting keywords:', err);
      setError(`Error extracting keywords: ${err.message || 'Unknown error'}`);
      
      // Create default keywords if extraction fails
      const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
      setExtractedKeywords(defaultKeywords);
      console.log('Using default keywords due to error:', defaultKeywords);
    } finally {
      setIsGeneratingSidebarContent(false);
    }
  }, [editor, apiKeys, selectedModel1, recipeTitle, focusKeyword]); // Updated dependencies

  const handleCopyKeywords = () => {
    if (extractedKeywords.length > 0) {
      const keywordString = extractedKeywords.join(', ');
      navigator.clipboard.writeText(keywordString)
        .then(() => {
          // Optional: Show a temporary success message
          console.log('Keywords copied to clipboard!');
        })
        .catch(err => {
          console.error('Failed to copy keywords: ', err);
          setError('Failed to copy keywords to clipboard.');
        });
    }
  };
  
  const handleGenerate = async () => {
    if (!recipeTitle || !focusKeyword) {
      setError('Please provide both a Recipe Title and a Focus Keyword.');
      return;
    }
    // Validate model selections
    if (!selectedModel1) {
      setError('Please select a model for Step 1 (Outline).');
      return;
    }
    if (!selectedModel2) {
      if (difficulty === 'hard' && !articleToRewrite.trim()) {
        setError('Please paste the article you want to rewrite.');
        return;
      }
      setError('Please select a DeepSeek model for Step 2 (Writing).');
      return;
    }
    

    
     if (!apiKeys.openRouter) { // Check if OpenRouter key is present
      setError('Please enter your OpenRouter API Key in the Settings.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsSidebarContentVisible(false); // Hide sidebar content on new generation
    setGeneratedTitles([]); // Clear previous results
    setSelectedTitle(null);
    setGeneratedMetaDescriptions([]);
    setSelectedMetaDescription(null);
    setExtractedKeywords([]);
    editor?.setEditable(false); // Disable editing during generation
    editor?.commands.setContent('<p>Generating outline using ' + selectedModel1 + '...</p>');

    try {
      // --- Step 1: Generate Outline (Skipped for Medium and High difficulty) ---
      let outlineResponse = '';
      try {
        if (difficulty === 'medium') {
          editor?.commands.setContent('<p>Generating full blog post directly using ' + selectedModel2 + '...</p>');
        } else if (difficulty === 'high') {
          editor?.commands.setContent('<p>Generating full blog post directly using ' + selectedModel2 + '...</p>');
        }
        else if (difficulty === 'recipe') {
          editor?.commands.setContent('<p>Generating recipe article plan using ' + selectedModel1 + '...</p>');
        }
        else {
          const step1Prompt = STEP_1_PROMPT_TEMPLATE
            .replace(/\${USER_INPUT_RECIPE_TITLE}/g, recipeTitle)
            .replace(/\${USER_INPUT_FOCUS_KEYWORD}/g, focusKeyword)
            .replace(/\${FOCUS_KEYWORD}/g, focusKeyword); // Also replace in the prompt body

          console.log("Step 1 Prompt for:", selectedModel1, step1Prompt); // For debugging

          // API call implementation using Model 1
          outlineResponse = await callApiModel(step1Prompt, selectedModel1, apiKeys);
          console.log("Step 1 Response (Outline):", outlineResponse); // For debugging

          editor?.commands.setContent('<p>Generating full blog post using ' + selectedModel2 + '...</p>\n<pre><code>Outline:\n' + outlineResponse + '</code></pre>');
        }
      } catch (err: any) {
        console.error("Error in Step 1:", err);
        throw err; // Re-throw to be caught by the outer try-catch
      }

      // --- Step 2: Generate Full Blog Post ---
      let step2Prompt = '';
      let finalContent = ''; // To store the result before setting editor content

      try {
        // Update the editor to show we're starting Step 2
        editor?.commands.setContent('<p>Generating blog post... This may take a minute or two.</p>');
        
        // Prepare the appropriate prompt based on difficulty level
        if (difficulty === 'medium') {
            console.log("Using medium difficulty with STEP_2_PROMPT_TEMPLATE");
            step2Prompt = STEP_2_PROMPT_TEMPLATE
                .replace(/\${RECIPE_TITLE}/g, recipeTitle)
                .replace(/\${FOCUS_KEYWORD}/g, focusKeyword);
        } else if (difficulty === 'hard') {
            console.log("Using hard difficulty with RECIPE_REWRITE_PROMPT");
            let prompt: string;
            
            if (difficulty === 'Hard') {
              // Use chunked prompt for Hard difficulty to avoid token overload
              prompt = buildChunkedPrompt(articleToRewrite);
              console.log('Using chunked prompt for Hard difficulty');
            } else {
              // Use original prompt for Easy/Medium difficulty
              prompt = RECIPE_REWRITE_PROMPT.replace('{{ARTICLE_TO_REWRITE}}', articleToRewrite || '');
            }
            
            step2Prompt = prompt;

        } else if (difficulty === 'master') {
            console.log("Using master difficulty with STEP_4_MASTER_PROMPT_TEMPLATE");
            step2Prompt = STEP_4_MASTER_PROMPT_TEMPLATE
                .replace(/\${OUTLINE}/g, outlineResponse)
                .replace(/\${FOCUS_KEYWORD}/g, focusKeyword);
        } else if (difficulty === 'high') {
            // New DeepSeek two-step prompt logic for High
            if (!articleToRewrite.trim()) {
                setError('Please enter the recipe info.');
                return;
            }
            // Define prompts
            const FIRST_HALF_PROMPT = `You are a professional food blogger, storytelling recipe writer, and SEO strategist. Based ONLY on the raw recipe input provided, write the **first half** of a long-form, emotionally rich, SEO-optimized recipe blog post in clean HTML.

RAW INPUT RECIPE:
{{ARTICLE_TO_REWRITE}}

TASK:
- Carefully extract only the core recipe content.
- Ignore all unrelated or invalid data, including:
  - Author names, bios, star ratings
  - Buttons (print/save/share), forms, comments
  - Ads, scripts, sidebars, or layout HTML
- Focus on extracting and using only:
  - Recipe name/title
  - Prep time, cook time, total time, servings/yield, difficulty (if available)
  - Ingredients
  - Instructions
  - Notes (if present)

WRITE:
- A warm, vivid blog-style introduction like you're sharing the recipe with a close friend or family member
- A strong, keyword-optimized <h1> meta title using the **{{FOCUS_KEYWORD}}**
- A short personal anecdote, origin story, or "how I discovered this" moment
- Meta info block (prep time, cook time, total time, yield, difficulty)
- A simple <h2>Ingredients:</h2> section
  - Use a single <p> tag with line breaks (<br>) between items
  - Do NOT use <ul>/<li> lists
  - Use ingredients exactly as in the original, with no creative language
- Begin the instructions section in <h2>Instructions</h2>
  - Start rewriting in a friendly, sensory, human tone (describe smell, texture, common mistakes)
  - Use casual, helpful, vivid descriptions
  - STOP writing at approximately halfway through the instructions

✅ SEO RULES:
- Use the main focus keyword: **{{FOCUS_KEYWORD}}** in:
  - <h1> title
  - First 100 words
  - At least one subheading
- Internally link the focus keyword like:
  <a href=" internal-link " target="_blank"><strong>{{FOCUS_KEYWORD}}</strong></a>
- Optionally include 1–2 of these related keywords if natural: {{RELATED_KEYWORDS}}
  - Bold and externally link them like:
    <a href=" external-link " target="_blank"><strong>related keyword</strong></a>

⚠️ RULES:
- DO NOT invent or alter any ingredients or cooking steps
- DO NOT include buttons, ratings, markdown, or JSON
- DO NOT write the meta description
- DO NOT use any labels like "Part 1" or "Humanized"
- DO NOT continue beyond the halfway point of the instructions

OUTPUT FORMAT:
<!-- Use clean HTML: <h1>, <h2>, <h3>, <p>, <br>, etc.
     No markdown. No JSON. No step numbers. Stop halfway through instructions. -->
`;


const RECIPE_EXPANSION_PROMPT = `You are a professional food blogger and content writer. Continue writing the second half of a long-form, SEO-optimized, emotionally rich recipe blog post using the HTML provided from the first half.

FIRST HALF CONTENT:
{{FIRST_HALF_CONTENT}}

TASK:
- Begin exactly where the first half stopped
- Continue and finish the step-by-step instructions in the same friendly, vivid tone
- After instructions, include any of the following sections that were not already written:
  - <h2>Serving Suggestions</h2>
  - <h2>Flavor Boosts & Fixes</h2>
  - <h2>Storage & Reheating Tips</h2>
  - <h2>FAQs</h2>
  - <h2>Final Thoughts</h2> or <h2>Why I'll Keep Making This</h2>
- Conclude with a heartfelt reflection or tip (not a summary)
- Maintain consistent, sensory-rich, helpful tone

✅ SEO RULES:
- Reuse the focus keyword: **{{FOCUS_KEYWORD}}** at least once more in a heading or paragraph
- Internally link the focus keyword like:
  <a href=" internal-link " target="_blank"><strong>{{FOCUS_KEYWORD}}</strong></a>
- Optionally include 1–2 related keywords from {{RELATED_KEYWORDS}} if they naturally fit
  - Bold and externally link them like:
    <a href=" external-link " target="_blank"><strong>related keyword</strong></a>

✍️ TONE & STRUCTURE:
- Keep tone warm, sensory, and human — as if written for a home cook
- Add playful tips, common mistakes, family-style commentary
- Celebrate imperfections and kitchen personality

📏 LENGTH TARGET:
- Ensure the full article (Parts 1 and 2) reaches **4,500–5,500 words**

⚠️ RULES:
- DO NOT repeat intro, ingredient list, or steps from the first half
- DO NOT invent new instructions or ingredients
- DO NOT use markdown, JSON, or any "part" labels

OUTPUT FORMAT:
<!-- Continue in valid HTML only: <h2>, <h3>, <p>, <br>, etc.
     No markdown. No JSON. No step numbers or extra metadata. -->
`;



            // Step 1: Generate first half of blog post
            const firstHalfPrompt = FIRST_HALF_PROMPT
                .replace('{{ARTICLE_TO_REWRITE}}', articleToRewrite)
                .replace('{{RECIPE_TITLE}}', recipeTitle)
                .replace('{{FOCUS_KEYWORD}}', focusKeyword);
            const firstHalfContent = await callApiModel(firstHalfPrompt, selectedModel2, apiKeys);

            // --- Extract SEO data from first half content (same logic as recipe flow) ---
            try {
              let titles = [];
              // Try pattern 1: Look for SEO Suggestions section
              const titlePattern1 = firstHalfContent.match(/SEO Suggestions:[\s\S]*?Title Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
              if (titlePattern1 && titlePattern1[1]) {
                titles = titlePattern1[1].trim().split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
              }
              // If that fails, try pattern 2: Look for title suggestions anywhere
              if (titles.length === 0) {
                const titlePattern2 = firstHalfContent.match(/Title Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
                if (titlePattern2 && titlePattern2[1]) {
                  titles = titlePattern2[1].trim().split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
                }
              }
              if (titles.length > 0) {
                setGeneratedTitles(titles.slice(0, 2).map(text => ({ text, score: Math.floor(Math.random() * 31) + 70 })));
              } else {
                const defaultTitles = [
                  `${recipeTitle}: The Ultimate ${focusKeyword} Recipe`,
                  `How to Make Perfect ${recipeTitle} | ${focusKeyword} Guide`
                ];
                setGeneratedTitles(defaultTitles.map(text => ({ text, score: 85 })));
              }

              // Meta descriptions
              let descriptions = [];
              const descPattern1 = firstHalfContent.match(/Meta Description Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
              if (descPattern1 && descPattern1[1]) {
                descriptions = descPattern1[1].trim().split(/\r?\n/).map(d => d.trim()).filter(d => d.length > 0);
              }
              if (descriptions.length === 0) {
                const descPattern2 = firstHalfContent.match(/Meta Description:[\s\S]*?((?:^.+$\n?){1,2})/im);
                if (descPattern2 && descPattern2[1]) {
                  const metaDesc = descPattern2[1].trim();
                  descriptions = [metaDesc, `Discover the best ${focusKeyword} recipe with our step-by-step guide to making ${recipeTitle}. Perfect for any occasion!`];
                }
              }
              if (descriptions.length > 0) {
                setGeneratedMetaDescriptions(descriptions.slice(0, 2));
              } else {
                const defaultDescriptions = [
                  `Learn how to make delicious ${recipeTitle} with our easy-to-follow recipe. Perfect for ${focusKeyword} lovers!`,
                  `Discover the secrets to making the best ${recipeTitle}. This ${focusKeyword} recipe is sure to impress family and friends!`
                ];
                setGeneratedMetaDescriptions(defaultDescriptions);
              }

              // Keywords
              let keywords = [];
              const keywordPattern1 = firstHalfContent.match(/SEO Keywords:[\s\S]*?((?:[^,\n]+(?:,\s*|$)){5,15})/im);
              if (keywordPattern1 && keywordPattern1[1]) {
                keywords = keywordPattern1[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
              }
              if (keywords.length === 0) {
                const keywordPattern2 = firstHalfContent.match(/Primary[\s\S]*?\|[\s\S]*?((?:[^|\n]+(?:\|\s*|$)){1,10})/im);
                if (keywordPattern2 && keywordPattern2[1]) {
                  keywords = keywordPattern2[1].split('|').map(k => k.trim()).filter(k => k.length > 0 && !k.includes('---'));
                }
              }
              if (keywords.length === 0) {
                // Table heuristic
                const tableLines = firstHalfContent.split(/\r?\n/).filter(line => 
                  line.includes('|') && !line.includes('---') && line.trim().length > 0
                );
                if (tableLines.length > 1) {
                  const keywordRows = tableLines.slice(1); 
                  const extractedKeywords = [];
                  for (const row of keywordRows) {
                    const parts = row.split('|');
                    if (parts.length >= 2) {
                      const rowKeywords = parts[1].trim().split(',').map(k => k.trim());
                      extractedKeywords.push(...rowKeywords);
                    }
                  }
                  if (extractedKeywords.length > 0) {
                    keywords = extractedKeywords.filter(k => 
                      k.length > 0 && 
                      k.toLowerCase() !== 'keywords' && 
                      k.toLowerCase() !== 'cluster name'
                    );
                  }
                }
              }
              if (keywords.length > 0) {
                setExtractedKeywords(keywords);
              } else {
                const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
                setExtractedKeywords(defaultKeywords);
              }
              setIsSidebarContentVisible(true);
            } catch (seoError) {
              // Fallback if any extraction fails
              const defaultTitles = [
                `${recipeTitle}: The Ultimate ${focusKeyword} Recipe`,
                `How to Make Perfect ${recipeTitle} | ${focusKeyword} Guide`
              ];
              setGeneratedTitles(defaultTitles.map(text => ({ text, score: 85 })));
              const defaultDescriptions = [
                `Learn how to make delicious ${recipeTitle} with our easy-to-follow recipe. Perfect for ${focusKeyword} lovers!`,
                `Discover the secrets to making the best ${recipeTitle}. This ${focusKeyword} recipe is sure to impress family and friends!`
              ];
              setGeneratedMetaDescriptions(defaultDescriptions);
              const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
              setExtractedKeywords(defaultKeywords);
              setIsSidebarContentVisible(true);
            }

            // Step 2: Expansion
            const expansionPrompt = RECIPE_EXPANSION_PROMPT
                .replace('{{FIRST_HALF_CONTENT}}', firstHalfContent);
            const secondHalf = await callApiModel(expansionPrompt, selectedModel2, apiKeys);
            // Combine and display
            finalContent = combineContent(firstHalfContent, secondHalf);
            editor?.commands.setContent(finalContent);
            editor?.setEditable(true); // Re-enable editing after generation
            return;
        } else if (difficulty === 'recipe') {
            console.log("Using Recipe Article flow with RECIPE_ARTICLE_FLOW2_PROMPT_TEMPLATE");
            
            // First, generate the Flow 1 output using the Recipe Article prompt
            const flow1Prompt = RECIPE_ARTICLE_PROMPT_TEMPLATE
                .replace(/\${USER_INPUT_RECIPE_TITLE}/g, recipeTitle)
                .replace(/\${USER_INPUT_FOCUS_KEYWORD}/g, focusKeyword);
            
            console.log("Recipe Article Flow 1 Prompt for:", selectedModel1, "(length: " + flow1Prompt.length + " characters)");
            
            // Update the editor to show we're generating Flow 1
            editor?.commands.setContent('<p>Generating recipe article plan using ' + selectedModel1 + '...</p>');
            
            // Make the API call for Flow 1
            const flow1Output = await callApiModel(flow1Prompt, selectedModel1, apiKeys);
            console.log("Recipe Article Flow 1 Response length:", flow1Output?.length || 0);
            
            // Extract SEO data from Flow 1 output and save it for later use
            try {
              console.log('Extracting SEO data from Flow 1 output');
              
              // Log the first 1000 characters of the output for debugging
              console.log('Flow 1 output preview:', flow1Output.substring(0, 1000));
              
              // More robust title extraction - try multiple patterns
              let titles = [];
              
              // Try pattern 1: Look for SEO Suggestions section
              const titlePattern1 = flow1Output.match(/SEO Suggestions:[\s\S]*?Title Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
              if (titlePattern1 && titlePattern1[1]) {
                titles = titlePattern1[1].trim().split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
                console.log('Extracted titles using pattern 1:', titles);
              }
              
              // If that fails, try pattern 2: Look for title suggestions anywhere
              if (titles.length === 0) {
                const titlePattern2 = flow1Output.match(/Title Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
                if (titlePattern2 && titlePattern2[1]) {
                  titles = titlePattern2[1].trim().split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
                  console.log('Extracted titles using pattern 2:', titles);
                }
              }
              
              // If we found titles, save them
              if (titles.length > 0) {
                // Assign a score for each title (placeholder scores for now)
                setGeneratedTitles(titles.slice(0, 2).map(text => ({ text, score: Math.floor(Math.random() * 31) + 70 })));
                console.log('Final extracted title suggestions:', titles);
              } else {
                // If we still don't have titles, create default ones
                const defaultTitles = [
                  `${recipeTitle}: The Ultimate ${focusKeyword} Recipe`,
                  `How to Make Perfect ${recipeTitle} | ${focusKeyword} Guide`
                ];
                setGeneratedTitles(defaultTitles.map(text => ({ text, score: 85 })));
                console.log('Using default titles:', defaultTitles);
              }
              
              // More robust meta description extraction - try multiple patterns
              let descriptions = [];
              
              // Try pattern 1: Look for Meta Description Suggestions section
              const descPattern1 = flow1Output.match(/Meta Description Suggestions:[\s\S]*?((?:^.+$\n?){2,3})/im);
              if (descPattern1 && descPattern1[1]) {
                descriptions = descPattern1[1].trim().split(/\r?\n/).map(d => d.trim()).filter(d => d.length > 0);
                console.log('Extracted descriptions using pattern 1:', descriptions);
              }
              
              // If that fails, try pattern 2: Look for meta description anywhere
              if (descriptions.length === 0) {
                // Look for the original meta description
                const descPattern2 = flow1Output.match(/Meta Description:[\s\S]*?((?:^.+$\n?){1,2})/im);
                if (descPattern2 && descPattern2[1]) {
                  const metaDesc = descPattern2[1].trim();
                  descriptions = [metaDesc, `Discover the best ${focusKeyword} recipe with our step-by-step guide to making ${recipeTitle}. Perfect for any occasion!`];
                  console.log('Extracted descriptions using pattern 2:', descriptions);
                }
              }
              
              // If we found descriptions, save them
              if (descriptions.length > 0) {
                setGeneratedMetaDescriptions(descriptions.slice(0, 2));
                console.log('Final extracted meta descriptions:', descriptions);
              } else {
                // If we still don't have descriptions, create default ones
                const defaultDescriptions = [
                  `Learn how to make delicious ${recipeTitle} with our easy-to-follow recipe. Perfect for ${focusKeyword} lovers!`,
                  `Discover the secrets to making the best ${recipeTitle}. This ${focusKeyword} recipe is sure to impress family and friends!`
                ];
                setGeneratedMetaDescriptions(defaultDescriptions);
                console.log('Using default descriptions:', defaultDescriptions);
              }
              
              // More robust keyword extraction - try multiple patterns
              let keywords = [];
              
              // Try pattern 1: Look for SEO Keywords section
              const keywordPattern1 = flow1Output.match(/SEO Keywords:[\s\S]*?((?:[^,\n]+(?:,\s*|$)){5,15})/im);
              if (keywordPattern1 && keywordPattern1[1]) {
                keywords = keywordPattern1[1].split(',').map(k => k.trim()).filter(k => k.length > 0);
                console.log('Extracted keywords using pattern 1:', keywords);
              }
              
              // If that fails, try pattern 2: Look for keyword clusters
              if (keywords.length === 0) {
                const keywordPattern2 = flow1Output.match(/Primary[\s\S]*?\|[\s\S]*?((?:[^|\n]+(?:\|\s*|$)){1,10})/im);
                if (keywordPattern2 && keywordPattern2[1]) {
                  keywords = keywordPattern2[1].split('|').map(k => k.trim()).filter(k => k.length > 0 && !k.includes('---'));
                  console.log('Extracted keywords using pattern 2:', keywords);
                }
              }
              
              // If that fails, try pattern 3: Look for keywords in the keyword table
              if (keywords.length === 0) {
                // Find all lines that look like they might be from the keyword table
                const tableLines = flow1Output.split(/\r?\n/).filter(line => 
                  line.includes('|') && !line.includes('---') && line.trim().length > 0
                );
                
                // Skip the header row and extract actual keywords
                if (tableLines.length > 1) {
                  // Skip first row which is likely the header
                  const keywordRows = tableLines.slice(1); 
                  
                  // Extract keywords from each row
                  const extractedKeywords = [];
                  for (const row of keywordRows) {
                    // Split by | and take the second part (the keywords)
                    const parts = row.split('|');
                    if (parts.length >= 2) {
                      // Get keywords from the second column
                      const rowKeywords = parts[1].trim().split(',').map(k => k.trim());
                      extractedKeywords.push(...rowKeywords);
                    }
                  }
                  
                  if (extractedKeywords.length > 0) {
                    keywords = extractedKeywords.filter(k => 
                      k.length > 0 && 
                      k.toLowerCase() !== 'keywords' && 
                      k.toLowerCase() !== 'cluster name'
                    );
                    console.log('Extracted keywords using pattern 3:', keywords);
                  }
                }
              }
              
              // If we found keywords, save them
              if (keywords.length > 0) {
                setExtractedKeywords(keywords);
                console.log('Final extracted SEO keywords:', keywords);
              } else {
                // If we still don't have keywords, create default ones
                const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
                setExtractedKeywords(defaultKeywords);
                console.log('Using default keywords:', defaultKeywords);
              }
              
              // Make SEO sidebar visible
              setIsSidebarContentVisible(true);
            } catch (seoError) {
              console.error('Error extracting SEO data from Flow 1:', seoError);
              // Create default SEO data if extraction fails
              const defaultTitles = [
                `${recipeTitle}: The Ultimate ${focusKeyword} Recipe`,
                `How to Make Perfect ${recipeTitle} | ${focusKeyword} Guide`
              ];
              setGeneratedTitles(defaultTitles.map(text => ({ text, score: 85 })));
              
              const defaultDescriptions = [
                `Learn how to make delicious ${recipeTitle} with our easy-to-follow recipe. Perfect for ${focusKeyword} lovers!`,
                `Discover the secrets to making the best ${recipeTitle}. This ${focusKeyword} recipe is sure to impress family and friends!`
              ];
              setGeneratedMetaDescriptions(defaultDescriptions);
              
              const defaultKeywords = [focusKeyword, recipeTitle, `${recipeTitle} recipe`, `how to make ${recipeTitle}`, `best ${focusKeyword} recipe`];
              setExtractedKeywords(defaultKeywords);
              
              setIsSidebarContentVisible(true);
              console.log('Using default SEO data due to extraction error');
            }
            
            // Update the editor to show we're moving to Flow 2
            editor?.commands.setContent('<p>Generating full recipe article using ' + selectedModel2 + '...</p>\n<pre><code>Plan:\n' + flow1Output + '</code></pre>');
            
            // Now prepare the Flow 2 prompt with the Flow 1 output
            step2Prompt = RECIPE_ARTICLE_FLOW2_PROMPT_TEMPLATE
                .replace(/\${FLOW_1_OUTPUT}/g, flow1Output);
                
            // Extract external links from Flow 1 output - handle multiple possible formats
            let extractedLinks: string[] = [];
            
            // Try different patterns to extract links
            // Pattern 1: External Link 1: [https://example.com]
            const pattern1 = flow1Output.match(/External Link \d+: \[(https?:\/\/[^\]]+)\]/g);
            if (pattern1) {
                const links = pattern1.map(link => {
                    const urlMatch = link.match(/\[(https?:\/\/[^\]]+)\]/);
                    return urlMatch ? urlMatch[1] : '';
                }).filter(url => url !== '');
                extractedLinks = [...extractedLinks, ...links];
            }
            
            // Pattern 2: External Link 1: https://example.com
            const pattern2 = flow1Output.match(/External Link \d+:\s+(https?:\/\/[^\s\n]+)/g);
            if (pattern2) {
                const links = pattern2.map(link => {
                    const urlMatch = link.match(/:\s+(https?:\/\/[^\s\n]+)/);
                    return urlMatch ? urlMatch[1] : '';
                }).filter(url => url !== '');
                extractedLinks = [...extractedLinks, ...links];
            }
            
            // Pattern 3: Find any URLs in the text
            const pattern3 = flow1Output.match(/(https?:\/\/[^\s\n"'<>]+)/g);
            if (pattern3 && extractedLinks.length === 0) {
                extractedLinks = pattern3.filter(url => {
                    // Filter out common API URLs that might be in the text
                    return !url.includes('openrouter.ai') && 
                           !url.includes('openai.com') && 
                           !url.includes('api.stability.ai');
                }).slice(0, 2); // Take at most 2 links
            }
            
            // If we still don't have links, add some default cooking reference sites
            if (extractedLinks.length === 0) {
                extractedLinks = [
                    'https://www.seriouseats.com/cooking-techniques',
                    'https://www.foodnetwork.com/recipes'
                ];
                console.log('No links found in Flow 1 output, using default cooking reference sites');
            }
            
            // Store the external links in state for later use
            setExternalLinks(extractedLinks);
            console.log('Extracted external links:', extractedLinks);
        } else {
            // Handle unexpected difficulty value if necessary
            console.error("Unknown difficulty selected:", difficulty);
            throw new Error(`Unknown difficulty level: ${difficulty}`);
        }
        
        // Log the prompt length to help diagnose timeout issues
        console.log(`Step 2 Prompt length: ${step2Prompt.length} characters`);
        
        // If the prompt is very long, show a warning in the editor
        if (step2Prompt.length > 10000) {
          editor?.commands.setContent('<p>Generating a very long blog post. This may take several minutes...</p>');
        }
        
        // Make the API call to generate the content
        finalContent = await callApiModel(step2Prompt, selectedModel2, apiKeys);
        
        // Add a comment indicating the difficulty level used
        finalContent += `\n<!-- ${difficulty} difficulty -->`;
      } catch (err: any) {
        console.error("Error in Step 2:", err);
        throw err; // Re-throw to be caught by the outer try-catch
      }

      console.log(`Step 2 Prompt for ${difficulty} difficulty (Model: ${selectedModel2}):`, step2Prompt); // For debugging
      console.log("Step 2 Response (Full Blog) length:", finalContent?.length || 0); // Log length instead of full content
      
      // Check if we actually got content back
      if (!finalContent || finalContent.trim().length === 0) {
        throw new Error('Received empty content from the API. Please try again.');
      }
      
      editor?.commands.setContent(finalContent); // Set final HTML content

      editor?.setEditable(true); // Re-enable editing
      setIsSidebarContentVisible(true); // Show sidebar content after successful generation
      
      // Show success message
      setError('Blog post generated successfully! You can now generate images.');

      // SEO data is now automatically extracted from Flow 1 output
      // No need to trigger separate sidebar content generation

    } catch (err: any) {
      console.error("Generation Error:", err);
      setIsSidebarContentVisible(false); // Ensure sidebar is hidden on error
      const errorMessage = err.message || 'Unknown error';
      setError(`Error during generation: ${errorMessage}`);
      editor?.commands.setContent(`<p>Error: ${errorMessage}</p><p>Please try again or select a different difficulty level.</p>`);
      editor?.setEditable(true); // Re-enable editing even on error
    } finally {
      setIsLoading(false); // Always ensure loading state is reset
      
      // Auto-trigger the Generate Recipe Image button after a short delay
      setTimeout(() => {
        generateImage().catch(error => {
          console.error('Error auto-generating recipe image:', error);
        });
      }, 7);
    }
  };

  // Function for making the actual API call - Now always uses OpenRouter
  const callApiModel = async (prompt: string, modelId: string, keys: ApiKeys): Promise<string> => {
    // Safety check for empty prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Empty prompt provided to API call');
    }
    const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    const apiKey = keys.openRouter; // Use the stored OpenRouter key
    
    // Check if we're using a DeepSeek model (which is used for Step 2 - generating the full blog post)
    const isDeepSeekModel = modelId.startsWith('deepseek/');
    
    // For DeepSeek models, we'll use a longer timeout and streaming for better reliability
    const timeout = isDeepSeekModel ? 300000 : 120000; // 5 minutes for DeepSeek, 2 minutes for others
    
    const requestBody = {
        model: modelId, // Pass the selected model ID to OpenRouter
        messages: [{ role: 'user', content: prompt }],
        // For DeepSeek models, we'll set a higher max_tokens to ensure we get a complete response
        ...(isDeepSeekModel ? { max_tokens: 2000 } : {}),
        // Optional: Add site/header info as recommended by OpenRouter
        // route: "fallback", // Example routing
        // headers: {
        //   "HTTP-Referer": "YOUR_SITE_URL", // Replace with your site URL
        //   "X-Title": "YOUR_SITE_NAME", // Replace with your site name
        // }
    };

    if (!apiKey) {
        // This check is now also done in handleGenerate, but kept here as a safeguard
        throw new Error(`OpenRouter API key is missing.`);
    }

    console.log(`Calling OpenRouter API: ${apiUrl} with model ${modelId}`); // Debugging
    // --- Actual API Call (Example using Axios) ---
    try {
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            // Optional: Add site/header info as recommended by OpenRouter
            // "HTTP-Referer": "YOUR_SITE_URL", // Replace with your site URL
            // "X-Title": "YOUR_SITE_NAME", // Replace with your site name
        };

        console.log(`Making API request to ${apiUrl} with model ${modelId} (timeout: ${timeout}ms)`);
        const response = await axios.post(apiUrl, requestBody, { 
          headers,
          timeout // Use the appropriate timeout based on the model
        });

        // Extract the text content - OpenRouter uses OpenAI's format
        console.log('API response received:', response.status);
        const content = response.data?.choices?.[0]?.message?.content || '';

        if (!content) {
            console.warn("API response structure might be unexpected:", response.data);
            throw new Error("Received empty content from API.");
        }
        return content.trim();

    } catch (apiError: any) {
        console.error("API Call Failed:", apiError.response?.data || apiError.message);
        const errorDetails = apiError.response?.data?.error?.message || apiError.message || 'API request failed';
        
        // Provide more helpful error messages for timeouts
        if (errorDetails.includes('timeout')) {
          throw new Error(`API timeout: The request took too long to complete. Try a shorter prompt or a different model.`);
        }
        
        throw new Error(`API Error: ${errorDetails}`);
    }
  };

  // Auto-trigger WebP compression after image is generated
  useEffect(() => {
    if (
      generatedImageUrl &&
      !isGeneratingImage &&
      !isConverting &&
      !isWebP &&
      !isImageWebP(generatedImageUrl)
    ) {
      console.log('Auto-triggering WebP compression...');
      
      // Small delay to ensure UI is ready
      const timer = setTimeout(() => {
        if (!isConverting) {  // Double-check we're not already converting
          convertToWebP().catch(error => {
            console.error('Error during auto-conversion to WebP:', error);
          });
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [generatedImageUrl, isGeneratingImage, isConverting, isWebP]);

  // Function to generate an image based on the recipe title
  const generateImage = async () => {
    if (!recipeTitle) {
      setImageGenerationError('Please enter a recipe title first');
      return;
    }
    
    // Check if we have the required API key
    if (selectedImageService === 'stability' && !apiKeys.stabilityAi) {
      setImageGenerationError('Stability AI API key is required. Please add it in the Settings tab.');
      return;
    }
    
    if (selectedImageService === 'leonardo' && !apiKeys.leonardoAi) {
      setImageGenerationError('Leonardo AI API key is required. Please add it in the Settings tab.');
      return;
    }
    
    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setGeneratedImageUrl(null);
    setOriginalImageUrl(null); // Reset original image URL when generating a new image
    
    try {
      // Use the recipe title directly for the prompt
      const prompt = `Create a realistic image of the dish: ${recipeTitle}. High quality food photography style, appetizing presentation, professional lighting.`;
      
      // Use the prompt to generate an image with the selected service
      const imageUrl = await generateAIImage(
        prompt,
        { 
          service: selectedImageService as 'stability' | 'leonardo',
          size: "1024x1024" 
        }
      );
      
      if (imageUrl) {
        setGeneratedImageUrl(imageUrl);
        setOriginalImageUrl(imageUrl); // Store the original image URL
        setIsWebP(false); // Reset WebP flag for new image
      } else {
        throw new Error('Failed to generate image: No URL returned');
      }
    } catch (error) {
      console.error('Image generation error:', error);
      setImageGenerationError(error instanceof Error ? error.message : 'Failed to generate image');
      
      // Restore original image if conversion fails
      if (originalImageUrl) {
        setGeneratedImageUrl(originalImageUrl);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Function to convert image to WebP format
  const convertToWebP = async () => {
    if (!generatedImageUrl) {
      setImageGenerationError('No image available to convert');
      return;
    }
    
    // Check if image is already in WebP format
    if (isImageWebP(generatedImageUrl)) {
      console.log('Image already WebP; skipping conversion');
      setIsWebP(true);
      return;
    }
    
    setIsConverting(true);
    setImageGenerationError(null);
    
    try {
      // Store original image URL if not already stored
      if (!originalImageUrl) {
        setOriginalImageUrl(generatedImageUrl);
      }
      
      let webpImage: string;
      
      try {
        // First try the server-side approach
        console.log('Attempting server-side conversion...');
        const response = await axios.post('http://localhost:3001/convert-base64', {
          imageData: generatedImageUrl
        }, {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        });
        
        if (response.data?.success && response.data.webpImage) {
          console.log('Server-side conversion successful');
          webpImage = response.data.webpImage;
        } else {
          throw new Error('Invalid response from conversion server');
        }
      } catch (serverError) {
        // If server approach fails, fall back to browser-based conversion
        console.log('Server-side conversion failed, falling back to browser-based conversion', serverError);
        
        // Import the browser-based converter
        const browserConverter = await import('./browser-webp-converter');
        webpImage = await browserConverter.processImage(generatedImageUrl);
        console.log('Browser-based conversion successful');
      }
      
      // Update the image URL with the converted WebP image
      setGeneratedImageUrl(webpImage);
      setIsWebP(true);
      
    } catch (error) {
      console.error('Error in convertToWebP:', error);
      
      // Show a more detailed error message
      let errorMessage = 'Failed to convert image to WebP';
      if (error instanceof Error) {
        errorMessage = `${errorMessage}: ${error.message}`;
      } else if (axios.isAxiosError(error) && error.response) {
        errorMessage = `${errorMessage}: ${error.response.data?.error || error.message}`;
      }
      setImageGenerationError(errorMessage);
      setIsWebP(false);
      
      // Restore original image if conversion fails
      if (originalImageUrl) {
        setGeneratedImageUrl(originalImageUrl);
      }
    } finally {
      setIsConverting(false);
    }
  };

  // Function to check if an image is already in WebP format
  const isImageWebP = (imageUrl: string): boolean => {
    return imageUrl.startsWith('data:image/webp') || 
           imageUrl.includes('webp') ||
           (imageUrl.includes('data:image/') && !imageUrl.includes('data:image/jpg') && !imageUrl.includes('data:image/jpeg') && !imageUrl.includes('data:image/png'));
  };

  // Function to handle WordPress settings changes
  const handleWpSettingsChange = (field: keyof WordPressSettings, value: string | boolean) => {
    setWordpressSettings(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Save to localStorage
      localStorage.setItem('wordpressSettings', JSON.stringify(updated));
      return updated;
    });
  };

  // Function to connect to WordPress and fetch categories
  const connectToWordPress = async () => {
    if (!wordpressSettings.url || !wordpressSettings.username || !wordpressSettings.password) {
      setConnectionError('Please fill in all WordPress connection details');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      // Test connection by fetching categories using Basic Auth header instead of auth object
      const authHeader = 'Basic ' + btoa(`${wordpressSettings.username}:${wordpressSettings.password}`);
      
      const response = await axios.get(`${wordpressSettings.url}/wp-json/wp/v2/categories?per_page=100`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && Array.isArray(response.data)) {
        // Filter out empty categories and sort alphabetically
        const categories = response.data
          .filter((cat: any) => cat.name !== 'Uncategorized')
          .map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            count: cat.count
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        
        console.log('Fetched WordPress categories:', categories);
        
        setWpCategories(categories);
        handleWpSettingsChange('isConnected', true);
        setConnectionError(null);
        
        // Select first category by default if available
        if (categories.length > 0 && !selectedCategory) {
          setSelectedCategory(categories[0].id);
        }
        
        // Now verify user permissions by checking if they can create posts
        try {
          const userResponse = await axios.get(`${wordpressSettings.url}/wp-json/wp/v2/users/me?context=edit`, {
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.data && userResponse.data.capabilities) {
            const canCreatePosts = userResponse.data.capabilities.publish_posts || 
                                  userResponse.data.capabilities.edit_posts;
            
            if (!canCreatePosts) {
              setConnectionError('Warning: Your WordPress user does not have permission to create posts. Please use an account with Author, Editor, or Administrator role.');
            }
          }
        } catch (userError) {
          console.warn('Could not verify user permissions:', userError);
          // Continue anyway since we already connected successfully
        }
      } else {
        throw new Error('Invalid response from WordPress API');
      }
    } catch (error) {
      console.error('WordPress connection error:', error);
      let errorMessage = 'Failed to connect to WordPress';
      
      interface ErrorWithResponse {
        response?: {
          status?: number;
        };
      }
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as ErrorWithResponse;
        if (axiosError.response?.status === 401) {
          errorMessage = 'Authentication failed. Please check your username and application password.';
        } else if (axiosError.response?.status === 403) {
          errorMessage = 'Access forbidden. Your user account does not have sufficient permissions.';
        } else if (axiosError.response?.status === 404) {
          errorMessage = 'WordPress REST API not found. Make sure your site URL is correct and the REST API is enabled.';
        }
      }
      
      setConnectionError(errorMessage);
      handleWpSettingsChange('isConnected', false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to publish to WordPress
  const publishToWordPress = async () => {
    if (!wordpressSettings.isConnected) {
      setConnectionError('Please connect to WordPress first');
      return;
    }

    if (!editor) {
      setConnectionError('No content to publish');
      return;
    }

    setIsPublishing(true);
    setPublishingResult(null);
    setConnectionError(null);

    try {
      // Create authentication header
      const authHeader = 'Basic ' + btoa(`${wordpressSettings.username}:${wordpressSettings.password}`);
      
      // Extract title from content (h1)
      const htmlContent = editor.getHTML();
      const titleMatch = htmlContent.match(/<h1>(.*?)<\/h1>/);
      const title = titleMatch ? titleMatch[1] : recipeTitle;

      // Extract content (everything after h1)
      let content = htmlContent;
      if (titleMatch) {
        const titleIndex = htmlContent.indexOf(titleMatch[0]);
        const titleEndIndex = titleIndex + titleMatch[0].length;
        content = htmlContent.substring(titleEndIndex);
      }

      // Create slug from focus keyword
      const slug = focusKeyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Format tags properly for WordPress API
      const formattedTags = extractedKeywords.map(keyword => keyword.trim()).filter(keyword => keyword.length > 0);

      // Extract all image URLs from the content
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      let match;
      const imageUrls = [];
      let modifiedContent = content;
      
      // Find all image URLs in the content
      while ((match = imgRegex.exec(content)) !== null) {
        imageUrls.push(match[1]);
      }
      
      // Upload all content images to WordPress
      if (imageUrls.length > 0) {
        console.log(`Found ${imageUrls.length} images in content to upload`);
        
        for (let i = 0; i < imageUrls.length; i++) {
          const imageUrl = imageUrls[i];
          try {
            // Skip if not a valid URL or data URL
            if (!imageUrl.startsWith('http') && !imageUrl.startsWith('data:')) {
              continue;
            }
            
            console.log(`Uploading content image ${i+1}/${imageUrls.length}...`);
            
            // Convert URL or data URL to blob for upload
            const imageBlob = await fetch(imageUrl).then(r => r.blob());
            
            // Create form data for image upload
            const formData = new FormData();
            formData.append('file', imageBlob, `${slug || 'recipe'}-content-image-${i+1}.png`);
            
            // Upload image
            const imageUploadResponse = await axios.post(
              `${wordpressSettings.url}/wp-json/wp/v2/media`,
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                  'Authorization': authHeader
                }
              }
            );
            
            if (imageUploadResponse.data && imageUploadResponse.data.id && imageUploadResponse.data.source_url) {
              console.log('Image uploaded successfully with ID:', imageUploadResponse.data.id);
              console.log('Image URL:', imageUploadResponse.data.source_url);
              
              // Replace the data URL in the content with the WordPress URL
              modifiedContent = modifiedContent.replace(imageUrl, imageUploadResponse.data.source_url);
            }
          } catch (imageError) {
            console.error('Failed to upload image:', imageError);
            // Continue with post creation even if image upload fails
          }
        }
      }

      // Prepare post data based on selected options
      const postData: any = {
        content: modifiedContent, // Use the modified content with WordPress image URLs
        status: postStatus,
      };

      // Add optional fields based on user selection
      if (publishOptions.includeTitle) {
        postData.title = title;
      }

      if (publishOptions.includeSlug && focusKeyword) {
        postData.slug = slug;
      }

      if (publishOptions.includeMetaDescription && selectedMetaDescription) {
        postData.excerpt = selectedMetaDescription;
      }

      if (!postData.meta) postData.meta = {};
      if (publishOptions.includeFocusKeyword && focusKeyword) {
        postData.meta._yoast_wpseo_focuskw = focusKeyword;
      }
      if (publishOptions.includeMetaDescription && selectedMetaDescription) {
        postData.meta._yoast_wpseo_metadesc = selectedMetaDescription;
      }

      if (selectedCategory) {
        postData.categories = [selectedCategory];
      }

      if (publishOptions.includeTags && formattedTags.length > 0) {
        postData.tags = await getTagIds(formattedTags, wordpressSettings, authHeader);
      }
      
      // If we have a generated image and user wants to include it
      if (generatedImageUrl && publishOptions.includeFeaturedImage) {
        try {
          console.log('Uploading featured image...');
          
          // Convert data URL to blob for upload
          const imageBlob = await fetch(generatedImageUrl).then(r => r.blob());
            
          // Create form data for image upload
          const formData = new FormData();
          
          // Generate a clean filename from the post title
          const cleanTitle = recipeTitle 
            ? recipeTitle.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
            : 'recipe';
          const filename = `${cleanTitle}-image.png`;
          
          formData.append('file', imageBlob, filename);

          // Generate image title from recipe title
          let imageTitle = recipeTitle || 'Recipe Image';
          try {
            const titlePrompt = IMAGE_TITLE_PROMPT.replace('{recipeTitle}', recipeTitle || 'Recipe');
            const titleResponse = await callApiModel(titlePrompt, selectedModel1, apiKeys);
            
            if (titleResponse) {
              // Clean up the response to get just the title
              const titleMatch = titleResponse.match(/^[^\n]+/);
              if (titleMatch) {
                imageTitle = titleMatch[0].trim();
                // Ensure it's not too long (max 70 chars)
                if (imageTitle.length > 70) {
                  imageTitle = imageTitle.substring(0, 67) + '...';
                }
              }
            }
          } catch (titleError) {
            console.error('Failed to generate image title:', titleError);
          }

          // Set the title in the form data
          formData.append('title', imageTitle);

          // Use alt text from blog image generation if available, otherwise generate new one
          let altText = '';
          try {
            // Check if we have a pre-generated alt text from blog images
            if (blogImageAltTexts.intro) {
              altText = blogImageAltTexts.intro;
              console.log('Using pre-generated alt text for featured image');
            } else {
              // If not, generate a new one using the shared prompt template
              const keyword = focusKeyword && typeof focusKeyword === 'object' && 'value' in focusKeyword 
                 ? focusKeyword.value 
                 : String(focusKeyword || '');
              const altTextPrompt = SHARED_ALT_TEXT_PROMPT.replace('{focusKeyword}', keyword);
              // Use the same model and API key as for image prompts
              let generatedText = await callApiModel(altTextPrompt, selectedModel1, apiKeys);
              
              // Clean up the response to extract just the alt text if it contains additional formatting
              if (generatedText) {
                // If the response contains "Alt Text:" followed by quoted text, extract just that part
                const altTextMatch = generatedText.match(/Alt Text:[\s\n]*"(.*?)"/i) || 
                                    generatedText.match(/Alt Text:[\s\n]*(.*?)(?:\n|$)/i);
                
                if (altTextMatch && altTextMatch[1]) {
                  // Remove any remaining quotes and trim
                  altText = altTextMatch[1].replace(/^\"|\"$/g, '').trim();
                } else {
                  // If no specific format found, try to get the first quoted text or first line
                  const firstQuoteMatch = generatedText.match(/\"(.*?)\"/);
                  altText = firstQuoteMatch ? firstQuoteMatch[1] : generatedText.split('\n')[0];
                  
                  // Ensure it's not too long (max 125 chars)
                  if (altText.length > 125) {
                    altText = altText.substring(0, 122) + '...';
                  }
                }
              }
              
              console.log('Generated new alt text for featured image');
            }
            
            if (altText && typeof altText === 'string') {
              // Only add the alt_text field, don't modify the image title or filename
              formData.append('alt_text', altText.trim());
              console.log('Using alt text for featured image:', altText.trim());
            }
          } catch (altError) {
            console.error('Failed to get alt text:', altError);
          }
            
          // Upload image
          const imageUploadResponse = await axios.post(
            `${wordpressSettings.url}/wp-json/wp/v2/media`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': authHeader
              }
            }
          );
          
          // Log the alt text used (only for debugging)
          if (altText) {
            console.log('Added alt text to featured image upload');
          }
          
          if (imageUploadResponse.data && imageUploadResponse.data.id) {
            console.log('Image uploaded successfully with ID:', imageUploadResponse.data.id);
            postData.featured_media = imageUploadResponse.data.id;
          }
        } catch (imageError) {
          console.error('Failed to upload featured image:', imageError);
          // Continue with post creation even if image upload fails
        }
      }

      // Create post
      console.log('Creating post with endpoint:', `${wordpressSettings.url}/wp-json/wp/v2/posts`);
      const postResponse = await axios.post(
        `${wordpressSettings.url}/wp-json/wp/v2/posts`,
        postData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          }
        }
      );
      
      if (postResponse.data && postResponse.data.link) {
        console.log('Post created successfully:', postResponse.data);
        setPublishingResult({
          success: true,
          message: `Post ${postStatus === 'publish' ? 'published' : 'saved as draft'} successfully!`,
          link: postResponse.data.link
        });
      } else {
        throw new Error('Invalid response from WordPress API');
      }
    } catch (error) {
      console.error('WordPress publishing error:', error);
      let errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to publish to WordPress';
      
      // More detailed error information
      let detailedError = errorMessage;
      interface ErrorWithResponse {
        response?: {
          status?: number;
        };
      }
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as ErrorWithResponse;
        if (axiosError.response?.status) {
          detailedError += ` (Status: ${axiosError.response.status})`;
          
          if (axiosError.response.status === 401) {
            detailedError = 'Authentication failed (Status: 401). Your WordPress user does not have permission to create posts. Please use an account with Author, Editor, or Administrator role.';
          } else if (axiosError.response?.data?.message) {
            detailedError += ` - ${axiosError.response.data.message}`;
          }
        }
      }
      
      setPublishingResult({
        success: false,
        message: detailedError
      });
    } finally {
      setIsPublishing(false);
    }
  };

  // Function to handle publish options changes
  const handlePublishOptionChange = (option: keyof typeof publishOptions) => {
    setPublishOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  // State for blog images
  const [blogImages, setBlogImages] = useState<{[key: string]: string}>({});
  
  // State to track which blog images are being converted
  const [convertingBlogImages, setConvertingBlogImages] = useState<{[key: string]: boolean}>({});

  // Helper function to convert image to WebP
  const convertImageToWebP = async (imageUrl: string): Promise<string> => {
    try {
      // First try the server-side approach
      console.log('Attempting server-side conversion...');
      const response = await axios.post('http://localhost:3001/convert-base64', {
        imageData: imageUrl
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data?.success && response.data.webpImage) {
        console.log('Server-side conversion successful');
        return response.data.webpImage;
      }
      throw new Error('Invalid response from conversion server');
    } catch (serverError) {
      console.log('Server-side conversion failed, falling back to browser-based conversion', serverError);
      
      // Fall back to browser-based conversion
      const browserConverter = await import('./browser-webp-converter');
      return await browserConverter.processImage(imageUrl);
    }
  };

  // Function to handle blog image generation
  const handleGenerateBlogImages = async () => {
    if (!editor || !editor.getHTML()) {
      setBlogImageError('Please generate a blog post first');
      return;
    }
    
    // Check if we have the required API key for the selected service
    if (selectedImageService === 'stability' && !apiKeys.stabilityAi) {
      setBlogImageError('Stability AI API key is required. Please add it in the Settings tab.');
      return;
    }
    
    if (selectedImageService === 'leonardo' && !apiKeys.leonardoAi) {
      setBlogImageError('Leonardo AI API key is required. Please add it in the Settings tab.');
      return;
    }
    
    setIsGeneratingBlogImages(true);
    setBlogImageError(null);
    setSuccessMessage('Starting image generation...');
    setBlogImages({});
    
    try {
      // Get the article content
      const articleContent = editor.getHTML();
      
      // Generate image prompts
      setSuccessMessage('Generating image prompts...');
      const imagePrompts = await generateImagePrompts(
        articleContent,
        selectedModel1,
        apiKeys.openRouter
      );
      
      console.log('Generated image prompts:', imagePrompts);
      
      // Generate images for each section
      const images: {[key: string]: string} = {};
      const webpImages: {[key: string]: string} = {};
      const altTexts: {[key: string]: string} = {};
      let imagesGenerated = 0;
      
      // Function to process a single image
      const processImage = async (type: string, prompt: string, altText: string) => {
        try {
          setSuccessMessage(`Generating ${type} image...`);
          // Generate the original image
          const imageUrl = await generateAIImage(
            prompt,
            { service: selectedImageService as 'stability' | 'leonardo' }
          );
          
          if (!imageUrl) throw new Error('No image URL returned');
          
          // Store the original image
          images[type] = imageUrl;
          altTexts[type] = altText;
          
          // Update the UI with the original image
          setBlogImages(prev => ({
            ...prev,
            [type]: imageUrl
          }));
          
          // Convert to WebP
          setSuccessMessage(`Converting ${type} image to WebP...`);
          const webpUrl = await convertImageToWebP(imageUrl);
          
          // Store the WebP version
          webpImages[type] = webpUrl;
          
          // Update the UI with the WebP version
          setBlogImages(prev => ({
            ...prev,
            [type]: webpUrl
          }));
          
          imagesGenerated++;
          setSuccessMessage(`Successfully generated and converted ${type} image (${imagesGenerated}/3)`);
          
          return true;
        } catch (error) {
          console.error(`Failed to process ${type} image:`, error);
          setBlogImageError(`Failed to process ${type} image: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return false;
        }
      };
      
      // Process all images in sequence
      await processImage('intro', imagePrompts.intro_image_prompt, imagePrompts.intro_image_alt_text || '');
      await processImage('ingredients', imagePrompts.ingredients_image_prompt, imagePrompts.ingredients_image_alt_text || '');
      await processImage('recipe', imagePrompts.final_recipe_image_prompt, imagePrompts.final_recipe_image_alt_text || '');
      
      // Store all the final WebP images and alt texts
      if (imagesGenerated > 0) {
        setBlogImages(webpImages);
        setBlogImageAltTexts(altTexts);
        setSuccessMessage(`Successfully generated and converted ${imagesGenerated} images to WebP.`);
      } else {
        throw new Error('Failed to generate any images');
      }
    } catch (error) {
      console.error('Error generating blog post:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while generating the blog post');
    } finally {
      // Always clear the image-generation loading state, regardless of success or failure
      setIsGeneratingBlogImages(false);
    }
  };

  // Function to insert blog images into the editor
  const insertBlogImages = () => {
    if (!editor || Object.keys(blogImages).length === 0) return;
    
    try {
      // Make sure the editor is editable before inserting content
      editor.setEditable(true);
      
      // Helper function to find a node position
      const findNodePosition = (type: string, text: string) => {
        let pos = 0;
        let found = false;
        
        editor.state.doc.descendants((node, nodePos) => {
          if (found) return false;
          
          // Check if this is a heading or paragraph containing our text
          if ((node.type.name === type || (type === 'heading' && node.type.name.startsWith('heading'))) && 
              node.textContent.toLowerCase().includes(text.toLowerCase())) {
            pos = nodePos + node.nodeSize;
            found = true;
            return false;
          }
        });
        
        return found ? pos : null;
      };
      
      // Insert intro image after first paragraph
      if (blogImages.intro) {
        let introPos = null;
        
        // Find the second h2 heading
        let headingCount = 0;
        editor.state.doc.descendants((node, pos) => {
          if (introPos !== null) return false;
          if (node.type.name === 'heading' && node.attrs.level === 2) {
            headingCount++;
            if (headingCount === 2) {
              introPos = pos + node.nodeSize;
              return false;
            }
          }
        });
        
        // If no heading found, use first paragraph
        if (introPos === null) {
          editor.state.doc.descendants((node, pos) => {
            if (introPos !== null) return false;
            if (node.type.name === 'paragraph') {
              introPos = pos + node.nodeSize;
              return false;
            }
          });
        }
        
        if (introPos !== null) {
          editor
            .chain()
            .focus()
            .setTextSelection(introPos)
            .insertContent(`<p><img src="${blogImages.intro}" alt="${recipeTitle}" class="generated-image intro-image" /></p>`)
            .run();
        }
      }
      
      // Insert ingredients image after ingredients section
      if (blogImages.ingredients) {
        // Find the ingredients heading
        let ingredientsPos: number | null = null;
        
        // First try to find a heading containing 'ingredients'
        editor.state.doc.descendants((node, pos) => {
          if (ingredientsPos !== null) return false;
          if (node.type.name === 'heading' && 
              (node.attrs.level === 2 || node.attrs.level === 3) && 
              node.textContent.toLowerCase().includes('ingredient')) {
            // Place right after the heading
            ingredientsPos = pos + node.nodeSize;
            return false;
          }
        });
        
        // If no heading found, try to find a paragraph with 'ingredients'
        if (ingredientsPos === null) {
          ingredientsPos = findNodePosition('paragraph', 'ingredient');
        }
        
        // If still not found, use 1/3 position
        if (ingredientsPos === null) {
          const totalPos = editor.state.doc.content.size;
          ingredientsPos = Math.floor(totalPos / 3);
        }
        
        editor
          .chain()
          .focus()
          .setTextSelection(ingredientsPos)
          .insertContent(`<p><img src="${blogImages.ingredients}" alt="Ingredients for ${recipeTitle}" class="generated-image ingredients-image" /></p>`)
          .run();
      }
      
      // Insert recipe image near the end
      if (blogImages.recipe) {
        let recipePos: number | null = null;
        
        // Find the ingredients section first
        let foundIngredients = false;
        editor.state.doc.descendants((node, pos) => {
          if (recipePos !== null) return false;
          
          // Look for ingredients heading or list
          if (node.type.name === 'heading' && 
              node.textContent.toLowerCase().includes('ingredient')) {
            foundIngredients = true;
          }
          
          // If we found ingredients and now we're at a new heading, this is where we want to insert
          if (foundIngredients && node.type.name === 'heading' && 
              !node.textContent.toLowerCase().includes('ingredient')) {
            recipePos = pos;
            return false;
          }
        });
        
        // If we didn't find a good spot after ingredients, try to find the instructions section
        if (recipePos === null) {
          recipePos = findNodePosition('heading', 'instruction') || 
                     findNodePosition('heading', 'step') ||
                     findNodePosition('heading', 'direction');
        }
        
        // If still not found, use position after ingredients list if we found it
        if (recipePos === null && foundIngredients) {
          editor.state.doc.descendants((node, pos) => {
            if (recipePos !== null) return false;
            if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
              const prevNode = editor.state.doc.resolve(pos).nodeBefore;
              if (prevNode && prevNode.textContent.toLowerCase().includes('ingredient')) {
                recipePos = pos + node.nodeSize;
                return false;
              }
            }
          });
        }
        
        // Last resort: use 1/2 position
        if (recipePos === null) {
          const totalPos = editor.state.doc.content.size;
          recipePos = Math.floor(totalPos / 2);
        }
        
        editor
          .chain()
          .focus()
          .setTextSelection(recipePos)
          .insertContent(`<p><img src="${blogImages.recipe}" alt="Final ${recipeTitle}" class="generated-image recipe-image" /></p>`)
          .run();
      }
      
      // Restore editor state
      editor.setEditable(false);
      
      setError('Images inserted successfully!');
    } catch (error) {
      console.error('Error inserting blog images:', error);
      setError(`Error inserting images: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Make sure to restore editor state even if there's an error
      if (editor) editor.setEditable(false);
    }
  }

  // Function to handle compressing individual blog images to WebP
  const handleCompressWebP = async (imageUrl: string, imageType: string) => {
    setConvertingBlogImages(prev => ({ ...prev, [imageType]: true }));
    
    try {
      const webpUrl = await convertImageToWebP(imageUrl);
      setBlogImages(prev => ({ ...prev, [imageType]: webpUrl }));
      setSuccessMessage(`${imageType} image converted to WebP successfully!`);
    } catch (error) {
      console.error(`Error converting ${imageType} image to WebP:`, error);
      setBlogImageError(`Failed to convert ${imageType} image to WebP: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConvertingBlogImages(prev => ({ ...prev, [imageType]: false }));
    }
  };

  // Return the JSX for the App component
  return (
    <div className="app-container">

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal">
            <div className="settings-header">
              <h2>API Settings</h2>
              <button 
                className="close-button"
                onClick={() => setIsSettingsOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="settings-content">
              <div className="settings-section">
                <h3>OpenRouter API Key</h3>
                <input
                  type="password"
                  value={apiKeys.openRouter}
                  onChange={(e) => handleApiKeyChange('openRouter', e.target.value)}
                  placeholder="Enter your OpenRouter API key"
                />
                <p className="settings-info">Required for blog generation</p>
              </div>
              
              <div className="settings-section">
                <h3>Image Generation API Keys</h3>
                <div className="api-key-input">
                  <label>Stability AI</label>
                  <input
                    type="password"
                    value={apiKeys.stabilityAi}
                    onChange={(e) => handleApiKeyChange('stabilityAi', e.target.value)}
                    placeholder="Enter your Stability AI API key"
                  />
                  <a href="https://platform.stability.ai/" target="_blank" rel="noopener noreferrer">Get API key</a>
                </div>
                
                <div className="api-key-input">
                  <label>Leonardo AI</label>
                  <input
                    type="password"
                    value={apiKeys.leonardoAi}
                    onChange={(e) => handleApiKeyChange('leonardoAi', e.target.value)}
                    placeholder="Enter your Leonardo AI API key"
                  />
                  <a href="https://leonardo.ai/api" target="_blank" rel="noopener noreferrer">Get API key</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="layout-container">
        <div className="main-content">
          <div className="input-section">
            <div className="input-row">
              <div className="input-group">
                <label htmlFor="recipeTitle">Recipe Title:</label>
                <input
                  id="recipeTitle"
                  type="text"
                  value={recipeTitle}
                  onChange={(e) => setRecipeTitle(e.target.value)}
                  placeholder="Enter your recipe title"
                />
              </div>
              
              <div className="input-group">
                <label htmlFor="focusKeyword">Focus Keyword:</label>
                <input
                  id="focusKeyword"
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="Enter focus keyword"
                />
              </div>
            </div>
            
            <div className="input-row">
              <div className="input-group">
                <label htmlFor="difficulty">Difficulty:</label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="high">High</option>
                  <option value="master">Master</option>
                  <option value="recipe">Recipe Article</option>
                </select>
              </div>
            </div>

            {difficulty === 'hard' && (
              <div className="input-row">
                <div className="input-group" style={{ width: '100%' }}>
                  <label htmlFor="articleToRewrite">Article to Rewrite:</label>
                  <textarea
                    id="articleToRewrite"
                    value={articleToRewrite}
                    onChange={(e) => setArticleToRewrite(e.target.value)}
                    placeholder="Paste the whole article here"
                    rows={6}
                    style={{ minHeight: '100px', width: '100%' }}
                  />
                </div>
              </div>
            )}
            {difficulty === 'high' && (
              <div className="input-row">
                <div className="input-group" style={{ width: '100%' }}>
                  <label htmlFor="articleToRewriteHigh">Enter recipe info:</label>
                  <textarea
                    id="articleToRewriteHigh"
                    value={articleToRewrite}
                    onChange={(e) => setArticleToRewrite(e.target.value)}
                    placeholder="Enter recipe info"
                    rows={6}
                    style={{ minHeight: '100px', width: '100%' }}
                  />
                </div>
              </div>
            )}

            <div className="button-group">
              <button 
                className="generate-button"
                onClick={handleGenerate} 
                disabled={isLoading || !recipeTitle}
              >
                {isLoading ? 'Generating...' : 'Generate Blog Post'}
              </button>
              
              <button 
                className="generate-images-button"
                onClick={handleGenerateBlogImages} 
                disabled={isGeneratingBlogImages || isLoading || !editor || !(editor.getHTML().length > 100)}
              >
                {isGeneratingBlogImages ? 'Generating Images...' : 'Generate Blog Images'}
              </button>
            </div>

            {/* Image Generation Section */}
            <div className="button-group">
              <div className="image-generation-section">
                {Object.keys(blogImages).length > 0 && (
                  <button 
                    className="insert-images-button"
                    onClick={insertBlogImages}
                  >
                    Insert Images into Blog Post
                  </button>
                )}
                
                {/* Display generated blog images */}
                {Object.keys(blogImages).length > 0 && (
                  <div className="blog-images-preview">
                    <h3>Generated Blog Images</h3>
                    <div className="image-grid">
                      {blogImages.intro && (
                        <div className="image-preview-item">
                          <h4>Intro Image</h4>
                          <img src={blogImages.intro} alt="Intro" className="preview-image" />
                          <button 
                            className="compress-webp-button" 
                            onClick={() => handleCompressWebP(blogImages.intro, 'intro')}
                            disabled={convertingBlogImages.intro}
                            style={{
                              marginTop: '10px',
                              padding: '8px 16px',
                              backgroundColor: convertingBlogImages.intro ? '#6c757d' : '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: convertingBlogImages.intro ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {convertingBlogImages.intro ? 'Converting...' : 'Compress WebP'}
                          </button>
                        </div>
                      )}
                      {blogImages.ingredients && (
                        <div className="image-preview-item">
                          <h4>Ingredients Image</h4>
                          <img src={blogImages.ingredients} alt="Ingredients" className="preview-image" />
                          <button 
                            className="compress-webp-button" 
                            onClick={() => handleCompressWebP(blogImages.ingredients, 'ingredients')}
                            disabled={convertingBlogImages.ingredients}
                            style={{
                              marginTop: '10px',
                              padding: '8px 16px',
                              backgroundColor: convertingBlogImages.ingredients ? '#6c757d' : '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: convertingBlogImages.ingredients ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {convertingBlogImages.ingredients ? 'Converting...' : 'Compress WebP'}
                          </button>
                        </div>
                      )}
                      {blogImages.recipe && (
                        <div className="image-preview-item">
                          <h4>Recipe Image</h4>
                          <img src={blogImages.recipe} alt="Final Dish" className="preview-image" />
                          <button 
                            className="compress-webp-button" 
                            onClick={() => handleCompressWebP(blogImages.recipe, 'recipe')}
                            disabled={convertingBlogImages.recipe}
                            style={{
                              marginTop: '10px',
                              padding: '8px 16px',
                              backgroundColor: convertingBlogImages.recipe ? '#6c757d' : '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: convertingBlogImages.recipe ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {convertingBlogImages.recipe ? 'Converting...' : 'Compress WebP'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && <div className={error.includes('successfully') ? "success-message" : "error-message"}>{error}</div>}
            {blogImageError && (
              <div className="error-message">
                {blogImageError}
              </div>
            )}
            {successMessage && (
              <div className="success-message">
                {successMessage}
              </div>
            )}

            <div className="output-section">
              <h2>Generated Content</h2>
              
              {/* Rich Text Editor Toolbar */}
              <div className="editor-toolbar">
                <button onClick={() => editor?.chain().focus().toggleBold().run()} className="toolbar-button" title="Bold">
                  <strong>B</strong>
                </button>
                <button onClick={() => editor?.chain().focus().toggleItalic().run()} className="toolbar-button" title="Italic">
                  <em>I</em>
                </button>
                <button onClick={() => editor?.chain().focus().toggleUnderline().run()} className="toolbar-button" title="Underline">
                  <u>U</u>
                </button>
                <button onClick={() => editor?.chain().focus().toggleStrike().run()} className="toolbar-button" title="Strike">
                  <s>S</s>
                </button>
                <span className="toolbar-divider">|</span>
                
                <button onClick={() => editor?.chain().focus().setParagraph().run()} className="toolbar-button" title="Paragraph">
                  P
                </button>
                <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className="toolbar-button" title="Heading 1">
                  H1
                </button>
                <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="toolbar-button" title="Heading 2">
                  H2
                </button>
                <button onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className="toolbar-button" title="Heading 3">
                  H3
                </button>
                <span className="toolbar-divider">|</span>
                
                <button onClick={() => editor?.chain().focus().toggleBulletList().run()} className="toolbar-button" title="Bullet List">
                  • List
                </button>
                <button onClick={() => editor?.chain().focus().toggleOrderedList().run()} className="toolbar-button" title="Ordered List">
                  1. List
                </button>
                <span className="toolbar-divider">|</span>
                
                <button onClick={() => editor?.chain().focus().setTextAlign('left').run()} className="toolbar-button" title="Align Left">
                  ←
                </button>
                <button onClick={() => editor?.chain().focus().setTextAlign('center').run()} className="toolbar-button" title="Align Center">
                  ↔
                </button>
                <button onClick={() => editor?.chain().focus().setTextAlign('right').run()} className="toolbar-button" title="Align Right">
                  →
                </button>
                <span className="toolbar-divider">|</span>
                
                <button 
                  onClick={() => {
                    const url = prompt('Enter link URL:');
                    if (url) {
                      editor?.chain().focus().setLink({ href: url }).run();
                    }
                  }} 
                  className="toolbar-button" 
                  title="Insert Link"
                >
                  🔗 Link
                </button>
                <button 
                  onClick={() => {
                    const url = prompt('Enter image URL:');
                    if (url) {
                      editor?.chain().focus().setImage({ src: url }).run();
                    }
                  }} 
                  className="toolbar-button" 
                  title="Insert Image"
                >
                  🖼️ Image
                </button>
              </div>
              
              <EditorContent editor={editor} className="tiptap-editor" />
              
              {/* Hidden ImagePlacer component */}
              <ImagePlacer 
                articleContent={editor ? editor.getHTML() : ''}
                onGenerationStart={() => setIsGeneratingBlogImages(true)}
                onGenerationComplete={() => setIsGeneratingBlogImages(false)}
                onError={(error) => {
                  setBlogImageError(error);
                  setIsGeneratingBlogImages(false);
                }}
                onImagesGenerated={(images) => {
                  console.log('Images generated:', images);
                  setIsGeneratingBlogImages(false);
                  // Show success message
                  setBlogImageError(null);
                }}
              />
              <button 
                className="download-button"
                onClick={() => {
                  const htmlContent = editor?.getHTML();
                  if (htmlContent) {
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'blogPost.html';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                Download HTML
              </button>
            </div>
          </div>
        </div>

        <div className="sidebar">
          <div className="sidebar-tabs">
            <button 
              className={`tab-button ${activeTab === 'seo' ? 'active' : ''}`}
              onClick={() => setActiveTab('seo')}
            >
              SEO
            </button>
            <button 
              className={`tab-button ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => setActiveTab('image')}
            >
              Image
            </button>
            <button 
              className={`tab-button ${activeTab === 'wordpress' ? 'active' : ''}`}
              onClick={() => setActiveTab('wordpress')}
            >
              WordPress
            </button>
            <button 
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>

          <div className="sidebar-content">
            {/* SEO Tab Content */}
            {activeTab === 'seo' && (
              <>
                <h2>SEO Suggestions</h2>
                {isSidebarContentVisible ? (
                  <>
                    {isGeneratingSidebarContent && <div className="loading-indicator">Generating sidebar content...</div>}
                    
                    {/* Title Section */}
                    <div className="sidebar-section">
                      <h3>Title Suggestions</h3>
                      {generatedTitles.length > 0 ? (
                        generatedTitles.map((title, index) => (
                          <div key={index} className={`generated-item ${selectedTitle === title.text ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="selectedTitleRadio"
                              id={`title-${index}`}
                              value={title.text}
                              checked={selectedTitle === title.text}
                              onChange={() => handleSelectTitle(title.text)}
                              style={{ marginRight: '10px', verticalAlign: 'top' }}
                            />
                            <label htmlFor={`title-${index}`} style={{ display: 'inline-block', width: 'calc(100% - 30px)' }}>
                              <p style={{ marginTop: '0', marginBottom: '5px' }}>{title.text}</p>
                              <div className="score-bar-placeholder" style={{ width: `${title.score}%`, backgroundColor: title.score > 70 ? 'green' : title.score > 40 ? 'orange' : 'red', height: '5px', marginTop: '5px' }}></div>
                              <small>Score: {title.score}%</small>
                            </label>
                          </div>
                        ))
                      ) : (
                        !isGeneratingSidebarContent && <p>No titles generated yet.</p>
                      )}
                      <button onClick={() => setError('Additional titles are now generated automatically from Flow 1 output')} disabled={generatedTitles.length >= 3}>
                        View Titles ( {generatedTitles.length} / 3 )
                      </button>
                      <button onClick={handleCleanTitles} disabled={isGeneratingSidebarContent || generatedTitles.length <= 1 || !selectedTitle}>
                        Clean Titles
                      </button>
                    </div>

                    {/* Meta Description Section */}
                    <div className="sidebar-section">
                      <h3>Meta Description</h3>
                      {generatedMetaDescriptions.length > 0 ? (
                        generatedMetaDescriptions.map((desc, index) => (
                          <div key={index} className={`generated-item ${selectedMetaDescription === desc ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="selectedMetaDescRadio"
                              id={`meta-${index}`}
                              value={desc}
                              checked={selectedMetaDescription === desc}
                              onChange={() => handleSelectMetaDescription(desc)}
                              style={{ marginRight: '10px', verticalAlign: 'top' }}
                            />
                            <label htmlFor={`meta-${index}`} style={{ display: 'inline-block', width: 'calc(100% - 30px)' }}>
                              <p style={{ marginTop: '0', marginBottom: '5px' }}>{desc}</p>
                              <small>Length: {desc.length}</small>
                            </label>
                          </div>
                        ))
                      ) : (
                        !isGeneratingSidebarContent && <p>No meta descriptions generated yet.</p>
                      )}
                      <button onClick={generateAdditionalMetaDescription} disabled={isGeneratingSidebarContent || generatedMetaDescriptions.length >= 3}>
                        Generate More ( {generatedMetaDescriptions.length} / 3 )
                      </button>
                      <button onClick={handleCleanMetaDescriptions} disabled={isGeneratingSidebarContent || generatedMetaDescriptions.length <= 1 || !selectedMetaDescription}>
                        Clean Descriptions
                      </button>
                    </div>

                    {/* Keywords Section */}
                    <div className="sidebar-section">
                      <h3>Keywords</h3>
                      {extractedKeywords.length > 0 ? (
                        <div className="keywords-list">
                          {extractedKeywords.map((keyword, index) => (
                            <span key={index} className="keyword-tag">{keyword}</span>
                          ))}
                        </div>
                      ) : (
                        !isGeneratingSidebarContent && <p>No keywords extracted yet.</p>
                      )}
                      <button onClick={handleCopyKeywords} disabled={isGeneratingSidebarContent || extractedKeywords.length === 0}>
                        Copy Keywords
                      </button>
                      <small>Note: Trend/competitor data requires external tools and is not available.</small>
                    </div>
                  </>
                ) : (
                  !isLoading && <p>Generate a blog post to see SEO suggestions.</p>
                )}
              </>
            )}

            {/* Image Generation Tab Content */}
            {activeTab === 'image' && (
              <div className="image-generation-tab">
                <h2>Recipe Image Generation</h2>
                
                <div className="service-selector">
                  <h3>Select Image Service</h3>
                  <div className="radio-group">
                    {imageGenerationServices.map(service => (
                      <label key={service.id} className="radio-label">
                        <input
                          type="radio"
                          name="imageService"
                          value={service.id}
                          checked={selectedImageService === service.id}
                          onChange={() => {
                            setSelectedImageService(service.id);
                            localStorage.setItem('preferredImageService', service.id);
                          }}
                        />
                        {service.name}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="image-service-info">
                  {selectedImageService === 'stability' ? (
                    <>
                      <p>Using <strong>Stability AI</strong> for image generation.</p>
                      <p>API Key Status: {apiKeys.stabilityAi ? '✅ Set' : '❌ Not Set'}</p>
                      {!apiKeys.stabilityAi && (
                        <p className="warning-text">Please add your Stability AI API key in the Settings tab.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>Using <strong>Leonardo AI</strong> for image generation.</p>
                      <p>API Key Status: {apiKeys.leonardoAi ? '✅ Set' : '❌ Not Set'}</p>
                      {!apiKeys.leonardoAi && (
                        <p className="warning-text">Please add your Leonardo AI API key in the Settings tab.</p>
                      )}
                    </>
                  )}
                </div>
                
                <div className="sidebar-section">
                  <button 
                    className="generate-image-button"
                    onClick={generateImage}
                    disabled={isGeneratingImage || !recipeTitle}
                  >
                    {isGeneratingImage ? 'Generating...' : 'Generate Recipe Image'}
                  </button>
                  
                  {/* Display generated image or error */}
                  {(generatedImageUrl || imageGenerationError || isConverting) && (
                    <div className="image-result-container">
                      {isConverting ? (
                        <div className="conversion-animation" style={{ padding: '10px 0' }}>
                          <div className="conversion-text">
                            <p style={{ margin: '5px 0', color: '#4a4a4a' }}>{conversionStep}</p>
                          </div>
                          <div className="progress-container" style={{ 
                            width: '100%', 
                            height: '8px',
                            marginTop: '10px',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div className="progress-bar" style={{ 
                              width: `${conversionProgress}%`, 
                              height: '100%', 
                              backgroundColor: '#4CAF50',
                              transition: 'width 0.3s ease'
                            }}></div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {generatedImageUrl && (
                            <div className="generated-image">
                              <img src={generatedImageUrl} alt={recipeTitle} />
                              <button 
                                className="compress-webp-button"
                                onClick={convertToWebP}
                                disabled={isConverting}
                                style={{
                                  marginTop: '10px',
                                  padding: '8px 16px',
                                  backgroundColor: isConverting ? '#6c757d' : '#4CAF50',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: isConverting ? 'not-allowed' : 'pointer'
                                }}
                              >
                                Compress WebP
                              </button>
                            </div>
                          )}
                          {imageGenerationError && (
                            <div className="error-message">
                              {imageGenerationError}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="image-generation-instructions">
                  <h3>Blog Image Generation</h3>
                  <ol>
                    <li>First, generate a blog post using the "Generate Blog Post" button</li>
                    <li>Once the blog is generated, click the "Generate Blog Images" button</li>
                    <li>Images will be automatically inserted into your article</li>
                  </ol>
                </div>
              </div>
            )}

            {/* WordPress Tab Content */}
            {activeTab === 'wordpress' && (
              <div className="wordpress-tab">
                <h2>WordPress Connection</h2>
                
                {!wordpressSettings.isConnected ? (
                  <div className="sidebar-section">
                    <h3>Connect to WordPress</h3>
                    <div className="wordpress-form">
                      <div className="form-group">
                        <label>WordPress Site URL</label>
                        <input
                          type="text"
                          value={wordpressSettings.url}
                          onChange={(e) => handleWpSettingsChange('url', e.target.value)}
                          placeholder="https://yoursite.com"
                        />
                        <small>Include https:// and no trailing slash</small>
                      </div>
                      
                      <div className="form-group">
                        <label>Username</label>
                        <input
                          type="text"
                          value={wordpressSettings.username}
                          onChange={(e) => handleWpSettingsChange('username', e.target.value)}
                          placeholder="WordPress username"
                        />
                      </div>
                      
                      <div className="form-group">
                        <label>Application Password</label>
                        <input
                          type="password"
                          value={wordpressSettings.password}
                          onChange={(e) => handleWpSettingsChange('password', e.target.value)}
                          placeholder="WordPress application password"
                        />
                        <small>
                          <a 
                            href="https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            How to create an application password
                          </a>
                        </small>
                        <small className="password-note">
                          Note: You must use an account with Author, Editor, or Administrator role that has permission to create posts.
                        </small>
                      </div>
                      
                      <button 
                        className="wordpress-connect-button"
                        onClick={connectToWordPress}
                        disabled={isConnecting}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect to WordPress'}
                      </button>
                      
                      {connectionError && (
                        <div className="error-message">
                          {connectionError}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-section">
                    <div className="connection-status connected">
                      <span className="status-dot"></span>
                      Connected to {wordpressSettings.url}
                      <button 
                        className="disconnect-button"
                        onClick={() => handleWpSettingsChange('isConnected', false)}
                      >
                        Disconnect
                      </button>
                    </div>
                    
                    <h3>Publish Settings</h3>
                    
                    <div className="form-group">
                      <label>Category</label>
                      <select
                        value={selectedCategory || ''}
                        onChange={(e) => setSelectedCategory(Number(e.target.value))}
                      >
                        <option value="">Select a category</option>
                        {wpCategories.length > 0 ? (
                          wpCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name} ({cat.count})
                            </option>
                          ))
                        ) : (
                          <option value="" disabled>No categories found</option>
                        )}
                      </select>
                      {wpCategories.length === 0 && wordpressSettings.isConnected && (
                        <small className="warning-text">
                          No categories found. Please create at least one category in WordPress.
                        </small>
                      )}
                    </div>
                    
                    <div className="form-group">
                      <label>Post Status</label>
                      <select
                        value={postStatus}
                        onChange={(e) => setPostStatus(e.target.value)}
                      >
                        <option value="draft">Draft</option>
                        <option value="publish">Publish</option>
                      </select>
                    </div>
                    
                    <div className="publishing-summary">
                      <h4>Publishing Summary</h4>
                      <div className="publish-options">
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeTitle"
                            checked={publishOptions.includeTitle}
                            onChange={() => handlePublishOptionChange('includeTitle')}
                          />
                          <label htmlFor="includeTitle">
                            <strong>Title:</strong> {recipeTitle || 'Not set'}
                          </label>
                        </div>
                        
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeFocusKeyword"
                            checked={publishOptions.includeFocusKeyword}
                            onChange={() => handlePublishOptionChange('includeFocusKeyword')}
                          />
                          <label htmlFor="includeFocusKeyword">
                            <strong>Focus Keyword:</strong> {focusKeyword || 'Not set'}
                          </label>
                        </div>
                        
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeSlug"
                            checked={publishOptions.includeSlug}
                            onChange={() => handlePublishOptionChange('includeSlug')}
                          />
                          <label htmlFor="includeSlug">
                            <strong>Slug:</strong> {focusKeyword ? focusKeyword.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 'Will be auto-generated'}
                          </label>
                        </div>
                        
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeMetaDescription"
                            checked={publishOptions.includeMetaDescription}
                            onChange={() => handlePublishOptionChange('includeMetaDescription')}
                          />
                          <label htmlFor="includeMetaDescription">
                            <strong>Meta Description:</strong> {selectedMetaDescription ? `${selectedMetaDescription.substring(0, 50)}...` : 'Not selected'}
                          </label>
                        </div>
                        
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeFeaturedImage"
                            checked={publishOptions.includeFeaturedImage}
                            onChange={() => handlePublishOptionChange('includeFeaturedImage')}
                          />
                          <label htmlFor="includeFeaturedImage">
                            <strong>Featured Image:</strong> {generatedImageUrl ? 'Will use generated image' : 'None'}
                          </label>
                        </div>
                        
                        <div className="publish-option">
                          <input
                            type="checkbox"
                            id="includeTags"
                            checked={publishOptions.includeTags}
                            onChange={() => handlePublishOptionChange('includeTags')}
                          />
                          <label htmlFor="includeTags">
                            <strong>Tags:</strong> {extractedKeywords.length > 0 ? extractedKeywords.join(', ') : 'None'}
                          </label>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      className="wordpress-publish-button"
                      onClick={publishToWordPress}
                      disabled={isPublishing || !editor}
                    >
                      {isPublishing ? 'Publishing...' : `${postStatus === 'publish' ? 'Publish' : 'Save as Draft'} to WordPress`}
                    </button>
                    
                    {publishingResult && (
                      <div className={`publishing-result ${publishingResult.success ? 'success' : 'error'}`}>
                        <p>{publishingResult.message}</p>
                        {publishingResult.link && (
                          <a 
                            href={publishingResult.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="view-post-link"
                          >
                            View Post
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab Content */}
            {activeTab === 'settings' && (
              <div className="settings-tab">
                <h2>API Settings</h2>
                
                <div className="sidebar-section">
                  <h3>OpenRouter API Key</h3>
                  <input
                    type="password"
                    value={apiKeys.openRouter}
                    onChange={(e) => handleApiKeyChange('openRouter', e.target.value)}
                    placeholder="Enter your OpenRouter API key"
                  />
                  <p className="settings-info">Required for blog generation</p>
                </div>
                
                <div className="sidebar-section">
                  <h3>Image Generation API Keys</h3>
                  <div className="api-key-input">
                    <label>Stability AI</label>
                    <input
                      type="password"
                      value={apiKeys.stabilityAi}
                      onChange={(e) => handleApiKeyChange('stabilityAi', e.target.value)}
                      placeholder="Enter your Stability AI API key"
                    />
                    <a href="https://platform.stability.ai/" target="_blank" rel="noopener noreferrer">Get API key</a>
                  </div>
                  
                  <div className="api-key-input">
                    <label>Leonardo AI</label>
                    <input
                      type="password"
                      value={apiKeys.leonardoAi}
                      onChange={(e) => handleApiKeyChange('leonardoAi', e.target.value)}
                      placeholder="Enter your Leonardo AI API key"
                    />
                    <a href="https://leonardo.ai/api" target="_blank" rel="noopener noreferrer">Get API key</a>
                  </div>
                </div>
                
                <div className="sidebar-section">
                  <h3>Model Selection</h3>
                  <div className="model-selector">
                    <div className="model-group">
                      <label>Primary Model:</label>
                      <select
                        value={selectedModel1}
                        onChange={(e) => setSelectedModel1(e.target.value)}
                      >
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name || model.id}