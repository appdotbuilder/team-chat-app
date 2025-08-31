import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { channelsTable, usersTable, channelMembershipsTable } from '../db/schema';
import { type GetChannelsInput } from '../schema';
import { getChannels } from '../handlers/get_channels';
import { eq } from 'drizzle-orm';

describe('getChannels', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all public channels when no user_id is specified', async () => {
    // Create test users first
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'user1@test.com',
          password_hash: 'hashed_password_1'
        },
        {
          username: 'testuser2',
          email: 'user2@test.com',
          password_hash: 'hashed_password_2'
        }
      ])
      .returning()
      .execute();

    // Create test channels
    await db.insert(channelsTable)
      .values([
        {
          name: 'general',
          description: 'General discussion',
          is_private: false,
          created_by: users[0].id
        },
        {
          name: 'random',
          description: 'Random chat',
          is_private: false,
          created_by: users[0].id
        },
        {
          name: 'private-team',
          description: 'Private team channel',
          is_private: true,
          created_by: users[0].id
        }
      ])
      .execute();

    const input: GetChannelsInput = {};
    const result = await getChannels(input);

    // Should only return public channels
    expect(result).toHaveLength(2);
    expect(result.every(channel => !channel.is_private)).toBe(true);
    
    const channelNames = result.map(c => c.name).sort();
    expect(channelNames).toEqual(['general', 'random']);

    // Verify all required fields are present
    result.forEach(channel => {
      expect(channel.id).toBeDefined();
      expect(channel.name).toBeDefined();
      expect(channel.is_private).toBe(false);
      expect(channel.created_by).toBeDefined();
      expect(channel.created_at).toBeInstanceOf(Date);
      expect(channel.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return only public channels when user_id is specified but include_private is false', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create test channels
    await db.insert(channelsTable)
      .values([
        {
          name: 'general',
          description: 'General discussion',
          is_private: false,
          created_by: user[0].id
        },
        {
          name: 'private-team',
          description: 'Private team channel',
          is_private: true,
          created_by: user[0].id
        }
      ])
      .execute();

    const input: GetChannelsInput = {
      user_id: user[0].id,
      include_private: false
    };
    
    const result = await getChannels(input);

    // Should only return public channels
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('general');
    expect(result[0].is_private).toBe(false);
  });

  it('should return public channels and private channels where user is a member when include_private is true', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'user1@test.com',
          password_hash: 'hashed_password_1'
        },
        {
          username: 'testuser2',
          email: 'user2@test.com',
          password_hash: 'hashed_password_2'
        }
      ])
      .returning()
      .execute();

    // Create test channels
    const channels = await db.insert(channelsTable)
      .values([
        {
          name: 'general',
          description: 'General discussion',
          is_private: false,
          created_by: users[0].id
        },
        {
          name: 'private-team1',
          description: 'Private team channel 1',
          is_private: true,
          created_by: users[0].id
        },
        {
          name: 'private-team2',
          description: 'Private team channel 2',
          is_private: true,
          created_by: users[0].id
        }
      ])
      .returning()
      .execute();

    // Add user1 as member to private-team1 only
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: channels[1].id, // private-team1
        user_id: users[0].id,
        role: 'member'
      })
      .execute();

    const input: GetChannelsInput = {
      user_id: users[0].id,
      include_private: true
    };
    
    const result = await getChannels(input);

    // Should return general (public) and private-team1 (member), but not private-team2
    expect(result).toHaveLength(2);
    
    const channelNames = result.map(c => c.name).sort();
    expect(channelNames).toEqual(['general', 'private-team1']);

    // Verify we have one public and one private channel
    const publicChannels = result.filter(c => !c.is_private);
    const privateChannels = result.filter(c => c.is_private);
    expect(publicChannels).toHaveLength(1);
    expect(privateChannels).toHaveLength(1);
    expect(publicChannels[0].name).toBe('general');
    expect(privateChannels[0].name).toBe('private-team1');
  });

  it('should return only public channels when user is not a member of any private channels', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'testuser1',
          email: 'user1@test.com',
          password_hash: 'hashed_password_1'
        },
        {
          username: 'testuser2',
          email: 'user2@test.com',
          password_hash: 'hashed_password_2'
        }
      ])
      .returning()
      .execute();

    // Create test channels
    const channels = await db.insert(channelsTable)
      .values([
        {
          name: 'general',
          description: 'General discussion',
          is_private: false,
          created_by: users[0].id
        },
        {
          name: 'private-team',
          description: 'Private team channel',
          is_private: true,
          created_by: users[0].id
        }
      ])
      .returning()
      .execute();

    // Add user1 as member to private channel, but query for user2
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: channels[1].id,
        user_id: users[0].id, // user1 is member
        role: 'member'
      })
      .execute();

    const input: GetChannelsInput = {
      user_id: users[1].id, // user2 (not a member of private channel)
      include_private: true
    };
    
    const result = await getChannels(input);

    // Should only return public channel
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('general');
    expect(result[0].is_private).toBe(false);
  });

  it('should handle case where user has multiple memberships in same private channel', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create test channel
    const channel = await db.insert(channelsTable)
      .values({
        name: 'private-team',
        description: 'Private team channel',
        is_private: true,
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Add user as both owner and member (edge case that shouldn't happen but we should handle)
    await db.insert(channelMembershipsTable)
      .values({
        channel_id: channel[0].id,
        user_id: user[0].id,
        role: 'owner'
      })
      .execute();

    const input: GetChannelsInput = {
      user_id: user[0].id,
      include_private: true
    };
    
    const result = await getChannels(input);

    // Should return the channel only once (deduplicated)
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('private-team');
    expect(result[0].is_private).toBe(true);
  });

  it('should return empty array when no channels exist', async () => {
    // Create test user but no channels
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const input: GetChannelsInput = {
      user_id: user[0].id,
      include_private: true
    };
    
    const result = await getChannels(input);

    expect(result).toHaveLength(0);
  });

  it('should handle nullable description field correctly', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@test.com',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    // Create channel with null description
    await db.insert(channelsTable)
      .values({
        name: 'general',
        description: null, // Explicitly null
        is_private: false,
        created_by: user[0].id
      })
      .execute();

    const input: GetChannelsInput = {};
    const result = await getChannels(input);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('general');
    expect(result[0].description).toBeNull();
  });
});