import React, { useState, useMemo } from 'react';
import { Save, Download, Trash2, X } from 'lucide-react';
import { useEnvelopeStore } from '../../stores/envelopeStore'; 
import type { DistributionTemplate } from '../../models/types'; 

interface DistributeFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DistributeFundsModal: React.FC<DistributeFundsModalProps> = ({ isOpen, onClose }) => {
  const { envelopes, addToEnvelope, distributionTemplates, saveTemplate, deleteTemplate } = useEnvelopeStore();
  
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [note, setNote] = useState<string>('');
  
  // UI States
  const [showSaveUI, setShowSaveUI] = useState(false);
  const [showLoadUI, setShowLoadUI] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const activeEnvelopes = useMemo(() =>
    envelopes
      .sort((a, b) => a.name.localeCompare(b.name)), // Sort by name since orderIndex might not be set
  [envelopes]);

  const depositValue = parseFloat(depositAmount) || 0;
  
  const totalDistributed = useMemo(() => {
    return Object.values(allocations).reduce((sum, val) => sum + val, 0);
  }, [allocations]);

  const remainingAmount = depositValue - totalDistributed;
  
  // LOGIC: strictly balanced check
  const isBalanced = Math.abs(remainingAmount) < 0.01;
  const isValid = depositValue > 0 && isBalanced;
  
  // Strict Save Condition
  const isSaveable = totalDistributed > 0 && isBalanced;

