import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, messagesTable } from '../db/schema';
import { type GetMessagesInput } from '../schema';
import { getMessages } from '../handlers/get_messages';

describe('getMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test users
  const createTestUsers = async () => {
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'test1@example.com',
          password_hash: 'hash1'
        },
        {
          username: 'testuser2',
          email: 'test2@example.com',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    return users;
  };

  // Helper function to create test channel
  const createTestChannel = async (creatorId: number) => {
    const channels = await db.insert(channelsTable)
      .values({
        name: 'Test Channel',
        description: 'A test channel',
        is_private: false,
        created_by: creatorId
      })
      .returning()
      .execute();

    return channels[0];
  };

  // Helper function to create test messages with specific timing
  const createTestMessages = async (senderId: number, channelId?: number, recipientId?: number) => {
    const now = new Date();
    
    // Create messages one by one with increasing timestamps
    const message1 = await db.insert(messagesTable)
      .values({
        content: 'First message',
        message_type: 'text',
        sender_id: senderId,
        channel_id: channelId || null,
        direct_message_recipient_id: recipientId || null,
        created_at: new Date(now.getTime() - 3000) // 3 seconds ago
      })
      .returning()
      .execute();

    const message2 = await db.insert(messagesTable)
      .values({
        content: 'Second message',
        message_type: 'text',
        sender_id: senderId,
        channel_id: channelId || null,
        direct_message_recipient_id: recipientId || null,
        created_at: new Date(now.getTime() - 2000) // 2 seconds ago
      })
      .returning()
      .execute();

    const message3 = await db.insert(messagesTable)
      .values({
        content: 'Third message',
        message_type: 'file',
        sender_id: senderId,
        channel_id: channelId || null,
        direct_message_recipient_id: recipientId || null,
        created_at: new Date(now.getTime() - 1000) // 1 second ago
      })
      .returning()
      .execute();

    return [message1[0], message2[0], message3[0]];
  };

  it('should get messages from a channel', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    await createTestMessages(users[0].id, channel.id);

    const input: GetMessagesInput = {
      channel_id: channel.id,
      page: 1,
      limit: 10
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    expect(result[0].channel_id).toBe(channel.id);
    expect(result[0].direct_message_recipient_id).toBeNull();
    expect(result[0].content).toBe('Third message'); // Newest first (descending order)
    expect(result[1].content).toBe('Second message');
    expect(result[2].content).toBe('First message');
  });

  it('should get direct messages', async () => {
    const users = await createTestUsers();
    await createTestMessages(users[0].id, undefined, users[1].id);

    const input: GetMessagesInput = {
      direct_message_recipient_id: users[1].id,
      page: 1,
      limit: 10
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    expect(result[0].channel_id).toBeNull();
    expect(result[0].direct_message_recipient_id).toBe(users[1].id);
    expect(result[0].sender_id).toBe(users[0].id);
  });

  it('should handle pagination correctly', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Create 5 messages
    for (let i = 1; i <= 5; i++) {
      await db.insert(messagesTable)
        .values({
          content: `Message ${i}`,
          message_type: 'text',
          sender_id: users[0].id,
          channel_id: channel.id
        })
        .execute();
    }

    // Get first page (limit 2)
    const page1Input: GetMessagesInput = {
      channel_id: channel.id,
      page: 1,
      limit: 2
    };

    const page1Result = await getMessages(page1Input);
    expect(page1Result).toHaveLength(2);
    expect(page1Result[0].content).toBe('Message 5'); // Newest first
    expect(page1Result[1].content).toBe('Message 4');

    // Get second page
    const page2Input: GetMessagesInput = {
      channel_id: channel.id,
      page: 2,
      limit: 2
    };

    const page2Result = await getMessages(page2Input);
    expect(page2Result).toHaveLength(2);
    expect(page2Result[0].content).toBe('Message 3');
    expect(page2Result[1].content).toBe('Message 2');
  });

  it('should use default pagination values when not provided', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    await createTestMessages(users[0].id, channel.id);

    const input: GetMessagesInput = {
      channel_id: channel.id
      // No page or limit specified
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    // Should work with default pagination (page 1, limit 50)
  });

  it('should handle null channel_id for direct messages only', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Create channel messages
    await createTestMessages(users[0].id, channel.id);
    
    // Create direct messages
    await createTestMessages(users[0].id, undefined, users[1].id);

    const input: GetMessagesInput = {
      channel_id: null // Explicitly requesting non-channel messages
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    expect(result[0].channel_id).toBeNull();
    expect(result[0].direct_message_recipient_id).toBe(users[1].id);
  });

  it('should handle null direct_message_recipient_id for channel messages only', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Create channel messages
    await createTestMessages(users[0].id, channel.id);
    
    // Create direct messages
    await createTestMessages(users[0].id, undefined, users[1].id);

    const input: GetMessagesInput = {
      direct_message_recipient_id: null // Explicitly requesting non-DM messages
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    expect(result[0].channel_id).toBe(channel.id);
    expect(result[0].direct_message_recipient_id).toBeNull();
  });

  it('should return empty array when no messages exist', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);

    const input: GetMessagesInput = {
      channel_id: channel.id
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(0);
  });

  it('should throw error when both channel_id and direct_message_recipient_id are provided', async () => {
    const input: GetMessagesInput = {
      channel_id: 1,
      direct_message_recipient_id: 2
    };

    await expect(getMessages(input)).rejects.toThrow(/Cannot specify both channel_id and direct_message_recipient_id/i);
  });

  it('should handle different message types correctly', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    const now = new Date();
    
    // Create messages with different types and specific timing
    await db.insert(messagesTable)
      .values({
        content: 'Text message',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 3000)
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        content: 'File uploaded',
        message_type: 'file',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 2000)
      })
      .execute();

    await db.insert(messagesTable)
      .values({
        content: 'System notification',
        message_type: 'system',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 1000)
      })
      .execute();

    const input: GetMessagesInput = {
      channel_id: channel.id
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    const messageTypes = result.map(msg => msg.message_type);
    expect(messageTypes).toContain('text');
    expect(messageTypes).toContain('file');
    expect(messageTypes).toContain('system');
  });

  it('should order messages by created_at descending', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Create messages with specific timing
    const now = new Date();
    const message1 = await db.insert(messagesTable)
      .values({
        content: 'Oldest message',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 3000) // 3 seconds ago
      })
      .returning()
      .execute();

    const message2 = await db.insert(messagesTable)
      .values({
        content: 'Middle message',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 2000) // 2 seconds ago
      })
      .returning()
      .execute();

    const message3 = await db.insert(messagesTable)
      .values({
        content: 'Newest message',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id,
        created_at: new Date(now.getTime() - 1000) // 1 second ago
      })
      .returning()
      .execute();

    const input: GetMessagesInput = {
      channel_id: channel.id
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('Newest message');
    expect(result[1].content).toBe('Middle message');
    expect(result[2].content).toBe('Oldest message');
    
    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });
});