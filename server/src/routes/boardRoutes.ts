import { Router } from 'express';
import { BoardController } from '../controllers/boardController.js';
import { requireAuth } from '../middleware/auth.js';

const controller = new BoardController();
const router = Router();
router.use(requireAuth);

router.post('/', controller.create);
router.post('/share/accept', controller.acceptShareToken);
router.get('/', controller.list);
router.get('/:boardId', controller.get);
router.patch('/:boardId', controller.update);
router.delete('/:boardId', controller.delete);
router.get('/:boardId/objects', controller.listObjects);
router.get('/:boardId/history', controller.history);
router.put('/:boardId/objects', controller.saveDocument);
router.post('/:boardId/objects', controller.createObject);
router.patch('/:boardId/objects/:objectId', controller.updateObject);
router.delete('/:boardId/objects/:objectId', controller.deleteObject);
router.get('/:boardId/members', controller.listMembers);
router.post('/:boardId/members', controller.addMember);
router.patch('/:boardId/members/:userId', controller.updateMember);
router.delete('/:boardId/members/:userId', controller.deleteMember);
router.post('/:boardId/share', controller.createShareToken);

export default router;