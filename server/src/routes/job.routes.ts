import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { retryFailedRecipients } from '../services/job.service.js';

const router = Router();

/**
 * Get all jobs
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { type, status } = req.query;

        const jobs = await prisma.batchJob.findMany({
            where: {
                ...(type && { type: type as string }),
                ...(status && { status: status as string }),
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        res.json(jobs.map(job => ({
            ...job,
            config: JSON.parse(job.config),
        })));
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

/**
 * Get a specific job with recipients
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const job = await prisma.batchJob.findUnique({
            where: { id: req.params.id },
            include: {
                recipients: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({
            ...job,
            config: JSON.parse(job.config),
            recipients: job.recipients.map(r => ({
                ...r,
                extraFields: r.extraFields ? JSON.parse(r.extraFields) : null,
            })),
        });
    } catch (error) {
        console.error('Error fetching job:', error);
        res.status(500).json({ error: 'Failed to fetch job' });
    }
});

/**
 * Get job progress (lightweight endpoint for polling)
 */
router.get('/:id/progress', async (req: Request, res: Response) => {
    try {
        const job = await prisma.batchJob.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                status: true,
                totalCount: true,
                processedCount: true,
                successCount: true,
                failedCount: true,
                completedAt: true,
            },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json({
            ...job,
            percentage: job.totalCount > 0
                ? Math.round((job.processedCount / job.totalCount) * 100)
                : 0,
        });
    } catch (error) {
        console.error('Error fetching job progress:', error);
        res.status(500).json({ error: 'Failed to fetch job progress' });
    }
});

/**
 * Get recipients for a job with pagination
 */
router.get('/:id/recipients', async (req: Request, res: Response) => {
    try {
        const { page = '1', limit = '50', status } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

        const where = {
            batchJobId: req.params.id,
            ...(status && { emailStatus: status as string }),
        };

        const [recipients, total] = await Promise.all([
            prisma.recipient.findMany({
                where,
                skip,
                take: parseInt(limit as string),
                orderBy: { createdAt: 'asc' },
            }),
            prisma.recipient.count({ where }),
        ]);

        res.json({
            recipients: recipients.map(r => ({
                ...r,
                extraFields: r.extraFields ? JSON.parse(r.extraFields) : null,
            })),
            pagination: {
                page: parseInt(page as string),
                limit: parseInt(limit as string),
                total,
                totalPages: Math.ceil(total / parseInt(limit as string)),
            },
        });
    } catch (error) {
        console.error('Error fetching job recipients:', error);
        res.status(500).json({ error: 'Failed to fetch recipients' });
    }
});

/**
 * Retry failed recipients
 */
router.post('/:id/retry-failed', async (req: Request, res: Response) => {
    try {
        const retriedCount = await retryFailedRecipients(req.params.id);

        res.json({
            success: true,
            retriedCount,
            message: `${retriedCount} recipient(s) queued for retry`,
        });
    } catch (error) {
        console.error('Error retrying failed recipients:', error);
        res.status(500).json({ error: 'Failed to retry recipients' });
    }
});

/**
 * Cancel a running job
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
        const job = await prisma.batchJob.update({
            where: { id: req.params.id },
            data: { status: 'cancelled' },
        });

        res.json({
            success: true,
            message: 'Job cancelled',
            job: {
                ...job,
                config: JSON.parse(job.config),
            },
        });
    } catch (error) {
        console.error('Error cancelling job:', error);
        res.status(500).json({ error: 'Failed to cancel job' });
    }
});

/**
 * Delete a job and its recipients
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await prisma.batchJob.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
});

export default router;
