import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Download,
  ArrowRight,
  Eye,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  SAMPLE_RECEIPTS_CATALOG,
  generateSampleReceiptImage,
  SampleReceiptMeta,
} from '../utils/sampleReceipts';
import { PendingUploadFile } from './UploadView';

interface SampleReceiptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleForProcessing: (files: PendingUploadFile[]) => void;
}

export const SampleReceiptsModal: React.FC<SampleReceiptsModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleForProcessing,
}) => {
  if (!isOpen) return null;

  const [selectedSample, setSelectedSample] = useState<SampleReceiptMeta>(
    SAMPLE_RECEIPTS_CATALOG[0]
  );
  const [previewImage, setPreviewImage] = useState<string>(() =>
    generateSampleReceiptImage(SAMPLE_RECEIPTS_CATALOG[0].id)
  );

  const handleSelectSample = (sample: SampleReceiptMeta) => {
    setSelectedSample(sample);
    setPreviewImage(generateSampleReceiptImage(sample.id));
  };

  const handleProcessSingle = () => {
    const fileObj: PendingUploadFile = {
      id: `sample-${Date.now()}-${selectedSample.id}`,
      file: null,
      name: selectedSample.fileName,
      size: 55000,
      type: 'image/png',
      base64Data: previewImage,
      previewUrl: previewImage,
    };
    onSelectSampleForProcessing([fileObj]);
    onClose();
  };

  const handleProcessAll = () => {
    const allFiles: PendingUploadFile[] = SAMPLE_RECEIPTS_CATALOG.map((s) => {
      const b64 = generateSampleReceiptImage(s.id);
      return {
        id: `sample-${Date.now()}-${s.id}`,
        file: null,
        name: s.fileName,
        size: 55000,
        type: 'image/png',
        base64Data: b64,
        previewUrl: b64,
      };
    });
    onSelectSampleForProcessing(allFiles);
    onClose();
  };

  const handleDownloadImage = () => {
    const link = document.createElement('a');
    link.href = previewImage;
    link.download = selectedSample.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Realistic Sample Receipts Library
              </h2>
              <p className="text-xs text-slate-500">
                Test Gemini AI's multi-layout extraction across diverse real-world Indian hostel receipt formats.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          
          {/* Left catalog list (4 cols) */}
          <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-800 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-900/60">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Available Formats
            </span>

            {SAMPLE_RECEIPTS_CATALOG.map((s) => {
              const isSelected = selectedSample.id === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSample(s)}
                  className={`p-3 rounded-xl border cursor-pointer transition text-xs ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-200 shadow-xs'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold">{s.title}</span>
                    <span className="text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                      {s.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                    {s.description}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{s.expectedData.hostelName}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      ₹{s.expectedData.amount}
                    </span>
                  </div>
                </div>
              );
            })}

            <div className="pt-2">
              <button
                onClick={handleProcessAll}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <span>Extract All 4 Samples in Batch</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right preview (8 cols) */}
          <div className="md:col-span-8 flex flex-col overflow-hidden bg-slate-950 p-4">
            <div className="flex items-center justify-between pb-3 text-xs text-slate-300 shrink-0">
              <span className="font-semibold">{selectedSample.fileName}</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleDownloadImage}
                  className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample</span>
                </button>
                <button
                  onClick={handleProcessSingle}
                  className="flex items-center space-x-1 px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-md transition text-xs shadow-xs"
                >
                  <span>Extract This Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-2">
              <img
                src={previewImage}
                alt={selectedSample.title}
                className="max-h-[60vh] max-w-full object-contain rounded shadow-xl border border-slate-800"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
