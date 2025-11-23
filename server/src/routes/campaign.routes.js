import express from 'express';
import { body } from 'express-validator';
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignStats,
} from '../controllers/campaign.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCampaigns);
router.get('/:id', getCampaign);
router.get('/:id/stats', getCampaignStats);

router.post(
  '/',
  authorize('admin', 'supervisor'),
  [
    body('name').notEmpty().withMessage('Campaign name is required'),
  ],
  createCampaign
);

router.patch('/:id', authorize('admin', 'supervisor'), updateCampaign);
router.delete('/:id', authorize('admin'), deleteCampaign);

export default router;
