import { db } from '../db';
import { channelMembershipsTable, channelsTable } from '../db/schema';
import { type ChannelMembershipInput } from '../schema';
import { eq, and } from 'drizzle-orm';

export const leaveChannel = async (input: ChannelMembershipInput): Promise<boolean> => {
  try {
    // First, verify the user is actually a member of the channel
    const existingMembership = await db.select()
      .from(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, input.channel_id),
          eq(channelMembershipsTable.user_id, input.user_id)
        )
      )
      .execute();

    if (existingMembership.length === 0) {
      throw new Error('User is not a member of this channel');
    }

    const membership = existingMembership[0];

    // If the user is the owner, we need to handle ownership transfer
    if (membership.role === 'owner') {
      // Find all other members in the channel (excluding the owner who is leaving)
      const otherMembers = await db.select()
        .from(channelMembershipsTable)
        .where(eq(channelMembershipsTable.channel_id, input.channel_id))
        .execute();

      // Filter out the current user (owner who is leaving)
      const remainingMembers = otherMembers.filter(m => m.user_id !== input.user_id);

      // If there are other members, find the best candidate for ownership
      if (remainingMembers.length > 0) {
        // Find an admin first, if not available, pick the oldest member
        const adminMembers = remainingMembers.filter(m => m.role === 'admin');
        
        let newOwner = adminMembers.length > 0 
          ? adminMembers[0]
          : remainingMembers[0];

        // Transfer ownership to the selected member
        await db.update(channelMembershipsTable)
          .set({ role: 'owner' })
          .where(eq(channelMembershipsTable.id, newOwner.id))
          .execute();
      } else {
        // If this is the last member and they're the owner, delete the channel
        await db.delete(channelsTable)
          .where(eq(channelsTable.id, input.channel_id))
          .execute();
        
        return true; // Channel deleted, so membership is automatically removed
      }
    }

    // Remove the user's membership
    await db.delete(channelMembershipsTable)
      .where(
        and(
          eq(channelMembershipsTable.channel_id, input.channel_id),
          eq(channelMembershipsTable.user_id, input.user_id)
        )
      )
      .execute();

    return true;
  } catch (error) {
    console.error('Leave channel failed:', error);
    throw error;
  }
};