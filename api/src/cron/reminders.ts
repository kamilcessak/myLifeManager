import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { webpush } from '../config/webpush.js';

async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      ),
    ),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      const statusCode = (result.reason as any)?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.delete({ where: { id: subscriptions[i].id } }).catch(() => {});
      }
    }
  }
}

function isWithinWindow(targetTime: Date, now: Date): boolean {
  const diff = targetTime.getTime() - now.getTime();
  return diff >= -30_000 && diff <= 30_000;
}

function getReminderLabel(minutes: number): string {
  if (minutes === 0) return 'Teraz';
  if (minutes < 60) return `za ${minutes} min`;
  if (minutes === 60) return 'za 1 godzinę';
  if (minutes === 1440) return 'za 1 dzień';
  const hours = Math.floor(minutes / 60);
  return `za ${hours} godz.`;
}

async function checkUpcomingReminders() {
  const now = new Date();

  const [tasks, events] = await Promise.all([
    prisma.task.findMany({
      where: {
        isCompleted: false,
        reminderMinutes: { not: null },
        reminderSent: false,
        OR: [
          { scheduledStart: { not: null } },
          { deadline: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        userId: true,
        assigneeId: true,
        teamId: true,
        scheduledStart: true,
        deadline: true,
        reminderMinutes: true,
      },
    }),
    prisma.event.findMany({
      where: {
        reminderMinutes: { not: null },
        reminderSent: false,
        startTime: { gte: new Date(now.getTime() - 60_000) },
      },
      select: {
        id: true,
        title: true,
        userId: true,
        teamId: true,
        startTime: true,
        reminderMinutes: true,
      },
    }),
  ]);

  let sentCount = 0;

  for (const task of tasks) {
    try {
      if (task.reminderMinutes == null) continue;
      const refTime = task.scheduledStart ?? task.deadline;
      if (!refTime) continue;

      const reminderTime = new Date(refTime.getTime() - task.reminderMinutes * 60_000);
      if (!isWithinWindow(reminderTime, now)) continue;

      // If the task has an assignee, notify them; otherwise fall back to the creator.
      const targetUserId = task.assigneeId ?? task.userId;

      const label = task.scheduledStart ? 'Zadanie' : 'Deadline';
      await sendPushToUser(targetUserId, {
        title: `${label} ${getReminderLabel(task.reminderMinutes)}`,
        body: task.title,
        url: '/',
      });

      await prisma.task.update({ where: { id: task.id }, data: { reminderSent: true } });
      sentCount++;
    } catch (err) {
      console.error(`❌ Failed to send reminder for task ${task.id}:`, err);
    }
  }

  for (const event of events) {
    try {
      if (event.reminderMinutes == null) continue;

      const reminderTime = new Date(event.startTime.getTime() - event.reminderMinutes * 60_000);
      if (!isWithinWindow(reminderTime, now)) continue;

      // Events don't have assignees in the current model — notify the creator.
      const targetUserId = event.userId;

      await sendPushToUser(targetUserId, {
        title: `Wydarzenie ${getReminderLabel(event.reminderMinutes)}`,
        body: event.title,
        url: '/',
      });

      await prisma.event.update({ where: { id: event.id }, data: { reminderSent: true } });
      sentCount++;
    } catch (err) {
      console.error(`❌ Failed to send reminder for event ${event.id}:`, err);
    }
  }

  if (sentCount > 0) {
    console.log(`🔔 Sent ${sentCount} reminder(s).`);
  }
}

export function startReminderCron() {
  if (!process.env.PUBLIC_VAPID_KEY || !process.env.PRIVATE_VAPID_KEY) {
    console.log('⏭️  Reminder cron skipped — VAPID keys not configured.');
    return;
  }

  cron.schedule('* * * * *', () => {
    checkUpcomingReminders().catch((err) => {
      console.error('❌ Reminder cron error:', err);
    });
  });

  console.log('⏰ Reminder cron started (every minute).');
}
