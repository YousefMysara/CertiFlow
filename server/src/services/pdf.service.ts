import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface FieldConfig {
    id: string;
    field: string;       // CSV column name to use
    x: number;           // X position (from left)
    y: number;           // Y position (from top)
    fontSize: number;
    fontFamily: 'Helvetica' | 'Times' | 'Courier' | 'Cairo' | 'Montserrat';
    fontWeight: 'normal' | 'bold' | 'italic' | 'boldItalic';
    color: string;       // Hex color
    alignment: 'left' | 'center' | 'right';
    maxWidth?: number;   // Optional max width for text wrapping
}

interface GenerateCertificateOptions {
    templateBuffer: Buffer;
    data: Record<string, string>;
    fieldConfigs: FieldConfig[];
}

/**
 * Convert hex color to RGB values (0-1 range for pdf-lib)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return { r: 0, g: 0, b: 0 };
    }
    return {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
    };
}

/**
 * Get the appropriate standard font based on family and weight
 */
async function getFont(
    pdfDoc: PDFDocument,
    family: FieldConfig['fontFamily'],
    weight: FieldConfig['fontWeight']
): Promise<PDFFont> {
    // Handle Custom Fonts (Cairo, Montserrat)
    if (family === 'Cairo' || family === 'Montserrat') {
        try {
            const fontDir = join(__dirname, '../assets/fonts');
            let fileName = `${family}-Regular.ttf`;

            if (weight === 'bold') fileName = `${family}-Bold.ttf`;

            // Montserrat has Italic variants, Cairo (downloaded) might not
            if (family === 'Montserrat') {
                if (weight === 'italic') fileName = `${family}-Italic.ttf`;
                if (weight === 'boldItalic') fileName = `${family}-BoldItalic.ttf`;
            } else if (family === 'Cairo') {
                // Fallback for Cairo italics to Regular/Bold
                if (weight === 'italic') fileName = `${family}-Regular.ttf`;
                if (weight === 'boldItalic') fileName = `${family}-Bold.ttf`;
            }

            const fontBytes = await readFile(join(fontDir, fileName));
            return pdfDoc.embedFont(fontBytes, { subset: true });
        } catch (error) {
            console.error(`Error loading custom font ${family} ${weight}:`, error);
            // Fallback to standard font
        }
    }

    const fontMap: Record<string, StandardFonts> = {
        'Helvetica-normal': StandardFonts.Helvetica,
        'Helvetica-bold': StandardFonts.HelveticaBold,
        'Helvetica-italic': StandardFonts.HelveticaOblique,
        'Helvetica-boldItalic': StandardFonts.HelveticaBoldOblique,
        'Times-normal': StandardFonts.TimesRoman,
        'Times-bold': StandardFonts.TimesRomanBold,
        'Times-italic': StandardFonts.TimesRomanItalic,
        'Times-boldItalic': StandardFonts.TimesRomanBoldItalic,
        'Courier-normal': StandardFonts.Courier,
        'Courier-bold': StandardFonts.CourierBold,
        'Courier-italic': StandardFonts.CourierOblique,
        'Courier-boldItalic': StandardFonts.CourierBoldOblique,
    };

    const fontKey = `${family}-${weight}`;
    const standardFont = fontMap[fontKey] || StandardFonts.Helvetica;
    return pdfDoc.embedFont(standardFont);
}

/**
 * Calculate X position based on alignment
 */
function calculateXPosition(
    text: string,
    font: PDFFont,
    fontSize: number,
    x: number,
    alignment: FieldConfig['alignment'],
    pageWidth: number
): number {
    const textWidth = font.widthOfTextAtSize(text, fontSize);

    switch (alignment) {
        case 'center':
            return x - (textWidth / 2);
        case 'right':
            return x - textWidth;
        case 'left':
        default:
            return x;
    }
}

/**
 * Generate a single certificate PDF
 */
export async function generateCertificate(
    options: GenerateCertificateOptions
): Promise<Buffer> {
    const { templateBuffer, data, fieldConfigs } = options;

    // Load the PDF template
    const pdfDoc = await PDFDocument.load(templateBuffer);
    pdfDoc.registerFontkit(fontkit);

    // Get the first page (assuming single-page certificate)
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
        throw new Error('PDF template has no pages');
    }
    const page = pages[0];
    const { width, height } = page.getSize();

    // Draw each field onto the certificate
    for (const config of fieldConfigs) {
        const text = data[config.field] || '';
        if (!text) continue;

        const font = await getFont(pdfDoc, config.fontFamily, config.fontWeight);
        const color = hexToRgb(config.color);

        // pdf-lib uses bottom-left origin, so convert Y coordinate
        const yPos = height - config.y - config.fontSize;

        // Calculate X position based on alignment
        const xPos = calculateXPosition(
            text,
            font,
            config.fontSize,
            config.x,
            config.alignment,
            width
        );

        page.drawText(text, {
            x: xPos,
            y: yPos,
            size: config.fontSize,
            font,
            color: rgb(color.r, color.g, color.b),
        });
    }

    // Save and return the modified PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
}

/**
 * Generate a preview certificate with sample data
 */
export async function generatePreview(
    templateBuffer: Buffer,
    fieldConfigs: FieldConfig[],
    sampleData?: Record<string, string>
): Promise<Buffer> {
    // Default sample data if none provided
    const defaultData: Record<string, string> = {
        name: 'John Doe',
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        event_name: 'Web Development Workshop',
        date: new Date().toLocaleDateString(),
        certificate_id: 'CERT-2024-001',
    };

    const data = { ...defaultData, ...sampleData };
    return generateCertificate({ templateBuffer, data, fieldConfigs });
}

/**
 * Get information about a PDF template
 */
export async function getTemplateInfo(templateBuffer: Buffer): Promise<{
    pageCount: number;
    width: number;
    height: number;
}> {
    const pdfDoc = await PDFDocument.load(templateBuffer);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
        throw new Error('PDF has no pages');
    }

    const { width, height } = pages[0].getSize();

    return {
        pageCount: pages.length,
        width,
        height,
    };
}
