import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Certificate Templates
export const certificateTemplateApi = {
    upload: async (file: File, name?: string, fieldConfigs?: string) => {
        const formData = new FormData();
        formData.append('template', file);
        if (name) formData.append('name', name);
        if (fieldConfigs) formData.append('fieldConfigs', fieldConfigs);
        return api.post('/templates/certificate', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    list: () => api.get('/templates/certificate'),
    get: (id: string) => api.get(`/templates/certificate/${id}`),
    getPdf: (id: string) => `${API_BASE}/templates/certificate/${id}/data`,
    update: (id: string, data: { name?: string; fieldConfigs?: object[] }) =>
        api.put(`/templates/certificate/${id}`, data),
    delete: (id: string) => api.delete(`/templates/certificate/${id}`),
};

// Email Templates
export const emailTemplateApi = {
    create: (data: { name: string; subject: string; htmlContent: string; placeholders?: string[] }) =>
        api.post('/templates/email', data),
    list: () => api.get('/templates/email'),
    get: (id: string) => api.get(`/templates/email/${id}`),
    update: (id: string, data: Partial<{ name: string; subject: string; htmlContent: string; placeholders: string[] }>) =>
        api.put(`/templates/email/${id}`, data),
    delete: (id: string) => api.delete(`/templates/email/${id}`),
};

// Certificates
export const certificateApi = {
    preview: (templateId: string, fieldConfigs?: object[], sampleData?: Record<string, string>) =>
        api.post('/certificates/preview', { templateId, fieldConfigs, sampleData }, { responseType: 'blob' }),
    generate: async (csvFile: File, templateId: string, outputPath: string, namingPattern?: string) => {
        const formData = new FormData();
        formData.append('csv', csvFile);
        formData.append('templateId', templateId);
        formData.append('outputPath', outputPath);
        if (namingPattern) formData.append('namingPattern', namingPattern);
        return api.post('/certificates/generate', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    download: (recipientId: string) => `${API_BASE}/certificates/download/${recipientId}`,
    downloadAll: (jobId: string) => `${API_BASE}/certificates/download-all/${jobId}`,
};

// Email
export const emailApi = {
    preview: (data: { templateId?: string; htmlContent?: string; sampleData?: Record<string, string> }) =>
        api.post('/email/preview', data),
    testSend: (data: { to: string; subject: string; htmlContent: string; smtpConfigId?: string }) =>
        api.post('/email/test-send', data),
    sendBatch: (data: {
        certificateJobId: string;
        emailTemplateId: string;
        smtpConfigId: string;
        subject?: string;
        delayMs?: number;
    }) => api.post('/email/send-batch', data),
    getStats: () => api.get('/email/stats'),
};

// Jobs
export const jobApi = {
    list: (params?: { type?: string; status?: string }) => api.get('/jobs', { params }),
    get: (id: string) => api.get(`/jobs/${id}`),
    getProgress: (id: string) => api.get(`/jobs/${id}/progress`),
    getRecipients: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
        api.get(`/jobs/${id}/recipients`, { params }),
    retryFailed: (id: string) => api.post(`/jobs/${id}/retry-failed`),
    cancel: (id: string) => api.post(`/jobs/${id}/cancel`),
    delete: (id: string) => api.delete(`/jobs/${id}`),
};

// Settings
export const settingsApi = {
    get: () => api.get('/settings'),
    update: (data: { defaultOutputPath?: string; emailDelayMs?: number; maxEmailsPerDay?: number }) =>
        api.put('/settings', data),
    getSmtpConfigs: () => api.get('/settings/smtp'),
    createSmtpConfig: (data: {
        name: string;
        host: string;
        port: number;
        username: string;
        password: string;
        fromName?: string;
        isDefault?: boolean;
    }) => api.post('/settings/smtp', data),
    updateSmtpConfig: (id: string, data: Partial<{
        name: string;
        host: string;
        port: number;
        username: string;
        password: string;
        fromName: string;
        isDefault: boolean;
    }>) => api.put(`/settings/smtp/${id}`, data),
    deleteSmtpConfig: (id: string) => api.delete(`/settings/smtp/${id}`),
    testSmtpConfig: (data: { id?: string; host?: string; port?: number; username?: string; password?: string }) =>
        api.post('/settings/smtp/test', data),
};

// CSV
export const csvApi = {
    parse: async (file: File) => {
        const formData = new FormData();
        formData.append('csv', file);
        return api.post('/csv/parse', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
};

export default api;
