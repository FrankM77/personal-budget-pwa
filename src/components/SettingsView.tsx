import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, Trash2, AlertTriangle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useEnvelopeStore } from '../store/envelopeStore';
import { useThemeStore } from '../store/themeStore';

export const SettingsView: React.FC = () => {
  const navigate = useNavigate();
  const { envelopes, transactions } = useEnvelopeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { theme, setTheme } = useThemeStore();

  // 1. EXPORT LOGIC
  const handleExport = () => {
    try {
      const dataToExport = {
        envelopes,
        transactions,
        exportDate: new Date().toISOString(),
        version: '1.0'
      };

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Backup downloaded successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to create backup file.' });
    }
  };

  // 2. IMPORT LOGIC
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);

        // Simple Validation
        if (!Array.isArray(parsed.envelopes) || !Array.isArray(parsed.transactions)) {
          throw new Error('Invalid file format: Missing envelopes or transactions arrays.');
        }

        // Direct State Manipulation (Zustand)
        useEnvelopeStore.setState({
          envelopes: parsed.envelopes,
          transactions: parsed.transactions
        });

        setMessage({ type: 'success', text: 'Data restored successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (error) {
        console.error(error);
        setMessage({ type: 'error', text: 'Invalid backup file. restoration failed.' });
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    event.target.value = '';
  };

  // 3. RESET LOGIC
  const handleReset = () => {
    if (window.confirm('Are you sure? This will delete ALL envelopes and transactions permanently.')) {
      useEnvelopeStore.setState({
        envelopes: [],
        transactions: []
      });
      setMessage({ type: 'success', text: 'All data has been cleared.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 py-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate('/')} className="mr-3 text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings & Backup</h1>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-6">
        
        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* Appearance Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Appearance</h2>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">Theme</p>
            <div className="grid grid-cols-3 bg-gray-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium">
              {(['light','dark','system'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`py-2 rounded-lg capitalize transition-colors ${
                    theme === value
                      ? 'bg-white text-gray-900 dark:bg-black dark:text-white shadow'
                      : 'text-gray-500 dark:text-zinc-400'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Data Management</h2>
          
          {/* Export Card */}
          <div 
            onClick={handleExport}
            className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="p-3 bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 rounded-full">
              <Download size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Export Backup</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Save your data to a JSON file</p>
            </div>
          </div>

          {/* Import Card */}
          <div 
            onClick={handleImportClick}
            className="bg-white dark:bg-zinc-900 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center gap-4 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="p-3 bg-green-50 text-green-600 dark:bg-emerald-900/40 dark:text-emerald-300 rounded-full">
              <Upload size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Import Backup</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Restore from a JSON file</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-4">
          <h2 className="text-sm font-bold text-red-500 uppercase tracking-wider ml-1">Danger Zone</h2>
          
          <div 
            onClick={handleReset}
            className="bg-red-50 dark:bg-red-950/40 p-5 rounded-xl shadow-sm border border-red-100 dark:border-red-900 flex items-center gap-4 active:scale-[0.99] transition-transform cursor-pointer"
          >
            <div className="p-3 bg-white dark:bg-red-900/60 text-red-600 dark:text-red-200 rounded-full shadow-sm">
              <Trash2 size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-700 dark:text-red-300">Reset App Data</h3>
              <p className="text-sm text-red-500 dark:text-red-300/80">Delete all envelopes and history</p>
            </div>
          </div>
        </section>

        {/* App Info */}
        <div className="text-center text-gray-400 dark:text-zinc-500 text-sm pt-8">
          <p>Envelope Budget PWA</p>
          <p>v1.0.0</p>
        </div>
      </div>
    </div>
  );
};
