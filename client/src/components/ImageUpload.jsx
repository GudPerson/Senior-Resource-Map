import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';

export default function ImageUpload({ label, value, onChange, className = '' }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploading(true);
        setError('');
        try {
            const url = await api.uploadMedia(file);
            onChange(url);
        } catch (err) {
            setError(err.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    }, [onChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1,
        multiple: false
    });

    return (
        <div className={`space-y-1.5 ${className}`}>
            {label && <label className="block text-sm font-semibold text-slate-700">{label}</label>}

            {value ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 group h-32 bg-slate-50 flex items-center justify-center">
                    <img src={value} alt="Uploaded" className="max-h-full max-w-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            className="bg-white text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors shadow-sm"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                        ${isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'}
                        ${uploading ? 'opacity-50 pointer-events-none' : ''}
                    `}
                >
                    <input {...getInputProps()} />
                    {uploading ? (
                        <div className="flex flex-col items-center gap-2 text-brand-600">
                            <Loader2 size={24} className="animate-spin" />
                            <span className="text-sm font-medium">Uploading…</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                            <UploadCloud size={24} className={isDragActive ? 'text-brand-500' : 'text-slate-400'} />
                            <span className="text-sm">
                                {isDragActive ? 'Drop image here' : 'Click or drop an image'}
                            </span>
                        </div>
                    )}
                </div>
            )}
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
}
