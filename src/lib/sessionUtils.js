/**
 * Utility functions for managing recurring sessions
 */

export const createRecurringSessions = async (baseSession, supabase) => {
  const { repeat_type, repeat_days, repeat_end_date, session_date } = baseSession;

  console.log('[CREATE RECURRING] Starting with base session:', {
    id: baseSession.id,
    name: baseSession.name,
    repeat_type,
    session_date
  });

  if (repeat_type === 'one_time') {
    console.log('[CREATE RECURRING] One-time session, skipping recurring creation');
    return;
  }

  try {
    const [sessionItemsRes, sessionUsersRes] = await Promise.all([
      supabase
        .from('session_items')
        .select('item_id')
        .eq('session_id', baseSession.id),
      supabase
        .from('session_users')
        .select('user_id')
        .eq('session_id', baseSession.id)
    ]);

    if (sessionItemsRes.error) throw sessionItemsRes.error;
    if (sessionUsersRes.error) throw sessionUsersRes.error;

    const sessionItems = sessionItemsRes.data || [];
    const sessionUsers = sessionUsersRes.data || [];

    console.log(`[CREATE RECURRING] Base session has ${sessionItems.length} items and ${sessionUsers.length} users`);

    const sessionsToCreate = [];
    const baseDate = session_date ? new Date(session_date) : new Date();
    const endDate = repeat_end_date ? new Date(repeat_end_date) : null;
    
    baseDate.setHours(0, 0, 0, 0);

    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() + 1);

    console.log(`[CREATE RECURRING] Base date: ${baseDate.toISOString().split('T')[0]}`);
    console.log(`[CREATE RECURRING] Start date: ${startDate.toISOString().split('T')[0]}`);
    console.log(`[CREATE RECURRING] End date: ${endDate ? endDate.toISOString().split('T')[0] : 'none'}`);

    const maxDays = endDate ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1 : 30;
    console.log(`[CREATE RECURRING] Will check ${maxDays} days`);

    for (let i = 0; i < maxDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);

      if (endDate && currentDate > endDate) {
        break;
      }

      let shouldCreate = false;

      switch (repeat_type) {
        case 'daily':
          shouldCreate = true;
          break;

        case 'weekly':
          if (repeat_days && repeat_days.length > 0) {
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            shouldCreate = repeat_days.includes(dayName);
          } else {
            shouldCreate = currentDate.getDay() === baseDate.getDay();
          }
          break;

        case 'monthly':
          if (repeat_days && repeat_days.length > 0) {
            const dayOfMonth = currentDate.getDate();
            shouldCreate = repeat_days.includes(dayOfMonth.toString());
          } else {
            shouldCreate = currentDate.getDate() === baseDate.getDate();
          }
          break;
      }

      if (shouldCreate) {
        const dayName = currentDate.toLocaleDateString('id-ID', { weekday: 'long' });
        const dateFormatted = currentDate.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        const sessionName = `${baseSession.name} - ${dayName} ${dateFormatted}`;

        const { data: existingSessions } = await supabase
          .from('sessions')
          .select('id')
          .eq('session_date', currentDate.toISOString().split('T')[0])
          .eq('parent_session_id', baseSession.id)
          .limit(1);

        const existingSession = existingSessions && existingSessions.length > 0 ? existingSessions[0] : null;

        if (!existingSession) {
          sessionsToCreate.push({
            name: sessionName,
            type: baseSession.type,
            status: 'active',
            repeat_type: 'one_time',
            start_time: baseSession.start_time,
            end_time: baseSession.end_time,
            session_date: currentDate.toISOString().split('T')[0],
            parent_session_id: baseSession.id,
            created_by: baseSession.created_by
          });
          console.log(`[CREATE RECURRING] Will create session for ${currentDate.toISOString().split('T')[0]} with parent_id: ${baseSession.id}`);
        }
      }
    }

    console.log(`[CREATE RECURRING] Total sessions to create: ${sessionsToCreate.length}`);

    if (sessionsToCreate.length > 0) {
      const { data: createdSessions, error: insertError } = await supabase
        .from('sessions')
        .insert(sessionsToCreate)
        .select('id, session_date, name, parent_session_id');

      if (insertError) throw insertError;

      console.log(`[CREATE RECURRING] ✅ Created ${createdSessions.length} recurring sessions:`);
      createdSessions.forEach(s => {
        console.log(`  - ${s.name} (date: ${s.session_date}, parent_id: ${s.parent_session_id})`);
      });

      for (const newSession of createdSessions) {
        if (sessionItems.length > 0) {
          const itemsToInsert = sessionItems.map(item => ({
            session_id: newSession.id,
            item_id: item.item_id
          }));

          await supabase.from('session_items').insert(itemsToInsert);
        }

        if (sessionUsers.length > 0) {
          const usersToInsert = sessionUsers.map(user => ({
            session_id: newSession.id,
            user_id: user.user_id
          }));

          await supabase.from('session_users').insert(usersToInsert);
        }
      }

      console.log(`[CREATE RECURRING] Copied ${sessionItems.length} items and ${sessionUsers.length} users`);
    }
  } catch (error) {
    console.error('[CREATE RECURRING] ❌ Error:', error);
  }
};

