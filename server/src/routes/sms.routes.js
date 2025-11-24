import express from 'express';
import {
  sendSMS,
  getSMSHistory,
  getSMSStatus,
} from '../controllers/sms.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.post('/send', sendSMS);
router.get('/status', getSMSStatus);
router.get('/history/:leadId', getSMSHistory);

export default router;
