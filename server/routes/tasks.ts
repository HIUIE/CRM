import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, type AuthedRequest } from '../lib/auth.js';
import { fail, handleRouteError } from '../lib/http.js';
import { readString, readNumber } from '../lib/values.js';
import { createNotification, notifyMention } from '../lib/notifications.js';
import { logAction } from '../lib/audit.js';

export function createTasksRouter() {
  const router = Router();

  // Get tasks with filtering (Assigned to me, Delegated by me, All)
  router.get('/', requireAuth, async (req: AuthedRequest, res) => {
    const view = readString(req.query.view) || 'assigned'; // assigned, delegated, all
    const userId = req.user?.id;
    const role = req.user?.role;

    let whereSql = 'WHERE 1=1';
    const params: any[] = [];

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
      const tasks = await db.all(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        ${whereSql}
        ORDER BY 
          CASE WHEN t.status = 'done' THEN 1 ELSE 0 END,
          t.due_date ASC,
          t.created_at DESC
      `, params);
      res.json(tasks);
    } catch (error) {
      return handleRouteError(res, error, '读取任务失败');
    }
  });

  // Get single task detail
  router.get('/:id', requireAuth, async (req, res) => {
    const taskId = Number(req.params.id);
    try {
      const task = await db.get(`
        SELECT t.*, u.name as assignee_name, u2.name as creator_name
        FROM tasks t
        JOIN users u ON t.assignee_id = u.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?
      `, [taskId]);

      if (!task) return fail(res, 404, '任务不存在');

      const comments = await db.all(`
        SELECT c.*, u.name as creator_name
        FROM task_comments c
        JOIN users u ON c.created_by = u.id
        WHERE c.task_id = ?
        ORDER BY c.created_at ASC
      `, [taskId]);

      for (const comment of comments) {
        const atts = await db.all(`
          SELECT a.*
          FROM attachments a
          JOIN task_attachments ta ON a.id = ta.attachment_id
          WHERE ta.comment_id = ?
        `, [comment.id]);
        comment.attachments = atts;
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
      const task = await db.get(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
      if (!task) return fail(res, 404, '任务不存在');

      await db.run('BEGIN TRANSACTION');

      const result = await db.run(
        `INSERT INTO task_comments (task_id, content, created_by) VALUES (?, ?, ?)`,
        [taskId, content, req.user?.id]
      );

      const commentId = result.lastID;

      const attachmentIds = Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : [];
      if (attachmentIds.length > 0) {
        for (const aid of attachmentIds) {
          await db.run(
            `INSERT INTO task_attachments (task_id, attachment_id, comment_id) VALUES (?, ?, ?)`,
            [taskId, aid, commentId]
          );
        }
        await db.run(`UPDATE tasks SET attachment_count = attachment_count + ? WHERE id = ?`, [attachmentIds.length, taskId]);
      }

      await db.run(`UPDATE tasks SET comment_count = comment_count + 1 WHERE id = ?`, [taskId]);

      // Parse mentions like @Carlos
      const mentions = content.match(/@([^ ]+)/g);
      if (mentions) {
        for (const m of mentions) {
          const name = m.slice(1);
          const mentionedUser = await db.get(`SELECT id FROM users WHERE name = ?`, [name]);
          if (mentionedUser && mentionedUser.id !== req.user?.id) {
            await notifyMention(mentionedUser.id, req.user?.name || '有人', 'TASK', String(taskId));
          }
        }
      }

      // Notify assignee if someone else comments
      if (task.assignee_id !== req.user?.id) {
         await createNotification({
           userId: task.assignee_id,
           title: '任务有新进展',
           message: `${req.user?.name} 在任务“${task.title}”中发表了评论`,
           link: `/tasks?detail=${taskId}`
         });
      }

      await db.run('COMMIT');
      res.status(201).json({ success: true });
    } catch (error) {
      await db.run('ROLLBACK');
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
      const result = await db.run(`
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
        entityType: 'ORDER', // Tasks are part of order/customer context
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
      await db.run(`UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, taskId]);
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
      await db.run(`
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
