import { db } from '../db';
import { fileAttachmentsTable } from '../db/schema';
import { type FileAttachment } from '../schema';
import { eq } from 'drizzle-orm';

export const getFileAttachments = async (messageId: number): Promise<FileAttachment[]> => {
  try {
    // Query file attachments for the specific message
    const results = await db.select()
      .from(fileAttachmentsTable)
      .where(eq(fileAttachmentsTable.message_id, messageId))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to get file attachments:', error);
    throw error;
  }
};