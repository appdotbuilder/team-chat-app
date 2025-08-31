import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, channelMembershipsTable, messagesTable } from '../db/schema';
import { type CreateMessageInput } from '../schema';
import { createMessage } from '../handlers/create_message';
import { eq } from 'drizzle-orm';

describe('createMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helper
  const setupTestData = async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'sender',
          email: 'sender@test.com',
          password_hash: 'hash1',
          display_name: 'Test Sender',
          status: 'online'
        },
        {
          username: 'recipient',
          email: 'recipient@test.com',
          password_hash: 'hash2',
          display_name: 'Test Recipient',
          status: 'online'
        },
        {
          username: 'nonmember',
          email: 'nonmember@test.com',
          password_hash: 'hash3',
          display_name: 'Non Member',
          status: 'offline'
        }
      ])
      .returning()
      .execute();

    const [sender, recipient, nonMember] = users;

    // Create test channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'general',
        description: 'General channel',
        is_private: false,
        created_by: sender.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add sender and recipient to channel
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: sender.id,
          role: 'owner'
        },
        {
          channel_id: channel.id,
          user_id: recipient.id,
          role: 'member'
        }
      ])
      .execute();

    return { sender, recipient, nonMember, channel };
  };

  it('should create a channel message', async () => {
    const { sender, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Hello everyone!',
      message_type: 'text',
      channel_id: channel.id
    };

    const result = await createMessage(input, sender.id);

    expect(result.content).toEqual('Hello everyone!');
    expect(result.message_type).toEqual('text');
    expect(result.sender_id).toEqual(sender.id);
    expect(result.channel_id).toEqual(channel.id);
    expect(result.direct_message_recipient_id).toBeNull();
    expect(result.reply_to_message_id).toBeNull();
    expect(result.edited_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a direct message', async () => {
    const { sender, recipient } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Hello there!',
      message_type: 'text',
      direct_message_recipient_id: recipient.id
    };

    const result = await createMessage(input, sender.id);

    expect(result.content).toEqual('Hello there!');
    expect(result.message_type).toEqual('text');
    expect(result.sender_id).toEqual(sender.id);
    expect(result.channel_id).toBeNull();
    expect(result.direct_message_recipient_id).toEqual(recipient.id);
    expect(result.reply_to_message_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a file message', async () => {
    const { sender, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'document.pdf',
      message_type: 'file',
      channel_id: channel.id
    };

    const result = await createMessage(input, sender.id);

    expect(result.content).toEqual('document.pdf');
    expect(result.message_type).toEqual('file');
    expect(result.sender_id).toEqual(sender.id);
    expect(result.channel_id).toEqual(channel.id);
  });

  it('should create a reply to a channel message', async () => {
    const { sender, recipient, channel } = await setupTestData();

    // Create original message
    const originalMessage = await db.insert(messagesTable)
      .values({
        content: 'Original message',
        message_type: 'text',
        sender_id: recipient.id,
        channel_id: channel.id
      })
      .returning()
      .execute();

    const input: CreateMessageInput = {
      content: 'This is a reply',
      message_type: 'text',
      channel_id: channel.id,
      reply_to_message_id: originalMessage[0].id
    };

    const result = await createMessage(input, sender.id);

    expect(result.content).toEqual('This is a reply');
    expect(result.channel_id).toEqual(channel.id);
    expect(result.reply_to_message_id).toEqual(originalMessage[0].id);
  });

  it('should create a reply to a direct message', async () => {
    const { sender, recipient } = await setupTestData();

    // Create original direct message
    const originalMessage = await db.insert(messagesTable)
      .values({
        content: 'Original DM',
        message_type: 'text',
        sender_id: recipient.id,
        direct_message_recipient_id: sender.id
      })
      .returning()
      .execute();

    const input: CreateMessageInput = {
      content: 'Reply to DM',
      message_type: 'text',
      direct_message_recipient_id: recipient.id,
      reply_to_message_id: originalMessage[0].id
    };

    const result = await createMessage(input, sender.id);

    expect(result.content).toEqual('Reply to DM');
    expect(result.direct_message_recipient_id).toEqual(recipient.id);
    expect(result.reply_to_message_id).toEqual(originalMessage[0].id);
  });

  it('should save message to database', async () => {
    const { sender, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      channel_id: channel.id
    };

    const result = await createMessage(input, sender.id);

    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toEqual('Test message');
    expect(messages[0].sender_id).toEqual(sender.id);
    expect(messages[0].channel_id).toEqual(channel.id);
  });

  // Error cases
  it('should throw error for non-existent sender', async () => {
    const { channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      channel_id: channel.id
    };

    await expect(createMessage(input, 999)).rejects.toThrow(/sender user not found/i);
  });

  it('should throw error for non-existent channel', async () => {
    const { sender } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      channel_id: 999
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/channel not found/i);
  });

  it('should throw error for non-existent direct message recipient', async () => {
    const { sender } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      direct_message_recipient_id: 999
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/direct message recipient not found/i);
  });

  it('should throw error when user is not channel member', async () => {
    const { nonMember, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      channel_id: channel.id
    };

    await expect(createMessage(input, nonMember.id)).rejects.toThrow(/user is not a member of this channel/i);
  });

  it('should throw error when sending direct message to self', async () => {
    const { sender } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      direct_message_recipient_id: sender.id
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/cannot send direct message to yourself/i);
  });

  it('should throw error when neither channel nor direct recipient specified', async () => {
    const { sender } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text'
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/message must specify either channel_id or direct_message_recipient_id/i);
  });

  it('should throw error when both channel and direct recipient specified', async () => {
    const { sender, recipient, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Test message',
      message_type: 'text',
      channel_id: channel.id,
      direct_message_recipient_id: recipient.id
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/message cannot specify both channel_id and direct_message_recipient_id/i);
  });

  it('should throw error for non-existent reply message', async () => {
    const { sender, channel } = await setupTestData();

    const input: CreateMessageInput = {
      content: 'Reply message',
      message_type: 'text',
      channel_id: channel.id,
      reply_to_message_id: 999
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/original message not found for reply/i);
  });

  it('should throw error when replying to message in different channel', async () => {
    const { sender, recipient, channel } = await setupTestData();

    // Create another channel
    const otherChannel = await db.insert(channelsTable)
      .values({
        name: 'other',
        description: 'Other channel',
        is_private: false,
        created_by: sender.id
      })
      .returning()
      .execute();

    // Add sender to other channel
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: otherChannel[0].id,
        user_id: sender.id,
        role: 'owner'
      })
      .execute();

    // Create message in different channel
    const originalMessage = await db.insert(messagesTable)
      .values({
        content: 'Original message',
        message_type: 'text',
        sender_id: recipient.id,
        channel_id: otherChannel[0].id
      })
      .returning()
      .execute();

    const input: CreateMessageInput = {
      content: 'Reply message',
      message_type: 'text',
      channel_id: channel.id,
      reply_to_message_id: originalMessage[0].id
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/reply must be in the same channel as original message/i);
  });

  it('should throw error when replying to DM from different conversation', async () => {
    const { sender, recipient, nonMember } = await setupTestData();

    // Create original DM between recipient and nonMember
    const originalMessage = await db.insert(messagesTable)
      .values({
        content: 'Original DM',
        message_type: 'text',
        sender_id: recipient.id,
        direct_message_recipient_id: nonMember.id
      })
      .returning()
      .execute();

    // Try to reply from sender (who wasn't part of original conversation)
    const input: CreateMessageInput = {
      content: 'Reply to DM',
      message_type: 'text',
      direct_message_recipient_id: recipient.id,
      reply_to_message_id: originalMessage[0].id
    };

    await expect(createMessage(input, sender.id)).rejects.toThrow(/reply must be in the same direct message conversation as original message/i);
  });
});