import type { Attachment } from '@mlm/shared';
import { apiClient } from './apiClient';

export type PickedUploadFile = {
  uri: string;
  name: string;
  type: string;
};

export async function uploadAttachment(
  file: PickedUploadFile,
  opts: { taskId?: string; eventId?: string },
): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  if (opts.taskId) formData.append('taskId', opts.taskId);
  if (opts.eventId) formData.append('eventId', opts.eventId);

  const { data } = await apiClient.post<{ status: string; data: { attachment: Attachment } }>(
    '/attachments/upload',
    formData,
  );
  return data.data.attachment;
}

export async function deleteAttachment(id: string): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
}
