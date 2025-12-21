import React from 'react';
import { Check, X } from 'lucide-react';
import { usePasswordValidation } from '../../utils/passwordValidation';

interface PasswordRequirementsChecklistProps {
  password: string;
  className?: string;
}

export const PasswordRequirementsChecklist: React.FC<PasswordRequirementsChecklistProps> = ({
  password,
  className = ''
}) => {
  const { requirements, isEmpty } = usePasswordValidation(password);

  if (isEmpty) return null;

  return (
    <div className={`space-y-1 ${className}`}>
      {requirements.map((requirement) => (
        <div
          key={requirement.id}
          className="flex items-center gap-2 text-sm"
        >
          {requirement.met ? (
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
          ) : (
            <X className="h-4 w-4 text-red-500 flex-shrink-0" />
          )}
          <span
            className={
              requirement.met
                ? 'text-green-700 dark:text-green-300'
                : 'text-gray-600 dark:text-gray-400'
            }
          >
            {requirement.label}
          </span>
        </div>
      ))}
    </div>
  );
};