import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

export const verifyTeamAccess = async (userId: string, teamId: string): Promise<void> => {
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });

  if (!membership) {
    throw new ApiError('Brak dostępu do zespołu', 403);
  }
};
