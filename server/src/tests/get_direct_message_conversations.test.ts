import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, directMessageConversationsTable } from '../db/schema';
import { getDirectMessageConversations } from '../handlers/get_direct_message_conversations';

describe('getDirectMessageConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return conversations where user is user1', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          password_hash: 'hash1',
          status: 'online'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          password_hash: 'hash2',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    const user1 = users[0];
    const user2 = users[1];

    // Create conversation where user1 is user1_id
    await db.insert(directMessageConversationsTable)
      .values({
        user1_id: user1.id,
        user2_id: user2.id
      })
      .execute();

    const result = await getDirectMessageConversations(user1.id);

    expect(result).toHaveLength(1);
    expect(result[0].user1_id).toEqual(user1.id);
    expect(result[0].user2_id).toEqual(user2.id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return conversations where user is user2', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          password_hash: 'hash1',
          status: 'online'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          password_hash: 'hash2',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    const user1 = users[0];
    const user2 = users[1];

    // Create conversation where user2 is user2_id
    await db.insert(directMessageConversationsTable)
      .values({
        user1_id: user1.id,
        user2_id: user2.id
      })
      .execute();

    const result = await getDirectMessageConversations(user2.id);

    expect(result).toHaveLength(1);
    expect(result[0].user1_id).toEqual(user1.id);
    expect(result[0].user2_id).toEqual(user2.id);
  });

  it('should return multiple conversations for a user', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          password_hash: 'hash1',
          status: 'online'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          password_hash: 'hash2',
          status: 'online'
        },
        {
          username: 'user3',
          email: 'user3@test.com',
          password_hash: 'hash3',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    const [user1, user2, user3] = users;

    // Create multiple conversations with user1
    await db.insert(directMessageConversationsTable)
      .values([
        {
          user1_id: user1.id,
          user2_id: user2.id
        },
        {
          user1_id: user3.id,
          user2_id: user1.id
        }
      ])
      .execute();

    const result = await getDirectMessageConversations(user1.id);

    expect(result).toHaveLength(2);
    
    // Check that user1 appears in both conversations
    const userIds = result.flatMap(conv => [conv.user1_id, conv.user2_id]);
    expect(userIds.filter(id => id === user1.id)).toHaveLength(2);
    
    // Check that we have conversations with both user2 and user3
    const otherUserIds = userIds.filter(id => id !== user1.id).sort();
    expect(otherUserIds).toEqual([user2.id, user3.id].sort());
  });

  it('should return empty array when user has no conversations', async () => {
    // Create a user but no conversations
    const users = await db.insert(usersTable)
      .values({
        username: 'lonely_user',
        email: 'lonely@test.com',
        password_hash: 'hash',
        status: 'online'
      })
      .returning()
      .execute();

    const result = await getDirectMessageConversations(users[0].id);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should not return conversations for other users', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          password_hash: 'hash1',
          status: 'online'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          password_hash: 'hash2',
          status: 'online'
        },
        {
          username: 'user3',
          email: 'user3@test.com',
          password_hash: 'hash3',
          status: 'online'
        }
      ])
      .returning()
      .execute();

    const [user1, user2, user3] = users;

    // Create conversation between user2 and user3 (not involving user1)
    await db.insert(directMessageConversationsTable)
      .values({
        user1_id: user2.id,
        user2_id: user3.id
      })
      .execute();

    const result = await getDirectMessageConversations(user1.id);

    expect(result).toHaveLength(0);
  });

  it('should handle non-existent user gracefully', async () => {
    // Query for a user ID that doesn't exist
    const result = await getDirectMessageConversations(999);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});