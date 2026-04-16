import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Ensures a category exists and belongs to the same workspace (personal vs team).
 * For team workspaces, the caller must already have verified team membership.
 */
export async function ensureCategoryMatchesWorkspace(
  userId: string,
  categoryId: string,
  workspaceTeamId: string | null,
): Promise<void> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ApiError('Category not found', 400);
  }
  if (workspaceTeamId) {
    if (category.teamId !== workspaceTeamId) {
      throw new ApiError('Category does not belong to this team', 400);
    }
  } else if (category.userId !== userId || category.teamId !== null) {
    throw new ApiError('Category not found', 400);
  }
}
