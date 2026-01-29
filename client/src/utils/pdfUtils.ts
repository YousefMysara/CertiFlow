// PDF.js utilities for rendering PDFs to canvas
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - use the bundled worker
// For Vite, we need to set this correctly
const pdfjsWorkerUrl = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * Render a PDF page to a data URL (base64 image)
 */
export async function renderPdfToImage(
    pdfUrl: string,
    pageNumber: number = 1,
    scale: number = 1.5
): Promise<{ dataUrl: string; width: number; height: number; actualWidth: number; actualHeight: number }> {
    console.log('[PdfUtils] Loading PDF from:', pdfUrl);
    console.log('[PdfUtils] Worker src:', pdfjsLib.GlobalWorkerOptions.workerSrc);

    try {
        // Fetch PDF as base64 JSON (to bypass IDM interception)
        console.log('[PdfUtils] Fetching PDF from:', pdfUrl);
        const response = await fetch(pdfUrl, { cache: 'no-store' });
        console.log('[PdfUtils] Response status:', response.status);
        console.log('[PdfUtils] Response OK:', response.ok);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        // Parse JSON response containing base64 PDF
        const jsonData = await response.json();
        console.log('[PdfUtils] PDF data received, size:', jsonData.size);

        // Decode base64 to binary
        const binaryString = atob(jsonData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;
        console.log('[PdfUtils] PDF decoded, size:', arrayBuffer.byteLength);

        // Load the PDF document from array buffer
        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            useWorkerFetch: false,
            isEvalSupported: false,
            useSystemFonts: true,
        });
        const pdf = await loadingTask.promise;

        console.log('[PdfUtils] PDF loaded, pages:', pdf.numPages);

        // Get the specified page
        const page = await pdf.getPage(pageNumber);

        // Get the viewport at the specified scale (for display)
        const viewport = page.getViewport({ scale });

        // Also get the unscaled viewport (actual PDF dimensions)
        const actualViewport = page.getViewport({ scale: 1.0 });

        console.log('[PdfUtils] Page viewport (display):', viewport.width, 'x', viewport.height);
        console.log('[PdfUtils] Page viewport (actual):', actualViewport.width, 'x', actualViewport.height);

        // Create a canvas to render the page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error('Could not get canvas context');
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Render the page to the canvas
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
        };

        await page.render(renderContext).promise;

        console.log('[PdfUtils] Page rendered successfully');

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');

        return {
            dataUrl,
            width: viewport.width,           // Display dimensions (scaled)
            height: viewport.height,
            actualWidth: actualViewport.width,   // Actual PDF dimensions (unscaled)
            actualHeight: actualViewport.height,
        };
    } catch (error) {
        console.error('[PdfUtils] Error rendering PDF:', error);
        throw error;
    }
}

/**
 * Get PDF info (page count, dimensions)
 */
export async function getPdfInfo(pdfUrl: string): Promise<{
    pageCount: number;
    width: number;
    height: number;
}> {
    try {
        const response = await fetch(pdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });

        return {
            pageCount: pdf.numPages,
            width: viewport.width,
            height: viewport.height,
        };
    } catch (error) {
        console.error('[PdfUtils] Error getting PDF info:', error);
        throw error;
    }
}
