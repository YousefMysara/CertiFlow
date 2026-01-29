import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { testSmtpConnection, SmtpSettings } from '../services/email.service.js';

const router = Router();

/**
 * Get app settings
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        let settings = await prisma.appSettings.findUnique({
            where: { id: 'default' },
        });

        if (!settings) {
            settings = await prisma.appSettings.create({
                data: { id: 'default' },
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * Update app settings
 */
router.put('/', async (req: Request, res: Response) => {
    try {
        const { defaultOutputPath, emailDelayMs, maxEmailsPerDay } = req.body;

        const settings = await prisma.appSettings.upsert({
            where: { id: 'default' },
            update: {
                ...(defaultOutputPath && { defaultOutputPath }),
                ...(emailDelayMs && { emailDelayMs }),
                ...(maxEmailsPerDay && { maxEmailsPerDay }),
            },
            create: {
                id: 'default',
                defaultOutputPath: defaultOutputPath || './storage/certificates',
                emailDelayMs: emailDelayMs || 3000,
                maxEmailsPerDay: maxEmailsPerDay || 500,
            },
        });

        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

/**
 * Get all SMTP configurations
 */
router.get('/smtp', async (req: Request, res: Response) => {
    try {
        const configs = await prisma.smtpConfig.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                host: true,
                port: true,
                username: true,
                fromName: true,
                isDefault: true,
                createdAt: true,
                updatedAt: true,
                // Do not return password
            },
        });

        res.json(configs);
    } catch (error) {
        console.error('Error fetching SMTP configs:', error);
        res.status(500).json({ error: 'Failed to fetch SMTP configs' });
    }
});

/**
 * Create SMTP configuration
 */
router.post('/smtp', async (req: Request, res: Response) => {
    try {
        const { name, host, port, username, password, fromName, isDefault } = req.body;

        if (!name || !host || !port || !username || !password) {
            return res.status(400).json({
                error: 'Name, host, port, username, and password are required'
            });
        }

        // If this is set as default, unset other defaults
        if (isDefault) {
            await prisma.smtpConfig.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            });
        }

        const config = await prisma.smtpConfig.create({
            data: {
                name,
                host,
                port: parseInt(port),
                username,
                passwordEncrypted: password, // In production, this should be encrypted
                fromName,
                isDefault: isDefault || false,
            },
        });

        res.status(201).json({
            id: config.id,
            name: config.name,
            host: config.host,
            port: config.port,
            username: config.username,
            fromName: config.fromName,
            isDefault: config.isDefault,
            createdAt: config.createdAt,
        });
    } catch (error) {
        console.error('Error creating SMTP config:', error);
        res.status(500).json({ error: 'Failed to create SMTP config' });
    }
});

/**
 * Update SMTP configuration
 */
router.put('/smtp/:id', async (req: Request, res: Response) => {
    try {
        const { name, host, port, username, password, fromName, isDefault } = req.body;

        // If this is set as default, unset other defaults
        if (isDefault) {
            await prisma.smtpConfig.updateMany({
                where: { isDefault: true, id: { not: req.params.id } },
                data: { isDefault: false },
            });
        }

        const config = await prisma.smtpConfig.update({
            where: { id: req.params.id },
            data: {
                ...(name && { name }),
                ...(host && { host }),
                ...(port && { port: parseInt(port) }),
                ...(username && { username }),
                ...(password && { passwordEncrypted: password }),
                ...(fromName !== undefined && { fromName }),
                ...(isDefault !== undefined && { isDefault }),
            },
        });

        res.json({
            id: config.id,
            name: config.name,
            host: config.host,
            port: config.port,
            username: config.username,
            fromName: config.fromName,
            isDefault: config.isDefault,
            updatedAt: config.updatedAt,
        });
    } catch (error) {
        console.error('Error updating SMTP config:', error);
        res.status(500).json({ error: 'Failed to update SMTP config' });
    }
});

/**
 * Delete SMTP configuration
 */
router.delete('/smtp/:id', async (req: Request, res: Response) => {
    try {
        await prisma.smtpConfig.delete({
            where: { id: req.params.id },
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting SMTP config:', error);
        res.status(500).json({ error: 'Failed to delete SMTP config' });
    }
});

/**
 * Test SMTP connection
 */
router.post('/smtp/test', async (req: Request, res: Response) => {
    try {
        const { id, host, port, username, password } = req.body;

        let settings: SmtpSettings;

        if (id) {
            // Test existing config
            const config = await prisma.smtpConfig.findUnique({
                where: { id },
            });
            if (!config) {
                return res.status(404).json({ error: 'SMTP config not found' });
            }
            settings = {
                host: config.host,
                port: config.port,
                username: config.username,
                password: config.passwordEncrypted,
            };
        } else if (host && port && username && password) {
            // Test new config
            settings = { host, port: parseInt(port), username, password };
        } else {
            return res.status(400).json({
                error: 'Either ID or host, port, username, and password are required'
            });
        }

        const result = await testSmtpConnection(settings);
        res.json(result);
    } catch (error) {
        console.error('Error testing SMTP:', error);
        res.status(500).json({ error: 'Failed to test SMTP connection' });
    }
});

export default router;
