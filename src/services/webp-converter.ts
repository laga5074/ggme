import axios from 'axios';

export const convertToWebP = async (imageUrl: string): Promise<string> => {
  try {
    // First, download the original image
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    
    // Send to our server-side converter
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer]), 'original.jpg');
    
    const conversionResponse = await axios.post('/api/convert-to-webp', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    
    if (!conversionResponse.data?.url) {
      throw new Error('Failed to convert image to WebP');
    }
    
    return conversionResponse.data.url;
  } catch (error) {
    console.error('WebP conversion failed:', error);
    // Fallback to original image if conversion fails
    return imageUrl;
  }
};
