import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma.js';

export interface SmtpSettings {
    host: string;
    port: number;
    username: string;
    password: string;
    fromName?: string;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    attachments?: Array<{
        filename: string;
        path: string;
    }>;
    smtpSettings: SmtpSettings;
}

/**
 * Create a nodemailer transporter with the given SMTP settings
 */
function createTransporter(settings: SmtpSettings) {
    return nodemailer.createTransport({
        host: settings.host,
        port: settings.port,
        secure: settings.port === 465, // true for 465, false for other ports
        auth: {
            user: settings.username,
            pass: settings.password,
        },
        tls: {
            rejectUnauthorized: false, // Allow self-signed certificates
        },
    });
}

/**
 * Send a single email
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, html, attachments, smtpSettings } = options;

    const transporter = createTransporter(smtpSettings);

    const fromAddress = smtpSettings.fromName
        ? `"${smtpSettings.fromName}" <${smtpSettings.username}>`
        : smtpSettings.username;

    await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        attachments: attachments?.map(att => ({
            filename: att.filename,
            path: att.path,
        })),
    });
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(settings: SmtpSettings): Promise<{
    success: boolean;
    message: string;
}> {
    try {
        const transporter = createTransporter(settings);
        await transporter.verify();
        return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, message: `SMTP connection failed: ${errorMessage}` };
    }
}

/**
 * Render an email template with data placeholders
 */
export function renderEmailTemplate(
    template: string,
    data: Record<string, string>
): string {
    let rendered = template;

    // Replace {{placeholder}} patterns with actual values
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        rendered = rendered.replace(regex, value || '');
    }

    return rendered;
}

/**
 * Extract placeholders from an email template
 */
export function extractPlaceholders(template: string): string[] {
    const regex = /\{\{\s*(\w+)\s*\}\}/g;
    const placeholders = new Set<string>();

    let match;
    while ((match = regex.exec(template)) !== null) {
        placeholders.add(match[1].toLowerCase());
    }

    return Array.from(placeholders);
}

/**
 * Get default SMTP configuration from database
 */
export async function getDefaultSmtpConfig(): Promise<SmtpSettings | null> {
    const config = await prisma.smtpConfig.findFirst({
        where: { isDefault: true },
    });

    if (!config) {
        return null;
    }

    return {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.passwordEncrypted, // In production, this should be decrypted
        fromName: config.fromName || undefined,
    };
}

/**
 * Sleep utility for rate limiting
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gmail-specific rate limiting constants
 */
export const GMAIL_LIMITS = {
    DAILY_LIMIT: 500,           // Free Gmail limit
    WORKSPACE_DAILY_LIMIT: 2000, // Google Workspace limit
    SAFE_DELAY_MS: 3000,        // 3 seconds between emails
    BURST_LIMIT: 20,            // Max emails per minute
};
