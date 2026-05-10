import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateProfileSchema } from '@mlm/shared';
import { useAuthStore } from '../../../store/authStore';
import { useUpdateProfile } from '../../../hooks/useUpdateProfile';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrors';
import AvatarUploader from '../AvatarUploader';

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.trim() || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

interface ProfileTabProps {
  onRequestClose: () => void;
  isActive: boolean;
}

export default function ProfileTab({ onRequestClose, isActive }: ProfileTabProps) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  useEffect(() => {
    if (isActive) {
      reset({
        name: user?.name ?? '',
        avatarUrl: user?.avatarUrl ?? '',
      });
      setFormError(null);
    }
  }, [isActive, user, reset]);

  const initials = useMemo(
    () => getInitials(user?.name, user?.email),
    [user?.name, user?.email],
  );

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    const trimmedName = values.name?.trim() ?? '';
    const currentName = user?.name ?? '';
    const nameChanged = trimmedName.length > 0 && trimmedName !== currentName;

    if (!nameChanged) {
      onRequestClose();
      return;
    }

    updateProfile.mutate(
      { name: trimmedName },
      {
        onSuccess: () => {
          toast.success('Profil został zaktualizowany');
          onRequestClose();
        },
        onError: (error) => {
          const message = getApiErrorMessage(error);
          setFormError(message);
          toast.error(message);
        },
      },
    );
  });

  const isSaving = updateProfile.isPending;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AvatarUploader
        currentAvatarUrl={user?.avatarUrl ?? null}
        initials={initials}
        disabled={isSaving}
      />

      <div>
        <label
          htmlFor="profile-name"
          className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--app-text)]"
        >
          <User className="h-4 w-4 text-[var(--app-text-muted)]" />
          Imię / Nazwa
        </label>
        <input
          id="profile-name"
          type="text"
          placeholder="Jak mamy Cię nazywać?"
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 disabled:opacity-60"
          disabled={isSaving}
          {...register('name')}
        />
        {errors.name ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div>
        <label
          htmlFor="profile-email"
          className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--app-text)]"
        >
          <Mail className="h-4 w-4 text-[var(--app-text-muted)]" />
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={user?.email ?? ''}
          readOnly
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm text-[var(--app-text-muted)]"
        />
        <p className="mt-1 text-xs text-[var(--app-text-muted)]">
          Adres email jest tylko do wglądu.
        </p>
      </div>

      {formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-[var(--app-border)] pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onRequestClose}
          disabled={isSaving}
        >
          Anuluj
        </Button>
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
            'Zapisz zmiany'
          )}
        </Button>
      </div>
    </form>
  );
}
