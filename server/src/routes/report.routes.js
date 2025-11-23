import express from 'express';
import {
  getDashboardStats,
  getAgentPerformance,
  getCampaignPerformance,
} from '../controllers/report.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'supervisor'));

router.get('/dashboard', getDashboardStats);
router.get('/agents', getAgentPerformance);
router.get('/campaigns', getCampaignPerformance);

export default router;
