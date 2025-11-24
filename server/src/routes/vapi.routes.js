import express from 'express';
import {
  createVapiCall,
  getCallStatus,
  endCall,
  listenToCall,
  whisperToCall,
  bargeIntoCall,
  transferCall,
  controlAssistant,
  getCallTranscript,
  getActiveCalls,
  handleVapiWebhook,
} from '../controllers/vapi.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Webhook endpoint (no auth required - VAPI will call this)
router.post('/webhook', handleVapiWebhook);

// Protected routes
router.use(protect);

// Agent routes
router.post('/call', createVapiCall);
router.get('/call/:callId', getCallStatus);
router.post('/call/:callId/end', endCall);
router.get('/call/:callId/transcript', getCallTranscript);
router.get('/call/:callId/listen', listenToCall);
router.post('/call/:callId/whisper', whisperToCall);
router.post('/call/:callId/barge', bargeIntoCall);
router.post('/call/:callId/transfer', transferCall);
router.post('/call/:callId/control', controlAssistant);

// Supervisor/Admin routes for call control
router.use(authorize('admin', 'supervisor'));
router.get('/calls/active', getActiveCalls);

export default router;
