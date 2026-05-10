import { forwardRef, useEffect, useState } from 'react';
import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, KeyRound, Loader2, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { changePasswordSchema, type ChangePasswordInput } from '@mlm/shared';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { useChangePassword } from '../../../hooks/useChangePassword';

interface SecurityTabProps {
  isActive: boolean;
}

export default function SecurityTab({ isActive }: SecurityTabProps) {
  const changePassword = useChangePassword();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [currentPasswordError, setCurrentPasswordError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  useEffect(() => {
    if (isActive) {
      reset({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setFormError(null);
      setCurrentPasswordError(null);
    }
  }, [isActive, reset]);

  const isSaving = changePassword.isPending;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    setCurrentPasswordError(null);

    changePassword.mutate(values, {
      onSuccess: () => {
        toast.success('Hasło zmienione');
        reset({
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: '',
        });
      },
      onError: (error) => {
        const message = getApiErrorMessage(error);
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;

        if (status === 400) {
          setCurrentPasswordError(message);
          setFocus('currentPassword');
        } else {
          setFormError(message);
        }
        toast.error(message);
      },
    });
  });

  const currentRegister = register('currentPassword');
  const newRegister = register('newPassword');
  const confirmRegister = register('confirmNewPassword');

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3 text-xs text-[var(--app-text-muted)]">
        Hasło musi mieć co najmniej 8 znaków. Po zmianie hasła pozostałe urządzenia
        pozostaną zalogowane do czasu ich ręcznego wylogowania.
      </div>

      <PasswordField
        id="current-password"
        label="Obecne hasło"
        icon={<Lock className="h-4 w-4 text-[var(--app-text-muted)]" />}
        autoComplete="current-password"
        disabled={isSaving}
        show={showCurrent}
        toggleShow={() => setShowCurrent((v) => !v)}
        error={errors.currentPassword?.message ?? currentPasswordError ?? undefined}
        name={currentRegister.name}
        onBlur={currentRegister.onBlur}
        onChange={(e) => {
          if (currentPasswordError) setCurrentPasswordError(null);
          void currentRegister.onChange(e);
        }}
        ref={currentRegister.ref}
      />

      <PasswordField
        id="new-password"
        label="Nowe hasło"
        icon={<KeyRound className="h-4 w-4 text-[var(--app-text-muted)]" />}
        autoComplete="new-password"
        disabled={isSaving}
        show={showNew}
        toggleShow={() => setShowNew((v) => !v)}
        error={errors.newPassword?.message}
        name={newRegister.name}
        onBlur={newRegister.onBlur}
        onChange={newRegister.onChange}
        ref={newRegister.ref}
      />

      <PasswordField
        id="confirm-new-password"
        label="Powtórz nowe hasło"
        icon={<KeyRound className="h-4 w-4 text-[var(--app-text-muted)]" />}
        autoComplete="new-password"
        disabled={isSaving}
        show={showConfirm}
        toggleShow={() => setShowConfirm((v) => !v)}
        error={errors.confirmNewPassword?.message}
        name={confirmRegister.name}
        onBlur={confirmRegister.onBlur}
        onChange={confirmRegister.onChange}
        ref={confirmRegister.ref}
      />

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] pt-4">
        <Button
          type="submit"
          className="border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
          disabled={isSaving || !isDirty}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Zapisywanie…
            </>
          ) : (
            'Zmień hasło'
          )}
        </Button>
      </div>
    </form>
  );
}

interface PasswordFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: ReactNode;
  show: boolean;
  toggleShow: () => void;
  error?: string;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, label, icon, show, toggleShow, error, ...rest }: PasswordFieldProps,
  ref: Ref<HTMLInputElement>,
) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--app-text)]"
      >
        {icon}
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          ref={ref}
          type={show ? 'text' : 'password'}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 pr-10 text-sm text-[var(--app-text)] outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 disabled:opacity-60"
          aria-invalid={error ? 'true' : 'false'}
          {...rest}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
          tabIndex={-1}
          aria-label={show ? 'Ukryj hasło' : 'Pokaż hasło'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
});
