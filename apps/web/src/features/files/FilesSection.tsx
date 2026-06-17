import { DragEvent, useState } from 'react';
import {
  formatBytes,
  getDownloadUrl,
  useDeleteFile,
  useTaskFiles,
  useUploadToTask,
} from './api';

export function FilesSection({ taskId }: { taskId: string }) {
  const { data: files } = useTaskFiles(taskId);
  const upload = useUploadToTask(taskId);
  const del = useDeleteFile(taskId);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) upload.mutate(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function onPaste(e: React.ClipboardEvent) {
    if (e.clipboardData.files.length > 0) handleFiles(e.clipboardData.files);
  }

  async function open(id: string) {
    const url = await getDownloadUrl(id);
    window.open(url, '_blank');
  }

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Files</div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onPaste={onPaste}
        tabIndex={0}
        className={`mb-3 block cursor-pointer rounded-control border border-dashed px-3 py-4 text-center text-sm text-muted ${
          dragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
      >
        {upload.isPending ? 'Uploading…' : 'Drop files or click to upload'}
        <input type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </label>

      <div className="space-y-2">
        {files?.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            {f.mimeType.startsWith('image/') ? (
              <ImageThumb id={f.id} alt={f.fileName} />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded bg-background text-xs">📄</span>
            )}
            <button onClick={() => open(f.id)} className="min-w-0 flex-1 truncate text-left hover:underline">
              {f.fileName}
            </button>
            <span className="text-xs text-muted">{formatBytes(f.fileSize)}</span>
            <button onClick={() => del.mutate(f.id)} className="text-red-600">×</button>
          </div>
        ))}
        {files && files.length === 0 && <p className="text-sm text-muted">No files.</p>}
      </div>
    </div>
  );
}

function ImageThumb({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  if (!src) {
    void getDownloadUrl(id).then(setSrc);
    return <span className="h-8 w-8 rounded bg-background" />;
  }
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={alt} className="h-8 w-8 rounded object-cover" />
    </a>
  );
}
