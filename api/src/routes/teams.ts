import { Router } from 'express';
import {
  createTeamSchema,
  inviteMembersSchema,
  joinTeamSchema,
  updateMemberRoleSchema,
  updateTeamSchema,
} from '@mlm/shared';
import * as teamController from '../controllers/teamController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = Router();

router.use(requireAuth);

// Teams
router.post('/', validateRequest(createTeamSchema), teamController.createTeam);
router.get('/', teamController.getTeams);
router.patch('/:id', validateRequest(updateTeamSchema), teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Members
router.get('/:id/members', teamController.getTeamMembers);
router.patch(
  '/:id/members/:userId',
  validateRequest(updateMemberRoleSchema),
  teamController.updateMemberRole,
);
router.delete('/:id/members/:targetUserId', teamController.removeMember);

// Invitations
router.post('/:id/invites', validateRequest(inviteMembersSchema), teamController.inviteMembers);
router.post('/join', validateRequest(joinTeamSchema), teamController.joinTeam);

export default router;
