import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, channelsTable, channelMembershipsTable } from '../db/schema';
import { type ChannelMembershipInput } from '../schema';
import { joinChannel } from '../handlers/join_channel';
import { eq, and } from 'drizzle-orm';

describe('joinChannel', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser: any;
  let testChannel: any;
  let privateChannel: any;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword123'
      })
      .returning()
      .execute();
    testUser = userResult[0];

    // Create test channel (public)
    const channelResult = await db.insert(channelsTable)
      .values({
        name: 'test-channel',
        description: 'A test channel',
        is_private: false,
        created_by: testUser.id
      })
      .returning()
      .execute();
    testChannel = channelResult[0];

    // Create private channel
    const privateChannelResult = await db.insert(channelsTable)
      .values({
        name: 'private-channel',
        description: 'A private test channel',
        is_private: true,
        created_by: testUser.id
      })
      .returning()
      .execute();
    privateChannel = privateChannelResult[0];
  });

  it('should successfully join a public channel', async () => {
    // Create another user to join the channel
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'anotheruser',
        email: 'another@example.com',
        password_hash: 'hashedpassword456'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: anotherUser.id,
      role: 'member'
    };

    const result = await joinChannel(input);

    // Verify the result
    expect(result.channel_id).toEqual(testChannel.id);
    expect(result.user_id).toEqual(anotherUser.id);
    expect(result.role).toEqual('member');
    expect(result.id).toBeDefined();
    expect(result.joined_at).toBeInstanceOf(Date);
  });

  it('should use default role when not specified', async () => {
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'anotheruser',
        email: 'another@example.com',
        password_hash: 'hashedpassword456'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: anotherUser.id
      // role not specified - should default to 'member'
    };

    const result = await joinChannel(input);

    expect(result.role).toEqual('member');
  });

  it('should allow joining with admin role', async () => {
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'adminuser',
        email: 'admin@example.com',
        password_hash: 'hashedpassword789'
      })
      .returning()
      .execute();
    const adminUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: adminUser.id,
      role: 'admin'
    };

    const result = await joinChannel(input);

    expect(result.role).toEqual('admin');
  });

  it('should save membership to database', async () => {
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'anotheruser',
        email: 'another@example.com',
        password_hash: 'hashedpassword456'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: anotherUser.id,
      role: 'member'
    };

    const result = await joinChannel(input);

    // Verify the membership was saved to database
    const memberships = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, testChannel.id),
          eq(channelMembershipsTable.user_id, anotherUser.id)
        )
      )
      .execute();

    expect(memberships).toHaveLength(1);
    expect(memberships[0].id).toEqual(result.id);
    expect(memberships[0].role).toEqual('member');
    expect(memberships[0].joined_at).toBeInstanceOf(Date);
  });

  it('should allow joining private channels', async () => {
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'privateuser',
        email: 'private@example.com',
        password_hash: 'hashedpassword999'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: privateChannel.id,
      user_id: anotherUser.id,
      role: 'member'
    };

    const result = await joinChannel(input);

    expect(result.channel_id).toEqual(privateChannel.id);
    expect(result.user_id).toEqual(anotherUser.id);
    expect(result.role).toEqual('member');
  });

  it('should throw error when channel does not exist', async () => {
    const input: ChannelMembershipInput = {
      channel_id: 99999, // Non-existent channel ID
      user_id: testUser.id,
      role: 'member'
    };

    expect(joinChannel(input)).rejects.toThrow(/channel with id 99999 not found/i);
  });

  it('should throw error when user does not exist', async () => {
    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: 99999, // Non-existent user ID
      role: 'member'
    };

    expect(joinChannel(input)).rejects.toThrow(/user with id 99999 not found/i);
  });

  it('should throw error when user is already a member', async () => {
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'duplicateuser',
        email: 'duplicate@example.com',
        password_hash: 'hashedpassword111'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: anotherUser.id,
      role: 'member'
    };

    // First join should succeed
    await joinChannel(input);

    // Second join should fail
    expect(joinChannel(input)).rejects.toThrow(/user is already a member of this channel/i);
  });

  it('should handle channel creator joining their own channel', async () => {
    // Channel creator should be able to join their own channel
    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: testUser.id, // Creator trying to join their own channel
      role: 'owner'
    };

    const result = await joinChannel(input);

    expect(result.channel_id).toEqual(testChannel.id);
    expect(result.user_id).toEqual(testUser.id);
    expect(result.role).toEqual('owner');
  });

  it('should validate foreign key constraints', async () => {
    // Verify that the membership links to valid channel and user
    const anotherUserResult = await db.insert(usersTable)
      .values({
        username: 'linkuser',
        email: 'link@example.com',
        password_hash: 'hashedpassword222'
      })
      .returning()
      .execute();
    const anotherUser = anotherUserResult[0];

    const input: ChannelMembershipInput = {
      channel_id: testChannel.id,
      user_id: anotherUser.id,
      role: 'member'
    };

    const result = await joinChannel(input);

    // Verify the foreign keys work by querying with joins
    const membershipWithDetails = await db.select({
      membershipId: channelMembershipsTable.id,
      channelName: channelsTable.name,
      userName: usersTable.username
    })
      .from(channelMembershipsTable)
      .innerJoin(channelsTable, eq(channelMembershipsTable.channel_id, channelsTable.id))
      .innerJoin(usersTable, eq(channelMembershipsTable.user_id, usersTable.id))
      .where(eq(channelMembershipsTable.id, result.id))
      .execute();

    expect(membershipWithDetails).toHaveLength(1);
    expect(membershipWithDetails[0].channelName).toEqual('test-channel');
    expect(membershipWithDetails[0].userName).toEqual('linkuser');
  });
});