import React from 'react';
import { usePasswordValidation } from '../../utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  className = ''
}) => {
  const { strength, isEmpty } = usePasswordValidation(password);

  if (isEmpty) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`h-1 flex-1 rounded-full ${
                level <= strength.score
                  ? strength.score <= 1
                    ? 'bg-red-500'
                    : strength.score <= 3
                    ? 'bg-yellow-500'
                    : strength.score === 4
                    ? 'bg-blue-500'
                    : 'bg-green-500'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
      <span className={`text-sm font-medium ${strength.color}`}>
        {strength.label}
      </span>
    </div>
  );
};