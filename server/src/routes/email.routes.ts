import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendEmail, testSmtpConnection, renderEmailTemplate, SmtpSettings, GMAIL_LIMITS } from '../services/email.service.js';
import { processEmailBatch } from '../services/job.service.js';

const router = Router();

/**
 * Preview rendered email with sample data
 */
router.post('/preview', async (req: Request, res: Response) => {
    try {
        const { templateId, htmlContent, sampleData } = req.body;

        let template: string;

        if (templateId) {
            const emailTemplate = await prisma.emailTemplate.findUnique({
                where: { id: templateId },
            });
            if (!emailTemplate) {
                return res.status(404).json({ error: 'Template not found' });
            }
            template = emailTemplate.htmlContent;
        } else if (htmlContent) {
            template = htmlContent;
        } else {
            return res.status(400).json({ error: 'Template ID or HTML content is required' });
        }

        const defaultData = {
            name: 'John Doe',
            email: 'john.doe@example.com',
            event_name: 'Web Development Workshop',
            date: new Date().toLocaleDateString(),
            ...sampleData,
        };

        const rendered = renderEmailTemplate(template, defaultData);

        res.json({ html: rendered });
    } catch (error) {
        console.error('Error previewing email:', error);
        res.status(500).json({ error: 'Failed to preview email' });
    }
});

/**
 * Send test email
 */
router.post('/test-send', async (req: Request, res: Response) => {
    try {
        const { to, subject, htmlContent, smtpConfigId } = req.body;

        if (!to || !subject || !htmlContent) {
            return res.status(400).json({ error: 'To, subject, and htmlContent are required' });
        }

        let smtpSettings: SmtpSettings;

        if (smtpConfigId) {
            const config = await prisma.smtpConfig.findUnique({
                where: { id: smtpConfigId },
            });
            if (!config) {
                return res.status(404).json({ error: 'SMTP config not found' });
            }
            smtpSettings = {
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.passwordEncrypted,
                fromName: config.fromName || undefined,
            };
        } else {
            // Use default SMTP
            const defaultConfig = await prisma.smtpConfig.findFirst({
                where: { isDefault: true },
            });
            if (!defaultConfig) {
                return res.status(400).json({ error: 'No SMTP configuration found. Please configure SMTP settings first.' });
            }
            smtpSettings = {
                host: defaultConfig.host,
                port: defaultConfig.port,
                username: defaultConfig.username,
                password: defaultConfig.passwordEncrypted,
                fromName: defaultConfig.fromName || undefined,
            };
        }

        await sendEmail({
            to,
            subject,
            html: htmlContent,
            smtpSettings,
        });

        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        console.error('Error sending test email:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: `Failed to send test email: ${errorMessage}` });
    }
});

/**
 * Start batch email sending
 */
router.post('/send-batch', async (req: Request, res: Response) => {
    try {
        const { certificateJobId, emailTemplateId, smtpConfigId, subject, delayMs } = req.body;

        if (!certificateJobId || !emailTemplateId || !smtpConfigId) {
            return res.status(400).json({
                error: 'Certificate job ID, email template ID, and SMTP config ID are required'
            });
        }

        // Verify certificate job exists and has recipients
        const certJob = await prisma.batchJob.findUnique({
            where: { id: certificateJobId },
            include: { recipients: true },
        });

        if (!certJob) {
            return res.status(404).json({ error: 'Certificate job not found' });
        }

        // Verify email template exists
        const emailTemplate = await prisma.emailTemplate.findUnique({
            where: { id: emailTemplateId },
        });

        if (!emailTemplate) {
            return res.status(404).json({ error: 'Email template not found' });
        }

        // Verify SMTP config exists
        const smtpConfig = await prisma.smtpConfig.findUnique({
            where: { id: smtpConfigId },
        });

        if (!smtpConfig) {
            return res.status(404).json({ error: 'SMTP config not found' });
        }

        // Create email batch job
        const emailJob = await prisma.batchJob.create({
            data: {
                type: 'email',
                status: 'pending',
                config: JSON.stringify({
                    emailTemplateId,
                    smtpConfigId,
                    subject: subject || emailTemplate.subject,
                    delayMs: delayMs || GMAIL_LIMITS.SAFE_DELAY_MS,
                }),
                totalCount: certJob.recipients.length,
            },
        });

        // Create recipient records for email job (linked to certificate recipients)
        const emailRecipients = certJob.recipients.map(r => ({
            batchJobId: emailJob.id,
            email: r.email,
            fullName: r.fullName,
            extraFields: r.extraFields,
            certificatePath: r.certificatePath,
        }));

        await prisma.recipient.createMany({
            data: emailRecipients,
        });

        // Start processing in background
        processEmailBatch(emailJob.id).catch(err => {
            console.error('Email batch processing error:', err);
        });

        res.status(201).json({
            jobId: emailJob.id,
            totalRecipients: certJob.recipients.length,
            estimatedTimeMinutes: Math.ceil((certJob.recipients.length * (delayMs || GMAIL_LIMITS.SAFE_DELAY_MS)) / 60000),
            message: 'Email sending started',
        });
    } catch (error) {
        console.error('Error starting email batch:', error);
        res.status(500).json({ error: 'Failed to start email batch' });
    }
});

/**
 * Get email sending statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const emailsSentToday = await prisma.recipient.count({
            where: {
                emailStatus: 'sent',
                sentAt: { gte: today },
            },
        });

        const settings = await prisma.appSettings.findUnique({
            where: { id: 'default' },
        });

        res.json({
            emailsSentToday,
            dailyLimit: settings?.maxEmailsPerDay || GMAIL_LIMITS.DAILY_LIMIT,
            remaining: Math.max(0, (settings?.maxEmailsPerDay || GMAIL_LIMITS.DAILY_LIMIT) - emailsSentToday),
        });
    } catch (error) {
        console.error('Error fetching email stats:', error);
        res.status(500).json({ error: 'Failed to fetch email stats' });
    }
});

export default router;
