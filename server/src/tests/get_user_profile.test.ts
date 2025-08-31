import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { getUserProfile } from '../handlers/get_user_profile';
// Test user data
const testUserData: RegisterUserInput & { password_hash: string } = {
  username: 'testuser123',
  email: 'test@example.com',
  password: 'password123',
  password_hash: 'hashed_password123',
  display_name: 'Test User'
};

const testUserData2: RegisterUserInput & { password_hash: string } = {
  username: 'anotheruser',
  email: 'another@example.com',
  password: 'password456',
  password_hash: 'hashed_password456',
  display_name: null
};

describe('getUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user profile when user exists', async () => {
    // Create a test user first
    const insertResult = await db.insert(usersTable)
      .values({
        username: testUserData.username,
        email: testUserData.email,
        password_hash: testUserData.password_hash,
        display_name: testUserData.display_name,
        status: 'online'
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Test fetching the user profile
    const result = await getUserProfile(createdUser.id);

    // Verify all fields are correct
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdUser.id);
    expect(result!.username).toBe('testuser123');
    expect(result!.email).toBe('test@example.com');
    expect(result!.password_hash).toBe(testUserData.password_hash);
    expect(result!.display_name).toBe('Test User');
    expect(result!.status).toBe('online');
    expect(result!.avatar_url).toBeNull();
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return user with null display_name when not provided', async () => {
    // Create a user without display_name
    const insertResult = await db.insert(usersTable)
      .values({
        username: testUserData2.username,
        email: testUserData2.email,
        password_hash: testUserData2.password_hash,
        display_name: null,
        status: 'away'
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];

    // Test fetching the user profile
    const result = await getUserProfile(createdUser.id);

    // Verify nullable fields are handled correctly
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdUser.id);
    expect(result!.username).toBe('anotheruser');
    expect(result!.display_name).toBeNull();
    expect(result!.avatar_url).toBeNull();
    expect(result!.status).toBe('away');
  });

  it('should return null when user does not exist', async () => {
    const result = await getUserProfile(99999);
    
    expect(result).toBeNull();
  });

  it('should return null for invalid user IDs', async () => {
    const result1 = await getUserProfile(0);
    const result2 = await getUserProfile(-1);
    const result3 = await getUserProfile(-99);

    expect(result1).toBeNull();
    expect(result2).toBeNull();
    expect(result3).toBeNull();
  });

  it('should handle different user statuses correctly', async () => {
    // Test different user statuses
    const statuses = ['online', 'away', 'busy', 'offline'] as const;
    
    for (const status of statuses) {
      const insertResult = await db.insert(usersTable)
        .values({
          username: `user_${status}`,
          email: `${status}@example.com`,
          password_hash: 'hashed_password_status',
          display_name: `User ${status}`,
          status: status
        })
        .returning()
        .execute();

      const createdUser = insertResult[0];
      const result = await getUserProfile(createdUser.id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(status);
      expect(result!.username).toBe(`user_${status}`);
    }
  });

  it('should return user with avatar_url when provided', async () => {
    const insertResult = await db.insert(usersTable)
      .values({
        username: 'userWithAvatar',
        email: 'avatar@example.com',
        password_hash: 'hashed_password_status',
        display_name: 'Avatar User',
        avatar_url: 'https://example.com/avatar.jpg',
        status: 'online'
      })
      .returning()
      .execute();

    const createdUser = insertResult[0];
    const result = await getUserProfile(createdUser.id);

    expect(result).not.toBeNull();
    expect(result!.avatar_url).toBe('https://example.com/avatar.jpg');
    expect(result!.username).toBe('userWithAvatar');
  });
});