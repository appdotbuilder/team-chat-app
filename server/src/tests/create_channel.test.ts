import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { channelsTable, channelMembershipsTable, usersTable } from '../db/schema';
import { type CreateChannelInput } from '../schema';
import { createChannel } from '../handlers/create_channel';
import { eq, and } from 'drizzle-orm';

describe('createChannel', () => {
  let testUserId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first since channels need a creator
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
    
    testUserId = userResult[0].id;
  });

  afterEach(resetDB);

  it('should create a public channel', async () => {
    const testInput: CreateChannelInput = {
      name: 'General Discussion',
      description: 'A place for general chat',
      is_private: false
    };

    const result = await createChannel(testInput, testUserId);

    // Verify channel properties
    expect(result.name).toEqual('General Discussion');
    expect(result.description).toEqual('A place for general chat');
    expect(result.is_private).toEqual(false);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a private channel', async () => {
    const testInput: CreateChannelInput = {
      name: 'Private Team',
      description: null,
      is_private: true
    };

    const result = await createChannel(testInput, testUserId);

    expect(result.name).toEqual('Private Team');
    expect(result.description).toBeNull();
    expect(result.is_private).toEqual(true);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
  });

  it('should create a channel without description', async () => {
    const testInput: CreateChannelInput = {
      name: 'Quick Chat',
      is_private: false
    };

    const result = await createChannel(testInput, testUserId);

    expect(result.name).toEqual('Quick Chat');
    expect(result.description).toBeNull();
    expect(result.is_private).toEqual(false);
    expect(result.created_by).toEqual(testUserId);
  });

  it('should save channel to database', async () => {
    const testInput: CreateChannelInput = {
      name: 'Test Channel',
      description: 'Test description',
      is_private: true
    };

    const result = await createChannel(testInput, testUserId);

    // Query the database to verify the channel was saved
    const channels = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, result.id))
      .execute();

    expect(channels).toHaveLength(1);
    expect(channels[0].name).toEqual('Test Channel');
    expect(channels[0].description).toEqual('Test description');
    expect(channels[0].is_private).toEqual(true);
    expect(channels[0].created_by).toEqual(testUserId);
    expect(channels[0].created_at).toBeInstanceOf(Date);
  });

  it('should automatically create owner membership for creator', async () => {
    const testInput: CreateChannelInput = {
      name: 'Auto Membership Test',
      description: 'Testing automatic membership creation',
      is_private: false
    };

    const result = await createChannel(testInput, testUserId);

    // Verify channel membership was created
    const memberships = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, result.id),
          eq(channelMembershipsTable.user_id, testUserId)
        )
      )
      .execute();

    expect(memberships).toHaveLength(1);
    expect(memberships[0].role).toEqual('owner');
    expect(memberships[0].channel_id).toEqual(result.id);
    expect(memberships[0].user_id).toEqual(testUserId);
    expect(memberships[0].joined_at).toBeInstanceOf(Date);
  });

  it('should handle multiple channels by same user', async () => {
    const testInput1: CreateChannelInput = {
      name: 'First Channel',
      is_private: false
    };

    const testInput2: CreateChannelInput = {
      name: 'Second Channel',
      is_private: true
    };

    const result1 = await createChannel(testInput1, testUserId);
    const result2 = await createChannel(testInput2, testUserId);

    // Verify both channels were created with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('First Channel');
    expect(result2.name).toEqual('Second Channel');
    expect(result1.created_by).toEqual(testUserId);
    expect(result2.created_by).toEqual(testUserId);

    // Verify both memberships exist
    const memberships = await db.select()
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.user_id, testUserId))
      .execute();

    expect(memberships).toHaveLength(2);
    expect(memberships.every(m => m.role === 'owner')).toBe(true);
  });

  it('should throw error for non-existent creator', async () => {
    const testInput: CreateChannelInput = {
      name: 'Invalid Creator Test',
      is_private: false
    };

    const nonExistentUserId = 99999;

    await expect(createChannel(testInput, nonExistentUserId))
      .rejects
      .toThrow(/User with id 99999 does not exist/i);
  });

  it('should handle channels with same name but different privacy', async () => {
    const publicChannel: CreateChannelInput = {
      name: 'Duplicate Name',
      is_private: false
    };

    const privateChannel: CreateChannelInput = {
      name: 'Duplicate Name',
      is_private: true
    };

    const result1 = await createChannel(publicChannel, testUserId);
    const result2 = await createChannel(privateChannel, testUserId);

    expect(result1.name).toEqual(result2.name);
    expect(result1.is_private).toEqual(false);
    expect(result2.is_private).toEqual(true);
    expect(result1.id).not.toEqual(result2.id);
  });
});