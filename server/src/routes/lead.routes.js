import express from 'express';
import { body } from 'express-validator';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  getNextLead,
  addNote,
} from '../controllers/lead.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

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

export default router;
