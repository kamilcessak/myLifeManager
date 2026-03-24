import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { Paperclip, Upload, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { attachmentsApi } from '../lib/api';
import { cn } from '../lib/utils';
import type { Attachment } from '../types';
import AttachmentPreviewModal, { type AttachmentPreviewPayload } from './AttachmentPreviewModal';

const MAX_BYTES = 5 * 1024 * 1024;

function fileKey(f: File, index: number) {
  return `${f.name}-${f.size}-${f.lastModified}-${index}`;
}

function PendingFileRow({
  file,
  onRemove,
  onPreview,
}: {
  file: File;
  onRemove: () => void;
  onPreview?: () => void;
}) {
  const objectUrl = useMemo(
    () => (file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const isImage = file.type.startsWith('image/');
  const canPreview =
    Boolean(onPreview) && (file.type.startsWith('image/') || file.type === 'application/pdf');

  const inner = (
    <>
      {isImage && objectUrl ? (
        <img
          src={objectUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
          <Paperclip className="h-5 w-5 text-gray-600 dark:text-gray-300" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {file.name}
        </span>
        <span className="text-xs text-amber-800/90 dark:text-amber-400/90">
          {canPreview ? 'Kliknij, aby podejrzeć · zostanie wysłany po zapisaniu' : 'Zostanie wysłany po zapisaniu'}
        </span>
      </div>
    </>
  );

  return (
    <li className="flex items-center gap-2 rounded-lg border border-dashed border-amber-300/80 bg-amber-50/50 p-2 dark:border-amber-500/30 dark:bg-amber-500/10">
      {canPreview ? (
        <button
          type="button"
          onClick={onPreview}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-amber-100/60 dark:hover:bg-amber-500/15"
        >
          {inner}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        title="Usuń z kolejki"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

interface AttachmentPanelProps {
  variant: 'task' | 'event';
  parentId: string | null;
  attachments: Attachment[];
  onAttachmentsChange: Dispatch<SetStateAction<Attachment[]>>;
  /** Gdy brak `parentId`: pliki tylko w stanie, wysyłka po utworzeniu elementu. */
  pendingFiles?: File[];
  onPendingFilesChange?: Dispatch<SetStateAction<File[]>>;
  readOnly?: boolean;
}

export default function AttachmentPanel({
  variant,
  parentId,
  attachments,
  onAttachmentsChange,
  pendingFiles = [],
  onPendingFilesChange,
  readOnly = false,
}: AttachmentPanelProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AttachmentPreviewPayload | null>(null);
  const previewBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current);
        previewBlobUrlRef.current = null;
      }
    };
  }, []);

  const closePreview = useCallback(() => {
    setPreview(null);
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
  }, []);

  const openAttachmentPreview = useCallback((a: Attachment) => {
    const canPreview = a.mimetype.startsWith('image/') || a.mimetype === 'application/pdf';
    if (!canPreview) return;
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    setPreview({
      url: a.url,
      name: a.originalName,
      mimetype: a.mimetype,
    });
  }, []);

  const openPendingFilePreview = useCallback((file: File) => {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return;
    if (previewBlobUrlRef.current) {
      URL.revokeObjectURL(previewBlobUrlRef.current);
      previewBlobUrlRef.current = null;
    }
    const blobUrl = URL.createObjectURL(file);
    previewBlobUrlRef.current = blobUrl;
    setPreview({
      url: blobUrl,
      name: file.name,
      mimetype: file.type || 'application/octet-stream',
    });
  }, []);

  const canQueueLocal = Boolean(!parentId && onPendingFilesChange && !readOnly);
  const canUploadToServer = Boolean(parentId && !readOnly);
  const dropzoneActive = canQueueLocal || canUploadToServer;

  const runUpload = useCallback(
    async (file: File) => {
      if (!parentId) return;
      const opts = variant === 'task' ? { taskId: parentId } : { eventId: parentId };
      const res = await attachmentsApi.upload(file, opts);
      const att = res.data.data.attachment;
      onAttachmentsChange((prev) => [att, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
    },
    [parentId, variant, onAttachmentsChange, queryClient],
  );

  const appendLocalFiles = useCallback(
    (files: File[]) => {
      if (!onPendingFilesChange) return;
      onPendingFilesChange((prev) => {
        const next = [...prev];
        for (const f of files) {
          const dup = next.some(
            (p) => p.name === f.name && p.size === f.size && p.lastModified === f.lastModified,
          );
          if (!dup) next.push(f);
        }
        return next;
      });
    },
    [onPendingFilesChange],
  );

  const removeAttachment = useCallback(
    async (id: string) => {
      setRemovingId(id);
      try {
        await attachmentsApi.delete(id);
        onAttachmentsChange((prev) => prev.filter((a) => a.id !== id));
        queryClient.invalidateQueries({ queryKey: ['inbox-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['calendar-items'] });
        toast.success('Załącznik usunięty');
      } catch (err) {
        let msg = 'Nie udało się usunąć załącznika';
        if (
          axios.isAxiosError(err) &&
          err.response?.data &&
          typeof err.response.data === 'object' &&
          'message' in err.response.data
        ) {
          msg = String((err.response.data as { message: string }).message);
        }
        toast.error(msg);
      } finally {
        setRemovingId(null);
      }
    },
    [onAttachmentsChange, queryClient],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (!accepted.length || readOnly || uploading) return;

      if (parentId) {
        void (async () => {
          setUploading(true);
          try {
            let ok = 0;
            for (const file of accepted) {
              try {
                await runUpload(file);
                ok += 1;
              } catch (err) {
                let msg = 'Nie udało się wgrać pliku';
                if (
                  axios.isAxiosError(err) &&
                  err.response?.data &&
                  typeof err.response.data === 'object' &&
                  'message' in err.response.data
                ) {
                  msg = String((err.response.data as { message: string }).message);
                }
                toast.error(msg);
              }
            }
            if (ok > 0) {
              toast.success(ok === 1 ? 'Plik dodany' : `Dodano plików: ${ok}`);
            }
          } finally {
            setUploading(false);
          }
        })();
        return;
      }

      if (onPendingFilesChange) {
        appendLocalFiles(accepted);
        toast.success(accepted.length === 1 ? 'Plik dodany do kolejki' : `Dodano plików: ${accepted.length}`);
      }
    },
    [
      appendLocalFiles,
      onPendingFilesChange,
      parentId,
      readOnly,
      runUpload,
      uploading,
    ],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: readOnly || !dropzoneActive || uploading,
    maxSize: MAX_BYTES,
    accept: {
      'image/*': [],
      'application/pdf': ['.pdf'],
    },
    onDropRejected: (rej) => {
      const first = rej[0];
      if (first?.errors.some((e) => e.code === 'file-too-large')) {
        toast.error('Plik przekracza limit 5 MB');
      } else {
        toast.error('Dozwolone są obrazy i pliki PDF');
      }
    },
  });

  return (
    <div className="space-y-3">
      <span className="task-modal-field-label block text-sm font-medium text-gray-900 dark:text-gray-300">
        Załączniki
      </span>
      {canQueueLocal && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Możesz wybrać pliki już teraz — trafią na serwer po kliknięciu{' '}
          <span className="font-medium">Utwórz</span>.
        </p>
      )}
      <div
        {...getRootProps()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
          readOnly || !dropzoneActive || uploading
            ? 'cursor-not-allowed border-gray-200 bg-gray-50/80 opacity-70 dark:border-gray-700 dark:bg-gray-800/40'
            : isDragActive
              ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/15'
              : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/40 dark:border-gray-600 dark:bg-gray-800/30 dark:hover:border-blue-500 dark:hover:bg-blue-500/10',
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mb-2 h-8 w-8 text-gray-400 dark:text-gray-500" aria-hidden />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {readOnly
            ? 'Załączniki (tylko podgląd)'
            : dropzoneActive
              ? 'Przeciągnij plik tutaj lub kliknij, aby wybrać'
              : 'Dodawanie niedostępne'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Obrazy lub PDF · max 5 MB</p>
        {uploading && (
          <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">Wysyłanie…</p>
        )}
      </div>

      {pendingFiles.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pendingFiles.map((file, index) => (
            <PendingFileRow
              key={fileKey(file, index)}
              file={file}
              onRemove={() =>
                onPendingFilesChange?.((prev) => prev.filter((_, i) => i !== index))
              }
              onPreview={() => openPendingFilePreview(file)}
            />
          ))}
        </ul>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => {
            const canPreview =
              a.mimetype.startsWith('image/') || a.mimetype === 'application/pdf';
            const rowInner = (
              <>
                {a.mimetype.startsWith('image/') ? (
                  <img
                    src={a.url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-700">
                    <Paperclip className="h-5 w-5 text-gray-600 dark:text-gray-300" aria-hidden />
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {a.originalName}
                </span>
              </>
            );
            return (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800/50"
            >
              {canPreview ? (
                <button
                  type="button"
                  onClick={() => openAttachmentPreview(a)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                >
                  {rowInner}
                </button>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-90"
                >
                  {rowInner}
                </a>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void removeAttachment(a.id);
                  }}
                  disabled={removingId === a.id}
                  className="shrink-0 rounded-lg p-2 text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  title="Usuń załącznik"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
            );
          })}
        </ul>
      )}
      <AttachmentPreviewModal payload={preview} onClose={closePreview} />
    </div>
  );
}
