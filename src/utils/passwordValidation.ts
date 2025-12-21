export interface PasswordRequirement {
  id: string;
  label: string;
  regex: RegExp;
  met: boolean;
}

export interface PasswordStrength {
  score: number; // 0-4 (weak to strong)
  level: 'weak' | 'medium' | 'strong' | 'very-strong';
  color: string;
  label: string;
}

export const PASSWORD_REQUIREMENTS: Omit<PasswordRequirement, 'met'>[] = [
  {
    id: 'length',
    label: 'Minimum 12 characters',
    regex: /^.{12,}$/
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter (A-Z)',
    regex: /[A-Z]/
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter (a-z)',
    regex: /[a-z]/
  },
  {
    id: 'number',
    label: 'At least one number (0-9)',
    regex: /\d/
  },
  {
    id: 'special',
    label: 'At least one special character (!@#$%^&*)',
    regex: /[!@#$%^&*]/
  }
];

export const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (!password) {
    return {
      score: 0,
      level: 'weak',
      color: 'text-gray-400',
      label: 'Enter password'
    };
  }

  const requirements = PASSWORD_REQUIREMENTS.map(req => ({
    ...req,
    met: req.regex.test(password)
  }));

  const metCount = requirements.filter(req => req.met).length;
  const score = metCount;

  let level: PasswordStrength['level'];
  let color: string;
  let label: string;

  if (score <= 1) {
    level = 'weak';
    color = 'text-red-500';
    label = 'Weak';
  } else if (score <= 3) {
    level = 'medium';
    color = 'text-yellow-500';
    label = 'Medium';
  } else if (score === 4) {
    level = 'strong';
    color = 'text-blue-500';
    label = 'Strong';
  } else {
    level = 'very-strong';
    color = 'text-green-500';
    label = 'Very Strong';
  }

  return { score, level, color, label };
};

export const usePasswordValidation = (password: string) => {
  const requirements = PASSWORD_REQUIREMENTS.map(req => ({
    ...req,
    met: req.regex.test(password)
  }));

  const strength = calculatePasswordStrength(password);
  const isValid = requirements.every(req => req.met);

  return {
    requirements,
    strength,
    isValid,
    isEmpty: !password.trim()
  };
};