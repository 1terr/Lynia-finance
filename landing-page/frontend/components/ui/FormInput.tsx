import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  optional?: boolean;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  optional?: boolean;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
};

function Label({ htmlFor, label, optional }: { htmlFor?: string; label: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-body-sm font-medium text-primary-dark mb-1.5">
      {label}{' '}
      {optional ? (
        <span className="text-slate-light text-caption">(optional)</span>
      ) : (
        <span className="text-error">*</span>
      )}
    </label>
  );
}

export function FormInput({ label, optional, id, ...props }: InputProps) {
  return (
    <div>
      <Label htmlFor={id} label={label} optional={optional} />
      <input id={id} className="form-input" {...props} />
    </div>
  );
}

export function FormTextarea({ label, optional, id, ...props }: TextareaProps) {
  return (
    <div>
      <Label htmlFor={id} label={label} optional={optional} />
      <textarea
        id={id}
        className="form-input h-auto py-3 resize-y"
        {...props}
      />
    </div>
  );
}

export function FormSelect({ label, optional, id, children, ...props }: SelectProps) {
  return (
    <div>
      <Label htmlFor={id} label={label} optional={optional} />
      <select id={id} className="form-input" {...props}>
        {children}
      </select>
    </div>
  );
}
