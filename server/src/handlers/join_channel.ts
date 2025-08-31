import { db } from '../db';
import { channelsTable, channelMembershipsTable, usersTable } from '../db/schema';
import { type ChannelMembershipInput, type ChannelMembership } from '../schema';
import { eq, and } from 'drizzle-orm';

export const joinChannel = async (input: ChannelMembershipInput): Promise<ChannelMembership> => {
  try {
    // Verify the channel exists
    const channel = await db.select()
      .from(channelsTable)
      .where(eq(channelsTable.id, input.channel_id))
      .execute();

    if (channel.length === 0) {
      throw new Error(`Channel with ID ${input.channel_id} not found`);
    }

    // Verify the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // Check if user is already a member of the channel
    const existingMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, input.channel_id),
          eq(channelMembershipsTable.user_id, input.user_id)
        )
      )
      .execute();

    if (existingMembership.length > 0) {
      throw new Error('User is already a member of this channel');
    }

    // For private channels, only allow joining if explicitly allowed
    // Note: In a real implementation, you might want additional permission checks here
    // For now, we'll allow joining private channels if explicitly requested
    const channelData = channel[0];
    if (channelData.is_private) {
      // In a production system, you might check for invitations, admin approval, etc.
      // For this implementation, we'll allow it but could add more restrictions later
    }

    // Insert new channel membership
    const result = await db.insert(channelMembershipsTable)
      .values({
        channel_id: input.channel_id,
        user_id: input.user_id,
        role: input.role || 'member'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Channel join failed:', error);
    throw error;
  }
};