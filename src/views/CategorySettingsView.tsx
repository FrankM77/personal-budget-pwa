import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, ArrowUp, ArrowDown } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';

export const CategorySettingsView: React.FC = () => {
  const navigate = useNavigate();
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useBudgetStore();
  const { showToast } = useToastStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await addCategory({
        name: newCategoryName.trim(),
        orderIndex: categories.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setNewCategoryName('');
      setIsAdding(false);
      showToast('Category added', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to add category', 'error');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const category = categories.find(c => c.id === id);
    if (!category) return;

    try {
      await updateCategory({ ...category, name: editName.trim() });
      setEditingId(null);
      showToast('Category updated', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to update category', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Envelopes in this category will become Uncategorized.')) return;
    try {
      await deleteCategory(id);
      showToast('Category deleted', 'success');
    } catch (error) {
      console.error(error);
      showToast('Failed to delete category', 'error');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categories.length - 1) return;

    const newCategories = [...categories];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]];
    
    // Update order indices locally first for optimistic feel? 
    // Actually store.reorderCategories expects just the IDs in order.
    const orderedIds = newCategories.map(c => c.id);
    
    try {
      await reorderCategories(orderedIds);
    } catch (error) {
      console.error(error);
      showToast('Failed to reorder', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <header className="bg-white dark:bg-black border-b dark:border-zinc-800 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => navigate(-1)} className="mr-3 text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manage Categories</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Add Category */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800">
          {isAdding ? (
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category Name"
                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg outline-none dark:text-white"
                autoFocus
              />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">Save</button>
              <button type="button" onClick={() => setIsAdding(false)} className="text-gray-500 px-2">Cancel</button>
            </form>
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-medium py-2"
            >
              <Plus size={20} />
              Add Category
            </button>
          )}
        </div>

        {/* Category List */}
        <div className="space-y-2">
          {categories.map((category, index) => (
            <div key={category.id} className="bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-zinc-800 flex items-center justify-between group">
              {editingId === category.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded-lg outline-none dark:text-white"
                    autoFocus
                  />
                  <button onClick={() => handleUpdate(category.id)} className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-gray-500 px-2 text-sm">Cancel</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1 text-gray-400">
                      <button 
                        onClick={() => handleMove(index, 'up')} 
                        disabled={index === 0}
                        className="hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => handleMove(index, 'down')} 
                        disabled={index === categories.length - 1}
                        className="hover:text-blue-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{category.name}</span>
                  </div>
                  
                  <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                      className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(category.id)}
                      className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {categories.length === 0 && !isAdding && (
            <div className="text-center text-gray-500 dark:text-zinc-500 py-8">
              No categories yet. Add one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
