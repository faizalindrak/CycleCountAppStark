/**
 * Utility functions for managing recurring sessions
 */

export const createRecurringSessions = async (baseSession, supabase) => {
  const { repeat_type, repeat_days, repeat_end_date, session_date } = baseSession;

  if (repeat_type === 'one_time') {
    return; // No recurring sessions to create
  }

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
          const dayName = currentDate.toLocaleLowerCase('en-US', { weekday: 'long' });
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
      const sessionName = `${baseSession.name} - ${currentDate.toLocaleDateString()}`;

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
          status: 'active',
          repeat_type: 'one_time', // Individual recurring sessions are one-time
          start_time: baseSession.start_time,
          end_time: baseSession.end_time,
          session_date: currentDate.toISOString().split('T')[0],
          created_by: baseSession.created_by
        });
      }
    }
  }

  // Create the recurring sessions
  if (sessionsToCreate.length > 0) {
    const { error } = await supabase
      .from('sessions')
      .insert(sessionsToCreate);

    if (error) {
      console.error('Error creating recurring sessions:', error);
    } else {
      console.log(`Created ${sessionsToCreate.length} recurring sessions`);
    }
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