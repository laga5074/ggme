import React, { useState, useEffect } from "react";

// ...existing code: import your generateAIImage, compressAndConvertToWebP functions...

interface ImageProcessorProps {
  imageCount: number;
}

const ImageProcessor: React.FC<ImageProcessorProps> = ({ imageCount }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedImages, setDisplayedImages] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // Optional: cache for original AI images
  const aiImageCache = React.useRef<string[]>([]);

  const processNextImage = async (index: number) => {
    setProcessing(true);
    // 1. Generate AI image (do not show yet)
    const aiImage = await generateAIImage(index);
    aiImageCache.current[index] = aiImage;

    // 2. Compress and convert to WebP automatically
    const webpImage = await compressAndConvertToWebP(aiImage);

    // 3. Show the processed image
    setDisplayedImages((prev) => [...prev, webpImage]);
    setCurrentIndex(index + 1);

    // 4. Process next image if any
    if (index + 1 < imageCount) {
      await processNextImage(index + 1);
    } else {
      setProcessing(false);
    }
  };

  // Automatically process all images when imageCount changes (e.g., after selecting a recipe)
  useEffect(() => {
    if (imageCount > 0) {
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCount]);

  const handleStart = () => {
    setDisplayedImages([]);
    setCurrentIndex(0);
    processNextImage(0);
  };

  return (
    <div>
      {/* Optionally hide the button if you want full auto, or keep for manual trigger */}
      <button onClick={handleStart} disabled={processing}>
        {processing ? "Processing..." : "Generate & Compress Images"}
      </button>
      <div>
        {displayedImages.map((img, idx) => (
          <img key={idx} src={img} alt={`Generated ${idx}`} />
        ))}
      </div>
      {/* Removed manual Compress WebP button */}
    </div>
  );
};

export default ImageProcessor;

// Helper functions (stubs, replace with your actual implementations)
async function generateAIImage(index: number): Promise<string> {
  // ...existing code: generate and return image as data URL or blob URL...
  return "";
}

async function compressAndConvertToWebP(image: string): Promise<string> {
  // ...existing code: compress and convert, return as data URL or blob URL...
  return "";
}
