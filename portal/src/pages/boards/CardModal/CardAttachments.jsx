import { useState } from 'react';
import { Button, Popconfirm, Progress, Tooltip, Upload, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, FileOutlined, LinkOutlined, PaperClipOutlined } from '@ant-design/icons';
import { getFileUrl } from '@/services/api';
import { uploadAttachment, deleteAttachment, errorMessage } from '@/services/boards';
import { fromNow } from '../boardUtils';

const MAX_MB = 20;

const formatSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Attachments: upload (multipart `file`, ≤ 20MB) via the shared axios
 * instance so the Bearer header is attached, list with download links,
 * delete. If the upload response isn't an attachment, `onRefetch` reloads the card.
 */
export default function CardAttachments({ cardId, attachments = [], commit, canEdit, onRefetch }) {
  const [progress, setProgress] = useState(null);

  const beforeUpload = (file) => {
    if (file.size / 1024 / 1024 > MAX_MB) {
      message.error(`File must be smaller than ${MAX_MB}MB`);
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const customRequest = async ({ file, onSuccess, onError }) => {
    setProgress(0);
    try {
      const res = await uploadAttachment(cardId, file, setProgress);
      if (res?.id && res?.fileName) {
        commit((d) => ({ ...d, attachments: [...(d.attachments || []).filter((a) => a.id !== res.id), res] }));
      } else {
        onRefetch?.();
      }
      onSuccess?.(res);
    } catch (err) {
      message.error(errorMessage(err, 'Upload failed'));
      onError?.(err);
    } finally {
      setProgress(null);
    }
  };

  const remove = async (a) => {
    try {
      await deleteAttachment(a.id);
      commit((d) => ({ ...d, attachments: (d.attachments || []).filter((x) => x.id !== a.id) }));
    } catch (err) {
      message.error(errorMessage(err, 'Failed to delete attachment'));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length === 0 && <div className="text-[12px] text-fg-3">No attachments.</div>}
      {attachments.map((a) => {
        const url = getFileUrl(a.url);
        // Imported (e.g. Trello) attachments are external links: no inline preview,
        // since the source may need its own login.
        const external = /^https?:\/\//i.test(a.url || '');
        const isImage = !external && a.mimeType?.startsWith('image/');
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-md border border-line p-2 transition-colors hover:border-fg">
            <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
              {isImage ? (
                <img src={url} alt={a.fileName} className="h-12 w-16 rounded-sm border border-line object-cover" />
              ) : (
                <div className="flex h-12 w-16 items-center justify-center rounded-sm border border-line bg-surface-2 text-lg text-fg-2">
                  {external ? <LinkOutlined /> : <FileOutlined />}
                </div>
              )}
            </a>
            <div className="min-w-0 flex-1">
              <a href={url} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-semibold text-fg! hover:underline">{a.fileName}</a>
              <div className="mono text-[10.5px] text-fg-3">
                {external && !a.size ? 'Link' : formatSize(a.size)}
                {a.uploader?.name && ` · ${a.uploader.name}`}
                {a.createdAt && ` · ${fromNow(a.createdAt)}`}
              </div>
            </div>
            <Tooltip title="Download">
              <Button size="small" type="text" icon={<DownloadOutlined />} href={url} target="_blank" download={a.fileName} aria-label="Download" />
            </Tooltip>
            {canEdit && (
              <Popconfirm title="Delete this attachment?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(a)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Delete attachment" />
              </Popconfirm>
            )}
          </div>
        );
      })}

      {canEdit && (
        <div>
          <Upload
            name="file"
            multiple
            showUploadList={false}
            beforeUpload={beforeUpload}
            customRequest={customRequest}
          >
            <Button size="small" icon={<PaperClipOutlined />} loading={progress !== null}>Attach a file</Button>
          </Upload>
          {progress !== null && <Progress percent={progress} size="small" className="mt-1" style={{ maxWidth: 240 }} />}
        </div>
      )}
    </div>
  );
}
