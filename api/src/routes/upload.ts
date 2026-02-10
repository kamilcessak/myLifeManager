import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadsDir, req.user!.id);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.', 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
  },
});

// All routes require authentication
router.use(requireAuth);

// POST /api/upload - Upload single image
router.post('/', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new ApiError('No file uploaded', 400);
    }

    const baseUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`;
    const imageUrl = `${baseUrl}/uploads/${req.user!.id}/${req.file.filename}`;

    res.status(201).json({
      status: 'success',
      data: {
        imageUrl,
        filename: req.file.filename,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/upload/:filename - Delete uploaded image
router.delete('/:filename', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = path.join(uploadsDir, req.user!.id, req.params.filename);

    if (!fs.existsSync(filePath)) {
      throw new ApiError('File not found', 404);
    }

    fs.unlinkSync(filePath);

    res.json({
      status: 'success',
      message: 'File deleted',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
