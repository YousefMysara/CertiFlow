import { Router, Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { prisma } from '../lib/prisma.js';
import { getTemplateInfo } from '../services/pdf.service.js';

const router = Router();

/**
 * Upload a new certificate template
 */
router.post('/certificate', async (req: Request, res: Response) => {
    try {
        console.log('[Upload] Received upload request');
        console.log('[Upload] req.files:', req.files ? Object.keys(req.files) : 'none');

        if (!req.files || !req.files.template) {
            return res.status(400).json({ error: 'No template file uploaded' });
        }

        const file = req.files.template as UploadedFile;

        console.log('[Upload] File name:', file.name);
        console.log('[Upload] File mimetype:', file.mimetype);
        console.log('[Upload] File size:', file.size);
        console.log('[Upload] File data type:', typeof file.data);
        console.log('[Upload] File data is Buffer:', Buffer.isBuffer(file.data));
        console.log('[Upload] File data length:', file.data?.length);

        // Validate file type
        if (!file.mimetype.includes('pdf')) {
            return res.status(400).json({ error: 'Only PDF files are allowed' });
        }

        const name = req.body.name || file.name.replace('.pdf', '');
        const fieldConfigs = req.body.fieldConfigs || '[]';

        // Get template info (optional - don't fail if parsing fails)
        const templateBuffer = file.data;
        console.log('[Upload] templateBuffer length:', templateBuffer?.length);

        let info = { pageCount: 1, width: 842, height: 595 }; // Default A4 landscape
        try {
            info = await getTemplateInfo(templateBuffer);
        } catch (parseError) {
            console.warn('Could not parse PDF for dimensions, using defaults:', parseError);
        }

        // Save to database
        console.log('[Upload] Saving to database with buffer length:', templateBuffer?.length);
        const template = await prisma.certificateTemplate.create({
            data: {
                name,
                templateData: templateBuffer,
                fieldConfigs,
            },
        });

        console.log('[Upload] Template created with id:', template.id);

        res.status(201).json({
            id: template.id,
            name: template.name,
            ...info,
            createdAt: template.createdAt,
        });
    } catch (error) {
        console.error('Error uploading certificate template:', error);
        res.status(500).json({ error: 'Failed to upload template' });
    }
});

/**
 * Get all certificate templates
 */
router.get('/certificate', async (req: Request, res: Response) => {
    try {
        const templates = await prisma.certificateTemplate.findMany({
            select: {
                id: true,
                name: true,
                fieldConfigs: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json(templates);
    } catch (error) {
        console.error('Error fetching certificate templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * Get a specific certificate template
 */
router.get('/certificate/:id', async (req: Request, res: Response) => {
    try {
        const template = await prisma.certificateTemplate.findUnique({
            where: { id: req.params.id },
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const info = await getTemplateInfo(Buffer.from(template.templateData));

        res.json({
            id: template.id,
            name: template.name,
            fieldConfigs: JSON.parse(template.fieldConfigs),
            ...info,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
        });
    } catch (error) {
        console.error('Error fetching certificate template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

/**
 * Get certificate template PDF for preview
 * Returns base64 encoded PDF in JSON to bypass IDM interception
 */
router.get('/certificate/:id/data', async (req: Request, res: Response) => {
    try {
        console.log('[PDF Route] Fetching template PDF for id:', req.params.id);

        const template = await prisma.certificateTemplate.findUnique({
            where: { id: req.params.id },
        });

        if (!template) {
            console.log('[PDF Route] Template not found');
            return res.status(404).json({ error: 'Template not found' });
        }

        console.log('[PDF Route] Template found:', template.name);

        // Handle different data types
        let pdfBuffer: Buffer;
        if (Buffer.isBuffer(template.templateData)) {
            pdfBuffer = template.templateData;
        } else if (template.templateData instanceof Uint8Array) {
            pdfBuffer = Buffer.from(template.templateData);
        } else {
            console.error('[PDF Route] Unknown templateData type:', typeof template.templateData);
            return res.status(500).json({ error: 'Invalid template data format' });
        }

        console.log('[PDF Route] PDF buffer length:', pdfBuffer.length);

        if (pdfBuffer.length === 0) {
            console.error('[PDF Route] PDF buffer is empty!');
            return res.status(500).json({ error: 'Template PDF data is empty' });
        }

        // Return as base64 JSON to bypass IDM interception
        const base64Data = pdfBuffer.toString('base64');
        res.json({
            data: base64Data,
            name: template.name,
            size: pdfBuffer.length
        });
    } catch (error) {
        console.error('Error fetching template PDF:', error);
        res.status(500).json({ error: 'Failed to fetch template PDF' });
    }
});

/**
 * Update certificate template field configuration
 */
router.put('/certificate/:id', async (req: Request, res: Response) => {
    try {
        const { name, fieldConfigs } = req.body;

        const template = await prisma.certificateTemplate.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(fieldConfigs && { fieldConfigs: JSON.stringify(fieldConfigs) }),
            },
        });

        res.json({
            id: template.id,
            name: template.name,
            fieldConfigs: JSON.parse(template.fieldConfigs),
            updatedAt: template.updatedAt,
        });
    } catch (error) {
        console.error('Error updating certificate template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

/**
 * Delete a certificate template
 */
router.delete('/certificate/:id', async (req: Request, res: Response) => {
    try {
        await prisma.certificateTemplate.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting certificate template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

/**
 * Create a new email template
 */
router.post('/email', async (req: Request, res: Response) => {
    try {
        const { name, subject, htmlContent, placeholders } = req.body;

        if (!name || !subject || !htmlContent) {
            return res.status(400).json({ error: 'Name, subject, and htmlContent are required' });
        }

        const template = await prisma.emailTemplate.create({
            data: {
                name,
                subject,
                htmlContent,
                placeholders: JSON.stringify(placeholders || []),
            },
        });

        res.status(201).json({
            ...template,
            placeholders: JSON.parse(template.placeholders),
        });
    } catch (error) {
        console.error('Error creating email template:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
});

/**
 * Get all email templates
 */
router.get('/email', async (req: Request, res: Response) => {
    try {
        const templates = await prisma.emailTemplate.findMany({
            orderBy: { createdAt: 'desc' },
        });

        res.json(templates.map(t => ({
            ...t,
            placeholders: JSON.parse(t.placeholders),
        })));
    } catch (error) {
        console.error('Error fetching email templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
});

/**
 * Get a specific email template
 */
router.get('/email/:id', async (req: Request, res: Response) => {
    try {
        const template = await prisma.emailTemplate.findUnique({
            where: { id: req.params.id },
        });

        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            ...template,
            placeholders: JSON.parse(template.placeholders),
        });
    } catch (error) {
        console.error('Error fetching email template:', error);
        res.status(500).json({ error: 'Failed to fetch template' });
    }
});

/**
 * Update an email template
 */
router.put('/email/:id', async (req: Request, res: Response) => {
    try {
        const { name, subject, htmlContent, placeholders } = req.body;

        const template = await prisma.emailTemplate.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(subject && { subject }),
                ...(htmlContent && { htmlContent }),
                ...(placeholders && { placeholders: JSON.stringify(placeholders) }),
            },
        });

        res.json({
            ...template,
            placeholders: JSON.parse(template.placeholders),
        });
    } catch (error) {
        console.error('Error updating email template:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
});

/**
 * Delete an email template
 */
router.delete('/email/:id', async (req: Request, res: Response) => {
    try {
        await prisma.emailTemplate.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting email template:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
});

export default router;
