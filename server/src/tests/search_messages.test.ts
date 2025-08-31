import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  channelsTable, 
  messagesTable, 
  channelMembershipsTable,
  directMessageConversationsTable 
} from '../db/schema';
import { searchMessages } from '../handlers/search_messages';

// Test data setup
const createTestUsers = async () => {
  const users = await db.insert(usersTable)
    .values([
      {
        username: 'user1',
        email: 'user1@test.com',
        password_hash: 'hash1',
        display_name: 'User One',
        status: 'online'
      },
      {
        username: 'user2',
        email: 'user2@test.com',
        password_hash: 'hash2',
        display_name: 'User Two',
        status: 'online'
      },
      {
        username: 'user3',
        email: 'user3@test.com',
        password_hash: 'hash3',
        display_name: 'User Three',
        status: 'online'
      }
    ])
    .returning()
    .execute();

  return users;
};

const createTestChannel = async (createdBy: number) => {
  const result = await db.insert(channelsTable)
    .values({
      name: 'test-channel',
      description: 'Test channel',
      is_private: false,
      created_by: createdBy
    })
    .returning()
    .execute();

  return result[0];
};

const addChannelMembership = async (channelId: number, userId: number, role: 'owner' | 'admin' | 'member' = 'member') => {
  await db.insert(channelMembershipsTable)
    .values({
      channel_id: channelId,
      user_id: userId,
      role
    })
    .execute();
};

const createTestMessages = async (channelId: number, senderId: number) => {
  const messages = await db.insert(messagesTable)
    .values([
      {
        content: 'Hello world, this is a test message',
        message_type: 'text',
        sender_id: senderId,
        channel_id: channelId
      },
      {
        content: 'Another message about testing features',
        message_type: 'text',
        sender_id: senderId,
        channel_id: channelId
      },
      {
        content: 'JavaScript is awesome for development',
        message_type: 'text',
        sender_id: senderId,
        channel_id: channelId
      }
    ])
    .returning()
    .execute();

  return messages;
};

const createDirectMessages = async (senderId: number, recipientId: number) => {
  const messages = await db.insert(messagesTable)
    .values([
      {
        content: 'Direct message hello world',
        message_type: 'text',
        sender_id: senderId,
        channel_id: null,
        direct_message_recipient_id: recipientId
      },
      {
        content: 'Private conversation about testing',
        message_type: 'text',
        sender_id: senderId,
        channel_id: null,
        direct_message_recipient_id: recipientId
      }
    ])
    .returning()
    .execute();

  return messages;
};

