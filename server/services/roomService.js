const { supabaseAdmin: supabase, isSupabaseAdminConfigured } = require('../config/supabase');

const skippedWarnings = new Set();

function skipped(action) {
  if (!skippedWarnings.has(action)) {
    skippedWarnings.add(action);
    console.warn(`[supabase] ${action} skipped: SUPABASE_SERVICE_ROLE_KEY is not configured for server-side persistence.`);
  }
  return { data: null, error: null, skipped: true };
}

function logError(action, error) {
  if (error) console.warn(`[supabase] ${action} skipped/failed:`, error.message || error);
}

async function run(action, queryBuilder) {
  if (!isSupabaseAdminConfigured) return skipped(action);

  try {
    const result = await queryBuilder();
    if (result.error) logError(action, result.error);
    return result;
  } catch (error) {
    logError(action, error);
    return { data: null, error };
  }
}

function memberConflictTarget(userId) {
  return userId ? 'room_id,user_id' : 'room_id,socket_id';
}

async function getRoom(roomId) {
  return run('getRoom', () =>
    supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .eq('is_active', true)
      .maybeSingle()
  );
}

async function upsertRoom({ roomId, ownerId = null, ownerSocketId = null, language = 'javascript', code = '' }) {
  return run('upsertRoom', () =>
    supabase
      .from('rooms')
      .upsert({
        id: roomId,
        owner_id: ownerId,
        owner_socket_id: ownerSocketId,
        language,
        code,
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'id' })
      .select()
      .single()
  );
}

async function updateRoomCode(roomId, code, language) {
  return run('updateRoomCode', () =>
    supabase
      .from('rooms')
      .update({ code, language })
      .eq('id', roomId)
  );
}

async function updateRoomLanguage(roomId, language, code) {
  return updateRoomCode(roomId, code, language);
}

async function closeRoom(roomId) {
  return run('closeRoom', () =>
    supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('id', roomId)
  );
}

async function joinRoomMember({ roomId, userId = null, socketId, username, role = 'member', isPaused = false }) {
  return run('joinRoomMember', () =>
    supabase
      .from('room_members')
      .upsert({
        room_id: roomId,
        user_id: userId,
        socket_id: socketId,
        username,
        role,
        is_active: true,
        is_paused: isPaused,
        joined_at: new Date().toISOString(),
        left_at: null
      }, { onConflict: memberConflictTarget(userId) })
  );
}

async function leaveRoomMember({ roomId, userId = null, socketId }) {
  if (!isSupabaseAdminConfigured) return skipped('leaveRoomMember');

  const query = supabase
    .from('room_members')
    .update({ is_active: false, left_at: new Date().toISOString() })
    .eq('room_id', roomId);

  return run('leaveRoomMember', () =>
    userId ? query.eq('user_id', userId) : query.eq('socket_id', socketId)
  );
}

async function updateMemberPaused(roomId, username, isPaused) {
  return run('updateMemberPaused', () =>
    supabase
      .from('room_members')
      .update({ is_paused: isPaused })
      .eq('room_id', roomId)
      .eq('username', username)
      .eq('is_active', true)
  );
}

async function transferOwnership({ roomId, newOwnerUserId = null, newOwnerSocketId, previousOwnerUserId = null, previousOwnerSocketId }) {
  if (!isSupabaseAdminConfigured) return skipped('transferOwnership');

  const ownerPayload = newOwnerUserId
    ? { owner_id: newOwnerUserId, owner_socket_id: newOwnerSocketId || null }
    : { owner_id: null, owner_socket_id: newOwnerSocketId || null };

  const updateRoom = await run('transferOwnership.room', () =>
    supabase.from('rooms').update(ownerPayload).eq('id', roomId)
  );

  const previousQuery = supabase
    .from('room_members')
    .update({ role: 'member' })
    .eq('room_id', roomId);

  await run('transferOwnership.previousMember', () =>
    previousOwnerUserId
      ? previousQuery.eq('user_id', previousOwnerUserId)
      : previousQuery.eq('socket_id', previousOwnerSocketId)
  );

  const newOwnerQuery = supabase
    .from('room_members')
    .update({ role: 'owner' })
    .eq('room_id', roomId);

  const updateNewOwner = await run('transferOwnership.newOwnerMember', () =>
    newOwnerUserId
      ? newOwnerQuery.eq('user_id', newOwnerUserId)
      : newOwnerQuery.eq('socket_id', newOwnerSocketId)
  );

  return { updateRoom, updateNewOwner };
}

async function saveChatMessage({ roomId, userId = null, socketId, username, message }) {
  return run('saveChatMessage', () =>
    supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        socket_id: socketId,
        username,
        message
      })
  );
}

async function saveSnapshot({ roomId, userId = null, socketId, code, language, label = null }) {
  return run('saveSnapshot', () =>
    supabase
      .from('code_snapshots')
      .insert({
        room_id: roomId,
        user_id: userId,
        socket_id: socketId,
        code,
        language,
        label
      })
  );
}

async function setCurrentProblem(roomId, problemId, code, language) {
  return run('setCurrentProblem', () =>
    supabase
      .from('rooms')
      .update({ current_problem_id: problemId, code, language })
      .eq('id', roomId)
  );
}

async function markProblemSolved({ roomId, userId = null, socketId, username, problemId }) {
  const payload = {
    room_id: roomId,
    user_id: userId,
    socket_id: socketId,
    username,
    problem_id: String(problemId)
  };

  return run('markProblemSolved', () =>
    supabase
      .from('solved_problems')
      .upsert(payload, {
        onConflict: userId ? 'user_id,problem_id' : 'socket_id,problem_id'
      })
  );
}

module.exports = {
  getRoom,
  upsertRoom,
  updateRoomCode,
  updateRoomLanguage,
  closeRoom,
  joinRoomMember,
  leaveRoomMember,
  updateMemberPaused,
  transferOwnership,
  saveChatMessage,
  saveSnapshot,
  setCurrentProblem,
  markProblemSolved,
  isSupabaseConfigured: isSupabaseAdminConfigured
};