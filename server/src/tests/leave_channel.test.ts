import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, channelMembershipsTable } from '../db/schema';
import { type ChannelMembershipInput } from '../schema';
import { leaveChannel } from '../handlers/leave_channel';
import { eq, and } from 'drizzle-orm';

describe('leaveChannel', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should successfully remove a regular member from a channel', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hash1'
        },
        {
          username: 'member_user',
          email: 'member@test.com',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    const [ownerUser, memberUser] = users;

    // Create a channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: ownerUser.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add memberships
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: ownerUser.id,
          role: 'owner'
        },
        {
          channel_id: channel.id,
          user_id: memberUser.id,
          role: 'member'
        }
      ])
      .execute();

    const input: ChannelMembershipInput = {
      channel_id: channel.id,
      user_id: memberUser.id
    };

    // Leave the channel
    const result = await leaveChannel(input);

    // Verify the operation was successful
    expect(result).toBe(true);

    // Verify the membership was removed
    const remainingMemberships = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, memberUser.id)
        )
      )
      .execute();

    expect(remainingMemberships).toHaveLength(0);

    // Verify owner membership still exists
    const ownerMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, ownerUser.id)
        )
      )
      .execute();

    expect(ownerMembership).toHaveLength(1);
    expect(ownerMembership[0].role).toBe('owner');
  });

  it('should transfer ownership when owner leaves and promote admin', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hash1'
        },
        {
          username: 'admin_user',
          email: 'admin@test.com',
          password_hash: 'hash2'
        },
        {
          username: 'member_user',
          email: 'member@test.com',
          password_hash: 'hash3'
        }
      ])
      .returning()
      .execute();

    const [ownerUser, adminUser, memberUser] = users;

    // Create a channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: ownerUser.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add memberships
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: ownerUser.id,
          role: 'owner'
        },
        {
          channel_id: channel.id,
          user_id: adminUser.id,
          role: 'admin'
        },
        {
          channel_id: channel.id,
          user_id: memberUser.id,
          role: 'member'
        }
      ])
      .execute();

    const input: ChannelMembershipInput = {
      channel_id: channel.id,
      user_id: ownerUser.id
    };

    // Owner leaves the channel
    const result = await leaveChannel(input);

    // Verify the operation was successful
    expect(result).toBe(true);

    // Verify the owner membership was removed
    const ownerMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, ownerUser.id)
        )
      )
      .execute();

    expect(ownerMembership).toHaveLength(0);

    // Verify admin was promoted to owner
    const adminMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, adminUser.id)
        )
      )
      .execute();

    expect(adminMembership).toHaveLength(1);
    expect(adminMembership[0].role).toBe('owner');

    // Verify member remains unchanged
    const memberMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, memberUser.id)
        )
      )
      .execute();

    expect(memberMembership).toHaveLength(1);
    expect(memberMembership[0].role).toBe('member');
  });

  it('should transfer ownership to oldest member when owner leaves and no admins exist', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hash1'
        },
        {
          username: 'member_user1',
          email: 'member1@test.com',
          password_hash: 'hash2'
        },
        {
          username: 'member_user2',
          email: 'member2@test.com',
          password_hash: 'hash3'
        }
      ])
      .returning()
      .execute();

    const [ownerUser, memberUser1, memberUser2] = users;

    // Create a channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: ownerUser.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add memberships (no admins, just members)
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: ownerUser.id,
          role: 'owner'
        },
        {
          channel_id: channel.id,
          user_id: memberUser1.id,
          role: 'member'
        },
        {
          channel_id: channel.id,
          user_id: memberUser2.id,
          role: 'member'
        }
      ])
      .execute();

    const input: ChannelMembershipInput = {
      channel_id: channel.id,
      user_id: ownerUser.id
    };

    // Owner leaves the channel
    const result = await leaveChannel(input);

    // Verify the operation was successful
    expect(result).toBe(true);

    // Verify the owner membership was removed
    const ownerMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, channel.id),
          eq(channelMembershipsTable.user_id, ownerUser.id)
        )
      )
      .execute();

    expect(ownerMembership).toHaveLength(0);

    // Verify one of the members was promoted to owner
    const allMemberships = await db.select()
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.channel_id, channel.id))
      .execute();

    expect(allMemberships).toHaveLength(2);

    const newOwners = allMemberships.filter(m => m.role === 'owner');
    expect(newOwners).toHaveLength(1);

    // Verify the new owner is one of the original members
    const newOwnerId = newOwners[0].user_id;
    expect([memberUser1.id, memberUser2.id]).toContain(newOwnerId);
  });

  it('should delete channel when last member (who is owner) leaves', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hash1'
        }
      ])
      .returning()
      .execute();

    const ownerUser = users[0];

    // Create a channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: ownerUser.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add only owner membership
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: ownerUser.id,
          role: 'owner'
        }
      ])
      .execute();

    const input: ChannelMembershipInput = {
      channel_id: channel.id,
      user_id: ownerUser.id
    };

    // Owner leaves the channel (should delete the channel)
    const result = await leaveChannel(input);

    // Verify the operation was successful
    expect(result).toBe(true);

    // Verify the channel was deleted
    const remainingChannels = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channel.id))
      .execute();

    expect(remainingChannels).toHaveLength(0);

    // Verify no memberships remain (cascade delete)
    const remainingMemberships = await db.select()
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.channel_id, channel.id))
      .execute();

    expect(remainingMemberships).toHaveLength(0);
  });

  it('should throw error when user is not a member of the channel', async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'owner_user',
          email: 'owner@test.com',
          password_hash: 'hash1'
        },
        {
          username: 'non_member_user',
          email: 'nonmember@test.com',
          password_hash: 'hash2'
        }
      ])
      .returning()
      .execute();

    const [ownerUser, nonMemberUser] = users;

    // Create a channel
    const channels = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: ownerUser.id
      })
      .returning()
      .execute();

    const channel = channels[0];

    // Add only owner membership (nonMemberUser is NOT a member)
    await db.insert(channelMembershipsTable)
      .values([
        {
          channel_id: channel.id,
          user_id: ownerUser.id,
          role: 'owner'
        }
      ])
      .execute();

    const input: ChannelMembershipInput = {
      channel_id: channel.id,
      user_id: nonMemberUser.id
    };

    // Attempt to leave channel as non-member should fail
    await expect(leaveChannel(input)).rejects.toThrow(/not a member/i);

    // Verify channel and membership remain unchanged
    const remainingChannels = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, channel.id))
      .execute();

    expect(remainingChannels).toHaveLength(1);

    const remainingMemberships = await db.select()
      .from(channelMembershipsTable)
      .where(eq(channelMembershipsTable.channel_id, channel.id))
      .execute();

    expect(remainingMemberships).toHaveLength(1);
    expect(remainingMemberships[0].user_id).toBe(ownerUser.id);
  });

  it('should handle non-existent channel gracefully', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values([
        {
          username: 'test_user',
          email: 'test@test.com',
          password_hash: 'hash1'
        }
      ])
      .returning()
      .execute();

    const testUser = users[0];

    const input: ChannelMembershipInput = {
      channel_id: 999999, // Non-existent channel ID
      user_id: testUser.id
    };

    // Attempt to leave non-existent channel should fail
    await expect(leaveChannel(input)).rejects.toThrow(/not a member/i);
  });
});