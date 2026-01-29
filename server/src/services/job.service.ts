import { prisma } from '../lib/prisma.js';
import { io } from '../app.js';
import { generateCertificate, FieldConfig } from './pdf.service.js';
import { sendEmail, renderEmailTemplate, sleep, GMAIL_LIMITS, SmtpSettings } from './email.service.js';
import { extractName, extractEmail, sanitizeFilename } from './csv.service.js';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export interface BatchJobConfig {
    templateId: string;
    namingPattern: string;  // e.g., "{{sn}}_{{name}}" or custom
    outputPath: string;
}

export interface EmailBatchConfig {
    emailTemplateId: string;
    smtpConfigId: string;
    subject: string;
    delayMs: number;
}

/**
 * Emit progress update via Socket.IO
 */
function emitProgress(jobId: string, processed: number, total: number, status: string) {
    io.to(`job-${jobId}`).emit('job-progress', {
        jobId,
        processed,
        total,
        percentage: Math.round((processed / total) * 100),
        status,
    });
}

/**
 * Generate filename based on pattern
 */
function generateFilename(pattern: string, data: Record<string, string>, index: number): string {
    let filename = pattern;

    // Replace {{sn}} with serial number
    filename = filename.replace(/\{\{sn\}\}/gi, String(index + 1).padStart(3, '0'));

    // Replace other placeholders
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        filename = filename.replace(regex, sanitizeFilename(value));
    }

    // Ensure .pdf extension
    if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
    }

    return filename;
}

/**
 * Process certificate generation batch job
 */
export async function processCertificateBatch(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
        where: { id: jobId },
        include: { recipients: true },
    });

    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    const config: BatchJobConfig = JSON.parse(job.config);

    // Get the certificate template
    const template = await prisma.certificateTemplate.findUnique({
        where: { id: config.templateId },
    });

    if (!template) {
        throw new Error(`Template ${config.templateId} not found`);
    }

    const fieldConfigs: FieldConfig[] = JSON.parse(template.fieldConfigs);

    // Update job status to processing
    await prisma.batchJob.update({
        where: { id: jobId },
        data: { status: 'processing' },
    });

    // Ensure output directory exists
    const outputDir = config.outputPath;
    if (!existsSync(outputDir)) {
        await mkdir(outputDir, { recursive: true });
    }

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Process each recipient
    for (let i = 0; i < job.recipients.length; i++) {
        const recipient = job.recipients[i];

        try {
            // Prepare data for certificate
            const data: Record<string, string> = {
                name: recipient.fullName,
                full_name: recipient.fullName,
                email: recipient.email,
                ...(recipient.extraFields ? JSON.parse(recipient.extraFields) : {}),
            };

            // Generate the certificate
            const pdfBuffer = await generateCertificate({
                templateBuffer: Buffer.from(template.templateData),
                data,
                fieldConfigs,
            });

            // Generate filename
            const filename = generateFilename(config.namingPattern, data, i);
            const filePath = join(outputDir, filename);

            // Save the certificate
            await writeFile(filePath, pdfBuffer);

            // Update recipient record
            await prisma.recipient.update({
                where: { id: recipient.id },
                data: { certificatePath: filePath },
            });

            successCount++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await prisma.recipient.update({
                where: { id: recipient.id },
                data: { errorMessage },
            });

            failedCount++;
        }

        processedCount++;

        // Update job progress
        await prisma.batchJob.update({
            where: { id: jobId },
            data: {
                processedCount,
                successCount,
                failedCount,
            },
        });

        // Emit progress
        emitProgress(jobId, processedCount, job.totalCount, 'processing');
    }

    // Mark job as completed
    await prisma.batchJob.update({
        where: { id: jobId },
        data: {
            status: failedCount === job.totalCount ? 'failed' : 'completed',
            completedAt: new Date(),
            outputPath: outputDir,
        },
    });

    emitProgress(jobId, processedCount, job.totalCount, 'completed');
}

/**
 * Process email sending batch job
 */