describe('searchMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should find messages by content in accessible channels', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Add user to channel
    await addChannelMembership(channel.id, users[0].id, 'owner');
    
    // Create messages
    await createTestMessages(channel.id, users[0].id);

    const results = await searchMessages('test', users[0].id);

    expect(results).toHaveLength(2); // Two messages contain "test"
    expect(results[0].content).toMatch(/test/i);
    expect(results[1].content).toMatch(/test/i);
  });

  it('should search case-insensitively', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    await addChannelMembership(channel.id, users[0].id, 'owner');
    await createTestMessages(channel.id, users[0].id);

    // Search with different cases
    const results1 = await searchMessages('HELLO', users[0].id);
    const results2 = await searchMessages('hello', users[0].id);
    const results3 = await searchMessages('Hello', users[0].id);

    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results3).toHaveLength(1);
    expect(results1[0].content).toContain('Hello world');
  });

  it('should search in specific channel when channelId provided', async () => {
    const users = await createTestUsers();
    const channel1 = await createTestChannel(users[0].id);
    const channel2 = await createTestChannel(users[0].id);
    
    // Add user to both channels
    await addChannelMembership(channel1.id, users[0].id, 'owner');
    await addChannelMembership(channel2.id, users[0].id, 'owner');
    
    // Create messages in channel1
    await createTestMessages(channel1.id, users[0].id);
    
    // Create different message in channel2
    await db.insert(messagesTable)
      .values({
        content: 'Channel 2 test message',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel2.id
      })
      .execute();

    // Search only in channel1
    const results = await searchMessages('test', users[0].id, channel1.id);

    expect(results).toHaveLength(2); // Only messages from channel1
    results.forEach(message => {
      expect(message.channel_id).toBe(channel1.id);
    });
  });

  it('should return empty array if user has no access to specified channel', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Only add user[0] to channel, not user[1]
    await addChannelMembership(channel.id, users[0].id, 'owner');
    await createTestMessages(channel.id, users[0].id);

    // User[1] tries to search in channel they don't have access to
    const results = await searchMessages('test', users[1].id, channel.id);

    expect(results).toHaveLength(0);
  });

  it('should search in direct messages', async () => {
    const users = await createTestUsers();
    
    // Create direct messages between users
    await createDirectMessages(users[0].id, users[1].id);

    // User[0] searches their direct messages
    const results1 = await searchMessages('hello', users[0].id);
    expect(results1).toHaveLength(1);
    expect(results1[0].content).toContain('Direct message hello world');
    expect(results1[0].channel_id).toBeNull();
    expect(results1[0].direct_message_recipient_id).toBe(users[1].id);

    // User[1] searches their direct messages
    const results2 = await searchMessages('testing', users[1].id);
    expect(results2).toHaveLength(1);
    expect(results2[0].content).toContain('Private conversation about testing');
  });

  it('should not find direct messages user is not involved in', async () => {
    const users = await createTestUsers();
    
    // Create direct messages between users[0] and users[1]
    await createDirectMessages(users[0].id, users[1].id);

    // User[2] tries to search, should not find messages they're not involved in
    const results = await searchMessages('hello', users[2].id);

    expect(results).toHaveLength(0);
  });

  it('should search across both channels and direct messages', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Add user to channel
    await addChannelMembership(channel.id, users[0].id, 'owner');
    
    // Create channel message with "awesome"
    await db.insert(messagesTable)
      .values({
        content: 'This channel is awesome',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id
      })
      .execute();

    // Create direct message with "awesome"
    await db.insert(messagesTable)
      .values({
        content: 'DM conversation is awesome',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: null,
        direct_message_recipient_id: users[1].id
      })
      .execute();

    const results = await searchMessages('awesome', users[0].id);

    expect(results).toHaveLength(2);
    const channelMessage = results.find(m => m.channel_id !== null);
    const dmMessage = results.find(m => m.channel_id === null);

    expect(channelMessage).toBeDefined();
    expect(dmMessage).toBeDefined();
    expect(channelMessage?.content).toContain('This channel is awesome');
    expect(dmMessage?.content).toContain('DM conversation is awesome');
  });

  it('should return empty array for empty search query', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    await addChannelMembership(channel.id, users[0].id, 'owner');
    await createTestMessages(channel.id, users[0].id);

    const results1 = await searchMessages('', users[0].id);
    const results2 = await searchMessages('   ', users[0].id);

    expect(results1).toHaveLength(0);
    expect(results2).toHaveLength(0);
  });

  it('should return empty array if user has no channel memberships and no DMs', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    // Create messages but don't add user[1] to any channels
    await addChannelMembership(channel.id, users[0].id, 'owner');
    await createTestMessages(channel.id, users[0].id);

    const results = await searchMessages('test', users[1].id);

    expect(results).toHaveLength(0);
  });

  it('should limit search results to prevent overwhelming responses', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    await addChannelMembership(channel.id, users[0].id, 'owner');

    // Create many messages with the same search term
    const messagePromises = [];
    for (let i = 0; i < 60; i++) {
      messagePromises.push(
        db.insert(messagesTable)
          .values({
            content: `Message ${i} contains searchterm`,
            message_type: 'text',
            sender_id: users[0].id,
            channel_id: channel.id
          })
          .execute()
      );
    }
    await Promise.all(messagePromises);

    const results = await searchMessages('searchterm', users[0].id);

    expect(results.length).toBeLessThanOrEqual(50); // Should be limited to 50
  });

  it('should handle partial word matches', async () => {
    const users = await createTestUsers();
    const channel = await createTestChannel(users[0].id);
    
    await addChannelMembership(channel.id, users[0].id, 'owner');
    
    await db.insert(messagesTable)
      .values({
        content: 'JavaScript programming is fantastic',
        message_type: 'text',
        sender_id: users[0].id,
        channel_id: channel.id
      })
      .execute();

    // Should find partial matches
    const results1 = await searchMessages('Java', users[0].id);
    const results2 = await searchMessages('Script', users[0].id);
    const results3 = await searchMessages('program', users[0].id);

    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results3).toHaveLength(1);
  });
});