import express from 'express';
import {
  getCalls,
  getCall,
  initiateCall,
  endCall,
  transferCall,
  getActiveCalls,
  updateCallDisposition,
} from '../controllers/call.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCalls);
router.get('/active', authorize('admin', 'supervisor'), getActiveCalls);
router.get('/:id', getCall);

router.post('/initiate', initiateCall);
router.post('/:id/end', endCall);
router.post('/:id/transfer', transferCall);
router.patch('/:id/disposition', updateCallDisposition);

export default router;