export const isSessionActive = (session) => {
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (session.start_time && session.end_time) {
    const startTime = parseInt(session.start_time.replace(':', ''));
    const endTime = parseInt(session.end_time.replace(':', ''));

    if (currentTime < startTime || currentTime > endTime) {
      return false;
    }
  }

  if (session.session_date) {
    const sessionDate = new Date(session.session_date);
    sessionDate.setHours(0, 0, 0, 0);

    if (sessionDate < today) {
      return false;
    }
  }

  return true;
};

export const syncRecurringSessions = async (currentSessionId, supabase) => {
  try {
    console.log(`[SYNC] Starting sync for session ${currentSessionId}`);

    const { data: currentSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', currentSessionId)
      .single();

    if (sessionError) throw sessionError;

    console.log(`[SYNC] Current session:`, currentSession.name, currentSession.session_date);

    if (!currentSession.parent_session_id) {
      console.log('[SYNC] Not a recurring session (no parent_session_id), no sync needed');
      return;
    }

    console.log(`[SYNC] This is a recurring session, parent_id: ${currentSession.parent_session_id}`);

    const currentDateStr = currentSession.session_date;
    console.log(`[SYNC] Current session date: ${currentDateStr}`);

    const [currentItemsRes, currentUsersRes] = await Promise.all([
      supabase
        .from('session_items')
        .select('item_id')
        .eq('session_id', currentSessionId),
      supabase
        .from('session_users')
        .select('user_id')
        .eq('session_id', currentSessionId)
    ]);

    if (currentItemsRes.error) throw currentItemsRes.error;
    if (currentUsersRes.error) throw currentUsersRes.error;

    const currentItems = currentItemsRes.data || [];
    const currentUsers = currentUsersRes.data || [];

    console.log(`[SYNC] Current session has ${currentItems.length} items and ${currentUsers.length} users`);

    const { data: futureSessions, error: futureError } = await supabase
      .from('sessions')
      .select('id, session_date, name')
      .eq('parent_session_id', currentSession.parent_session_id)
      .gt('session_date', currentDateStr)
      .neq('id', currentSessionId)
      .order('session_date');

    if (futureError) throw futureError;

    if (futureSessions.length === 0) {
      console.log('[SYNC] No future sessions to sync');
      return;
    }

    console.log(`[SYNC] Found ${futureSessions.length} future sessions to sync:`);
    futureSessions.forEach(s => console.log(`  - ${s.name} (${s.session_date})`));

    for (const futureSession of futureSessions) {
      console.log(`[SYNC] Syncing session: ${futureSession.name}`);

      await supabase.from('session_items').delete().eq('session_id', futureSession.id);

      if (currentItems.length > 0) {
        const itemsToInsert = currentItems.map(item => ({
          session_id: futureSession.id,
          item_id: item.item_id
        }));
        await supabase.from('session_items').insert(itemsToInsert);
        console.log(`[SYNC] Added ${currentItems.length} items`);
      }

      await supabase.from('session_users').delete().eq('session_id', futureSession.id);

      if (currentUsers.length > 0) {
        const usersToInsert = currentUsers.map(user => ({
          session_id: futureSession.id,
          user_id: user.user_id
        }));
        await supabase.from('session_users').insert(usersToInsert);
        console.log(`[SYNC] Added ${currentUsers.length} users`);
      }
    }

    console.log(`[SYNC] ✅ Successfully synced ${futureSessions.length} future sessions`);
  } catch (error) {
    console.error('[SYNC] ❌ Error:', error);
  }
};

/**
 * Sync parent session changes to all child sessions
 * This function updates all child sessions when the parent session's items or users are modified
 */
export const syncParentToChildren = async (parentSessionId, supabase) => {
  try {
    console.log(`[SYNC PARENT] Starting sync for parent session ${parentSessionId}`);

    // Get parent session details
    const { data: parentSession, error: parentError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', parentSessionId)
      .single();

    if (parentError) throw parentError;

    console.log(`[SYNC PARENT] Parent session:`, parentSession.name, parentSession.session_date);

    // Get parent session's items and users
    const [parentItemsRes, parentUsersRes] = await Promise.all([
      supabase
        .from('session_items')
        .select('item_id')
        .eq('session_id', parentSessionId),
      supabase
        .from('session_users')
        .select('user_id')
        .eq('session_id', parentSessionId)
    ]);

    if (parentItemsRes.error) throw parentItemsRes.error;
    if (parentUsersRes.error) throw parentUsersRes.error;

    const parentItems = parentItemsRes.data || [];
    const parentUsers = parentUsersRes.data || [];

    console.log(`[SYNC PARENT] Parent session has ${parentItems.length} items and ${parentUsers.length} users`);

    // Get all child sessions (sessions with this parent_session_id)
    const { data: childSessions, error: childrenError } = await supabase
      .from('sessions')
      .select('id, session_date, name')
      .eq('parent_session_id', parentSessionId)
      .order('session_date');

    if (childrenError) throw childrenError;

    if (childSessions.length === 0) {
      console.log('[SYNC PARENT] No child sessions to sync');
      return;
    }

    console.log(`[SYNC PARENT] Found ${childSessions.length} child sessions to sync:`);
    childSessions.forEach(s => console.log(`  - ${s.name} (${s.session_date})`));

    // Update each child session with parent's items and users
    for (const childSession of childSessions) {
      console.log(`[SYNC PARENT] Syncing child session: ${childSession.name}`);

      // Update items
      await supabase.from('session_items').delete().eq('session_id', childSession.id);

      if (parentItems.length > 0) {
        const itemsToInsert = parentItems.map(item => ({
          session_id: childSession.id,
          item_id: item.item_id
        }));
        await supabase.from('session_items').insert(itemsToInsert);
        console.log(`[SYNC PARENT] Added ${parentItems.length} items to child session`);
      }

      // Update users
      await supabase.from('session_users').delete().eq('session_id', childSession.id);

      if (parentUsers.length > 0) {
        const usersToInsert = parentUsers.map(user => ({
          session_id: childSession.id,
          user_id: user.user_id
        }));
        await supabase.from('session_users').insert(usersToInsert);
        console.log(`[SYNC PARENT] Added ${parentUsers.length} users to child session`);
      }
    }

    console.log(`[SYNC PARENT] ✅ Successfully synced ${childSessions.length} child sessions`);
  } catch (error) {
    console.error('[SYNC PARENT] ❌ Error:', error);
    throw error; // Re-throw to allow caller to handle
  }
};