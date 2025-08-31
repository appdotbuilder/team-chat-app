import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getOnlineUsers } from '../handlers/get_online_users';

// Test users data
const testUsers = [
  {
    username: 'online_user1',
    email: 'online1@example.com',
    password_hash: 'hashed_password_1',
    display_name: 'Online User 1',
    avatar_url: 'https://example.com/avatar1.jpg',
    status: 'online' as const
  },
  {
    username: 'online_user2',
    email: 'online2@example.com',
    password_hash: 'hashed_password_2',
    display_name: 'Online User 2',
    avatar_url: null,
    status: 'online' as const
  },
  {
    username: 'offline_user',
    email: 'offline@example.com',
    password_hash: 'hashed_password_3',
    display_name: 'Offline User',
    avatar_url: null,
    status: 'offline' as const
  },
  {
    username: 'away_user',
    email: 'away@example.com',
    password_hash: 'hashed_password_4',
    display_name: 'Away User',
    avatar_url: null,
    status: 'away' as const
  },
  {
    username: 'busy_user',
    email: 'busy@example.com',
    password_hash: 'hashed_password_5',
    display_name: 'Busy User',
    avatar_url: null,
    status: 'busy' as const
  }
];

describe('getOnlineUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only users with online status', async () => {
    // Insert test users
    await db.insert(usersTable).values(testUsers).execute();

    const result = await getOnlineUsers();

    // Should return only the 2 online users
    expect(result).toHaveLength(2);
    
    // Verify all returned users have online status
    result.forEach(user => {
      expect(user.status).toBe('online');
    });

    // Verify specific users are returned
    const usernames = result.map(user => user.username).sort();
    expect(usernames).toEqual(['online_user1', 'online_user2']);
  });

  it('should return empty array when no users are online', async () => {
    // Insert only non-online users
    const nonOnlineUsers = testUsers.filter(user => user.status !== 'online');
    await db.insert(usersTable).values(nonOnlineUsers).execute();

    const result = await getOnlineUsers();

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should return all user fields correctly', async () => {
    // Insert one online user
    const onlineUser = testUsers[0];
    await db.insert(usersTable).values([onlineUser]).execute();

    const result = await getOnlineUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    // Verify all fields are present and correct
    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe('number');
    expect(user.username).toBe(onlineUser.username);
    expect(user.email).toBe(onlineUser.email);
    expect(user.password_hash).toBe(onlineUser.password_hash);
    expect(user.display_name).toBe(onlineUser.display_name);
    expect(user.avatar_url).toBe(onlineUser.avatar_url);
    expect(user.status).toBe('online');
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });

  it('should handle users with null display_name and avatar_url', async () => {
    // Insert online user with null fields
    const userWithNulls = {
      username: 'user_nulls',
      email: 'nulls@example.com',
      password_hash: 'hashed_password',
      display_name: null,
      avatar_url: null,
      status: 'online' as const
    };

    await db.insert(usersTable).values([userWithNulls]).execute();

    const result = await getOnlineUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    expect(user.display_name).toBeNull();
    expect(user.avatar_url).toBeNull();
    expect(user.status).toBe('online');
  });

  it('should return users ordered by their insertion order', async () => {
    // Insert multiple online users
    const onlineUsers = testUsers.filter(user => user.status === 'online');
    await db.insert(usersTable).values(onlineUsers).execute();

    const result = await getOnlineUsers();

    expect(result).toHaveLength(2);
    
    // Verify the order matches insertion order (first inserted has lower ID)
    expect(result[0].id).toBeLessThan(result[1].id);
    expect(result[0].username).toBe('online_user1');
    expect(result[1].username).toBe('online_user2');
  });

  it('should work with mixed user statuses', async () => {
    // Insert all test users with different statuses
    await db.insert(usersTable).values(testUsers).execute();

    const result = await getOnlineUsers();

    // Should only return online users, not offline/away/busy
    expect(result).toHaveLength(2);
    
    result.forEach(user => {
      expect(user.status).toBe('online');
      expect(['online_user1', 'online_user2']).toContain(user.username);
    });
  });
});