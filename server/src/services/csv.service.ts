import { parse } from 'csv-parse';
import { Readable } from 'stream';

export interface ParsedCSV {
    headers: string[];
    rows: Record<string, string>[];
    totalRows: number;
    errors: CSVError[];
}

export interface CSVError {
    row: number;
    message: string;
}

export interface CSVValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Parse a CSV buffer into structured data
 */
export async function parseCSV(buffer: Buffer): Promise<ParsedCSV> {
    return new Promise((resolve, reject) => {
        const rows: Record<string, string>[] = [];
        const errors: CSVError[] = [];
        let headers: string[] = [];

        const parser = parse({
            columns: true,           // Use first row as headers
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
            on_record: (record, { lines }) => {
                // Validate required fields exist
                if (!record.email && !record.Email && !record.EMAIL) {
                    errors.push({
                        row: lines,
                        message: 'Missing email field',
                    });
                }
                return record;
            },
        });

        const stream = Readable.from(buffer);

        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                // Normalize field names (handle case variations)
                const normalizedRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(record)) {
                    normalizedRecord[key.toLowerCase().trim()] = String(value || '');
                    // Also keep original case version
                    normalizedRecord[key.trim()] = String(value || '');
                }
                rows.push(normalizedRecord);
            }
        });

        parser.on('error', (err) => {
            reject(err);
        });

        parser.on('end', () => {
            // Extract headers from first record (include all headers)
            if (rows.length > 0) {
                // Get unique header keys (prefer original case over lowercase)
                const seen = new Set<string>();
                headers = Object.keys(rows[0]).filter(key => {
                    const lower = key.toLowerCase().trim();
                    if (seen.has(lower)) return false;
                    seen.add(lower);
                    return true;
                });
            }

            resolve({
                headers,
                rows,
                totalRows: rows.length,
                errors,
            });
        });

        stream.pipe(parser);
    });
}

/**
 * Validate CSV data for certificate generation
 */
export function validateCSVForCertificates(
    parsedCSV: ParsedCSV,
    requiredFields: string[] = ['name'] // Only name is required, email is optional
): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if CSV has any rows
    if (parsedCSV.totalRows === 0) {
        errors.push('CSV file is empty or has no data rows');
        return { isValid: false, errors, warnings };
    }

    // Check for required fields (case-insensitive, flexible matching)
    const headersLower = parsedCSV.headers.map(h => h.toLowerCase().replace(/\s+/g, ''));

    for (const field of requiredFields) {
        const fieldLower = field.toLowerCase();
        const hasField = headersLower.some(h =>
            h === fieldLower ||
            h.includes(fieldLower) ||
            (fieldLower === 'name' && (h.includes('name') || h === 'fullname' || h === 'full_name'))
        );

        if (!hasField) {
            errors.push(`Required field "${field}" not found in CSV headers`);
        }
    }

    // Check for empty email values
    let emptyEmails = 0;
    let invalidEmails = 0;

    for (let i = 0; i < parsedCSV.rows.length; i++) {
        const row = parsedCSV.rows[i];
        const email = row.email || row.Email || row.EMAIL || '';

        if (!email) {
            emptyEmails++;
        } else if (!isValidEmail(email)) {
            invalidEmails++;
        }
    }

    if (emptyEmails > 0) {
        warnings.push(`${emptyEmails} row(s) have empty email addresses`);
    }

    if (invalidEmails > 0) {
        warnings.push(`${invalidEmails} row(s) have invalid email addresses`);
    }

    // Add parsing errors
    for (const error of parsedCSV.errors) {
        errors.push(`Row ${error.row}: ${error.message}`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Extract and normalize name from CSV row
 */
export function extractName(row: Record<string, string>): string {
    return (
        row.name ||
        row.Name ||
        row.NAME ||
        row['Full Name'] ||
        row['full name'] ||
        row['FULL NAME'] ||
        row.full_name ||
        row.Full_Name ||
        row.fullname ||
        row.FullName ||
        row.FULLNAME ||
        `${row.first_name || row.First_Name || ''} ${row.last_name || row.Last_Name || ''}`.trim() ||
        'Unknown'
    );
}

/**
 * Extract and normalize email from CSV row
 */
export function extractEmail(row: Record<string, string>): string {
    return (
        row.email ||
        row.Email ||
        row.EMAIL ||
        row.e_mail ||
        row['e-mail'] ||
        ''
    ).toLowerCase().trim();
}

/**
 * Generate a safe filename from a name
 */
export function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\s-_]/g, '') // Remove special characters
        .replace(/\s+/g, '_')              // Replace spaces with underscores
        .substring(0, 100);                 // Limit length
}
