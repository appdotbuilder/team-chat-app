import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  channelsTable, 
  channelMembershipsTable, 
  messagesTable, 
  fileAttachmentsTable 
} from '../db/schema';
import { deleteMessage } from '../handlers/delete_message';
import { eq } from 'drizzle-orm';

describe('deleteMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let adminUser: any;
  let otherUser: any;
  let testChannel: any;
  let testMessage: any;

  beforeEach(async () => {
    // Create test users
    const userResults = await db.insert(usersTable)
      .values([
        {
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'hashed_password',
          display_name: 'Test User',
          status: 'online'
        },
        {
          username: 'adminuser',
          email: 'admin@example.com',
          password_hash: 'admin_hash',
          display_name: 'Admin User',
          status: 'online'
        },
        {
          username: 'otheruser',
          email: 'other@example.com',
          password_hash: 'other_hash',
          display_name: 'Other User',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    testUser = userResults[0];
    adminUser = userResults[1];
    otherUser = userResults[2];

    // Create test channel
    const channelResults = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: testUser.id
      })
      .returning()
      .execute();

    testChannel = channelResults[0];

    // Add users to channel with different roles
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: testChannel.id,
          user_id: testUser.id,
          role: 'owner'
        },
        {
          channel_id: testChannel.id,
          user_id: adminUser.id,
          role: 'admin'
        },
        {
          channel_id: testChannel.id,
          user_id: otherUser.id,
          role: 'member'
        }
      ])
      .execute();

    // Create test message
    const messageResults = await db.insert(messagesTable)
      .values({
        content: 'Test message to delete',
        message_type: 'text',
        sender_id: otherUser.id,
        channel_id: testChannel.id
      })
      .returning()
      .execute();

    testMessage = messageResults[0];
  });

  it('should delete message when user is the original sender', async () => {
    const result = await deleteMessage(testMessage.id, otherUser.id);

    expect(result).toBe(true);

    // Verify message was deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, testMessage.id))
      .execute();

    expect(messages).toHaveLength(0);
  });

  it('should delete message when user is channel owner', async () => {
    const result = await deleteMessage(testMessage.id, testUser.id);

    expect(result).toBe(true);

    // Verify message was deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, testMessage.id))
      .execute();

    expect(messages).toHaveLength(0);
  });

  it('should delete message when user is channel admin', async () => {
    const result = await deleteMessage(testMessage.id, adminUser.id);

    expect(result).toBe(true);

    // Verify message was deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, testMessage.id))
      .execute();

    expect(messages).toHaveLength(0);
  });

  it('should throw error when user is not authorized (member trying to delete others message)', async () => {
    // Create another user who is just a member
    const memberResults = await db.insert(usersTable)
      .values({
        username: 'member',
        email: 'member@example.com',
        password_hash: 'member_hash',
        display_name: 'Member User',
        status: 'online'
      })
      .returning()
      .execute();

    const memberUser = memberResults[0];

    // Add them as a member
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: testChannel.id,
        user_id: memberUser.id,
        role: 'member'
      })
      .execute();

    await expect(deleteMessage(testMessage.id, memberUser.id))
      .rejects.toThrow(/unauthorized to delete this message/i);

    // Verify message was not deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, testMessage.id))
      .execute();

    expect(messages).toHaveLength(1);
  });

  it('should throw error when user is not in the channel', async () => {
    // Create a user not in the channel
    const outsideUserResults = await db.insert(usersTable)
      .values({
        username: 'outsider',
        email: 'outsider@example.com',
        password_hash: 'outsider_hash',
        display_name: 'Outside User',
        status: 'online'
      })
      .returning()
      .execute();

    const outsideUser = outsideUserResults[0];

    await expect(deleteMessage(testMessage.id, outsideUser.id))
      .rejects.toThrow(/unauthorized to delete this message/i);

    // Verify message was not deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, testMessage.id))
      .execute();

    expect(messages).toHaveLength(1);
  });

  it('should throw error when message does not exist', async () => {
    const nonExistentMessageId = 99999;

    await expect(deleteMessage(nonExistentMessageId, testUser.id))
      .rejects.toThrow(/message not found/i);
  });

  it('should handle direct message deletion (only sender can delete)', async () => {
    // Create a direct message
    const dmResults = await db.insert(messagesTable)
      .values({
        content: 'Direct message',
        message_type: 'text',
        sender_id: testUser.id,
        direct_message_recipient_id: otherUser.id
      })
      .returning()
      .execute();

    const directMessage = dmResults[0];

    // Sender should be able to delete
    const result = await deleteMessage(directMessage.id, testUser.id);
    expect(result).toBe(true);

    // Verify message was deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, directMessage.id))
      .execute();

    expect(messages).toHaveLength(0);
  });

  it('should not allow recipient to delete direct message', async () => {
    // Create a direct message
    const dmResults = await db.insert(messagesTable)
      .values({
        content: 'Direct message to test',
        message_type: 'text',
        sender_id: testUser.id,
        direct_message_recipient_id: otherUser.id
      })
      .returning()
      .execute();

    const directMessage = dmResults[0];

    // Recipient should not be able to delete
    await expect(deleteMessage(directMessage.id, otherUser.id))
      .rejects.toThrow(/unauthorized to delete this message/i);

    // Verify message was not deleted
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, directMessage.id))
      .execute();

    expect(messages).toHaveLength(1);
  });

  it('should cascade delete file attachments when message is deleted', async () => {
    // Create a file attachment for the test message
    await db.insert(fileAttachmentsTable)
      .values({
        message_id: testMessage.id,
        filename: 'test_file.jpg',
        original_filename: 'original_test_file.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        file_url: 'https://example.com/files/test_file.jpg'
      })
      .execute();

    // Verify attachment exists before deletion
    const attachmentsBefore = await db.select()
      .from(fileAttachmentsTable)
      .where(eq(fileAttachmentsTable.message_id, testMessage.id))
      .execute();

    expect(attachmentsBefore).toHaveLength(1);

    // Delete the message
    const result = await deleteMessage(testMessage.id, otherUser.id);
    expect(result).toBe(true);

    // Verify attachment was cascade deleted
    const attachmentsAfter = await db.select()
      .from(fileAttachmentsTable)
      .where(eq(fileAttachmentsTable.message_id, testMessage.id))
      .execute();

    expect(attachmentsAfter).toHaveLength(0);
  });

  it('should return false when message was already deleted', async () => {
    // First deletion should succeed
    const firstResult = await deleteMessage(testMessage.id, otherUser.id);
    expect(firstResult).toBe(true);

    // Second attempt should throw error (message not found)
    await expect(deleteMessage(testMessage.id, otherUser.id))
      .rejects.toThrow(/message not found/i);
  });
});