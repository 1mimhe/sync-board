import { useState } from 'react';
import type { CardAttachment } from '../../types';
import { attachmentApi, filesApi } from '../../api/endpoints';
import { useToast } from '../../stores/toast.store';
import { FileUploadButton } from '../files/FileUploadButton';
import { IconPaperclip, IconTrash } from '../common/Icons';

export interface AttachmentSectionProps {
  workspaceId: string;
  boardId: string;
  cardId: string;
  attachments: CardAttachment[];
  onUpdated: () => void;
}

export function AttachmentSection({
  workspaceId,
  boardId,
  cardId,
  attachments,
  onUpdated,
}: AttachmentSectionProps) {
  const { addToast } = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDelete = async (fileId: string) => {
    const res = await filesApi.remove(workspaceId, fileId);
    if (res.success) {
      addToast('Attachment removed', 'info');
      onUpdated();
    } else {
      addToast(res.error?.message || 'Failed to remove attachment', 'error');
    }
  };

  const handleDownload = async (att: CardAttachment) => {
    setDownloadingId(att.id);
    const res = await filesApi.downloadUrl(workspaceId, att.id);
    setDownloadingId(null);
    if (res.success && res.data) {
      window.open(res.data.downloadUrl, '_blank', 'noreferrer');
    } else {
      addToast(res.error?.message || 'Failed to get download URL', 'error');
    }
  };

  const handleRefreshList = async () => {
    // Revalidate via parent reload; also touch the proxy route so errors surface early.
    const res = await attachmentApi.list(workspaceId, boardId, cardId);
    if (!res.success) {
      addToast(res.error?.message || 'Failed to refresh attachments', 'error');
    }
    onUpdated();
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          padding: 14,
          background: 'var(--bg3)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconPaperclip size={16} /> S3 file attachments (2-phase upload)
        </div>
        <FileUploadButton
          workspaceId={workspaceId}
          entityType="card"
          entityId={cardId}
          onDone={() => void handleRefreshList()}
        />
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {attachments.map((att) => {
          const isImage =
            att.type === 'image' ||
            (att.mimeType ?? '').startsWith('image/') ||
            (att.url ? /\.jpe?g|\.gif|\.png|\.webp|\.svg$/i.test(att.url) : false);
          const sizeLabel =
            typeof att.size === 'number' && att.size > 0
              ? ` • ${(att.size / 1024).toFixed(1)} KB`
              : '';

          return (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '10px 14px',
                background: 'var(--bg3)',
                borderRadius: 10,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {isImage && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 6,
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'var(--muted)',
                    }}
                  >
                    <IconPaperclip size={18} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                    title={att.name}
                  >
                    {att.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
                    {att.type}
                    {att.mimeType ? ` • ${att.mimeType}` : ''}
                    {sizeLabel} • {new Date(att.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={downloadingId === att.id}
                  onClick={() => void handleDownload(att)}
                  title="Download via presigned S3 URL"
                >
                  {downloadingId === att.id ? 'Loading…' : 'Download'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#f87171', padding: 6 }}
                  onClick={() => void handleDelete(att.id)}
                  title="Remove attachment"
                  aria-label={`Remove attachment ${att.name}`}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            </div>
          );
        })}

        {attachments.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted2)', fontSize: 13, padding: 12 }}>
            No attachments on this card yet. Upload a file above (max 25 MiB).
          </div>
        )}
      </div>
    </div>
  );
}
