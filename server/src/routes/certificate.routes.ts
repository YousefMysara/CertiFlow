import { Router, Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { prisma } from '../lib/prisma.js';
import { generateCertificate, generatePreview, FieldConfig } from '../services/pdf.service.js';
import { parseCSV, validateCSVForCertificates, extractName, extractEmail } from '../services/csv.service.js';
import { processCertificateBatch } from '../services/job.service.js';
import { readFile } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';

const router = Router();

/**
 * Preview a certificate with sample data
 */
router.post('/preview', async (req: Request, res: Response) => {
    try {
        const { templateId, fieldConfigs, sampleData } = req.body;

        if (!templateId) {
            return res.status(400).json({ error: 'Template ID is required' });
        }

        const template = await prisma.certificateTemplate.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const configs: FieldConfig[] = fieldConfigs || JSON.parse(template.fieldConfigs);
        const pdfBuffer = await generatePreview(
            Buffer.from(template.templateData),
            configs,
            sampleData
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating preview:', error);
        res.status(500).json({ error: 'Failed to generate preview' });
    }
});

/**
 * Start batch certificate generation
 */
router.post('/generate', async (req: Request, res: Response) => {
    try {
        console.log('[Generate] Starting certificate generation');
        console.log('[Generate] req.files:', req.files ? Object.keys(req.files) : 'none');
        console.log('[Generate] req.body:', req.body);

        if (!req.files || !req.files.csv) {
            console.log('[Generate] No CSV file found in request');
            return res.status(400).json({ error: 'CSV file is required' });
        }

        const csvFile = req.files.csv as UploadedFile;
        console.log('[Generate] CSV file received:', csvFile.name, 'size:', csvFile.size);

        const { templateId, namingPattern, outputPath } = req.body;

        if (!templateId) {
            console.log('[Generate] No templateId');
            return res.status(400).json({ error: 'Template ID is required' });
        }

        if (!outputPath) {
            console.log('[Generate] No outputPath');
            return res.status(400).json({ error: 'Output path is required' });
        }

        // Verify template exists
        const template = await prisma.certificateTemplate.findUnique({
            where: { id: templateId },
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Parse CSV
        const parsedCSV = await parseCSV(csvFile.data);
        const validation = validateCSVForCertificates(parsedCSV);

        if (!validation.isValid) {
            return res.status(400).json({
                error: 'CSV validation failed',
                details: validation.errors,
                warnings: validation.warnings,
            });
        }

        // Create batch job
        const job = await prisma.batchJob.create({
            data: {
                type: 'certificate',
                status: 'pending',
                config: JSON.stringify({
                    templateId,
                    namingPattern: namingPattern || '{{sn}}_{{name}}',
                    outputPath,
                }),
                totalCount: parsedCSV.rows.length,
            },
        });

        // Create recipient records
        const recipients = parsedCSV.rows.map(row => ({
            batchJobId: job.id,
            email: extractEmail(row),
            fullName: extractName(row),
            extraFields: JSON.stringify(row),
        }));

        await prisma.recipient.createMany({
            data: recipients,
        });

        // Start processing in background
        processCertificateBatch(job.id).catch(err => {
            console.error('Batch processing error:', err);
        });

        res.status(201).json({
            jobId: job.id,
            totalRecipients: parsedCSV.rows.length,
            warnings: validation.warnings,
            message: 'Certificate generation started',
        });
    } catch (error) {
        console.error('Error starting certificate generation:', error);
        res.status(500).json({ error: 'Failed to start certificate generation' });
    }
});

/**
 * Download a single certificate
 */
router.get('/download/:recipientId', async (req: Request, res: Response) => {
    try {
        const recipient = await prisma.recipient.findUnique({
            where: { id: req.params.recipientId },
        });

        if (!recipient || !recipient.certificatePath) {
            return res.status(404).json({ error: 'Certificate not found' });
        }

        const pdfBuffer = await readFile(recipient.certificatePath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Certificate_${recipient.fullName}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error downloading certificate:', error);
        res.status(500).json({ error: 'Failed to download certificate' });
    }
});

/**
 * Download all certificates as ZIP
 */
router.get('/download-all/:jobId', async (req: Request, res: Response) => {
    try {
        const job = await prisma.batchJob.findUnique({
            where: { id: req.params.jobId },
            include: {
                recipients: {
                    where: { certificatePath: { not: null } },
                },
            },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="certificates_${job.id}.zip"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(res);

        for (const recipient of job.recipients) {
            if (recipient.certificatePath) {
                archive.file(recipient.certificatePath, {
                    name: `Certificate_${recipient.fullName}.pdf`
                });
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Error downloading certificates:', error);
        res.status(500).json({ error: 'Failed to download certificates' });
    }
});

export default router;
