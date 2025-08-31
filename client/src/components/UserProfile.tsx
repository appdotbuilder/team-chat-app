import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import { toast } from 'sonner';
import type { User, UpdateUserProfileInput } from '../../../server/src/schema';

interface UserProfileProps {
  user: User;
  onClose: () => void;
  onUserUpdated: (user: User) => void;
}

export function UserProfile({ user, onClose, onUserUpdated }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [profileData, setProfileData] = useState<UpdateUserProfileInput>({
    id: user.id,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    status: user.status
  });

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updatedUser = await trpc.updateUserProfile.mutate(profileData);
      onUserUpdated(updatedUser);
      setIsEditing(false);
      toast.success('Profile updated successfully! ✨');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      status: user.status
    });
    setIsEditing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return '🟢';
      case 'away': return '🟡';
      case 'busy': return '🔴';
      default: return '⚫';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatJoinDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            👤 User Profile
          </DialogTitle>
          <DialogDescription>
            View and edit your profile information
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={profileData.avatar_url || user.avatar_url || ''} />
                <AvatarFallback className="bg-blue-600 text-white text-2xl">
                  {(profileData.display_name || user.display_name || user.username).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white ${getStatusColor(profileData.status || user.status)}`} />
            </div>

            {isEditing && (
              <div className="w-full space-y-2">
                <Label htmlFor="avatar-url">Avatar URL (Optional)</Label>
                <Input
                  id="avatar-url"
                  placeholder="https://example.com/avatar.jpg"
                  value={profileData.avatar_url || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProfileData(prev => ({ ...prev, avatar_url: e.target.value || null }))
                  }
                />
                <p className="text-xs text-gray-500">
                  Paste a link to your profile picture
                </p>
              </div>
            )}
          </div>

          {/* Profile Information */}
          <div className="space-y-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              {isEditing ? (
                <Input
                  id="display-name"
                  placeholder="How others will see you"
                  value={profileData.display_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProfileData(prev => ({ ...prev, display_name: e.target.value || null }))
                  }
                />
              ) : (
                <div className="text-lg font-semibold">
                  {user.display_name || user.username}
                </div>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label>Username</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">@{user.username}</span>
                <Badge variant="secondary" className="text-xs">
                  Cannot be changed
                </Badge>
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{user.email}</span>
                <Badge variant="secondary" className="text-xs">
                  Cannot be changed
                </Badge>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              {isEditing ? (
                <Select
                  value={profileData.status}
                  onValueChange={(value: 'online' | 'away' | 'busy' | 'offline') =>
                    setProfileData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span>{getStatusIcon(profileData.status || user.status)}</span>
                        <span className="capitalize">{profileData.status || user.status}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <span>🟢</span>
                        <span>Online</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="away">
                      <div className="flex items-center gap-2">
                        <span>🟡</span>
                        <span>Away</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="busy">
                      <div className="flex items-center gap-2">
                        <span>🔴</span>
                        <span>Busy</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <span>⚫</span>
                        <span>Offline</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{getStatusIcon(user.status)}</span>
                  <span className="capitalize text-sm">{user.status}</span>
                </div>
              )}
            </div>

            {/* Member Since */}
            <div className="space-y-2">
              <Label>Member Since</Label>
              <div className="text-sm text-gray-600">
                {formatJoinDate(user.created_at)}
              </div>
            </div>
          </div>

          {/* Additional Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Account Created:</span>
                <span>{formatJoinDate(user.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Updated:</span>
                <span>{formatJoinDate(user.updated_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">User ID:</span>
                <span className="font-mono text-xs">#{user.id}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onClose}
              >
                Close
              </Button>
              <Button
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}