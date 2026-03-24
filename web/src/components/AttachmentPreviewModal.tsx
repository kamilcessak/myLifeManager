import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

export interface AttachmentPreviewPayload {
  url: string;
  name: string;
  mimetype: string;
}

interface AttachmentPreviewModalProps {
  payload: AttachmentPreviewPayload | null;
  onClose: () => void;
}

export default function AttachmentPreviewModal({ payload, onClose }: AttachmentPreviewModalProps) {
  useEscapeToClose(onClose, Boolean(payload));

  if (!payload) return null;

  const isImage = payload.mimetype.startsWith('image/');
  const isPdf = payload.mimetype === 'application/pdf';

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Podgląd: ${payload.name}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 bg-gray-900 px-4 py-3">
          <span className="min-w-0 truncate text-sm font-medium text-gray-100">{payload.name}</span>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={payload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
              title="Otwórz w nowej karcie"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
              title="Zamknij"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-gray-900/95 p-3">
          {isImage && (
            <img
              src={payload.url}
              alt=""
              className="mx-auto block max-h-[min(85vh,900px)] w-auto max-w-full object-contain"
            />
          )}
          {isPdf && (
            <iframe
              src={payload.url}
              title={payload.name}
              className="h-[min(85vh,800px)] w-full rounded-lg border-0 bg-white"
            />
          )}
          {!isImage && !isPdf && (
            <p className="py-12 text-center text-sm text-gray-400">
              Brak wbudowanego podglądu dla tego typu pliku. Użyj „otwórz w nowej karcie” w pasku powyżej.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
