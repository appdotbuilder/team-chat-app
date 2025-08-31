import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import { toast } from 'sonner';
import type { User, Channel, DirectMessageConversation, Message, CreateMessageInput } from '../../../server/src/schema';

interface ChatInterfaceProps {
  user: User;
  selectedChannel: Channel | null;
  selectedDMConversation: DirectMessageConversation | null;
  onlineUsers: User[];
}

export function ChatInterface({ user, selectedChannel, selectedDMConversation, onlineUsers }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);



  // Get chat title
  const getChatTitle = () => {
    if (selectedChannel) {
      return `${selectedChannel.is_private ? '🔒' : '#'} ${selectedChannel.name}`;
    }
    if (selectedDMConversation) {
      const otherUserId = selectedDMConversation.user1_id === user.id ? 
        selectedDMConversation.user2_id : selectedDMConversation.user1_id;
      const otherUser = onlineUsers.find(u => u.id === otherUserId);
      return otherUser ? `💬 ${otherUser.display_name || otherUser.username}` : 'Direct Message';
    }
    return '';
  };

  // Get chat description
  const getChatDescription = () => {
    if (selectedChannel?.description) {
      return selectedChannel.description;
    }
    if (selectedDMConversation) {
      const otherUserId = selectedDMConversation.user1_id === user.id ? 
        selectedDMConversation.user2_id : selectedDMConversation.user1_id;
      const otherUser = onlineUsers.find(u => u.id === otherUserId);
      return otherUser ? `Direct conversation with ${otherUser.display_name || otherUser.username}` : '';
    }
    return '';
  };

  // Load messages for current chat
  const loadMessages = useCallback(async () => {
    if (!selectedChannel && !selectedDMConversation) return;
    
    setIsLoadingMessages(true);
    try {
      const result = await trpc.getMessages.query({
        channel_id: selectedChannel?.id || null,
        direct_message_recipient_id: selectedDMConversation ? 
          (selectedDMConversation.user1_id === user.id ? selectedDMConversation.user2_id : selectedDMConversation.user1_id) : null,
        limit: 50
      });
      setMessages(result);
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedChannel, selectedDMConversation, user.id]);

  // Load messages when chat changes
  useEffect(() => {
    loadMessages();
    setSearchQuery('');
    setSearchResults([]);
  }, [loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  };

  // Handle message input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageInput(value);
    adjustTextareaHeight(e.target);
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const content = messageInput.trim();
    if (!content || isSending) return;

    setIsSending(true);
    try {
      const messageData: CreateMessageInput = {
        content,
        message_type: 'text',
        channel_id: selectedChannel?.id || null,
        direct_message_recipient_id: selectedDMConversation ? 
          (selectedDMConversation.user1_id === user.id ? selectedDMConversation.user2_id : selectedDMConversation.user1_id) : null,
        reply_to_message_id: replyToMessage?.id || null
      };

      const result = await trpc.createMessage.mutate({
        ...messageData,
        senderId: user.id
      });

      setMessages(prev => [...prev, result]);
      setMessageInput('');
      setReplyToMessage(null);
      
      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Handle key press in textarea
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Start editing message
  const startEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  // Save edited message
  const saveEdit = async (messageId: number) => {
    if (!editContent.trim()) return;
    
    try {
      await trpc.updateMessage.mutate({
        id: messageId,
        content: editContent.trim()
      });

      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: editContent.trim(), edited_at: new Date() }
          : msg
      ));
      
      cancelEditing();
      toast.success('Message updated');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update message';
      toast.error(errorMessage);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: number) => {
    try {
      await trpc.deleteMessage.mutate({
        messageId,
        userId: user.id
      });

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      toast.success('Message deleted');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
      toast.error(errorMessage);
    }
  };

  // Search messages
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await trpc.searchMessages.query({
        query: searchQuery,
        userId: user.id,
        channelId: selectedChannel?.id
      });
      setSearchResults(result);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Get user info for message
  const getMessageUser = (senderId: number) => {
    return onlineUsers.find(u => u.id === senderId);
  };

  // Format message timestamp
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return messageDate.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const displayMessages = searchResults.length > 0 ? searchResults : messages;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{getChatTitle()}</h1>
            {getChatDescription() && (
              <p className="text-sm text-gray-500 mt-1">{getChatDescription()}</p>
            )}
          </div>
          
          {/* Search */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              onKeyPress={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
              className="w-64"
            />
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              size="sm"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
            {searchResults.length > 0 && (
              <Button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2">
            <Badge variant="secondary">
              Found {searchResults.length} message{searchResults.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-6">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-gray-500">Loading messages...</div>
          </div>
        ) : displayMessages.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="text-4xl mb-2">💭</div>
              <div className="text-gray-500">
                {searchQuery ? 'No messages found' : 'No messages yet. Start the conversation!'}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {displayMessages.map((message: Message, index: number) => {
              const messageUser = getMessageUser(message.sender_id);
              const isOwnMessage = message.sender_id === user.id;
              const showAvatar = index === 0 || displayMessages[index - 1].sender_id !== message.sender_id;
              
              return (
                <div key={message.id} className={`group flex gap-3 ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {showAvatar ? (
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={messageUser?.avatar_url || ''} />
                          <AvatarFallback className="bg-blue-600">
                            {(messageUser?.display_name || messageUser?.username || 'U').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {messageUser && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(messageUser.status)}`} />
                        )}
                      </div>
                    ) : (
                      <div className="w-10" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    {showAvatar && (
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-gray-900">
                          {messageUser?.display_name || messageUser?.username || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(message.created_at)}
                        </span>
                        {message.edited_at && (
                          <span className="text-xs text-gray-400">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Reply indicator */}
                    {message.reply_to_message_id && (
                      <div className="mb-2 p-2 bg-gray-50 border-l-4 border-gray-300 rounded text-sm">
                        <div className="text-gray-600">Replying to a message...</div>
                      </div>
                    )}

                    {/* Message text */}
                    {editingMessageId === message.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                          className="min-h-[60px]"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => saveEdit(message.id)}>
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditing}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-900 whitespace-pre-wrap break-words m-0">
                          {message.content}
                        </p>
                      </div>
                    )}

                    {/* Message actions */}
                    {isOwnMessage && editingMessageId !== message.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setReplyToMessage(message)}
                          >
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => startEditing(message)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                            onClick={() => {
                              setMessageToDelete(message.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Reply indicator */}
      {replyToMessage && (
        <div className="px-6 py-2 bg-gray-50 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Replying to {getMessageUser(replyToMessage.sender_id)?.display_name || 'message'}
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setReplyToMessage(null)}
            >
              ✕
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
          <div className="flex-1">
            <Textarea
              ref={inputRef}
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={`Message ${getChatTitle().replace(/^[#💬🔒]\s*/u, '')}...`}
              className="min-h-[44px] max-h-[120px] resize-none"
              disabled={isSending}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!messageInput.trim() || isSending}
            className="mb-1"
          >
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => messageToDelete && deleteMessage(messageToDelete)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}