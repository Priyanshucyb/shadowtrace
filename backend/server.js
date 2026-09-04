const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const scanHistory = [];

app.post('/api/scan', upload.single('asset'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Invalid Asset Type', 
        message: 'The uploaded file is not a valid audit asset (PNG, JPG, PDF required).' 
      });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    // Cryptographic SHA-256 Hash
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const sha256 = hashSum.digest('hex');

    let riskScore = 12; // Base clean score
    let extractedMeta = {};

    try {
      if (req.file.mimetype.startsWith('image/')) {
        const metadata = await sharp(filePath).metadata();
        extractedMeta = {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          space: metadata.space,
          hasExif: !!metadata.exif
        };
        // Real analysis: Increase risk if EXIF metadata exists
        if (metadata.exif) {
          riskScore += 40;
        }
        if (req.file.size > 1024 * 1024) {
          riskScore += 15;
        }
      } else if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(fileBuffer);
        extractedMeta = {
          numpages: pdfData.numpages,
          textLength: pdfData.text.length
        };
        if (pdfData.numpages > 5) {
          riskScore += 25;
        }
      }
    } catch (parseErr) {
      console.log('Parser warning:', parseErr.message);
      riskScore += 30;
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    riskScore = Math.min(riskScore, 98);
    const statusText = riskScore > 40 ? 'Elevated Exposure / Metadata Risk' : 'Low Risk / Clean Asset';

    const logEntry = {
      id: Date.now().toString(),
      filename: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      sha256Hash: sha256,
      exposureRiskScore: `${riskScore}/100`,
      status: statusText,
      metadata: extractedMeta,
      timestamp: new Date()
    };

    scanHistory.push(logEntry);
    res.json({ success: true, ...logEntry });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Server error:', error);
    res.status(500).json({ error: 'Server processing error.' });
  }
});

const PORT = process.env.PORT || 5000;

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ShadowTrace Engine'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ShadowTrace Engine running on port ${PORT}`);
});