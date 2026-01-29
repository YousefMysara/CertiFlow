import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create default app settings
    await prisma.appSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            defaultOutputPath: './storage/certificates',
            emailDelayMs: 3000,
            maxEmailsPerDay: 500,
        },
    });
    console.log('✅ App settings created');

    // Create sample email templates
    const thankYouTemplate = await prisma.emailTemplate.upsert({
        where: { id: 'sample-thank-you' },
        update: {},
        create: {
            id: 'sample-thank-you',
            name: 'Thank You - Certificate Delivery',
            subject: 'Your Certificate of Completion - {{event_name}}',
            htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Certificate</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🎉 Congratulations!</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Dear <strong>{{name}}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                We are pleased to inform you that you have successfully completed <strong>{{event_name}}</strong>.
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Please find your certificate of completion attached to this email. You can download and print it for your records.
              </p>
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 30px 0;">
                <p style="color: #333333; font-size: 14px; margin: 0;">
                  <strong>Certificate Details:</strong><br>
                  Name: {{name}}<br>
                  Email: {{email}}<br>
                  Event: {{event_name}}<br>
                  Date: {{date}}
                </p>
              </div>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0;">
                Thank you for your participation!
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="color: #888888; font-size: 14px; margin: 0;">
                This email was sent by CertiFlow
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
            placeholders: JSON.stringify(['name', 'email', 'event_name', 'date']),
        },
    });
    console.log('✅ Email template created:', thankYouTemplate.name);

    // Create simple email template
    const simpleTemplate = await prisma.emailTemplate.upsert({
        where: { id: 'sample-simple' },
        update: {},
        create: {
            id: 'sample-simple',
            name: 'Simple Certificate Email',
            subject: 'Your Certificate - {{name}}',
            htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: Arial, sans-serif; padding: 20px; background-color: #ffffff;">
  <h2 style="color: #333;">Hello {{name}},</h2>
  <p style="color: #555; font-size: 16px;">
    Please find your certificate attached to this email.
  </p>
  <p style="color: #555; font-size: 16px;">
    Best regards,<br>
    The Team
  </p>
</body>
</html>`,
            placeholders: JSON.stringify(['name', 'email']),
        },
    });
    console.log('✅ Email template created:', simpleTemplate.name);

    console.log('');
    console.log('🎉 Database seeding completed!');
    console.log('');
    console.log('Note: Sample certificate templates (PDF) should be uploaded through the UI.');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
