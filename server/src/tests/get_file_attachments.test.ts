import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, messagesTable, fileAttachmentsTable } from '../db/schema';
import { getFileAttachments } from '../handlers/get_file_attachments';

describe('getFileAttachments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return file attachments for a message', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const [channel] = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        created_by: user.id
      })
      .returning()
      .execute();

    const [message] = await db.insert(messagesTable)
      .values({
        content: 'Message with attachments',
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();

    // Create file attachments
    const attachmentsData = [
      {
        message_id: message.id,
        filename: 'document.pdf',
        original_filename: 'Important Document.pdf',
        file_size: 1024000,
        mime_type: 'application/pdf',
        file_url: '/uploads/files/document.pdf'
      },
      {
        message_id: message.id,
        filename: 'image.jpg',
        original_filename: 'Photo.jpg',
        file_size: 512000,
        mime_type: 'image/jpeg',
        file_url: '/uploads/files/image.jpg'
      }
    ];

    const attachments = await db.insert(fileAttachmentsTable)
      .values(attachmentsData)
      .returning()
      .execute();

    // Test the handler
    const result = await getFileAttachments(message.id);

    expect(result).toHaveLength(2);
    
    // Verify first attachment
    const pdfAttachment = result.find(a => a.filename === 'document.pdf');
    expect(pdfAttachment).toBeDefined();
    expect(pdfAttachment!.original_filename).toEqual('Important Document.pdf');
    expect(pdfAttachment!.file_size).toEqual(1024000);
    expect(pdfAttachment!.mime_type).toEqual('application/pdf');
    expect(pdfAttachment!.file_url).toEqual('/uploads/files/document.pdf');
    expect(pdfAttachment!.message_id).toEqual(message.id);
    expect(pdfAttachment!.created_at).toBeInstanceOf(Date);

    // Verify second attachment
    const jpgAttachment = result.find(a => a.filename === 'image.jpg');
    expect(jpgAttachment).toBeDefined();
    expect(jpgAttachment!.original_filename).toEqual('Photo.jpg');
    expect(jpgAttachment!.file_size).toEqual(512000);
    expect(jpgAttachment!.mime_type).toEqual('image/jpeg');
    expect(jpgAttachment!.file_url).toEqual('/uploads/files/image.jpg');
    expect(jpgAttachment!.message_id).toEqual(message.id);
  });

  it('should return empty array when message has no attachments', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const [channel] = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        created_by: user.id
      })
      .returning()
      .execute();

    const [message] = await db.insert(messagesTable)
      .values({
        content: 'Message without attachments',
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getFileAttachments(message.id);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return empty array for non-existent message', async () => {
    const nonExistentMessageId = 99999;
    
    const result = await getFileAttachments(nonExistentMessageId);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should only return attachments for the specified message', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const [channel] = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        created_by: user.id
      })
      .returning()
      .execute();

    // Create two messages
    const messages = await db.insert(messagesTable)
      .values([
        {
          content: 'Message 1 with attachment',
          sender_id: user.id,
          channel_id: channel.id
        },
        {
          content: 'Message 2 with attachment',
          sender_id: user.id,
          channel_id: channel.id
        }
      ])
      .returning()
      .execute();

    // Create attachments for both messages
    await db.insert(fileAttachmentsTable)
      .values([
        {
          message_id: messages[0].id,
          filename: 'doc1.pdf',
          original_filename: 'Document 1.pdf',
          file_size: 1000,
          mime_type: 'application/pdf',
          file_url: '/uploads/files/doc1.pdf'
        },
        {
          message_id: messages[1].id,
          filename: 'doc2.pdf',
          original_filename: 'Document 2.pdf',
          file_size: 2000,
          mime_type: 'application/pdf',
          file_url: '/uploads/files/doc2.pdf'
        }
      ])
      .execute();

    // Test getting attachments for first message only
    const result = await getFileAttachments(messages[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].filename).toEqual('doc1.pdf');
    expect(result[0].message_id).toEqual(messages[0].id);
  });

  it('should handle multiple attachments of different types', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const [channel] = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        created_by: user.id
      })
      .returning()
      .execute();

    const [message] = await db.insert(messagesTable)
      .values({
        content: 'Message with various file types',
        sender_id: user.id,
        channel_id: channel.id
      })
      .returning()
      .execute();

    // Create various file attachment types
    const attachmentsData = [
      {
        message_id: message.id,
        filename: 'presentation.pptx',
        original_filename: 'Team Presentation.pptx',
        file_size: 2048000,
        mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        file_url: '/uploads/files/presentation.pptx'
      },
      {
        message_id: message.id,
        filename: 'video.mp4',
        original_filename: 'Demo Video.mp4',
        file_size: 10240000,
        mime_type: 'video/mp4',
        file_url: '/uploads/files/video.mp4'
      },
      {
        message_id: message.id,
        filename: 'archive.zip',
        original_filename: 'Project Files.zip',
        file_size: 5120000,
        mime_type: 'application/zip',
        file_url: '/uploads/files/archive.zip'
      }
    ];

    await db.insert(fileAttachmentsTable)
      .values(attachmentsData)
      .execute();

    // Test the handler
    const result = await getFileAttachments(message.id);

    expect(result).toHaveLength(3);
    
    // Check all file types are present
    const fileTypes = result.map(a => a.mime_type);
    expect(fileTypes).toContain('application/vnd.openxmlformats-officedocument.presentationml.presentation');
    expect(fileTypes).toContain('video/mp4');
    expect(fileTypes).toContain('application/zip');

    // Verify all attachments belong to the correct message
    result.forEach(attachment => {
      expect(attachment.message_id).toEqual(message.id);
      expect(attachment.id).toBeDefined();
      expect(attachment.created_at).toBeInstanceOf(Date);
    });
  });
});