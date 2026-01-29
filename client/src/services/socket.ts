import { io, Socket } from 'socket.io-client';

class SocketService {
    private socket: Socket | null = null;

    connect(): Socket {
        if (!this.socket) {
            this.socket = io('/', {
                transports: ['websocket', 'polling'],
            });

            this.socket.on('connect', () => {
                console.log('Socket connected:', this.socket?.id);
            });

            this.socket.on('disconnect', () => {
                console.log('Socket disconnected');
            });
        }
        return this.socket;
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinJob(jobId: string): void {
        if (this.socket) {
            this.socket.emit('join-job', jobId);
        }
    }

    leaveJob(jobId: string): void {
        if (this.socket) {
            this.socket.emit('leave-job', jobId);
        }
    }

    onJobProgress(callback: (data: JobProgress) => void): void {
        if (this.socket) {
            this.socket.on('job-progress', callback);
        }
    }

    offJobProgress(): void {
        if (this.socket) {
            this.socket.off('job-progress');
        }
    }
}

export interface JobProgress {
    jobId: string;
    processed: number;
    total: number;
    percentage: number;
    status: string;
}

export const socketService = new SocketService();
export default socketService;
