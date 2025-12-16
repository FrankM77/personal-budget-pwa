import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, Trash2, CheckCircle, ChevronRight, FileText, RefreshCw, Loader } from 'lucide-react';
import { useEnvelopeStore } from '../stores/envelopeStore';

export const SettingsView: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { envelopes, transactions, distributionTemplates, resetData, importData, getEnvelopeBalance, appSettings, updateAppSettings, initializeAppSettings, cleanupOrphanedTemplates } = useEnvelopeStore();
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastBackupDate, setLastBackupDate] = useState<string>(() => {
    return localStorage.getItem('lastBackupDate') || 'Never';
  });
  const [isCleaningTemplates, setIsCleaningTemplates] = useState(false);

  const APPLE_EPOCH_OFFSET = 978307200;

  // Use appSettings theme, fallback to system
  const currentTheme = appSettings?.theme ?? 'system';

  // Initialize app settings if they don't exist
  useEffect(() => {
    if (!appSettings) {
      initializeAppSettings().catch(error => {
        console.error('Failed to initialize app settings:', error);
      });
    }
  }, [appSettings, initializeAppSettings]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const dataSummary = useMemo(() => {
    const envelopeCount = envelopes.length;
    const transactionCount = transactions.length;
    const templateCount = distributionTemplates.length;
    const totalBalance = envelopes.reduce((sum, env) => sum + getEnvelopeBalance(env.id!).toNumber(), 0);

    // New store doesn't have lastUpdated, so use latest transaction date
    const latestEnvelope = 0;

    const latestTransaction = transactions.reduce((max, tx) => {
      let ts = 0;
      if (typeof tx.date === 'string') {
        const parsed = Date.parse(tx.date);
        ts = Number.isNaN(parsed) ? 0 : parsed;
      } else if (typeof tx.date === 'number') {
        ts = tx.date < 2000000000 ? (tx.date + APPLE_EPOCH_OFFSET) * 1000 : tx.date;
      }
      return Math.max(max, ts);
    }, 0);

    const lastUpdated =
      latestEnvelope || latestTransaction
        ? new Date(Math.max(latestEnvelope, latestTransaction)).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Never';

    return {
      envelopeCount,
      transactionCount,
      templateCount,
      totalBalance,
      lastUpdated,
    };
  }, [envelopes, transactions, distributionTemplates]);

  const handleBackup = () => {
    try {
      const backupData = {
        appVersion: '2.0 (PWA)',
        backupDate: Date.now(),
        appSettings: appSettings || {
          theme: 'system',
        },
        envelopes: envelopes.map(env => ({
          ...env,
          currentBalance: getEnvelopeBalance(env.id!).toNumber(), // Use computed balance for backup compatibility
          lastUpdated: new Date().toISOString()
        })),
        transactions,
        distributionTemplates,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HouseBudget_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Update last backup date
      const now = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      localStorage.setItem('lastBackupDate', now);
      setLastBackupDate(now);

      showStatus('success', 'Backup downloaded successfully.');
    } catch (error) {
      console.error(error);
      showStatus('error', 'Failed to create backup file.');
    }
  };

  const handleExportCSV = () => {
    try {
      const headers = ['Date', 'Description', 'Amount', 'Type', 'Envelope', 'Reconciled'];
      const rows = transactions.map((t) => {
        const envName = envelopes.find((e) => e.id === t.envelopeId)?.name || 'Unknown';
        const safeDesc = (t.description || '').replace(/"/g, '""');
        let dateStr = 'Invalid Date';
        if (t.date) {
          if (typeof t.date === 'string') {
            dateStr = t.date.split('T')[0];
          } else if (typeof t.date === 'number') {
            const ts = t.date < 2000000000 ? (t.date + APPLE_EPOCH_OFFSET) * 1000 : t.date;
            dateStr = new Date(ts).toISOString().split('T')[0];
          }
        }
        return [
          dateStr,
          `"${safeDesc}"`,
          parseFloat(t.amount).toFixed(2),
          t.type,
          `"${envName}"`,
          t.reconciled ? 'Yes' : 'No',
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HouseBudget_Transactions_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showStatus('success', 'CSV export ready to open in Excel/Numbers.');
    } catch (error) {
      console.error(error);
      showStatus('error', 'Failed to export CSV.');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const result = importData(parsed);

        if (!result.success) {
          showStatus('error', result.message);
          return;
        }

        if (parsed.appSettings?.theme) {
          try {
            await updateAppSettings({ theme: parsed.appSettings.theme });
          } catch (error) {
            console.error('Failed to update imported settings:', error);
          }
        } else if (parsed.appSettings?.isDarkMode !== undefined) {
          // Backward compatibility with old backups
          try {
            const theme = parsed.appSettings.isDarkMode ? 'dark' : 'light';
            await updateAppSettings({ theme });
          } catch (error) {
            console.error('Failed to update imported settings:', error);
          }
        }

        showStatus(
          'success',
          `Loaded ${parsed.envelopes?.length ?? 0} envelopes, ${parsed.transactions?.length ?? 0} transactions, and ${parsed.distributionTemplates?.length ?? 0} templates.`
        );
      } catch (error) {
        console.error(error);
        showStatus('error', 'Invalid backup file. Please verify the JSON.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleCleanupTemplates = async () => {
    setIsCleaningTemplates(true);
    try {
      showStatus('success', 'Scanning templates for orphaned references...');
      await cleanupOrphanedTemplates();
      showStatus('success', 'Orphaned templates have been cleaned up successfully.');
    } catch (error) {
      console.error('Template cleanup failed:', error);
      showStatus('error', 'Failed to clean up orphaned templates. Check console for details.');
    } finally {
      setIsCleaningTemplates(false);
    }
  };

  const handleReset = async () => {
    if (
      window.confirm(
        'Are you sure? This will permanently delete all envelopes, transactions, templates, and settings from the cloud. This action cannot be undone.'
      )
    ) {
      try {
        await resetData();
        showStatus('success', 'All data has been permanently deleted.');
        navigate('/');
      } catch (error) {
        console.error('Reset failed:', error);
        showStatus('error', 'Failed to delete all data. Some data may remain.');
      }
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-200">
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-20 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="mr-3 text-blue-600 dark:text-blue-400 font-medium">
            Done
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {statusMessage && (
          <div
            className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <Trash2 size={18} />}
            {statusMessage.text}
          </div>
        )}

        {/* Backup hero */}
        <section>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Download className="text-blue-500" size={22} />
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">Backup & Restore</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Create backups of all your data including envelopes, transactions, templates, and settings.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Envelopes</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.envelopeCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Transactions</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.transactionCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Templates</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{dataSummary.templateCount}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500">Data Last Modified</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{dataSummary.lastUpdated}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Appearance</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {currentTheme === 'light' && <span className="text-orange-500 text-lg">☀️</span>}
                {currentTheme === 'dark' && <span className="text-purple-500 text-lg">🌙</span>}
                {currentTheme === 'system' && <span className="text-gray-500 text-lg">⚙️</span>}
                <span className="text-gray-900 dark:text-white font-medium">Theme</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-zinc-400 capitalize">{currentTheme}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
              Choose your preferred appearance.
            </div>
            <div className="flex gap-2">
              {[
                { label: 'Light', value: 'light' as const },
                { label: 'Dark', value: 'dark' as const },
                { label: 'System', value: 'system' as const }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={async () => {
                    try {
                      await updateAppSettings({ theme: option.value });
                    } catch (error) {
                      console.error('Failed to update theme setting:', error);
                    }
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    currentTheme === option.value
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-200'
                      : 'border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Actions */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Actions</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm divide-y divide-gray-100 dark:divide-zinc-800">
            <button
              onClick={handleBackup}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="text-blue-500" size={20} />
                <div className="flex flex-col items-start">
                  <span className="text-gray-900 dark:text-white font-medium">Create Backup</span>
                  <span className="text-xs text-gray-500 dark:text-zinc-400">Last backup: {lastBackupDate}</span>
                </div>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleRestoreClick}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload className="text-blue-500" size={20} />
                <span className="text-gray-900 dark:text-white font-medium">Restore from Backup</span>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleExportCSV}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="text-blue-500" size={20} />
                <span className="text-gray-900 dark:text-white font-medium">Export Transactions (CSV)</span>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>

            <button
              onClick={handleCleanupTemplates}
              disabled={isCleaningTemplates}
              className={`w-full p-4 flex items-center justify-between transition-colors ${
                isCleaningTemplates
                  ? 'bg-gray-50 dark:bg-zinc-800/50 cursor-not-allowed'
                  : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {isCleaningTemplates ? (
                  <Loader className="text-blue-500 animate-spin" size={20} />
                ) : (
                  <RefreshCw className="text-blue-500" size={20} />
                )}
                <span className={`font-medium ${isCleaningTemplates ? 'text-gray-500 dark:text-zinc-400' : 'text-gray-900 dark:text-white'}`}>
                  {isCleaningTemplates ? 'Cleaning Templates...' : 'Clean Up Orphaned Templates'}
                </span>
              </div>
              {isCleaningTemplates ? (
                <div className="text-gray-400 text-sm">Working...</div>
              ) : (
                <ChevronRight className="text-gray-400" size={18} />
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </section>

        {/* Tips */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Tips</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm p-4 text-sm text-gray-600 dark:text-zinc-300 space-y-2">
            <p>Create regular backups before major changes.</p>
            <p>Store backups in iCloud, Files, or another safe location.</p>
            <p>Backups are plain JSON files and can be inspected in any text editor.</p>
            <p>Restoring replaces all current envelopes, transactions, templates, and settings.</p>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase mb-2 px-1">Danger Zone</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-sm">
            <button
              onClick={handleReset}
              className="w-full p-4 flex items-center justify-between hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="text-red-500 group-hover:text-red-600" size={20} />
                <span className="text-red-500 group-hover:text-red-600 font-medium">Reset All Data</span>
              </div>
              <ChevronRight className="text-gray-400" size={18} />
            </button>
          </div>
          <div className="px-1 pt-2 text-xs text-gray-500 dark:text-zinc-500">
            This clears every envelope, transaction, and template. Use with caution.
          </div>
        </section>

        <div className="text-center pt-4 pb-12 text-xs text-gray-400 dark:text-zinc-500 font-medium">
          House Budget PWA • App Version 2.0.1
        </div>
      </div>
    </div>
  );
};