import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable } from '../db/schema';
import { type UpdateChannelInput } from '../schema';
import { updateChannel } from '../handlers/update_channel';
import { eq } from 'drizzle-orm';

describe('updateChannel', () => {
  let testUserId: number;
  let testChannelId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test user first (required for foreign key)
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword'
      })
      .returning()
      .execute();
    
    testUserId = userResult[0].id;

    // Create a test channel
    const channelResult = await db.insert(channelsTable)
      .values({
        name: 'Original Channel',
        description: 'Original description',
        is_private: false,
        created_by: testUserId
      })
      .returning()
      .execute();
    
    testChannelId = channelResult[0].id;
  });

  afterEach(resetDB);

  it('should update channel name only', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      name: 'Updated Channel Name'
    };

    const result = await updateChannel(input);

    expect(result.id).toEqual(testChannelId);
    expect(result.name).toEqual('Updated Channel Name');
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.is_private).toEqual(false); // Unchanged
    expect(result.created_by).toEqual(testUserId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update channel description only', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      description: 'Updated description'
    };

    const result = await updateChannel(input);

    expect(result.id).toEqual(testChannelId);
    expect(result.name).toEqual('Original Channel'); // Unchanged
    expect(result.description).toEqual('Updated description');
    expect(result.is_private).toEqual(false); // Unchanged
    expect(result.created_by).toEqual(testUserId);
  });

  it('should update channel privacy setting only', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      is_private: true
    };

    const result = await updateChannel(input);

    expect(result.id).toEqual(testChannelId);
    expect(result.name).toEqual('Original Channel'); // Unchanged
    expect(result.description).toEqual('Original description'); // Unchanged
    expect(result.is_private).toEqual(true);
    expect(result.created_by).toEqual(testUserId);
  });

  it('should update multiple fields simultaneously', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      name: 'Completely New Name',
      description: 'Completely new description',
      is_private: true
    };

    const result = await updateChannel(input);

    expect(result.id).toEqual(testChannelId);
    expect(result.name).toEqual('Completely New Name');
    expect(result.description).toEqual('Completely new description');
    expect(result.is_private).toEqual(true);
    expect(result.created_by).toEqual(testUserId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should set description to null when explicitly provided', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      description: null
    };

    const result = await updateChannel(input);

    expect(result.description).toBeNull();
    expect(result.name).toEqual('Original Channel'); // Unchanged
    expect(result.is_private).toEqual(false); // Unchanged
  });

  it('should save changes to database', async () => {
    const input: UpdateChannelInput = {
      id: testChannelId,
      name: 'Database Test Channel',
      description: 'Testing database persistence'
    };

    await updateChannel(input);

    // Verify changes were saved to database
    const channels = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, testChannelId))
      .execute();

    expect(channels).toHaveLength(1);
    expect(channels[0].name).toEqual('Database Test Channel');
    expect(channels[0].description).toEqual('Testing database persistence');
  });

  it('should update the updated_at timestamp', async () => {
    // Get original timestamp
    const originalChannel = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, testChannelId))
      .execute();
    
    const originalTimestamp = originalChannel[0].updated_at;

    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: UpdateChannelInput = {
      id: testChannelId,
      name: 'Timestamp Test'
    };

    const result = await updateChannel(input);

    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalTimestamp.getTime());
  });

  it('should throw error when channel does not exist', async () => {
    const input: UpdateChannelInput = {
      id: 99999, // Non-existent ID
      name: 'This should fail'
    };

    await expect(updateChannel(input)).rejects.toThrow(/Channel with id 99999 not found/);
  });

  it('should handle partial updates without affecting other fields', async () => {
    // Create a channel with all fields populated
    const fullChannelResult = await db.insert(channelsTable)
      .values({
        name: 'Full Channel',
        description: 'Full description',
        is_private: true,
        created_by: testUserId
      })
      .returning()
      .execute();
    
    const fullChannelId = fullChannelResult[0].id;

    // Update only one field
    const input: UpdateChannelInput = {
      id: fullChannelId,
      name: 'Only Name Changed'
    };

    const result = await updateChannel(input);

    expect(result.name).toEqual('Only Name Changed');
    expect(result.description).toEqual('Full description'); // Should remain unchanged
    expect(result.is_private).toEqual(true); // Should remain unchanged
    expect(result.created_by).toEqual(testUserId);
  });
});