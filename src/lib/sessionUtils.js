/**
 * Utility functions for managing recurring sessions
 */

export const createRecurringSessions = async (baseSession, supabase) => {
  const { repeat_type, repeat_days, repeat_end_date, session_date } = baseSession;

  if (repeat_type === 'one_time') {
    return; // No recurring sessions to create
  }

  try {
    // First, get the items and users assigned to the base session
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

    const sessionsToCreate = [];
    const baseDate = session_date ? new Date(session_date) : new Date();
    const endDate = repeat_end_date ? new Date(repeat_end_date) : null;

    // Generate sessions for the next 30 days (or until end date)
    const maxDays = endDate ? Math.ceil((endDate - baseDate) / (1000 * 60 * 60 * 24)) : 30;

    for (let i = 1; i <= maxDays; i++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + i);

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
            // If no specific days selected, repeat every week on the same day
            shouldCreate = currentDate.getDay() === baseDate.getDay();
          }
          break;

        case 'monthly':
          if (repeat_days && repeat_days.length > 0) {
            const dayOfMonth = currentDate.getDate();
            shouldCreate = repeat_days.includes(dayOfMonth.toString());
          } else {
            // If no specific days selected, repeat on the same day of month
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

        // Check if session already exists for this date
        const { data: existingSession } = await supabase
          .from('sessions')
          .select('id')
          .eq('name', sessionName)
          .eq('session_date', currentDate.toISOString().split('T')[0])
          .single();

        if (!existingSession) {
          sessionsToCreate.push({
            name: sessionName,
            type: baseSession.type,
            status: 'active', // Start as active, will be activated on the session date
            repeat_type: 'one_time', // Individual recurring sessions are one-time
            start_time: baseSession.start_time,
            end_time: baseSession.end_time,
            session_date: currentDate.toISOString().split('T')[0],
            parent_session_id: baseSession.id, // Link to base session for sync
            created_by: baseSession.created_by
          });
        }
      }
    }

    // Create the recurring sessions
    if (sessionsToCreate.length > 0) {
      const { data: createdSessions, error: insertError } = await supabase
        .from('sessions')
        .insert(sessionsToCreate)
        .select('id, session_date');

      if (insertError) throw insertError;

      console.log(`Created ${createdSessions.length} recurring sessions`);

      // Now copy items and users to each new session
      for (const newSession of createdSessions) {
        // Copy session items
        if (sessionItems.length > 0) {
          const itemsToInsert = sessionItems.map(item => ({
            session_id: newSession.id,
            item_id: item.item_id
          }));

          const { error: itemsError } = await supabase
            .from('session_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error copying session items:', itemsError);
          }
        }

        // Copy session users
        if (sessionUsers.length > 0) {
          const usersToInsert = sessionUsers.map(user => ({
            session_id: newSession.id,
            user_id: user.user_id
          }));

          const { error: usersError } = await supabase
            .from('session_users')
            .insert(usersToInsert);

          if (usersError) {
            console.error('Error copying session users:', usersError);
          }
        }
      }

      console.log(`Copied ${sessionItems.length} items and ${sessionUsers.length} users to all recurring sessions`);
    }
  } catch (error) {
    console.error('Error creating recurring sessions:', error);
  }
};

/**
 * Check if a session is currently active based on time window and date
 */
export const isSessionActive = (session) => {
  const now = new Date();
  const currentTime = now.getHours() * 100 + now.getMinutes();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check time window
  if (session.start_time && session.end_time) {
    const startTime = parseInt(session.start_time.replace(':', ''));
    const endTime = parseInt(session.end_time.replace(':', ''));

    if (currentTime < startTime || currentTime > endTime) {
      return false;
    }
  }

  // Check session date
  if (session.session_date) {
    const sessionDate = new Date(session.session_date);
    sessionDate.setHours(0, 0, 0, 0);

    if (sessionDate < today) {
      return false; // Past session
    }
  }

  return true;
};

/**
 * Sync recurring sessions with base session changes
 * Updates all future sessions with the same parent_session_id
 */
export const syncRecurringSessions = async (currentSessionId, supabase) => {
  try {
    // Get current session details
    const { data: currentSession, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', currentSessionId)
      .single();

    if (sessionError) throw sessionError;

    // Only sync if this is a recurring session (has parent_session_id)
    if (!currentSession.parent_session_id) {
      return; // Not a recurring session
    }

    // Get current items and users for this session
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

    // Find all future sessions with the same parent
    const today = new Date().toISOString().split('T')[0];
    const { data: futureSessions, error: futureError } = await supabase
      .from('sessions')
      .select('id')
      .eq('parent_session_id', currentSession.parent_session_id)
      .gte('session_date', today)
      .neq('id', currentSessionId); // Exclude current session

    if (futureError) throw futureError;

    console.log(`Found ${futureSessions.length} future sessions to sync`);

    // Update each future session
    for (const futureSession of futureSessions) {
      // Update items - first delete existing, then insert new
      if (currentItems.length > 0) {
        await supabase
          .from('session_items')
          .delete()
          .eq('session_id', futureSession.id);

        const itemsToInsert = currentItems.map(item => ({
          session_id: futureSession.id,
          item_id: item.item_id
        }));

        const { error: itemsError } = await supabase
          .from('session_items')
          .insert(itemsToInsert);

        if (itemsError) {
          console.error('Error syncing session items:', itemsError);
        }
      }

      // Update users - first delete existing, then insert new
      if (currentUsers.length > 0) {
        await supabase
          .from('session_users')
          .delete()
          .eq('session_id', futureSession.id);

        const usersToInsert = currentUsers.map(user => ({
          session_id: futureSession.id,
          user_id: user.user_id
        }));

        const { error: usersError } = await supabase
          .from('session_users')
          .insert(usersToInsert);

        if (usersError) {
          console.error('Error syncing session users:', usersError);
        }
      }
    }

    console.log(`Synced ${futureSessions.length} future sessions with current session changes`);
  } catch (error) {
    console.error('Error syncing recurring sessions:', error);
  }
};