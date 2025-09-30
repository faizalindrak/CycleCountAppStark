# Group Session Components Design

## Overview
This document outlines the React components needed to implement the group session feature in the cycle count application.

## Component Architecture

### 1. GroupSessionManager Component

**Purpose**: Admin interface for managing group sessions within a session

**Props**:
```jsx
GroupSessionManager = ({ session, onDataChange })
```

**State**:
- `groupSessions`: Array of group sessions for the current session
- `showEditor`: Boolean to show/hide group session editor modal
- `editingGroupSession`: Current group session being edited (null for new)
- `showUserAssignment`: Boolean to show/hide user assignment modal
- `showItemAssignment`: Boolean to show/hide item assignment modal
- `selectedGroupSessionForUsers`: Group session selected for user assignment
- `selectedGroupSessionForItems`: Group session selected for item assignment

**Key Features**:
- List all group sessions in a session
- Create new group sessions
- Edit existing group sessions
- Delete group sessions
- Assign users to group sessions
- Assign items to group sessions
- Show group session statistics (user count, item count)

**UI Structure**:
```
GroupSessionManager
├── Header with "Manage Group Sessions" title
├── "Create Group Session" button
├── Group Sessions List
│   ├── Group Session Card
│   │   ├── Name and description
│   │   ├── User count badge
│   │   ├── Item count badge
│   │   ├── Status badge (active/inactive)
│   │   └── Action buttons (assign users, assign items, edit, delete)
│   │
├── GroupSessionEditor Modal (when creating/editing)
├── UserAssignmentModal (when assigning users)
└── ItemAssignmentModal (when assigning items)
```

### 2. GroupSessionSelection Component

**Purpose**: Counter interface for selecting group sessions within a session

**Props**:
```jsx
GroupSessionSelection = ({ session, onGroupSessionSelect, onBack })
```

**State**:
- `groupSessions`: Array of group sessions the user is assigned to
- `loading`: Boolean for loading state

**Key Features**:
- Fetch group sessions user is assigned to
- Display group sessions in a grid/list format
- Show group session details (name, description, item count)
- Handle group session selection
- Back button to return to session selection

**UI Structure**:
```
GroupSessionSelection
├── Header with session name and back button
├── "Select Group Session" title
├── Loading spinner (when loading)
├── Group Sessions Grid/List
│   ├── Group Session Card (clickable)
│   │   ├── Name and description
│   │   ├── Item count
│   │   ├── Assignment date
│   │   └── Status indicator
│   │
└── Empty state (no group sessions assigned)
```

### 3. Modified Components

#### AdminDashboard Updates

**Changes Needed**:
- Add group session management to SessionsManager
- Add "Manage Group Sessions" button to session cards
- Integrate GroupSessionManager as a modal or tab

**New UI Elements**:
```jsx
// In session card actions
<button
  onClick={() => handleManageGroupSessions(session)}
  className="text-purple-600 hover:text-purple-800 p-2"
  title="Manage Group Sessions"
>
  <Groups className="h-5 w-5" />
</button>
```

#### SessionSelection Updates

**Changes Needed**:
- After session selection, show group session selection instead of directly going to items list
- Update flow to handle group session selection

#### ItemsList Updates

**Changes Needed**:
- Accept `groupSession` prop in addition to `session` prop
- Filter items based on group session assignment
- Update item queries to only show items in the selected group session

**New Props**:
```jsx
ItemsList = ({ session, groupSession, onBack })
```

#### App.jsx Updates

**Changes Needed**:
- Add state for selected group session
- Update flow: Session Selection → Group Session Selection → Items List
- Handle back navigation through the flow

**New State**:
- `selectedGroupSession`: Currently selected group session
- `currentPage`: Update to include 'group-session-selection'

**Updated Flow**:
```jsx
// Current flow
Session Selection → Items List

// New flow
Session Selection → Group Session Selection → Items List
```

## Component Implementation Details

### GroupSessionManager Implementation

**Key Functions**:
```jsx
// Fetch group sessions for a session
const fetchGroupSessions = async (sessionId) => {
  const { data, error } = await supabase
    .from('group_sessions')
    .select(`
      *,
      group_session_users(count),
      group_session_items(count)
    `)
    .eq('session_id', sessionId)
    .eq('is_active', true);

  return data || [];
};

// Create group session
const handleCreateGroupSession = async (groupSessionData) => {
  const { error } = await supabase
    .from('group_sessions')
    .insert([{
      ...groupSessionData,
      session_id: session.id,
      created_by: user.id
    }]);
};

// User assignment within group session
const handleAssignUsersToGroupSession = async (groupSessionId, userIds) => {
  const assignments = userIds.map(userId => ({
    group_session_id: groupSessionId,
    user_id: userId,
    assigned_by: user.id
  }));

  const { error } = await supabase
    .from('group_session_users')
    .insert(assignments);
};
```

