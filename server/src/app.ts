import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Load environment variables
config();

// Import routes
import templateRoutes from './routes/template.routes.js';
import certificateRoutes from './routes/certificate.routes.js';
import emailRoutes from './routes/email.routes.js';
import jobRoutes from './routes/job.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import csvRoutes from './routes/csv.routes.js';

// Initialize Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO for real-time progress updates
export const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    abortOnLimit: true,
    useTempFiles: false,  // Store in memory so file.data is available
    // tempFileDir: join(process.cwd(), 'uploads', 'temp'),
}));

// Ensure required directories exist
const dirs = [
    join(process.cwd(), 'uploads'),
    join(process.cwd(), 'uploads', 'temp'),
    join(process.cwd(), 'storage'),
    join(process.cwd(), 'storage', 'certificates'),
    join(process.cwd(), 'storage', 'templates'),
    join(process.cwd(), 'data'),
];

dirs.forEach(dir => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
});

// API Routes
app.use('/api/templates', templateRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/csv', csvRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-job', (jobId: string) => {
        socket.join(`job-${jobId}`);
        console.log(`Client ${socket.id} joined job room: ${jobId}`);
    });

    socket.on('leave-job', (jobId: string) => {
        socket.leave(`job-${jobId}`);
        console.log(`Client ${socket.id} left job room: ${jobId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// Start server
const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎓 CertiFlow Server                                     ║
║                                                           ║
║   Server running on: http://localhost:${PORT}               ║
║   Socket.IO enabled for real-time updates                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
