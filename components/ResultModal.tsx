import React, { useState } from 'react';
import { Task } from '../types';
import { X, Table, FileJson, Copy, Check, MapPin, DollarSign, Star } from 'lucide-react';

interface ResultModalProps {
  task: Task | null;
  onClose: () => void;
}

const ResultModal: React.FC<ResultModalProps> = ({ task, onClose }) => {
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [copied, setCopied] = useState(false);

  if (!task || !task.result) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(task.result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 ring-1 ring-black/5">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-900">Result Details</h2>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-mono">
                {task.id.slice(0, 8)}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate max-w-lg mt-1">{task.url}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex bg-gray-200/60 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-gray-200' : 'text-gray-500 hover:text-gray-700 shadow-transparent bg-transparent'
              }`}
            >
              <Table size={16} /> Preview
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all shadow-sm ${
                viewMode === 'json' ? 'bg-white text-gray-900 shadow-gray-200' : 'text-gray-500 hover:text-gray-700 shadow-transparent bg-transparent'
              }`}
            >
              <FileJson size={16} /> JSON
            </button>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
               copied 
               ? 'bg-green-50 text-green-600 border-green-200' 
               : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50">
          {viewMode === 'table' ? (
            <div className="space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hotel Name</span>
                      <div className="text-lg font-bold text-gray-900 mt-1 leading-tight">{task.result.name}</div>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-100">
                        <Star size={14} className="fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-bold text-yellow-700">{task.result.rating}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-start gap-3">
                     <div className="p-2 bg-green-50 rounded-lg text-green-600">
                        <DollarSign size={20} />
                     </div>
                     <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estimated Price</span>
                        <div className="text-lg font-bold text-gray-900 mt-1">{task.result.price}</div>
                     </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm md:col-span-2">
                   <div className="flex items-start gap-3">
                     <div className="p-2 bg-blue-50 rounded-lg text-blue-600 mt-1">
                        <MapPin size={20} />
                     </div>
                     <div>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Address</span>
                        <div className="text-sm font-medium text-gray-700 mt-1">{task.result.address}</div>
                     </div>
                   </div>
                </div>
              </div>

              {/* Gallery Preview */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                  Extracted Images <span className="bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">{task.result.images.length}</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {task.result.images.map((img, idx) => (
                    <a key={idx} href={img} target="_blank" rel="noreferrer" className="group relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all">
                      <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="text-xs font-semibold text-white bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">View Full</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
                <pre className="font-mono text-xs text-blue-700 whitespace-pre-wrap break-all bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                {JSON.stringify(task.result, null, 2)}
                </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultModal;