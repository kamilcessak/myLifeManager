import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Mail, User, X, ImagePlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { updateProfileSchema } from 'shared';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useAuthStore } from '../../store/authStore';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrors';

type ProfileFormValues = z.infer<typeof updateProfileSchema>;

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAX_AVATAR_SIZE_MB = 5;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function getInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.trim() || '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function ProfileSettingsModal({
  isOpen,
  onClose,
}: ProfileSettingsModalProps) {
  useEscapeToClose(onClose, isOpen);
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
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
    if (isOpen) {
      reset({
        name: user?.name ?? '',
        avatarUrl: user?.avatarUrl ?? '',
      });
      setAvatarFile(null);
      setAvatarPreview(null);
      setFormError(null);
    }
  }, [isOpen, user, reset]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [avatarFile]);

  const displayedAvatar = avatarPreview ?? user?.avatarUrl ?? null;
  const initials = useMemo(
    () => getInitials(user?.name, user?.email),
    [user?.name, user?.email],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAvatarFile(null);
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setFormError('Obsługiwane formaty to JPEG, PNG, GIF lub WebP.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      setFormError(`Plik jest zbyt duży. Maksymalny rozmiar to ${MAX_AVATAR_SIZE_MB} MB.`);
      event.target.value = '';
      return;
    }

    setAvatarFile(file);
  };

  const handleRemoveSelectedAvatar = () => {
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    const trimmedName = values.name?.trim() ?? '';
    const currentName = user?.name ?? '';
    const nameChanged = trimmedName.length > 0 && trimmedName !== currentName;

    if (!nameChanged && !avatarFile) {
      onClose();
      return;
    }

    updateProfile.mutate(
      {
        name: nameChanged ? trimmedName : undefined,
        avatarFile,
      },
      {
        onSuccess: () => {
          toast.success('Profil został zaktualizowany');
          onClose();
        },
        onError: (error) => {
          const message = getApiErrorMessage(error);
          setFormError(message);
          toast.error(message);
        },
      },
    );
  });

  if (!isOpen) {
    return null;
  }

  const isSaving = updateProfile.isPending;

  return (
    <div className="modal-overlay z-[60]" onClick={isSaving ? undefined : onClose}>
      <div
        className="modal-content max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--app-text)]">
            Ustawienia profilu
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] disabled:opacity-50"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              {displayedAvatar ? (
                <img
                  src={displayedAvatar}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full border border-[var(--app-border)] object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-xl font-semibold text-[var(--app-text-muted)]">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
                id="profile-avatar-input"
                disabled={isSaving}
              />
              <Button
                type="button"
                variant="outline"
                className="justify-start gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <ImagePlus className="h-4 w-4" />
                {avatarFile ? 'Zmień plik' : 'Wybierz avatar'}
              </Button>
              {avatarFile ? (
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--app-text-muted)]">
                  <span className="truncate">{avatarFile.name}</span>
                  <button
                    type="button"
                    onClick={handleRemoveSelectedAvatar}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Usuń
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--app-text-muted)]">
                  JPEG, PNG, GIF lub WebP. Max {MAX_AVATAR_SIZE_MB} MB.
                </p>
              )}
            </div>
          </div>

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
              className="w-full rounded-lg border border-[var(--app-border)] px-3 py-2 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 disabled:opacity-60"
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
              onClick={onClose}
              disabled={isSaving}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              className="border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
              disabled={isSaving || (!isDirty && !avatarFile)}
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
      </div>
    </div>
  );
}
