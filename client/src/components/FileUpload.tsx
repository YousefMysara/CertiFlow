import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X } from 'lucide-react';

interface FileUploadProps {
    accept?: Record<string, string[]>;
    onFileSelect: (file: File) => void;
    selectedFile?: File | null;
    onClear?: () => void;
    label?: string;
    hint?: string;
    maxSize?: number;
}

export default function FileUpload({
    accept = { 'application/pdf': ['.pdf'] },
    onFileSelect,
    selectedFile,
    onClear,
    label = 'Upload File',
    hint = 'Drag and drop or click to select',
    maxSize = 50 * 1024 * 1024, // 50MB
}: FileUploadProps) {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            onFileSelect(acceptedFiles[0]);
        }
    }, [onFileSelect]);

    const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
        onDrop,
        accept,
        maxFiles: 1,
        maxSize,
    });

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="w-full">
            {!selectedFile ? (
                <div
                    {...getRootProps()}
                    className={`dropzone ${isDragActive ? 'active' : ''}`}
                >
                    <input {...getInputProps()} />
                    <Upload className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                    <p className="text-lg font-medium text-slate-300 mb-2">{label}</p>
                    <p className="text-sm text-slate-500">{hint}</p>
                    {fileRejections.length > 0 && (
                        <p className="text-sm text-red-400 mt-2">
                            {fileRejections[0].errors[0].message}
                        </p>
                    )}
                </div>
            ) : (
                <div className="card flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center">
                            <File className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-800">{selectedFile.name}</p>
                            <p className="text-sm text-slate-500">{formatFileSize(selectedFile.size)}</p>
                        </div>
                    </div>
                    {onClear && (
                        <button
                            onClick={onClear}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
