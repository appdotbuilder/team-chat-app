import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, directMessageConversationsTable } from '../db/schema';
import { type CreateDirectMessageConversationInput } from '../schema';
import { createDirectMessageConversation } from '../handlers/create_direct_message_conversation';
import { eq, or, and } from 'drizzle-orm';

// Test users
const testUser1 = {
  username: 'user1',
  email: 'user1@example.com',
  password_hash: 'hashedpassword1',
  display_name: 'User One',
  avatar_url: null,
  status: 'online' as const
};

const testUser2 = {
  username: 'user2',
  email: 'user2@example.com',
  password_hash: 'hashedpassword2',
  display_name: 'User Two',
  avatar_url: null,
  status: 'offline' as const
};

describe('createDirectMessageConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let user1Id: number;
  let user2Id: number;

  beforeEach(async () => {
    // Create test users before each test
    const users = await db.insert(usersTable)
      .values([testUser1, testUser2])
      .returning()
      .execute();

    user1Id = users[0].id;
    user2Id = users[1].id;
  });

  it('should create a new direct message conversation', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: user2Id
    };

    const result = await createDirectMessageConversation(input);

    // Basic field validation
    expect(result.user1_id).toEqual(user1Id);
    expect(result.user2_id).toEqual(user2Id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save conversation to database', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: user2Id
    };

    const result = await createDirectMessageConversation(input);

    // Verify conversation was saved to database
    const conversations = await db.select()
      .from(directMessageConversationsTable)
      .where(eq(directMessageConversationsTable.id, result.id))
      .execute();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].user1_id).toEqual(user1Id);
    expect(conversations[0].user2_id).toEqual(user2Id);
    expect(conversations[0].created_at).toBeInstanceOf(Date);
    expect(conversations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return existing conversation if one already exists (same order)', async () => {
    // Create initial conversation
    const input: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: user2Id
    };

    const firstResult = await createDirectMessageConversation(input);

    // Try to create the same conversation again
    const secondResult = await createDirectMessageConversation(input);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.user1_id).toEqual(user1Id);
    expect(secondResult.user2_id).toEqual(user2Id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(directMessageConversationsTable)
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should return existing conversation if one already exists (reverse order)', async () => {
    // Create conversation with user1 -> user2
    const input1: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: user2Id
    };

    const firstResult = await createDirectMessageConversation(input1);

    // Try to create conversation with user2 -> user1 (reverse order)
    const input2: CreateDirectMessageConversationInput = {
      user1_id: user2Id,
      user2_id: user1Id
    };

    const secondResult = await createDirectMessageConversation(input2);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(directMessageConversationsTable)
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should throw error when user1 does not exist', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: 99999, // Non-existent user ID
      user2_id: user2Id
    };

    await expect(createDirectMessageConversation(input))
      .rejects.toThrow(/one or both users do not exist/i);
  });

  it('should throw error when user2 does not exist', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: 99999 // Non-existent user ID
    };

    await expect(createDirectMessageConversation(input))
      .rejects.toThrow(/one or both users do not exist/i);
  });

  it('should throw error when both users do not exist', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: 99998, // Non-existent user ID
      user2_id: 99999  // Non-existent user ID
    };

    await expect(createDirectMessageConversation(input))
      .rejects.toThrow(/one or both users do not exist/i);
  });

  it('should allow conversation between same user (self-conversation)', async () => {
    const input: CreateDirectMessageConversationInput = {
      user1_id: user1Id,
      user2_id: user1Id
    };

    const result = await createDirectMessageConversation(input);

    expect(result.user1_id).toEqual(user1Id);
    expect(result.user2_id).toEqual(user1Id);
    expect(result.id).toBeDefined();
  });

  it('should handle multiple different conversations correctly', async () => {
    // Create third user for additional testing
    const testUser3 = {
      username: 'user3',
      email: 'user3@example.com',
      password_hash: 'hashedpassword3',
      display_name: 'User Three',
      avatar_url: null,
      status: 'away' as const
    };

    const user3Result = await db.insert(usersTable)
      .values(testUser3)
      .returning()
      .execute();

    const user3Id = user3Result[0].id;

    // Create first conversation: user1 <-> user2
    const conv1 = await createDirectMessageConversation({
      user1_id: user1Id,
      user2_id: user2Id
    });

    // Create second conversation: user1 <-> user3
    const conv2 = await createDirectMessageConversation({
      user1_id: user1Id,
      user2_id: user3Id
    });

    // Create third conversation: user2 <-> user3
    const conv3 = await createDirectMessageConversation({
      user1_id: user2Id,
      user2_id: user3Id
    });

    // All conversations should be different
    expect(conv1.id).not.toEqual(conv2.id);
    expect(conv1.id).not.toEqual(conv3.id);
    expect(conv2.id).not.toEqual(conv3.id);

    // Verify all three conversations exist in database
    const conversations = await db.select()
      .from(directMessageConversationsTable)
      .execute();

    expect(conversations).toHaveLength(3);
  });
});