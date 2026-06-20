/**
 * backend/services/roomService.js
 *
 * Room persistence logic using Supabase.
 * Called from Express routes and Socket.io handlers.
 */

import supabase from '../config/supabase.js';

/**
 * Create a new room in the database.
 * @param {string} roomId - The 8-char room code
 * @param {string} ownerId - Supabase user ID of the creator
 * @param {string} language - Initial language
 * @returns {Promise<{data, error}>}
 */
export async function createRoom(roomId, ownerId, language = 'javascript') {
  return supabase.from('rooms').insert({
    id: roomId,
    owner_id: ownerId,
    language,
    code: '',
    is_active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select().single();
}

/**
 * Get room by ID.
 */
export async function getRoom(roomId) {
  return supabase.from('rooms').select('*').eq('id', roomId).single();
}

/**
 * Update room code and language.
 */
export async function updateRoomCode(roomId, code, language) {
  return supabase.from('rooms')
    .update({ code, language, updated_at: new Date().toISOString() })
    .eq('id', roomId);
}

/**
 * Mark a room as inactive (closed).
 */
export async function closeRoom(roomId) {
  return supabase.from('rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', roomId);
}

/**
 * Add a user to a room.
 */
export async function joinRoom(roomId, userId, username, isOwner = false) {
  return supabase.from('room_members').upsert({
    room_id: roomId,
    user_id: userId,
    username,
    role: isOwner ? 'owner' : 'member',
    is_active: true,
    joined_at: new Date().toISOString(),
    left_at: null,
  }, { onConflict: 'room_id,user_id' });
}

/**
 * Mark a user as left from a room.
 */
export async function leaveRoom(roomId, userId) {
  return supabase.from('room_members')
    .update({ is_active: false, left_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('user_id', userId);
}

/**
 * Get active members of a room.
 */
export async function getRoomMembers(roomId) {
  return supabase.from('room_members')
    .select('user_id, username, role, is_paused, joined_at')
    .eq('room_id', roomId)
    .eq('is_active', true);
}

/**
 * Transfer room ownership.
 */
export async function transferOwnership(roomId, newOwnerId) {
  const [updateRoom, updateNewOwner] = await Promise.all([
    supabase.from('rooms').update({ owner_id: newOwnerId }).eq('id', roomId),
    supabase.from('room_members').update({ role: 'owner' })
      .eq('room_id', roomId).eq('user_id', newOwnerId),
  ]);
  return { updateRoom, updateNewOwner };
}
