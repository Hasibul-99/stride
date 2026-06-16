import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  taskId: string | null;
  messageId: string | null;
  createdAt: string;
  uploader?: { id: string; name: string };
}

export function useTaskFiles(taskId: string | undefined) {
  return useQuery({
    queryKey: ['files', taskId],
    enabled: !!taskId,
    queryFn: async () => (await api.get<Attachment[]>(`/tasks/${taskId}/files`)).data,
  });
}

/** Presign → direct PUT to S3/MinIO → confirm. */
export function useUploadToTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const target = { taskId };
      const { data: presign } = await api.post<{ uploadUrl: string; s3Key: string }>(
        '/files/presign',
        { fileName: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', target },
      );
      // Raw PUT — no auth header (S3 rejects extra headers it didn't sign).
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error('Upload failed');
      const { data } = await api.post<Attachment>('/files/confirm', {
        s3Key: presign.s3Key,
        fileName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        target,
      });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files', taskId] }),
  });
}

export function useDeleteFile(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/files/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['files', taskId] }),
  });
}

export async function getDownloadUrl(id: string): Promise<string> {
  return (await api.get<{ url: string }>(`/files/${id}/download`)).data.url;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
