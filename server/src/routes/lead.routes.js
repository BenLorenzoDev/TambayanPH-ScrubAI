import express from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import path from 'path';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  getNextLead,
  addNote,
  importLeadsFromFile,
} from '../controllers/lead.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.use(protect);

router.get('/', getLeads);
router.get('/next/:campaignId', getNextLead);
router.get('/:id', getLead);

router.post(
  '/',
  authorize('admin', 'supervisor'),
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('campaign').notEmpty().withMessage('Campaign ID is required'),
  ],
  createLead
);

router.patch('/:id', updateLead);
router.delete('/:id', authorize('admin', 'supervisor'), deleteLead);
router.post('/:id/notes', addNote);

// Import leads from file
router.post(
  '/import',
  authorize('admin', 'supervisor'),
  upload.single('file'),
  importLeadsFromFile
);

export default router;
