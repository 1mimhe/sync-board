import { useRef, useState } from 'react';
import type { FileEntityType } from '../../types';
import { filesApi } from '../../api/endpoints';
import { useToast } from '../../stores/toast.store';

export interface FileUploadButtonProps {
  /** Workspace scope for the 2-phase upload. */
  workspaceId: string;
  /** Hosting entity type. */
  entityType: FileEntityType;
  /** Hosting entity id (card id or document id). */
  entityId: string;
  /** Called with the confirmed file id after `confirm`. */
  onDone?: (fileId: string) => void;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
  'text/',
  'application/pdf',
  'application/zip',
  'application/json',
  'application/msword',
  'application/vnd.',
];
const BLOCKED_EXTENSIONS = ['exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'ps1', 'sh'];

function isAllowedMime(mime: string, fileName: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  // Fall back to extension allowlist for common office types with generic mime.
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.includes(ext)) return false;
  return mime.length > 0;
}

export function FileUploadButton({ workspaceId, entityType, entityId, onDone }: FileUploadButtonProps) {
  const { addToast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      addToast('File too large (max 25 MiB)', 'error');
      return;
    }
    if (!isAllowedMime(file.type, file.name)) {
      addToast(`File type not allowed: ${file.type || 'unknown'}`, 'error');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      addToast('Executable files are blocked', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const req = await filesApi.requestUpload(workspaceId, {
        fileName: file.name.trim(),
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        entityType,
        entityId,
      });
      if (!req.success || !req.data) {
        addToast(req.error?.message || 'Failed to request upload', 'error');
        return;
      }

      // Progress via XHR (fetch has no upload progress events).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', req.data!.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });

      const confirmed = await filesApi.confirm(workspaceId, req.data.fileId);
      if (!confirmed.success) {
        addToast(confirmed.error?.message || 'Failed to confirm upload', 'error');
        return;
      }
      addToast('File uploaded', 'success');
      onDone?.(req.data.fileId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      addToast(message, 'error');
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={(e) => void handleFiles(e.target.files)}
        aria-label="Upload file"
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? `Uploading…${progress ?? 0}%` : 'Upload file'}
      </button>
      {progress !== null && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{progress}%</span>
      )}
    </div>
  );
}
