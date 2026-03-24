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

    const [tasks, events] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId: req.user!.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          deadline: true,
          scheduledStart: true,
          createdAt: true,
        },
        take: 10,
      }),
      prisma.event.findMany({
        where: {
          userId: req.user!.id,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          startTime: true,
          createdAt: true,
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
    }));

    const normalizedEvents: SearchResultItem[] = events.map((event) => ({
      id: event.id,
      type: "event",
      title: event.title,
      description: event.description,
      date: event.startTime ?? event.createdAt,
    }));

    const results = [...normalizedTasks, ...normalizedEvents]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        date: item.date.toISOString(),
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
