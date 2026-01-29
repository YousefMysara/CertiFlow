import { Router, Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { parseCSV, validateCSVForCertificates } from '../services/csv.service.js';

const router = Router();

/**
 * Parse and validate CSV file
 */
router.post('/parse', async (req: Request, res: Response) => {
    try {
        if (!req.files || !req.files.csv) {
            return res.status(400).json({ error: 'No CSV file uploaded' });
        }

        const file = req.files.csv as UploadedFile;

        // Validate file type
        if (!file.mimetype.includes('csv') && !file.name.endsWith('.csv')) {
            return res.status(400).json({ error: 'Only CSV files are allowed' });
        }

        const parsedCSV = await parseCSV(file.data);
        const validation = validateCSVForCertificates(parsedCSV);

        res.json({
            headers: parsedCSV.headers,
            totalRows: parsedCSV.totalRows,
            preview: parsedCSV.rows.slice(0, 10), // First 10 rows for preview
            validation,
        });
    } catch (error) {
        console.error('Error parsing CSV:', error);
        res.status(500).json({ error: 'Failed to parse CSV file' });
    }
});

export default router;