  const handleAllocationChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    setAllocations(prev => ({
      ...prev,
      [id]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleApply = () => {
    if (!isValid) return;
    Object.entries(allocations).forEach(([id, amount]) => {
      if (amount > 0) {
        addToEnvelope(id, amount, note || 'Deposit', new Date());
      }
    });
    setDepositAmount('');
    setAllocations({});
    setNote('');
    onClose();
  };

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    // UPDATED: Now passing the 'note' state variable instead of ""
    saveTemplate(newTemplateName, allocations, note); 
    setShowSaveUI(false);
    setNewTemplateName('');
  };

  const handleLoadTemplate = (template: DistributionTemplate) => {
    setAllocations(template.distributions);
    const totalRequired = Object.values(template.distributions).reduce((sum, val) => sum + val, 0);
    setDepositAmount(totalRequired.toFixed(2));
    
    // UPDATED: Now pre-populating the note field
    setNote(template.note || "");
    
    setShowLoadUI(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50 dark:bg-black sm:bg-gray-100 dark:sm:bg-black">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 flex items-center justify-between shadow-sm shrink-0">
        <button onClick={onClose} className="text-blue-600 dark:text-blue-400 font-medium text-base">Cancel</button>
        <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Distribute Funds</h2>
        <button 
          onClick={handleApply}
          disabled={!isValid}
          className={`font-bold text-base ${isValid ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-zinc-600'}`}
        >
          Apply
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-20 relative">
        <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-black/95 backdrop-blur-sm border-b border-gray-200 dark:border-zinc-800 shadow-sm p-4 space-y-4">
          
          {/* Deposit Input */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
            <label className="block text-sm font-medium text-gray-500 dark:text-zinc-400 mb-1">Deposit Amount</label>
            <div className="flex items-center">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 mr-2">$</span>
              <input 
                type="number"
                inputMode="decimal" 
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                className="text-3xl font-bold text-black dark:text-white w-full focus:outline-none bg-white dark:bg-zinc-900 placeholder-gray-300 dark:placeholder-zinc-600 appearance-none"
                autoFocus
              />
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-between items-center text-sm font-medium px-1">
            <div className="flex flex-col">
              <span className="text-gray-500 dark:text-zinc-400">Distributed</span>
              <span className="text-gray-900 dark:text-white">${totalDistributed.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-gray-500 dark:text-zinc-400">Remaining</span>
              <span className={`text-lg ${remainingAmount === 0 ? 'text-green-600 dark:text-green-400' : remainingAmount < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                ${remainingAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* WARNING TEXT */}
          {!isBalanced && depositValue > 0 && (
             <div className="text-center text-sm font-medium text-red-500 dark:text-red-400">
                {remainingAmount > 0 
                  ? `You still have $${remainingAmount.toFixed(2)} to distribute`
                  : `You have over-allocated by $${Math.abs(remainingAmount).toFixed(2)}`
                }
             </div>
          )}

          {/* BUTTON LOGIC */}
          <div className="pt-2">
            {isSaveable ? (
                /* Balanced -> Show Both */
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setShowLoadUI(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 dark:bg-zinc-800 rounded-lg text-blue-400 font-medium text-sm hover:bg-gray-700 transition-colors"
                    >
                        <Download size={16} />
                        Load Template
                    </button>
                    <button 
                        onClick={() => setShowSaveUI(true)}
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 dark:bg-zinc-800 text-green-400 rounded-lg font-medium text-sm hover:bg-gray-700 transition-colors"
                    >
                        <Save size={16} />
                        Save Template
                    </button>
                </div>
            ) : (
                /* Not Balanced -> Show Load + Helper */
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => setShowLoadUI(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-800 dark:bg-zinc-800 rounded-lg text-blue-400 font-medium text-sm hover:bg-gray-700 transition-colors"
                    >
                        <Download size={16} />
                        Load Template
                    </button>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 text-center px-2 leading-relaxed">
                        You can save this as a template once the Deposit Amount and Total Distributed are equal (Remaining = $0).
                    </p>
                </div>
            )}
          </div>

          <input 
            type="text" 
            placeholder="Distribution Note (Optional)" 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full p-3 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-zinc-600"
          />
        </div>

        {/* Allocations List */}
        <div className="p-4 space-y-3">
          {activeEnvelopes.map((env) => {
            const currentAlloc = allocations[env.id] || 0;
            const percent = totalDistributed > 0 ? Math.round((currentAlloc / totalDistributed) * 100) : 0;

            return (
              <div key={env.id} className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{env.name}</h3>
                    {currentAlloc > 0 && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        {percent}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-zinc-400">
                    Budget: ${env.budget?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <div className="w-32 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500">$</span>
                  <input 
                    type="number"
                    inputMode="decimal"
                    value={allocations[env.id] === 0 ? '' : allocations[env.id]}
                    onChange={(e) => handleAllocationChange(env.id, e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-6 py-2 text-right bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none font-mono text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-zinc-600 appearance-none"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Template Modal */}
      {showSaveUI && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-zinc-700">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Save Template</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Name your template to easily recall this distribution later.
                </p>
                <input 
                    autoFocus
                    type="text" 
                    placeholder="e.g. Payday Split"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full p-3 bg-gray-100 dark:bg-black rounded-xl mb-4 text-gray-900 dark:text-white border border-transparent focus:border-blue-500 outline-none"
                />
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowSaveUI(false)} 
                        className="flex-1 py-3 text-gray-600 dark:text-gray-400 font-semibold"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSaveTemplate}
                        disabled={!newTemplateName.trim()}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Load Template Modal */}
      {showLoadUI && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-gray-200 dark:border-zinc-700 max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Load Template</h3>
                    <button onClick={() => setShowLoadUI(false)} className="p-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="overflow-y-auto p-2 space-y-2">
                    {distributionTemplates.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-zinc-500">
                            No templates saved yet.
                        </div>
                    ) : (
                        distributionTemplates.map(t => (
                            <div key={t.id} className="flex items-center gap-2 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-xl group transition-colors">
                                <button 
                                    onClick={() => handleLoadTemplate(t)}
                                    className="flex-1 text-left"
                                >
                                    <div className="font-semibold text-gray-900 dark:text-white">{t.name}</div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        Total: ${Object.values(t.distributions).reduce((a,b)=>a+b,0).toFixed(2)}
                                        {t.note && <span className="ml-2 opacity-75">• {t.note}</span>}
                                    </div>
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(confirm("Delete this template?")) deleteTemplate(t.id);
                                    }}
                                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};