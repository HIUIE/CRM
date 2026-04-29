import { dbRun } from './db.js';
import { logger } from './logger.js';
import { emitToUser } from './socket.js';

export async function createNotification(params: {
  userId: number;
  title: string;
  message?: string;
  link?: string;
}) {
  try {
    await dbRun(
      `
        INSERT INTO notifications (user_id, title, message, link)
        VALUES (?, ?, ?, ?)
      `,
      [params.userId, params.title, params.message || null, params.link || null]
    );

    // Emit real-time socket event
    emitToUser(params.userId, 'new-notification', {
      title: params.title,
      message: params.message,
      link: params.link
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to create notification');
  }
}

export async function notifyMention(userId: number, sourceName: string, entityType: string, entityId: string) {
  await createNotification({
    userId,
    title: `@提及提醒`,
    message: `${sourceName} 在 ${entityType} ${entityId} 中提及了你`,
    link: entityType === 'ORDER' ? `/orders/${entityId}` : `/customers/detail/${entityId}`
  });
}
