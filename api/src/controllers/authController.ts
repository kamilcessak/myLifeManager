import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { TeamRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { safeUnlink } from '../utils/safeUnlink.js';

const uploadsRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

/**
 * Resolve a stored `avatarUrl` back to a local filesystem path, if it points
 * into our `/uploads/...` area. Returns `null` for external URLs so we never
 * attempt to delete files we do not own.
 */
function resolveLocalAvatarPath(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;

  let pathname: string;
  try {
    pathname = new URL(avatarUrl).pathname;
  } catch {
    pathname = avatarUrl;
  }

  const marker = '/uploads/';
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;

  const relative = pathname.slice(idx + marker.length);
  if (!relative) return null;

  return path.join(uploadsRoot, relative);
}

// ---------------------------------------------------------------------------
// GET /api/auth/export - Export personal data (GDPR / RODO)
// ---------------------------------------------------------------------------

export async function exportUserData(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;

    const [user, tasks, events, categories] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.task.findMany({
        where: { userId, teamId: null },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.event.findMany({
        where: { userId, teamId: null },
        orderBy: { startTime: 'asc' },
      }),
      prisma.category.findMany({
        where: { userId, teamId: null },
        orderBy: { order: 'asc' },
      }),
    ]);

    if (!user) {
      throw new ApiError('Użytkownik nie istnieje', 404);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      user,
      personal: {
        tasks,
        events,
        categories,
      },
    };

    const filename = `mlm-export-${user.id}-${new Date().toISOString().slice(0, 10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (error) {
    next(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/auth/me - Permanently delete current account
// ---------------------------------------------------------------------------

export async function deleteUserAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;

    // 1) Collect every team where this user is an OWNER, including the full
    //    member list so we can tell "solo-owner teams" from "teams with other
    //    members" without issuing N additional queries.
    const ownerMemberships = await prisma.teamMember.findMany({
      where: { userId, role: TeamRole.OWNER },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    const blockingTeams: string[] = [];
    const soloTeamIds: string[] = [];

    for (const membership of ownerMemberships) {
      const totalMembers = membership.team.members.length;
      if (totalMembers > 1) {
        blockingTeams.push(membership.team.name);
      } else {
        soloTeamIds.push(membership.team.id);
      }
    }

    if (blockingTeams.length > 0) {
      throw new ApiError(
        `Nie możesz usunąć konta, ponieważ jesteś jedynym właścicielem w zespołach: ${blockingTeams
          .map((n) => `"${n}"`)
          .join(', ')}. Przekaż własność innemu członkowi lub usuń zespół.`,
        400,
      );
    }

    // 2) Grab the avatar path BEFORE deleting the user so we can clean it up
    //    after the DB transaction succeeds.
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const avatarLocalPath = resolveLocalAvatarPath(existingUser?.avatarUrl);

    // 3) Perform the actual destructive work atomically. Any "solo-owner" team
    //    is deleted explicitly (Team has no direct FK to the user, so cascade
    //    alone cannot remove it). Afterwards, deleting the user triggers
    //    Prisma `onDelete: Cascade` on tasks/events/categories/memberships.
    await prisma.$transaction(async (tx) => {
      if (soloTeamIds.length > 0) {
        await tx.team.deleteMany({ where: { id: { in: soloTeamIds } } });
      }
      await tx.user.delete({ where: { id: userId } });
    });

    // 4) Filesystem cleanup is best-effort and must never block the response.
    if (avatarLocalPath) {
      void safeUnlink(avatarLocalPath);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
