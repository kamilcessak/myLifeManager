import { Router, Request, Response } from "express";
import { prisma } from "../config/database.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

type SearchResultItem = {
  id: string;
  type: "task" | "event";
  title: string;
  description: string | null;
  date: Date;
  teamId: string | null;
  teamName: string | undefined;
};

// GET /api/search?q=term
router.get("/", async (req: Request, res: Response) => {
  try {
    const rawQuery = typeof req.query.q === "string" ? req.query.q : "";
    const q = rawQuery.trim();

    if (!q) {
      return res.json({
        status: "success",
        data: { results: [] },
      });
    }

    const userId = req.user!.id;

    // TASK 1: Fetch all team IDs the current user belongs to.
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const userTeamIds: string[] = teamMemberships.map((m) => m.teamId);

    // Workspace isolation:
    //   (userId = currentUser.id AND teamId IS NULL)  -- personal items
    //   OR teamId IN userTeamIds                      -- items in shared teams
    const workspaceFilter = {
      OR: [
        { userId, teamId: null },
        ...(userTeamIds.length > 0
          ? [{ teamId: { in: userTeamIds } }]
          : []),
      ],
    };

    const textFilter = {
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    };

    // TASK 2: findMany with combined workspace + text filters.
    const [tasks, events] = await Promise.all([
      prisma.task.findMany({
        where: {
          AND: [workspaceFilter, textFilter],
        },
        select: {
          id: true,
          title: true,
          description: true,
          deadline: true,
          scheduledStart: true,
          createdAt: true,
          teamId: true,
          team: { select: { name: true } },
        },
        take: 10,
      }),
      prisma.event.findMany({
        where: {
          AND: [workspaceFilter, textFilter],
        },
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          createdAt: true,
          teamId: true,
          team: { select: { name: true } },
        },
        take: 10,
      }),
    ]);

    const normalizedTasks: SearchResultItem[] = tasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      description: task.description,
      date: task.scheduledStart ?? task.deadline ?? task.createdAt,
      teamId: task.teamId,
      teamName: task.team?.name,
    }));

    const normalizedEvents: SearchResultItem[] = events.map((event) => ({
      id: event.id,
      type: "event",
      title: event.title,
      description: event.description,
      date: event.startTime ?? event.createdAt,
      teamId: event.teamId,
      teamName: event.team?.name,
    }));

    // TASK 3: Combine, sort by date desc, cap at 10, serialize.
    const results = [...normalizedTasks, ...normalizedEvents]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        date: item.date.toISOString(),
        teamId: item.teamId,
        teamName: item.teamName,
      }));

    return res.json({
      status: "success",
      data: { results },
    });
  } catch (error) {
    console.error("Search endpoint error:", error);
    return res.status(500).json({
      status: "error",
      message: "Search failed",
    });
  }
});

export default router;
