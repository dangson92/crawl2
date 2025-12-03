import React, { useState } from 'react';
import { Task } from '../types';
import {
  X, Table, FileJson, Copy, Check, MapPin, Star, MessageCircle,
  Home, ShieldCheck, Info, Image as ImageIcon
} from 'lucide-react';

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
            <div className="space-y-5">
              {/* Hotel Info Header */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{task.result.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin size={14} className="text-blue-500" />
                      <span>{task.result.address}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200 mb-1">
                      <Star size={16} className="fill-yellow-400 text-yellow-400" />
                      <span className="text-lg font-bold text-yellow-700">{task.result.rating}</span>
                    </div>
                    {task.result.ratingCategory && (
                      <div className="text-xs font-semibold text-yellow-600">{task.result.ratingCategory}</div>
                    )}
                    {task.result.reviewCount && (
                      <div className="text-xs text-gray-500 mt-1">{task.result.reviewCount} reviews</div>
                    )}
                  </div>
                </div>
              </div>

              {/* About Section */}
              {task.result.about && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Info size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">About</h3>
                  </div>
                  <div
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: task.result.about }}
                  />
                </div>
              )}

              {/* Facilities */}
              {task.result.facilities && task.result.facilities.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Home size={16} className="text-purple-600" />
                    <h3 className="text-sm font-bold text-gray-900">Facilities</h3>
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {task.result.facilities.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {task.result.facilities.map((facility, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                        {facility}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* House Rules */}
              {task.result.houseRules && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck size={16} className="text-green-600" />
                    <h3 className="text-sm font-bold text-gray-900">House Rules</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {task.result.houseRules.checkIn && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Check-in</div>
                        <div className="text-sm text-gray-700">{task.result.houseRules.checkIn}</div>
                      </div>
                    )}
                    {task.result.houseRules.checkOut && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Check-out</div>
                        <div className="text-sm text-gray-700">{task.result.houseRules.checkOut}</div>
                      </div>
                    )}
                    {task.result.houseRules.pets && (
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">Pets</div>
                        <div className="text-sm text-gray-700">{task.result.houseRules.pets}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FAQs */}
              {task.result.faqs && task.result.faqs.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle size={16} className="text-orange-600" />
                    <h3 className="text-sm font-bold text-gray-900">Frequently Asked Questions</h3>
                    <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {task.result.faqs.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {task.result.faqs.map((faq, idx) => (
                      <div key={idx} className="border-l-2 border-orange-300 pl-4 py-2">
                        <div className="font-semibold text-sm text-gray-900 mb-1">{faq.question}</div>
                        <div className="text-sm text-gray-600">{faq.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gallery Preview */}
              {task.result.images && task.result.images.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900">Images</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {task.result.images.length}
                    </span>
                  </div>
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
              )}
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