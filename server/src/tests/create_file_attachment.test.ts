import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, messagesTable, fileAttachmentsTable } from '../db/schema';
import { type CreateFileAttachmentInput } from '../schema';
import { createFileAttachment } from '../handlers/create_file_attachment';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password_hash: 'hashed_password'
};

const testChannel = {
  name: 'test-channel',
  description: 'Test channel',
  is_private: false,
  created_by: 1 // Will be set to actual user ID
};

const testMessage = {
  content: 'Test message with attachment',
  message_type: 'file' as const,
  sender_id: 1, // Will be set to actual user ID
  channel_id: 1 // Will be set to actual channel ID
};

const testInput: CreateFileAttachmentInput = {
  message_id: 1, // Will be set to actual message ID
  filename: 'document_12345.pdf',
  original_filename: 'My Important Document.pdf',
  file_size: 2048000,
  mime_type: 'application/pdf',
  file_url: 'https://storage.example.com/uploads/document_12345.pdf'
};

describe('createFileAttachment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a file attachment', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const user = userResult[0];

    const channelResult = await db.insert(channelsTable)
      .values({ ...testChannel, created_by: user.id })
      .returning()
      .execute();
    const channel = channelResult[0];

    const messageResult = await db.insert(messagesTable)
      .values({
        ...testMessage,
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();
    const message = messageResult[0];

    // Create file attachment
    const input = { ...testInput, message_id: message.id };
    const result = await createFileAttachment(input);

    // Basic field validation
    expect(result.message_id).toEqual(message.id);
    expect(result.filename).toEqual('document_12345.pdf');
    expect(result.original_filename).toEqual('My Important Document.pdf');
    expect(result.file_size).toEqual(2048000);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.file_url).toEqual('https://storage.example.com/uploads/document_12345.pdf');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save file attachment to database', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const user = userResult[0];

    const channelResult = await db.insert(channelsTable)
      .values({ ...testChannel, created_by: user.id })
      .returning()
      .execute();
    const channel = channelResult[0];

    const messageResult = await db.insert(messagesTable)
      .values({
        ...testMessage,
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();
    const message = messageResult[0];

    // Create file attachment
    const input = { ...testInput, message_id: message.id };
    const result = await createFileAttachment(input);

    // Query database to verify
    const attachments = await db.select()
      .from(fileAttachmentsTable)
      .where(eq(fileAttachmentsTable.id, result.id))
      .execute();

    expect(attachments).toHaveLength(1);
    expect(attachments[0].message_id).toEqual(message.id);
    expect(attachments[0].filename).toEqual('document_12345.pdf');
    expect(attachments[0].original_filename).toEqual('My Important Document.pdf');
    expect(attachments[0].file_size).toEqual(2048000);
    expect(attachments[0].mime_type).toEqual('application/pdf');
    expect(attachments[0].file_url).toEqual('https://storage.example.com/uploads/document_12345.pdf');
    expect(attachments[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different file types correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const user = userResult[0];

    const channelResult = await db.insert(channelsTable)
      .values({ ...testChannel, created_by: user.id })
      .returning()
      .execute();
    const channel = channelResult[0];

    const messageResult = await db.insert(messagesTable)
      .values({
        ...testMessage,
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();
    const message = messageResult[0];

    // Test image file
    const imageInput: CreateFileAttachmentInput = {
      message_id: message.id,
      filename: 'photo_67890.jpg',
      original_filename: 'Vacation Photo.jpg',
      file_size: 1536000,
      mime_type: 'image/jpeg',
      file_url: 'https://storage.example.com/uploads/photo_67890.jpg'
    };

    const imageResult = await createFileAttachment(imageInput);

    expect(imageResult.filename).toEqual('photo_67890.jpg');
    expect(imageResult.original_filename).toEqual('Vacation Photo.jpg');
    expect(imageResult.mime_type).toEqual('image/jpeg');
    expect(imageResult.file_size).toEqual(1536000);

    // Test text file
    const textInput: CreateFileAttachmentInput = {
      message_id: message.id,
      filename: 'notes_11111.txt',
      original_filename: 'Meeting Notes.txt',
      file_size: 4096,
      mime_type: 'text/plain',
      file_url: 'https://storage.example.com/uploads/notes_11111.txt'
    };

    const textResult = await createFileAttachment(textInput);

    expect(textResult.filename).toEqual('notes_11111.txt');
    expect(textResult.original_filename).toEqual('Meeting Notes.txt');
    expect(textResult.mime_type).toEqual('text/plain');
    expect(textResult.file_size).toEqual(4096);
  });

  it('should handle foreign key constraint violations', async () => {
    // Try to create file attachment with non-existent message ID
    const invalidInput: CreateFileAttachmentInput = {
      message_id: 999999, // Non-existent message ID
      filename: 'test.pdf',
      original_filename: 'test.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      file_url: 'https://example.com/test.pdf'
    };

    // Should throw foreign key constraint error
    await expect(createFileAttachment(invalidInput)).rejects.toThrow(/violates foreign key constraint/i);
  });

  it('should handle multiple attachments for the same message', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values(testUser).returning().execute();
    const user = userResult[0];

    const channelResult = await db.insert(channelsTable)
      .values({ ...testChannel, created_by: user.id })
      .returning()
      .execute();
    const channel = channelResult[0];

    const messageResult = await db.insert(messagesTable)
      .values({
        ...testMessage,
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();
    const message = messageResult[0];

    // Create first attachment
    const input1: CreateFileAttachmentInput = {
      message_id: message.id,
      filename: 'doc1.pdf',
      original_filename: 'Document 1.pdf',
      file_size: 1024000,
      mime_type: 'application/pdf',
      file_url: 'https://storage.example.com/doc1.pdf'
    };

    // Create second attachment
    const input2: CreateFileAttachmentInput = {
      message_id: message.id,
      filename: 'image1.jpg',
      original_filename: 'Image 1.jpg',
      file_size: 512000,
      mime_type: 'image/jpeg',
      file_url: 'https://storage.example.com/image1.jpg'
    };

    const result1 = await createFileAttachment(input1);
    const result2 = await createFileAttachment(input2);

    // Both should be created successfully
    expect(result1.message_id).toEqual(message.id);
    expect(result2.message_id).toEqual(message.id);
    expect(result1.id).not.toEqual(result2.id);

    // Verify both exist in database
    const attachments = await db.select()
      .from(fileAttachmentsTable)
      .where(eq(fileAttachmentsTable.message_id, message.id))
      .execute();

    expect(attachments).toHaveLength(2);
    expect(attachments.map(a => a.filename)).toContain('doc1.pdf');
    expect(attachments.map(a => a.filename)).toContain('image1.jpg');
  });
});