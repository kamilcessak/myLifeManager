import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from '../middleware/errorHandler.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}${ext}`);
  },
});

const maxBytes = 5 * 1024 * 1024;

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ok =
    file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  if (ok) {
    cb(null, true);
  } else {
    cb(new ApiError('Dozwolone są tylko obrazy i pliki PDF.', 400));
  }
};

export const attachmentsUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxBytes },
});
