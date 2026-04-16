import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper, { type Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import {
  Check,
  Crop as CropIcon,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/apiErrors';
import { useUploadAvatar } from '../../hooks/useUploadAvatar';

const MAX_AVATAR_SIZE_MB = 5;
const ACCEPTED_IMAGE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
const OUTPUT_MIME = 'image/jpeg';
const OUTPUT_QUALITY = 0.92;
const OUTPUT_MAX_SIZE = 512;

type Stage = 'idle' | 'cropping' | 'uploading' | 'success';

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  initials: string;
  disabled?: boolean;
  onUploaded?: (newAvatarUrl: string | null) => void;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedBlob(
  imageSrc: string,
  crop: Area,
  outputSize = OUTPUT_MAX_SIZE,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const size = Math.min(outputSize, Math.floor(crop.width));
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Nie udało się utworzyć obrazu wynikowego.'));
          return;
        }
        resolve(blob);
      },
      OUTPUT_MIME,
      OUTPUT_QUALITY,
    );
  });
}

export default function AvatarUploader({
  currentAvatarUrl,
  initials,
  disabled,
  onUploaded,
}: AvatarUploaderProps) {
  const uploadAvatar = useUploadAvatar();

  const [stage, setStage] = useState<Stage>('idle');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const resetState = useCallback(() => {
    setStage('idle');
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setError(null);
  }, []);

  const handleFileAccepted = useCallback(async (file: File) => {
    setError(null);

    if (!Object.keys(ACCEPTED_IMAGE_TYPES).includes(file.type)) {
      setError('Obsługiwane formaty to JPEG, PNG lub WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      setError(`Plik jest zbyt duży. Maksymalny rozmiar to ${MAX_AVATAR_SIZE_MB} MB.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageSrc(dataUrl);
      setStage('cropping');
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch {
      setError('Nie udało się odczytać wybranego pliku.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    multiple: false,
    noClick: stage !== 'idle',
    noKeyboard: stage !== 'idle',
    disabled: disabled || stage === 'uploading',
    onDropAccepted: (files) => {
      if (files[0]) void handleFileAccepted(files[0]);
    },
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]?.message;
      setError(reason || 'Nieprawidłowy plik.');
    },
  });

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirmCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setError(null);
    setStage('uploading');

    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], `avatar-${Date.now()}.jpg`, {
        type: OUTPUT_MIME,
      });

      const result = await uploadAvatar.mutateAsync(file);
      setStage('success');
      toast.success('Avatar został zaktualizowany');
      onUploaded?.(result.avatarUrl);

      window.setTimeout(() => {
        resetState();
      }, 1200);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
      setStage('cropping');
    }
  };

  const previewElement = useMemo(() => {
    if (currentAvatarUrl) {
      return (
        <img
          src={currentAvatarUrl}
          alt="Aktualny avatar"
          className="h-20 w-20 rounded-full border border-[var(--app-border)] object-cover"
        />
      );
    }
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface-muted)] text-xl font-semibold text-[var(--app-text-muted)]">
        {initials}
      </div>
    );
  }, [currentAvatarUrl, initials]);

  const isBusy = stage === 'uploading' || disabled;

  if (stage === 'cropping' && imageSrc) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--app-text)]">
          <CropIcon className="h-4 w-4" />
          Dopasuj kadr (1:1)
        </div>
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-black/80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-[var(--app-text-muted)]">Zoom</label>
          <input
            type="range"
            min={1}
            max={4}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-blue-500"
            disabled={isBusy}
          />
        </div>
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={resetState}
            disabled={isBusy}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={handleConfirmCrop}
            disabled={!croppedAreaPixels || isBusy}
            className="gap-2 border-0 bg-blue-500 text-white shadow-sm hover:bg-blue-600"
          >
            <Upload className="h-4 w-4" />
            Prześlij avatar
          </Button>
        </div>
      </div>
    );
  }

  if (stage === 'uploading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-8 text-sm text-[var(--app-text-muted)]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        <span>Przesyłanie avatara…</span>
      </div>
    );
  }

  if (stage === 'success') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 px-4 py-8 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
        <Check className="h-6 w-6" />
        <span>Avatar zaktualizowany!</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {previewElement}
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm font-medium text-[var(--app-text)]">Avatar</p>
          <p className="text-xs text-[var(--app-text-muted)]">
            JPEG, PNG lub WebP. Max {MAX_AVATAR_SIZE_MB} MB. Zdjęcie zostanie
            przycięte do kwadratu.
          </p>
        </div>
      </div>

      <div
        {...getRootProps()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-500/10'
            : 'border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] hover:border-blue-400 hover:text-blue-500',
          isBusy ? 'pointer-events-none opacity-60' : '',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <ImagePlus className="h-6 w-6" />
        <p className="text-sm font-medium">
          {isDragActive
            ? 'Upuść plik tutaj…'
            : 'Przeciągnij i upuść obraz lub kliknij, aby wybrać'}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          disabled={isBusy}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Wybierz plik
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
