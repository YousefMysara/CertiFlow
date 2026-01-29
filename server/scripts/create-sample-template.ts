// Script to generate a sample certificate PDF template
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createSampleCertificate() {
    // Create a new PDF document (A4 Landscape)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]); // A4 landscape

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    const { width, height } = page.getSize();

    // Colors
    const primaryColor = rgb(0.02, 0.52, 0.78); // Sky blue
    const goldColor = rgb(0.85, 0.65, 0.13);    // Gold
    const darkColor = rgb(0.15, 0.15, 0.15);    // Dark gray

    // Draw decorative border
    const borderWidth = 3;
    const margin = 30;

    // Outer border
    page.drawRectangle({
        x: margin,
        y: margin,
        width: width - 2 * margin,
        height: height - 2 * margin,
        borderColor: goldColor,
        borderWidth: borderWidth,
    });

    // Inner border
    page.drawRectangle({
        x: margin + 10,
        y: margin + 10,
        width: width - 2 * (margin + 10),
        height: height - 2 * (margin + 10),
        borderColor: primaryColor,
        borderWidth: 1,
    });

    // Draw decorative corner elements
    const cornerSize = 40;
    const corners = [
        { x: margin + 15, y: height - margin - 15 - cornerSize }, // Top left
        { x: width - margin - 15 - cornerSize, y: height - margin - 15 - cornerSize }, // Top right
        { x: margin + 15, y: margin + 15 }, // Bottom left
        { x: width - margin - 15 - cornerSize, y: margin + 15 }, // Bottom right
    ];

    corners.forEach(corner => {
        page.drawRectangle({
            x: corner.x,
            y: corner.y,
            width: cornerSize,
            height: cornerSize,
            borderColor: goldColor,
            borderWidth: 1,
        });
    });

    // Header - Organization name
    const orgName = "CERTIFICATE OF COMPLETION";
    const orgNameWidth = helveticaBold.widthOfTextAtSize(orgName, 36);
    page.drawText(orgName, {
        x: (width - orgNameWidth) / 2,
        y: height - 120,
        size: 36,
        font: helveticaBold,
        color: primaryColor,
    });

    // Subheader
    const subHeader = "This is to certify that";
    const subHeaderWidth = helvetica.widthOfTextAtSize(subHeader, 16);
    page.drawText(subHeader, {
        x: (width - subHeaderWidth) / 2,
        y: height - 190,
        size: 16,
        font: helvetica,
        color: darkColor,
    });

    // Name placeholder line
    page.drawLine({
        start: { x: 200, y: height - 260 },
        end: { x: width - 200, y: height - 260 },
        thickness: 1,
        color: goldColor,
    });

    // Placeholder text for name (will be replaced dynamically)
    const namePlaceholder = "{{name}}";
    const nameWidth = helveticaBold.widthOfTextAtSize(namePlaceholder, 32);
    page.drawText(namePlaceholder, {
        x: (width - nameWidth) / 2,
        y: height - 250,
        size: 32,
        font: helveticaBold,
        color: darkColor,
    });

    // Achievement text
    const achievementText = "has successfully completed the";
    const achievementWidth = helvetica.widthOfTextAtSize(achievementText, 16);
    page.drawText(achievementText, {
        x: (width - achievementWidth) / 2,
        y: height - 310,
        size: 16,
        font: helvetica,
        color: darkColor,
    });

    // Event name placeholder
    const eventPlaceholder = "{{event_name}}";
    const eventWidth = helveticaBold.widthOfTextAtSize(eventPlaceholder, 24);
    page.drawText(eventPlaceholder, {
        x: (width - eventWidth) / 2,
        y: height - 350,
        size: 24,
        font: helveticaBold,
        color: primaryColor,
    });

    // Date line
    const dateText = "Awarded on";
    const dateTextWidth = helvetica.widthOfTextAtSize(dateText, 14);
    page.drawText(dateText, {
        x: (width - dateTextWidth) / 2 - 80,
        y: height - 420,
        size: 14,
        font: helvetica,
        color: darkColor,
    });

    // Date placeholder
    const datePlaceholder = "{{date}}";
    const dateWidth = timesItalic.widthOfTextAtSize(datePlaceholder, 16);
    page.drawText(datePlaceholder, {
        x: (width - dateTextWidth) / 2 + 20,
        y: height - 420,
        size: 16,
        font: timesItalic,
        color: darkColor,
    });

    // Signature lines
    const signatureY = 100;

    // Left signature
    page.drawLine({
        start: { x: 150, y: signatureY },
        end: { x: 350, y: signatureY },
        thickness: 1,
        color: darkColor,
    });
    const leftSigLabel = "Instructor";
    const leftSigLabelWidth = helvetica.widthOfTextAtSize(leftSigLabel, 12);
    page.drawText(leftSigLabel, {
        x: 150 + (200 - leftSigLabelWidth) / 2,
        y: signatureY - 20,
        size: 12,
        font: helvetica,
        color: darkColor,
    });

    // Right signature
    page.drawLine({
        start: { x: width - 350, y: signatureY },
        end: { x: width - 150, y: signatureY },
        thickness: 1,
        color: darkColor,
    });
    const rightSigLabel = "Program Director";
    const rightSigLabelWidth = helvetica.widthOfTextAtSize(rightSigLabel, 12);
    page.drawText(rightSigLabel, {
        x: width - 350 + (200 - rightSigLabelWidth) / 2,
        y: signatureY - 20,
        size: 12,
        font: helvetica,
        color: darkColor,
    });

    // Certificate ID at bottom
    const certId = "Certificate ID: {{certificate_id}}";
    const certIdWidth = helvetica.widthOfTextAtSize(certId, 10);
    page.drawText(certId, {
        x: (width - certIdWidth) / 2,
        y: 50,
        size: 10,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();

    const outputPath = join(__dirname, '..', '..', 'sample-data', 'certificate-template.pdf');
    writeFileSync(outputPath, pdfBytes);

    console.log(`✅ Sample certificate template created at: ${outputPath}`);
    console.log('\nThis template has the following placeholders:');
    console.log('  - {{name}} - Recipient name');
    console.log('  - {{event_name}} - Event or course name');
    console.log('  - {{date}} - Date of completion');
    console.log('  - {{certificate_id}} - Unique certificate ID');
}

createSampleCertificate().catch(console.error);
