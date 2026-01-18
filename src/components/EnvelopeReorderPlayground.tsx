import React, { useRef, useState, useEffect } from 'react';
import Moveable from 'moveable';

interface MockEnvelope {
  id: string;
  name: string;
  balance: number;
  color: string;
}

const mockEnvelopes: MockEnvelope[] = [
  { id: '1', name: 'Groceries', balance: 250.00, color: '#10B981' },
  { id: '2', name: 'Rent', balance: 1200.00, color: '#3B82F6' },
  { id: '3', name: 'Entertainment', balance: 150.00, color: '#F59E0B' },
  { id: '4', name: 'Transportation', balance: 200.00, color: '#EF4444' },
  { id: '5', name: 'Utilities', balance: 180.00, color: '#8B5CF6' },
];

export const EnvelopeReorderPlayground: React.FC = () => {
  const [envelopes, setEnvelopes] = useState<MockEnvelope[]>(mockEnvelopes);
  const moveableRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const moveableInstances = useRef<{ [key: string]: Moveable | null }>({});



  useEffect(() => {
    // Initialize Moveable instances for each envelope
    envelopes.forEach((envelope) => {
      if (moveableRefs.current[envelope.id] && !moveableInstances.current[envelope.id]) {
        const moveable = new Moveable(moveableRefs.current[envelope.id]!.parentElement!, {
          target: moveableRefs.current[envelope.id],
          draggable: true,
          snappable: true,
          snapThreshold: 5,
          snapDirections: { top: true, bottom: true },
          snapGap: false,
          elementGuidelines: [],
          // Disable visual guides and outlines
          hideDefaultLines: true,
          hideChildMoveableDefaultLines: true,
        });

        moveable.on('drag', (e: any) => {
          e.target.style.transform = e.transform;
        });

        moveable.on('dragEnd', (e: any) => {
          // Reset transform
          e.target.style.transform = '';

          // Calculate new position based on drag distance
          const dragDistance = e.lastEvent ? e.lastEvent.dist[1] : 0; // Vertical distance dragged
          const itemHeight = (e.target as HTMLElement).offsetHeight + 8; // Including margin (space-y-2 = 8px)

          // Calculate how many positions to move
          const positionsMoved = Math.round(dragDistance / itemHeight);
          const currentIndex = envelopes.findIndex(env => env.id === envelope.id);
          const newIndex = Math.max(0, Math.min(envelopes.length - 1, currentIndex + positionsMoved));

          // Only reorder if position actually changed
          if (newIndex !== currentIndex) {
            const newEnvelopes = [...envelopes];
            const [removed] = newEnvelopes.splice(currentIndex, 1);
            newEnvelopes.splice(newIndex, 0, removed);
            setEnvelopes(newEnvelopes);
          }
        });

        moveableInstances.current[envelope.id] = moveable;
      }
    });

    // Cleanup function
    return () => {
      Object.values(moveableInstances.current).forEach(instance => {
        if (instance) instance.destroy();
      });
      moveableInstances.current = {};
    };
  }, [envelopes]);

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Moveable Reorder Playground
      </h1>

      <div className="space-y-2">
        {envelopes.map((envelope) => (
          <div
            key={envelope.id}
            ref={(el: HTMLDivElement | null) => {
              moveableRefs.current[envelope.id] = el;
            }}
            className="relative bg-white dark:bg-zinc-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-zinc-700 cursor-move"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: envelope.color }}
                />
                <span className="font-medium text-gray-900 dark:text-white">
                  {envelope.name}
                </span>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">
                ${envelope.balance.toFixed(2)}
              </span>
            </div>

            {/* Drag handle indicator */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-30">
              <div className="flex flex-col gap-0.5">
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Testing Notes
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Drag envelopes vertically to reorder</li>
          <li>• Items snap to row positions using Moveable's snappable</li>
          <li>• Test on mobile Safari/Chrome for touch smoothness</li>
          <li>• Compare with current Framer Motion Reorder performance</li>
          <li>• Note: Basic implementation - may need refinement for production</li>
        </ul>
      </div>
    </div>
  );
};