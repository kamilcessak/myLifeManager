import { Router } from 'express';
import {
  createTeamSchema,
  inviteMembersSchema,
  joinTeamSchema,
} from 'shared';
import * as teamController from '../controllers/teamController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.use(requireAuth);

router.post('/', validateRequest(createTeamSchema), teamController.createTeam);
router.get('/', teamController.getTeams);
router.post('/:id/invites', validateRequest(inviteMembersSchema), teamController.inviteMembers);
router.post('/join', validateRequest(joinTeamSchema), teamController.joinTeam);

export default router;
