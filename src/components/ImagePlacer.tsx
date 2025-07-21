import React, { useEffect, useState, useCallback } from 'react';
import { generateImage } from '../services/imageGenerator';
import { generateImagePrompts, ImagePrompts } from '../services/imagePromptGenerator';
import { convertToWebP } from '../services/webp-converter'; // Import the webp-converter function

interface ImagePlacerProps {
  articleContent: string;
  onImagesGenerated?: (images: { [key: string]: string }) => void;
  onError?: (error: string) => void;
  onGenerationStart?: () => void;
  onGenerationComplete?: () => void;
}

export const ImagePlacer: React.FC<ImagePlacerProps> = ({
  articleContent,
  onImagesGenerated,
  onError,
  onGenerationStart,
  onGenerationComplete
}) => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Get the preferred image service from localStorage
  const getPreferredImageService = useCallback((): 'stability' | 'leonardo' => {
    try {
      const savedService = localStorage.getItem('preferredImageService');
      if (savedService === 'leonardo') return 'leonardo';
    } catch (e) {
      console.error("Failed to get preferred image service:", e);
    }
    return 'stability'; // Default to Stability AI
  }, []);

  const generateAndPlaceImages = useCallback(async (modelId?: string, apiKey?: string) => {
    if (!articleContent || isGenerating) return;

    setIsGenerating(true);
    if (onGenerationStart) onGenerationStart();

    try {
      // Generate image prompts from article content
      const imagePrompts = await generateImagePrompts(articleContent, modelId, apiKey);

      // Generate images and convert to WebP before displaying
      const generatedImages: { [key: string]: string } = {};

      for (const [key, prompt] of Object.entries(imagePrompts)) {
        try {
          // Generate original image
          const imageUrl = await generateImage(prompt, {
            service: getPreferredImageService()
          });

          if (imageUrl) {
            try {
              // Convert the generated image to WebP format
              const webpUrl = await convertToWebP(imageUrl);
              generatedImages[key] = webpUrl;
              console.log(`Successfully converted ${key} to WebP`);
            } catch (conversionError) {
              console.error(`Failed to convert ${key} to WebP:`, conversionError);
              // Fallback to original URL if conversion fails
              generatedImages[key] = imageUrl;
            }
          } else {
            console.warn(`No image URL returned for ${key}`);
          }
        } catch (error) {
          console.error(`Failed to generate ${key}:`, error);
        }
      }

      // Only after all images are converted, display them
      if (Object.keys(generatedImages).length > 0) {
        if (onImagesGenerated) onImagesGenerated(generatedImages);
        console.log('All images generated and converted to WebP successfully');
      }
    } catch (error) {
      if (onError) onError(error instanceof Error ? error.message : 'Image generation failed');
    } finally {
      setIsGenerating(false);
      if (onGenerationComplete) onGenerationComplete();
    }
  }, [articleContent, isGenerating, onError, onGenerationComplete, onGenerationStart, onImagesGenerated, getPreferredImageService]);

  // Helper function to place image after an element
  const placeImageAfterElement = (element: Element, imageUrl: string, className: string) => {
    // Find the Tiptap editor instance
    const editorContent = document.querySelector('.tiptap-editor .ProseMirror');
    if (!editorContent || !(editorContent as any).editor) {
      throw new Error('Could not find Tiptap editor instance');
    }

    const editor = (editorContent as any).editor;

    // Remove any existing image with the same class name
    const existingImage = document.querySelector(`.${className}`);
    if (existingImage) {
      existingImage.remove();
    }

    // Find the position after the target element
    const pos = editor.view.posAtDOM(element, 0);
    if (pos === undefined) {
      throw new Error('Could not find position for image placement');
    }

    // Find the end of the current block
    const $pos = editor.state.doc.resolve(pos);
    const end = $pos.end();

    // Insert the image at the end of the block
    editor
      .chain()
      .focus()
      .setTextSelection(end)
      .insertContent(`<p><img src="${imageUrl}" alt="${className.replace('-image', '')} illustration" class="generated-image ${className}" /></p>`)
      .run();

    console.log(`Placed ${className} after:`, element);
  };

  // Expose the generate function to be called externally
  useEffect(() => {
    // Expose the function to the window object for external access
    (window as any).generateBlogImages = (modelId?: string, apiKey?: string) =>
      generateAndPlaceImages(modelId, apiKey);

    // Cleanup function to remove the reference when component unmounts
    return () => {
      delete (window as any).generateBlogImages;
    };
  }, [articleContent, generateAndPlaceImages]); // Include generateAndPlaceImages in dependencies

  return null; // This is a utility component that doesn't render anything
};
