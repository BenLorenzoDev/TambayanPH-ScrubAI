import express from 'express';
import { getUsers, getUser, updateUser, deleteUser, getAgentStats } from '../controllers/user.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'supervisor'), getUsers);
router.get('/stats/:id', getAgentStats);
router.get('/:id', getUser);
router.patch('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