### GroupSessionSelection Implementation

**Key Functions**:
```jsx
// Fetch user's group sessions for a session
const fetchUserGroupSessions = async (sessionId, userId) => {
  const { data, error } = await supabase
    .from('group_session_users')
    .select(`
      group_sessions(*)
    `)
    .eq('group_sessions.session_id', sessionId)
    .eq('user_id', userId);

  return data?.map(item => item.group_sessions) || [];
};
```

### ItemsList Updates

**Key Functions**:
```jsx
// Fetch items for group session
const fetchGroupSessionItems = async (groupSessionId) => {
  const { data, error } = await supabase
    .from('group_session_items')
    .select(`
      items(*)
    `)
    .eq('group_session_id', groupSessionId);

  return data?.map(item => item.items) || [];
};

// Update useEffect to handle group session
useEffect(() => {
  if (session && groupSession) {
    fetchGroupSessionData();
  } else if (session && !groupSession) {
    // Fallback to session items if no group session
    fetchSessionData();
  }
}, [session, groupSession]);
```

## Database Helper Functions

Add to `src/lib/supabase.js`:

```jsx
// Group Session helpers
export const getGroupSessions = async (sessionId) => {
  const { data, error } = await supabase
    .from('group_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .eq('is_active', true)
    .order('created_date');

  if (error) throw error;
  return data || [];
};

export const getUserGroupSessions = async (sessionId, userId) => {
  const { data, error } = await supabase
    .from('group_session_users')
    .select(`
      group_sessions(*)
    `)
    .eq('group_sessions.session_id', sessionId)
    .eq('user_id', userId);

  if (error) throw error;
  return data?.map(item => item.group_sessions) || [];
};

export const getGroupSessionItems = async (groupSessionId) => {
  const { data, error } = await supabase
    .from('group_session_items')
    .select(`
      items(*)
    `)
    .eq('group_session_id', groupSessionId);

  if (error) throw error;
  return data?.map(item => item.items) || [];
};
```

## Updated App Flow

### New State Management
```jsx
const [selectedGroupSession, setSelectedGroupSession] = useState(null);

// Updated handlers
const handleGroupSessionSelect = (groupSession) => {
  setSelectedGroupSession(groupSession);
  setCurrentPage('items-list');
};

const handleBackToGroupSessions = () => {
  setSelectedGroupSession(null);
  setCurrentPage('group-session-selection');
};

const handleBackToSessions = () => {
  setSelectedGroupSession(null);
  setSelectedSession(null);
  setCurrentPage('select-session');
};
```

### Updated Rendering Logic
```jsx
// Group session selection
if (!isAdmin && currentPage === 'group-session-selection') {
  return (
    <GroupSessionSelection
      session={selectedSession}
      onGroupSessionSelect={handleGroupSessionSelect}
      onBack={handleBackToSessions}
    />
  );
}

// Items counting page (with group session context)
if (currentPage === 'items-list' && selectedSession) {
  return (
    <ItemsList
      session={selectedSession}
      groupSession={selectedGroupSession}
      onBack={selectedGroupSession ? handleBackToGroupSessions : handleBackToSessions}
    />
  );
}
```

## UI/UX Considerations

### Visual Hierarchy
1. **Session Level**: Main session name and details
2. **Group Session Level**: Group session name and assignment info
3. **Item Level**: Individual items within group session

### Navigation Flow
```
Admin creates session
├── Admin creates group sessions
├── Admin assigns users to group sessions
├── Admin assigns items to group sessions
└── Counter selects session
    └── Counter selects group session
        └── Counter counts items in group session
```

### Loading States
- Show loading spinners during data fetching
- Disable buttons during async operations
- Show progress indicators for bulk operations

### Error Handling
- Display user-friendly error messages
- Provide retry mechanisms for failed operations
- Log errors for debugging

### Responsive Design
- Ensure components work on mobile devices
- Use appropriate breakpoints for different screen sizes
- Optimize touch interactions for mobile users

## Testing Strategy

### Unit Tests
- Test individual component rendering
- Test state management
- Test API integrations
- Test error scenarios

### Integration Tests
- Test complete workflow from admin to counter
- Test data consistency across components
- Test real-time updates
- Test permission-based access

### User Acceptance Tests
- Test with actual users (admins and counters)
- Verify workflow matches expectations
- Test edge cases (empty states, large datasets)
- Validate performance with realistic data sizes

## Implementation Priority

1. **Phase 1**: Database schema and basic components
2. **Phase 2**: Admin interface for group session management
3. **Phase 3**: Counter interface for group session selection
4. **Phase 4**: Integration and workflow testing
5. **Phase 5**: Performance optimization and edge case handling

This design provides a solid foundation for implementing the group session feature while maintaining consistency with the existing application architecture.