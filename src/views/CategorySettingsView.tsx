import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { useBudgetStore } from '../stores/budgetStore';
import { useToastStore } from '../stores/toastStore';
import logger from '../utils/logger';
import Moveable from 'moveable';
import { useLongPress, LongPressEventType } from 'use-long-press';

export const CategorySettingsView: React.FC = () => {
  const navigate = useNavigate();
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useBudgetStore();
  const { showToast } = useToastStore();

  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Drag-and-drop state
  const [localCategories, setLocalCategories] = useState(categories);
  const localOrderRef = useRef(categories);
  const [isReordering, setIsReordering] = useState(false);
  const [activelyDraggingId, setActivelyDraggingId] = useState<string | null>(null);
  const isManualDrag = useRef(false);
  const reorderConstraintsRef = useRef<HTMLDivElement | null>(null);
  const moveableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const moveableInstances = useRef<{ [key: string]: Moveable | null }>({});
  const moveableDragState = useRef<{ 
    activeId: string | null; 
    startIndex: number; 
    currentIndex: number;
    itemHeight: number;
  }>({
    activeId: null,
    startIndex: 0,
    currentIndex: 0,
    itemHeight: 0
  });

  useEffect(() => {
    if (!isReordering) {
      setLocalCategories(categories);
      localOrderRef.current = categories;
    }
  }, [categories, isReordering]);

  // Prevent body scroll when reordering
  useEffect(() => {
    if (isReordering) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isReordering]);

  const handleLongPressTrigger = useCallback((e: any, id: string) => {
    logger.log('🎯 Long press triggered for category:', id);
    const instance = moveableInstances.current[id];
    if (instance) {
      logger.log('✅ Moveable instance found, starting drag');
      isManualDrag.current = true;
      const event = e.nativeEvent || e;
      instance.dragStart(event);
    } else {
      logger.log('❌ No moveable instance found for:', id);
    }
  }, []);

  const setMoveableRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) moveableRefs.current[id] = el;
    else delete moveableRefs.current[id];
  }, []);

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
      logger.error(error);
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
      logger.error(error);
      showToast('Failed to update category', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Envelopes in this category will become Uncategorized.')) return;
    try {
      await deleteCategory(id);
      showToast('Category deleted', 'success');
    } catch (error) {
      logger.error(error);
      showToast('Failed to delete category', 'error');
    }
  };

  const MOVEABLE_ITEM_GAP = 8;
  const clampValue = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const persistReorder = useCallback(async (orderedCategories: typeof categories) => {
    if (!orderedCategories.length) return;
    const orderedIds = orderedCategories.map(cat => cat.id);
    try {
      await reorderCategories(orderedIds);
    } catch (error) {
      logger.error('Failed to persist category order:', error);
      showToast('Failed to save category order', 'error');
    }
  }, [reorderCategories, showToast]);

  useEffect(() => {
    const destroyMoveables = () => {
      Object.values(moveableInstances.current).forEach(instance => instance?.destroy());
      moveableInstances.current = {};
    };

    if (!localCategories.length) return;

    const initializeMoveable = () => {
      localCategories.forEach((category) => {
        const element = moveableRefs.current[category.id];
        if (!element || !reorderConstraintsRef.current) return;

        const moveable = new Moveable(reorderConstraintsRef.current, {
          target: element,
          draggable: true,
          throttleDrag: 0,
          snappable: true,
          snapThreshold: 5,
          snapDirections: {"top": true, "bottom": true},
          elementSnapDirections: {"top": true, "bottom": true},
          clickable: true,
          dragArea: false,
          hideDefaultLines: true,
          renderDirections: [],
          edge: false,
          origin: false,
        });

        moveable.on('dragStart', (e: any) => {
          logger.log('🚀 Moveable dragStart event', { isManualDrag: isManualDrag.current, categoryId: category.id });
          if (!isManualDrag.current) { 
            logger.log('⏭️ Stopping drag - not manual');
            e.stop(); 
            return; 
          }
          const target = e.inputEvent.target as HTMLElement;
          if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) { 
            logger.log('⏭️ Stopping drag - clicked on button/input');
            e.stop(); 
            return; 
          }
          logger.log('✅ Drag starting for category:', category.id);

          const startIndex = localOrderRef.current.findIndex(cat => cat.id === category.id);
          const targetEl = e.target as HTMLElement;
          const rect = targetEl.getBoundingClientRect();
          
          setActivelyDraggingId(category.id);
          moveableDragState.current = {
            activeId: category.id,
            startIndex,
            currentIndex: startIndex,
            itemHeight: rect.height + MOVEABLE_ITEM_GAP
          };
          
          targetEl.style.transition = 'none';
          targetEl.style.boxShadow = '0 18px 45px rgba(15,23,42,0.35)';
          targetEl.style.zIndex = '20';
          setIsReordering(true);
        });

        let rafId: number | null = null;
        moveable.on('drag', (e: any) => {
          const targetEl = e.target as HTMLElement;
          if (rafId !== null) cancelAnimationFrame(rafId);
          
          rafId = requestAnimationFrame(() => {
            const dragState = moveableDragState.current;
            if (dragState.activeId !== category.id) return;

            const translateY = e.beforeTranslate[1];
            targetEl.style.transform = `translateY(${translateY}px)`;
            targetEl.style.transition = 'none';

            const { itemHeight, startIndex } = dragState;
            const indexOffset = Math.round(translateY / itemHeight);
            const targetIndex = clampValue(startIndex + indexOffset, 0, localOrderRef.current.length - 1);

            if (targetIndex !== dragState.currentIndex) {
              dragState.currentIndex = targetIndex;
              localOrderRef.current.forEach((cat, idx) => {
                if (cat.id === category.id) return;
                const otherEl = moveableRefs.current[cat.id];
                if (!otherEl) return;
                
                let offset = 0;
                if (startIndex < targetIndex && idx > startIndex && idx <= targetIndex) offset = -itemHeight;
                else if (startIndex > targetIndex && idx >= targetIndex && idx < startIndex) offset = itemHeight;
                
                otherEl.style.transform = offset ? `translateY(${offset}px)` : '';
                otherEl.style.transition = 'transform 0.2s ease';
              });
            }
            rafId = null;
          });
        });

        moveable.on('dragEnd', (e: any) => {
          if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
          const targetEl = e.target as HTMLElement;
          const { startIndex, currentIndex } = moveableDragState.current;
          
          targetEl.style.transform = '';
          targetEl.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease';
          targetEl.style.boxShadow = '';
          
          localOrderRef.current.forEach((cat) => {
            const otherEl = moveableRefs.current[cat.id];
            if (otherEl) { otherEl.style.transform = ''; otherEl.style.transition = ''; }
          });
          
          if (startIndex !== currentIndex) {
            const updated = [...localOrderRef.current];
            const [item] = updated.splice(startIndex, 1);
            updated.splice(currentIndex, 0, item);
            localOrderRef.current = updated;
            setLocalCategories(updated);
            persistReorder(updated);
          }
          
          setTimeout(() => {
            targetEl.style.zIndex = '';
            setActivelyDraggingId(null);
            setIsReordering(false);
            isManualDrag.current = false;
          }, 300);
        });

        moveableInstances.current[category.id] = moveable;
      });
    };

    const timeoutId = window.setTimeout(initializeMoveable, 80);
    return () => { clearTimeout(timeoutId); destroyMoveables(); };
  }, [localCategories, persistReorder]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      <style>{`
        .moveable-control-box,
        .moveable-line,
        .moveable-direction {
          display: none !important;
        }
      `}</style>
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
        <div 
          ref={reorderConstraintsRef} 
          className="space-y-2"
          style={{ touchAction: isReordering ? 'none' : 'auto' }}
        >
          {localCategories.map((category) => {
            const bind = useLongPress((event) => {
              handleLongPressTrigger(event, category.id);
            }, {
              threshold: 500,
              cancelOnMovement: 25,
              detect: LongPressEventType.Touch
            });
            const isBeingDragged = activelyDraggingId === category.id;
            
            return (
            <div 
              key={category.id} 
              {...bind()}
              ref={setMoveableRef(category.id)}
              style={{
                cursor: isBeingDragged ? 'grabbing' : 'pointer'
              }}
              className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-zinc-800 flex items-center justify-between group select-none">
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
                    <div 
                      className="text-gray-400 dark:text-zinc-600 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => handleLongPressTrigger(e, category.id)}
                    >
                      <GripVertical size={20} />
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
            );
          })}
          
          {localCategories.length === 0 && !isAdding && (
            <div className="text-center text-gray-500 dark:text-zinc-500 py-8">
              No categories yet. Add one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
