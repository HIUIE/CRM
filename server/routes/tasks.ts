import { Router } from 'express';
import { dbAll, dbGet, dbRun, withTransaction } from '../lib/db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString, readNumber, readPagination, buildLimitOffset } from '../lib/values.js';
import { createNotification, notifyMention } from '../lib/notifications.js';
import { logAction } from '../lib/audit.js';

type TaskAccessRow = {
  id: number;
  title: string;
  assignee_id: number;
  created_by: number | null;
};

async function loadAccessibleTask(taskId: number, user: AuthedRequest['user']) {
  const task = await dbGet<TaskAccessRow>(`SELECT id, title, assignee_id, created_by FROM tasks WHERE id = ?`, [taskId]);
  if (!task) {
    return { error: 'NOT_FOUND' as const };
  }
  if (user?.role === 'admin' || task.assignee_id === user?.id || task.created_by === user?.id) {
    return { task };
  }
  return { error: 'FORBIDDEN' as const };
}

export function createTasksRouter() {
  const router = Router();

  // Get tasks with filtering (Assigned to me, Delegated by me, All)
  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    const view = readString(req.query.view) || 'assigned'; // assigned, delegated, all
    const q = readString(req.query.q);
    const userId = req.user?.id;
    const role = req.user?.role;

    let whereSql = 'WHERE 1=1';
    const params: (string | number | null | undefined)[] = [];

    if (q) {
      whereSql += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      const p = `%${q}%`;
      params.push(p, p);
    }

    if (view === 'assigned') {
      whereSql += ' AND t.assignee_id = ?';
      params.push(userId);
    } else if (view === 'delegated') {
      whereSql += ' AND t.created_by = ? AND t.assignee_id != ?';
      params.push(userId, userId);
    } else if (view === 'all') {
      if (role !== 'admin') {
        whereSql += ' AND (t.assignee_id = ? OR t.created_by = ?)';
        params.push(userId, userId);
      }
      // admins see everything
    }

    try {
      const tasks = await dbAll(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        ${whereSql}
        ORDER BY 
          CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
          t.due_date ASC,
          t.created_at DESC
        ${buildLimitOffset(readPagination(req.query as Record<string, unknown>), params)}
      `, params);
      res.json(tasks);
    } catch (error) {
      return handleRouteError(res, error, '读取任务失败');
    }
  });

  // Get single task detail
  router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const taskId = Number(req.params.id);
    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === 'NOT_FOUND') return fail(res, 404, '任务不存在');
      if (access.error === 'FORBIDDEN') return fail(res, 403, '无权访问该任务', 'TASK_FORBIDDEN');

      const task = await dbGet(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?
      `, [taskId]);

      if (!task) return fail(res, 404, '任务不存在');

      const comments = await dbAll(`
        SELECT c.*, u.name as creator_name
        FROM task_comments c
        JOIN users u ON c.created_by = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at ASC
      `, [taskId]);

      if (comments.length > 0) {
        const commentIds = comments.map(c => c.id);
        const placeholders = commentIds.map(() => '?').join(',');
        const allAttachments = await dbAll(`
          SELECT a.*, ta.comment_id
          FROM attachments a
          JOIN task_attachments ta ON a.id = ta.attachment_id
          WHERE ta.comment_id IN (${placeholders})
        `, commentIds);

        const attsByCommentId: Record<number, any[]> = {};
        for (const att of allAttachments) {
          const cid = att.comment_id;
          if (!attsByCommentId[cid]) attsByCommentId[cid] = [];
          attsByCommentId[cid].push(att);
          delete att.comment_id;
        }

        for (const comment of comments) {
          comment.attachments = attsByCommentId[comment.id] || [];
        }
      } else {
        for (const comment of comments) {
          comment.attachments = [];
        }
      }

      res.json({ ...task, comments });
    } catch (error) {
      return handleRouteError(res, error, '读取任务详情失败');
    }
  });

  // Add comment to task
  router.post('/:id/comments', requireAuth, async (req: AuthedRequest, res) => {
    const taskId = Number(req.params.id);
    const content = readString(req.body?.content);

    if (!content) return fail(res, 400, '请输入评论内容');

    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === 'NOT_FOUND') return fail(res, 404, '任务不存在');
      if (access.error === 'FORBIDDEN') return fail(res, 403, '无权访问该任务', 'TASK_FORBIDDEN');
      const task = access.task;
      const mentionedUserIds = new Set<number>();
      let shouldNotifyAssignee = false;

      await withTransaction(async (tx) => {
        const result = await tx.run(
          `INSERT INTO task_comments (task_id, content, created_by) VALUES (?, ?, ?)`,
          [taskId, content, req.user?.id]
        );

        const commentId = result.lastID;

        const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : [];
        if (attachmentIds.length > 0) {
          for (const aid of attachmentIds) {
            await tx.run(
              `INSERT INTO task_attachments (task_id, attachment_id, comment_id) VALUES (?, ?, ?)`,
              [taskId, aid, commentId]
            );
          }
          await tx.run(`UPDATE tasks SET attachment_count = attachment_count + ? WHERE id = ?`, [attachmentIds.length, taskId]);
        }

        await tx.run(`UPDATE tasks SET comment_count = comment_count + 1 WHERE id = ?`, [taskId]);

        // Parse mentions like @Carlos
        const mentions = content.match(/@([^ ]+)/g);
        if (mentions) {
          for (const m of mentions) {
            const name = m.slice(1);
            const mentionedUser = await tx.get<{ id: number }>(`SELECT id FROM users WHERE name = ?`, [name]);
            if (mentionedUser && mentionedUser.id !== req.user?.id) {
              mentionedUserIds.add(mentionedUser.id);
            }
          }
        }

        // Notify assignee if someone else comments
        if (task.assignee_id !== req.user?.id) {
          shouldNotifyAssignee = true;
        }
      });

      for (const mentionedUserId of mentionedUserIds) {
        await notifyMention(mentionedUserId, req.user?.name || '有人', 'TASK', String(taskId));
      }
      if (shouldNotifyAssignee) {
        await createNotification({
          userId: task.assignee_id,
          title: '任务有新进展',
          message: `${req.user?.name} 在任务“${task.title}”中发表了评论`,
          link: `/tasks?detail=${taskId}`
        });
      }
      res.status(201).json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '发表评论失败');
    }
  });

  // Create task
  router.post('/', requireAuth, async (req: AuthedRequest, res) => {
    const title = readString(req.body?.title);
    const assigneeId = readNumber(req.body?.assigneeId);
    const dueDate = readString(req.body?.dueDate);
    const priority = readString(req.body?.priority) || 'P2';
    const entityType = readString(req.body?.entityType);
    const entityId = readString(req.body?.entityId);
    const description = readString(req.body?.description);

    if (!title || !assigneeId || !dueDate) {
      return fail(res, 400, '请完整填写任务标题、负责人和截止日期', 'INVALID_TASK_PAYLOAD');
    }

    try {
      const result = await dbRun(`
        INSERT INTO tasks (title, assignee_id, due_date, priority, entity_type, entity_id, description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, assigneeId, dueDate, priority, entityType?.toUpperCase(), entityId, description, req.user?.id]);

      const taskId = result.lastID;

      if (assigneeId !== req.user?.id) {
        await createNotification({
          userId: assigneeId,
          title: '收到新派发任务',
          message: `${req.user?.name} 指派给你一个新任务：${title}`,
          link: `/tasks?detail=${taskId}`
        });
      }

      await logAction({
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        action: 'CREATE',
        entityType: 'TASK',
        entityId: taskId,
        newValue: req.body
      });

      res.status(201).json({ id: taskId });
    } catch (error) {
      return handleRouteError(res, error, '创建任务失败');
    }
  });

  // Update task status
  router.patch('/:id/status', requireAuth, async (req: AuthedRequest, res) => {
    const taskId = Number(req.params.id);
    const status = readString(req.body?.status);

    if (!['todo', 'in_progress', 'done'].includes(status)) {
      return fail(res, 400, '无效的状态值', 'INVALID_STATUS');
    }

    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === 'NOT_FOUND') return fail(res, 404, '任务不存在');
      if (access.error === 'FORBIDDEN') return fail(res, 403, '无权访问该任务', 'TASK_FORBIDDEN');
      await dbRun(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, taskId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新任务状态失败');
    }
  });

  // Update task metadata
  router.patch('/:id', requireAuth, async (req: AuthedRequest, res) => {
    const taskId = Number(req.params.id);
    const assigneeId = readNumber(req.body?.assigneeId);
    const dueDate = readString(req.body?.dueDate);
    const priority = readString(req.body?.priority);
    const title = readString(req.body?.title);

    try {
      const access = await loadAccessibleTask(taskId, req.user);
      if (access.error === 'NOT_FOUND') return fail(res, 404, '任务不存在');
      if (access.error === 'FORBIDDEN') return fail(res, 403, '无权访问该任务', 'TASK_FORBIDDEN');
      await dbRun(`
        UPDATE tasks 
        SET assignee_id = COALESCE(?, assignee_id),
            due_date = COALESCE(?, due_date),
            priority = COALESCE(?, priority),
            title = COALESCE(?, title),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [assigneeId, dueDate, priority, title, taskId]);
      res.json({ success: true });
    } catch (error) {
      return handleRouteError(res, error, '更新任务失败');
    }
  });

  return router;
}