export async function processEmailBatch(jobId: string): Promise<void> {
    const job = await prisma.batchJob.findUnique({
        where: { id: jobId },
        include: { recipients: true },
    });

    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    const config: EmailBatchConfig = JSON.parse(job.config);

    // Get email template
    const emailTemplate = await prisma.emailTemplate.findUnique({
        where: { id: config.emailTemplateId },
    });

    if (!emailTemplate) {
        throw new Error(`Email template ${config.emailTemplateId} not found`);
    }

    // Get SMTP config
    const smtpConfig = await prisma.smtpConfig.findUnique({
        where: { id: config.smtpConfigId },
    });

    if (!smtpConfig) {
        throw new Error(`SMTP config ${config.smtpConfigId} not found`);
    }

    const smtpSettings: SmtpSettings = {
        host: smtpConfig.host,
        port: smtpConfig.port,
        username: smtpConfig.username,
        password: smtpConfig.passwordEncrypted,
        fromName: smtpConfig.fromName || undefined,
    };

    // Update job status
    await prisma.batchJob.update({
        where: { id: jobId },
        data: { status: 'processing' },
    });

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // Process each recipient
    for (const recipient of job.recipients) {
        // Skip if already sent
        if (recipient.emailStatus === 'sent') {
            processedCount++;
            successCount++;
            continue;
        }

        try {
            // Prepare template data
            const data: Record<string, string> = {
                name: recipient.fullName,
                full_name: recipient.fullName,
                email: recipient.email,
                ...(recipient.extraFields ? JSON.parse(recipient.extraFields) : {}),
            };

            // Render email content
            const htmlContent = renderEmailTemplate(emailTemplate.htmlContent, data);
            const subject = renderEmailTemplate(config.subject || emailTemplate.subject, data);

            // Prepare attachments
            const attachments = recipient.certificatePath
                ? [{ filename: `Certificate_${sanitizeFilename(recipient.fullName)}.pdf`, path: recipient.certificatePath }]
                : [];

            // Send email
            await sendEmail({
                to: recipient.email,
                subject,
                html: htmlContent,
                attachments,
                smtpSettings,
            });

            // Update recipient status
            await prisma.recipient.update({
                where: { id: recipient.id },
                data: {
                    emailStatus: 'sent',
                    sentAt: new Date(),
                    errorMessage: null,
                },
            });

            successCount++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            await prisma.recipient.update({
                where: { id: recipient.id },
                data: {
                    emailStatus: 'failed',
                    errorMessage,
                },
            });

            failedCount++;
        }

        processedCount++;

        // Update job progress
        await prisma.batchJob.update({
            where: { id: jobId },
            data: {
                processedCount,
                successCount,
                failedCount,
            },
        });

        // Emit progress
        emitProgress(jobId, processedCount, job.totalCount, 'processing');

        // Rate limiting delay
        if (processedCount < job.totalCount) {
            await sleep(config.delayMs || GMAIL_LIMITS.SAFE_DELAY_MS);
        }
    }

    // Mark job as completed
    await prisma.batchJob.update({
        where: { id: jobId },
        data: {
            status: failedCount === job.totalCount ? 'failed' : 'completed',
            completedAt: new Date(),
        },
    });

    emitProgress(jobId, processedCount, job.totalCount, 'completed');
}

/**
 * Retry failed recipients in a job
 */
export async function retryFailedRecipients(jobId: string): Promise<number> {
    const job = await prisma.batchJob.findUnique({
        where: { id: jobId },
        include: {
            recipients: {
                where: {
                    OR: [
                        { emailStatus: 'failed' },
                        { errorMessage: { not: null } },
                    ],
                },
            },
        },
    });

    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    // Reset failed recipients
    await prisma.recipient.updateMany({
        where: {
            batchJobId: jobId,
            OR: [
                { emailStatus: 'failed' },
                { errorMessage: { not: null } },
            ],
        },
        data: {
            emailStatus: 'pending',
            errorMessage: null,
        },
    });

    // Reset job counters
    const failedCount = job.recipients.length;
    await prisma.batchJob.update({
        where: { id: jobId },
        data: {
            status: 'pending',
            failedCount: 0,
            processedCount: job.processedCount - failedCount,
            completedAt: null,
        },
    });

    return failedCount;
}
