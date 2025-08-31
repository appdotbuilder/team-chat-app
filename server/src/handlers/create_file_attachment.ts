import { db } from '../db';
import { fileAttachmentsTable } from '../db/schema';
import { type CreateFileAttachmentInput, type FileAttachment } from '../schema';

export const createFileAttachment = async (input: CreateFileAttachmentInput): Promise<FileAttachment> => {
  try {
    // Insert file attachment record
    const result = await db.insert(fileAttachmentsTable)
      .values({
        message_id: input.message_id,
        filename: input.filename,
        original_filename: input.original_filename,
        file_size: input.file_size,
        mime_type: input.mime_type,
        file_url: input.file_url
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('File attachment creation failed:', error);
    throw error;
  }
};