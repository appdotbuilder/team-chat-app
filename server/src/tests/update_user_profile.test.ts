import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserProfileInput } from '../schema';
import { updateUserProfile } from '../handlers/update_user_profile';
import { eq } from 'drizzle-orm';

// Create a test user for our tests
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      username: 'testuser',
      email: 'test@example.com',
      password_hash: 'hashed_password',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      status: 'online'
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateUserProfile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update display_name', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      display_name: 'Updated Display Name'
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.display_name).toEqual('Updated Display Name');
    expect(result.username).toEqual(testUser.username);
    expect(result.email).toEqual(testUser.email);
    expect(result.avatar_url).toEqual(testUser.avatar_url);
    expect(result.status).toEqual(testUser.status);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
  });

  it('should update avatar_url', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      avatar_url: 'https://example.com/new-avatar.png'
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.avatar_url).toEqual('https://example.com/new-avatar.png');
    expect(result.display_name).toEqual(testUser.display_name);
    expect(result.status).toEqual(testUser.status);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
  });

  it('should update status', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      status: 'away'
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.status).toEqual('away');
    expect(result.display_name).toEqual(testUser.display_name);
    expect(result.avatar_url).toEqual(testUser.avatar_url);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
  });

  it('should update multiple fields at once', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      display_name: 'New Name',
      avatar_url: 'https://example.com/new-avatar.jpg',
      status: 'busy'
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.display_name).toEqual('New Name');
    expect(result.avatar_url).toEqual('https://example.com/new-avatar.jpg');
    expect(result.status).toEqual('busy');
    expect(result.username).toEqual(testUser.username);
    expect(result.email).toEqual(testUser.email);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
  });

  it('should set display_name to null', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      display_name: null
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.display_name).toBeNull();
    expect(result.avatar_url).toEqual(testUser.avatar_url);
    expect(result.status).toEqual(testUser.status);
  });

  it('should set avatar_url to null', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      avatar_url: null
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.avatar_url).toBeNull();
    expect(result.display_name).toEqual(testUser.display_name);
    expect(result.status).toEqual(testUser.status);
  });

  it('should persist changes to database', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id,
      display_name: 'Persisted Name',
      status: 'offline'
    };

    await updateUserProfile(input);

    // Verify changes are persisted in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].display_name).toEqual('Persisted Name');
    expect(users[0].status).toEqual('offline');
    expect(users[0].avatar_url).toEqual(testUser.avatar_url); // Should remain unchanged
  });

  it('should update only updated_at when no fields are provided', async () => {
    const testUser = await createTestUser();
    
    const input: UpdateUserProfileInput = {
      id: testUser.id
    };

    const result = await updateUserProfile(input);

    expect(result.id).toEqual(testUser.id);
    expect(result.display_name).toEqual(testUser.display_name);
    expect(result.avatar_url).toEqual(testUser.avatar_url);
    expect(result.status).toEqual(testUser.status);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
  });

  it('should throw error when user does not exist', async () => {
    const input: UpdateUserProfileInput = {
      id: 99999,
      display_name: 'Non-existent User'
    };

    await expect(updateUserProfile(input)).rejects.toThrow(/User with id 99999 not found/i);
  });

  it('should handle all valid status values', async () => {
    const testUser = await createTestUser();
    
    const statuses: Array<'online' | 'away' | 'busy' | 'offline'> = ['online', 'away', 'busy', 'offline'];

    for (const status of statuses) {
      const input: UpdateUserProfileInput = {
        id: testUser.id,
        status: status
      };

      const result = await updateUserProfile(input);
      expect(result.status).toEqual(status);
    }
  });
});