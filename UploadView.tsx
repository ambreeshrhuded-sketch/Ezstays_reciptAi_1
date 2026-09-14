import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileImage,
  FileText,
  X,
  Sparkles,
  Plus,
  ArrowRight,
  CheckCircle,
  FolderOpen,
} from 'lucide-react';
import { SAMPLE_RECEIPTS_CATALOG, generateSampleReceiptImage } from '../utils/sampleReceipts';
import { prepareTemporaryOcrImage } from '../utils/imageOptimizer';

export interface PendingUploadFile {
  id: string;
  file: File | null;
  name: string;
  size: number;
  type: string;
  base64Data: string;
  previewUrl: string;
}

interface UploadViewProps {
  onStartBatch: (files: PendingUploadFile[], batchName: string) => void;
  onOpenSampleModal: () => void;
}

export const UploadView: React.FC<UploadViewProps> = ({
  onStartBatch,
  onOpenSampleModal,
}) => {
  const [pendingFiles, setPendingFiles] = useState<PendingUploadFile[]>([]);
  const [batchName, setBatchName] = useState(`Batch #${new Date().toISOString().slice(5, 10).replace('-', '')} - Hostel Admissions`);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const validFiles = filesArray.filter((file) => {
      const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif|bmp|tiff?|svg)$/i.test(file.name);
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      return isImg || isPdf;
    });

    if (validFiles.length === 0) return;

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawBase64 = reader.result as string;
        let mimeType = file.type;
        if (!mimeType) {
          if (file.name.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
          else if (file.name.toLowerCase().endsWith('.png')) mimeType = 'image/png';
          else if (file.name.toLowerCase().endsWith('.webp')) mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
        }
        // Pre-optimize image in background immediately for rapid network transfer and instant AI OCR
        const optimizedBase64 = await prepareTemporaryOcrImage(rawBase64, mimeType);
        const newFile: PendingUploadFile = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          file,
          name: file.name,
          size: file.size,
          type: mimeType,
          base64Data: optimizedBase64,
          previewUrl: optimizedBase64,
        };
        setPendingFiles((prev) => [...prev, newFile]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = (sampleId: string) => {
    const sampleMeta = SAMPLE_RECEIPTS_CATALOG.find((s) => s.id === sampleId);
    if (!sampleMeta) return;

    const base64Data = generateSampleReceiptImage(sampleId);
    const newFile: PendingUploadFile = {
      id: `sample-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      file: null,
      name: sampleMeta.fileName,
      size: 48500,
      type: 'image/png',
      base64Data,
      previewUrl: base64Data,
    };
    setPendingFiles((prev) => [...prev, newFile]);
  };

  const handleLoadAllSamples = () => {
    const newSamples: PendingUploadFile[] = SAMPLE_RECEIPTS_CATALOG.map((s) => {
      const base64Data = generateSampleReceiptImage(s.id);
      return {
        id: `sample-${Date.now()}-${s.id}`,
        file: null,
        name: s.fileName,
        size: 52000,
        type: 'image/png',
        base64Data,
        previewUrl: base64Data,
      };
    });
    setPendingFiles((prev) => [...prev, ...newSamples]);
  };

  const removeFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setPendingFiles([]);
  };

  const handleStartProcessing = () => {
    if (pendingFiles.length === 0) return;
    onStartBatch(pendingFiles, batchName || 'Hostel Fee Batch');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Batch Document Ingestion</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Upload Receipt Images & PDFs</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload individual receipts, bulk photos, or PDF challan documents for automated OCR extraction.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleLoadAllSamples}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 transition shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Load 4 Realistic Sample Receipts</span>
          </button>
        </div>
      </div>

      {/* Batch Setup Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
              Batch Title / Identification
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Batch #001 - Tagore Hostel August Admissions"
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>
          <div className="sm:self-end pb-1">
            <span className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg">
              {pendingFiles.length} file{pendingFiles.length === 1 ? '' : 's'} queued
            </span>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/60'
            : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
          }}
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center border border-indigo-100 shadow-xs">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              Drag & Drop receipt images or PDF files here
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports JPG, PNG, WEBP, and PDF documents. Can handle 100+ receipts in bulk.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition"
            >
              Browse Files
            </button>
            <button
              onClick={onOpenSampleModal}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              Sample Library
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Selected Quick Samples */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Quick Test Samples (Different Real-World Hostel Layouts)
          </span>
          <span className="text-[11px] text-slate-400">Click to add to upload queue</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SAMPLE_RECEIPTS_CATALOG.map((sample) => (
            <div
              key={sample.id}
              onClick={() => handleLoadSample(sample.id)}
              className="group cursor-pointer border border-slate-200 hover:border-indigo-400 p-4 rounded-xl bg-slate-50/50 hover:bg-white transition-all shadow-xs"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-slate-800 truncate">{sample.title}</span>
                <Plus className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-125 transition" />
              </div>
              <p className="text-[11px] text-slate-500 line-clamp-2">{sample.description}</p>
              <div className="mt-3 flex items-center justify-between text-[10px]">
                <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-700 font-semibold">
                  {sample.badge}
                </span>
                <span className="font-bold text-slate-900">₹{sample.expectedData.amount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Files List */}
      {pendingFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Queued Receipts ({pendingFiles.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review your list before launching the AI extraction engine.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={clearAll}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5"
              >
                Clear All
              </button>
              <button
                onClick={handleStartProcessing}
                className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition"
              >
                <span>Start AI Extraction Queue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 max-h-96 overflow-y-auto p-1">
            {pendingFiles.map((pf) => (
              <div
                key={pf.id}
                className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-2.5 text-xs flex flex-col justify-between"
              >
                <button
                  onClick={() => removeFile(pf.id)}
                  className="absolute top-1.5 right-1.5 z-10 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition shadow"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>

                <div className="h-28 rounded-lg bg-slate-200 flex items-center justify-center overflow-hidden mb-2">
                  {pf.type.includes('pdf') ? (
                    <FileText className="w-8 h-8 text-rose-500" />
                  ) : (
                    <img
                      src={pf.previewUrl}
                      alt={pf.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  )}
                </div>

                <div className="truncate">
                  <div className="font-bold text-slate-800 truncate" title={pf.name}>
                    {pf.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{formatFileSize(pf.size)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleStartProcessing}
              className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-indigo-200 transition"
            >
              <span>Process {pendingFiles.length} Receipts with Gemini AI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
