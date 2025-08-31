import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, messagesTable, channelsTable } from '../db/schema';
import { type UpdateMessageInput } from '../schema';
import { updateMessage } from '../handlers/update_message';
import { eq } from 'drizzle-orm';

describe('updateMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const createTestUser = async () => {
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashed_password',
        display_name: 'Test User',
        status: 'online'
      })
      .returning()
      .execute();
    
    return userResult[0];
  };

  const createTestMessage = async (senderId: number) => {
    const messageResult = await db.insert(messagesTable)
      .values({
        content: 'Original message content',
        message_type: 'text',
        sender_id: senderId,
        channel_id: null,
        direct_message_recipient_id: null,
        reply_to_message_id: null
      })
      .returning()
      .execute();
    
    return messageResult[0];
  };

  it('should update message content', async () => {
    const user = await createTestUser();
    const message = await createTestMessage(user.id);

    const updateInput: UpdateMessageInput = {
      id: message.id,
      content: 'Updated message content'
    };

    const result = await updateMessage(updateInput);

    // Verify the message content was updated
    expect(result.id).toEqual(message.id);
    expect(result.content).toEqual('Updated message content');
    expect(result.sender_id).toEqual(user.id);
    expect(result.message_type).toEqual('text');
    expect(result.edited_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Verify edited_at is after original created_at
    expect(result.edited_at!.getTime()).toBeGreaterThan(result.created_at.getTime());
  });

  it('should persist changes to database', async () => {
    const user = await createTestUser();
    const message = await createTestMessage(user.id);

    const updateInput: UpdateMessageInput = {
      id: message.id,
      content: 'Database persistence test'
    };

    await updateMessage(updateInput);

    // Query the database directly to verify the changes
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, message.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual('Database persistence test');
    expect(messages[0].edited_at).toBeInstanceOf(Date);
    expect(messages[0].updated_at).toBeInstanceOf(Date);
    
    // Verify edited_at and updated_at are recent (within last 5 seconds)
    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5000);
    expect(messages[0].edited_at!.getTime()).toBeGreaterThan(fiveSecondsAgo.getTime());
    expect(messages[0].updated_at.getTime()).toBeGreaterThan(fiveSecondsAgo.getTime());
  });

  it('should preserve all other message fields', async () => {
    const user = await createTestUser();
    const originalMessage = await createTestMessage(user.id);

    const updateInput: UpdateMessageInput = {
      id: originalMessage.id,
      content: 'Field preservation test'
    };

    const result = await updateMessage(updateInput);

    // Verify all other fields remain unchanged
    expect(result.message_type).toEqual(originalMessage.message_type);
    expect(result.sender_id).toEqual(originalMessage.sender_id);
    expect(result.channel_id).toEqual(originalMessage.channel_id);
    expect(result.direct_message_recipient_id).toEqual(originalMessage.direct_message_recipient_id);
    expect(result.reply_to_message_id).toEqual(originalMessage.reply_to_message_id);
    expect(result.created_at).toEqual(originalMessage.created_at);
  });

  it('should handle channel messages correctly', async () => {
    const user = await createTestUser();
    
    // Create a channel first
    const channelResult = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'Test channel',
        is_private: false,
        created_by: user.id
      })
      .returning()
      .execute();
    
    const channel = channelResult[0];
    
    // Create a channel message with channel_id
    const channelMessageResult = await db.insert(messagesTable)
      .values({
        content: 'Channel message',
        message_type: 'text',
        sender_id: user.id,
        channel_id: channel.id,
        direct_message_recipient_id: null,
        reply_to_message_id: null
      })
      .returning()
      .execute();
    
    const channelMessage = channelMessageResult[0];

    const updateInput: UpdateMessageInput = {
      id: channelMessage.id,
      content: 'Updated channel message'
    };

    const result = await updateMessage(updateInput);

    expect(result.content).toEqual('Updated channel message');
    expect(result.channel_id).toEqual(channel.id);
    expect(result.direct_message_recipient_id).toBeNull();
    expect(result.edited_at).toBeInstanceOf(Date);
  });

  it('should handle direct messages correctly', async () => {
    const user = await createTestUser();
    
    // Create a second user as the recipient
    const recipientResult = await db.insert(usersTable)
      .values({
        username: 'recipient',
        email: 'recipient@example.com',
        password_hash: 'hashed_password',
        display_name: 'Recipient User',
        status: 'online'
      })
      .returning()
      .execute();
    
    const recipient = recipientResult[0];
    
    // Create a direct message
    const dmResult = await db.insert(messagesTable)
      .values({
        content: 'Direct message',
        message_type: 'text',
        sender_id: user.id,
        channel_id: null,
        direct_message_recipient_id: recipient.id,
        reply_to_message_id: null
      })
      .returning()
      .execute();
    
    const directMessage = dmResult[0];

    const updateInput: UpdateMessageInput = {
      id: directMessage.id,
      content: 'Updated direct message'
    };

    const result = await updateMessage(updateInput);

    expect(result.content).toEqual('Updated direct message');
    expect(result.channel_id).toBeNull();
    expect(result.direct_message_recipient_id).toEqual(recipient.id);
    expect(result.edited_at).toBeInstanceOf(Date);
  });

  it('should throw error when message not found', async () => {
    const updateInput: UpdateMessageInput = {
      id: 999999, // Non-existent message ID
      content: 'This should fail'
    };

    await expect(updateMessage(updateInput)).rejects.toThrow(/message with id 999999 not found/i);
  });

  it('should handle empty string content', async () => {
    const user = await createTestUser();
    const message = await createTestMessage(user.id);

    const updateInput: UpdateMessageInput = {
      id: message.id,
      content: '' // Empty content should be rejected by Zod validation at API level
    };

    // Since this bypasses Zod validation, the handler should still work
    // but in practice, this would be caught by input validation
    await expect(updateMessage(updateInput)).resolves.toBeDefined();
  });

  it('should update edited_at to current timestamp', async () => {
    const user = await createTestUser();
    const message = await createTestMessage(user.id);
    
    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const beforeUpdate = new Date();

    const updateInput: UpdateMessageInput = {
      id: message.id,
      content: 'Timestamp test'
    };

    const result = await updateMessage(updateInput);

    expect(result.edited_at).toBeInstanceOf(Date);
    expect(result.edited_at!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    expect(result.updated_at.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
  });
});