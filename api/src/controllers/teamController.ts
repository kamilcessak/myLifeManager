import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { InvitationStatus, TeamRole } from '@prisma/client';
import { prisma } from '../config/database.js';
import { ApiError } from '../middleware/errorHandler.js';
import { verifyTeamAccess } from '../utils/teamAccess.js';

const INVITE_EXPIRY_DAYS = 7;

function generateInviteCode(): string {
  return randomBytes(4).toString('hex');
}

export async function createTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name } = req.body as { name: string };
    const userId = req.user!.id;

    const team = await prisma.team.create({
      data: {
        name,
        members: {
          create: {
            userId,
            role: TeamRole.OWNER,
          },
        },
        categories: {
          create: {
            name: 'Ogólne',
            color: '#64748B',
            icon: 'folder-kanban',
            userId,
            isDefault: true,
            order: 0,
          },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: { team },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeamMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teamId = req.params.id;
    const userId = req.user!.id;

    await verifyTeamAccess(userId, teamId);

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    res.json({
      status: 'success',
      data: { members },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTeams(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      include: { team: true },
      orderBy: { joinedAt: 'asc' },
    });

    const teams = memberships.map((m) => ({
      ...m.team,
      myRole: m.role,
      memberSince: m.joinedAt,
    }));

    res.json({
      status: 'success',
      data: { teams },
    });
  } catch (error) {
    next(error);
  }
}

export async function inviteMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const teamId = req.params.id;
    const { emails } = req.body as { emails: string[] };
    const userId = req.user!.id;

    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId, userId },
      },
    });

    if (!membership || membership.role !== TeamRole.OWNER) {
      throw new ApiError('Tylko właściciel zespołu może wysyłać zaproszenia', 403);
    }

    const uniqueEmails: string[] = [];
    const seen = new Set<string>();
    for (const raw of emails) {
      const email = raw.trim();
      const key = email.toLowerCase();
      if (!email || seen.has(key)) continue;
      seen.add(key);
      uniqueEmails.push(email);
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invitations = await prisma.$transaction(async (tx) => {
      const created: Awaited<ReturnType<typeof tx.teamInvitation.create>>[] = [];

      for (const email of uniqueEmails) {
        let invitation = null;
        for (let attempt = 0; attempt < 8 && !invitation; attempt++) {
          const code = generateInviteCode();
          try {
            invitation = await tx.teamInvitation.create({
              data: {
                teamId,
                email,
                code,
                status: InvitationStatus.PENDING,
                expiresAt,
              },
            });
          } catch (err: unknown) {
            const code =
              typeof err === 'object' && err !== null && 'code' in err ? (err as { code?: string }).code : undefined;
            if (code === 'P2002') {
              continue;
            }
            throw err;
          }
        }
        if (!invitation) {
          throw new ApiError('Nie udało się wygenerować unikalnego kodu zaproszenia', 500);
        }
        created.push(invitation);
      }

      return created;
    });

    res.status(201).json({
      status: 'success',
      data: { invitations },
    });
  } catch (error) {
    next(error);
  }
}

export async function joinTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.body as { code: string };
    const userId = req.user!.id;

    const invitation = await prisma.teamInvitation.findFirst({
      where: {
        code,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new ApiError('Nieprawidłowy lub wygasły kod zaproszenia', 400);
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: invitation.teamId, userId },
      },
    });

    if (existingMember) {
      throw new ApiError('Należysz już do tego zespołu', 400);
    }

    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId,
          role: TeamRole.MEMBER,
        },
      }),
      prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        teamId: invitation.teamId,
        message: 'Successfully joined the team',
      },
    });
  } catch (error) {
    next(error);
  }
}
