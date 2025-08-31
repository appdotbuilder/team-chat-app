import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, channelMembershipsTable } from '../db/schema';
import { getChannelMembers } from '../handlers/get_channel_members';

describe('getChannelMembers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all members of a channel', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hashed_password'
        },
        {
          username: 'member_user',
          email: 'member@test.com',
          password_hash: 'hashed_password'
        },
        {
          username: 'admin_user',
          email: 'admin@test.com',
          password_hash: 'hashed_password'
        }
      ])
      .returning()
      .execute();

    // Create test channel
    const channel = await db.insert(channelsTable)
      .values({
        name: 'Test Channel',
        description: 'A test channel',
        is_private: false,
        created_by: users[0].id
      })
      .returning()
      .execute();

    // Create channel memberships
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel[0].id,
          user_id: users[0].id,
          role: 'owner'
        },
        {
          channel_id: channel[0].id,
          user_id: users[1].id,
          role: 'member'
        },
        {
          channel_id: channel[0].id,
          user_id: users[2].id,
          role: 'admin'
        }
      ])
      .execute();

    const result = await getChannelMembers(channel[0].id);

    expect(result).toHaveLength(3);
    expect(result[0].channel_id).toEqual(channel[0].id);
    expect(result[0].user_id).toEqual(users[0].id);
    expect(result[0].role).toEqual('owner');
    expect(result[0].joined_at).toBeInstanceOf(Date);
    expect(result[0].id).toBeDefined();

    // Verify all roles are present
    const roles = result.map(member => member.role).sort();
    expect(roles).toEqual(['admin', 'member', 'owner']);
  });

  it('should return empty array for channel with no members', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'test_user',
        email: 'test@test.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create channel with no memberships
    const channel = await db.insert(channelsTable)
      .values({
        name: 'Empty Channel',
        description: 'A channel with no members',
        is_private: false,
        created_by: user[0].id
      })
      .returning()
      .execute();

    const result = await getChannelMembers(channel[0].id);

    expect(result).toHaveLength(0);
  });

  it('should throw error for non-existent channel', async () => {
    const nonExistentChannelId = 999;

    await expect(getChannelMembers(nonExistentChannelId))
      .rejects.toThrow(/Channel with id 999 not found/i);
  });

  it('should return members in correct order by joined_at', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'user1',
          email: 'user1@test.com',
          password_hash: 'hashed_password'
        },
        {
          username: 'user2',
          email: 'user2@test.com',
          password_hash: 'hashed_password'
        }
      ])
      .returning()
      .execute();

    // Create test channel
    const channel = await db.insert(channelsTable)
      .values({
        name: 'Test Channel',
        description: 'A test channel',
        is_private: false,
        created_by: users[0].id
      })
      .returning()
      .execute();

    // Create memberships at different times
    const firstMember = await db.insert(channelMembershipsTable)
      .values({
        channel_id: channel[0].id,
        user_id: users[0].id,
        role: 'owner'
      })
      .returning()
      .execute();

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondMember = await db.insert(channelMembershipsTable)
      .values({
        channel_id: channel[0].id,
        user_id: users[1].id,
        role: 'member'
      })
      .returning()
      .execute();

    const result = await getChannelMembers(channel[0].id);

    expect(result).toHaveLength(2);
    expect(result[0].joined_at <= result[1].joined_at).toBe(true);
  });
});