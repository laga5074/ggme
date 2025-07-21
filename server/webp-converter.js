// server/webp-converter.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { Buffer } = require('buffer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3001;

// Enable CORS
app.use(cors());

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Configure where to store converted images
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'converted-images');

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Endpoint to convert base64 image to WebP
app.post('/convert-base64', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Extract base64 data
    const matches = imageData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image format' });
    }
    
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Process steps with logging
    console.log('Converting to JPG and removing metadata...');
    const jpgBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    
    console.log('Converting to WebP...');
    const webpBuffer = await sharp(jpgBuffer)
      .webp({ 
        quality: 85,
        lossless: false,
        nearLossless: false,
        smartSubsample: true,
        effort: 5
      })
      .toBuffer();
    
    // Return the WebP image as base64
    const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
    res.json({ success: true, webpImage: webpBase64 });
  } catch (error) {
    console.error('Error converting image:', error);
    res.status(500).json({ error: `Conversion failed: ${error.message}` });
  }
});

// Endpoint to convert uploaded file to WebP
app.post('/convert-file', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate unique filename
    const filename = `${uuidv4()}.webp`;
    const outputPath = path.join(OUTPUT_DIR, filename);

    // Convert to WebP with quality optimization
    await sharp(req.file.buffer)
      .webp({ 
        quality: 80,
        alphaQuality: 80,
        lossless: false,
        nearLossless: true
      })
      .toFile(outputPath);

    // Return URL to the converted image
    res.json({
      url: `/converted-images/${filename}`
    });

  } catch (error) {
    console.error('Image conversion error:', error);
    res.status(500).json({ error: 'Failed to convert image' });
  }
});

// Serve static files from uploads directory
app.use('/converted-images', express.static(OUTPUT_DIR));

// Start the server
app.listen(port, () => {
  console.log(`WebP converter server running on port ${port}`);
});
