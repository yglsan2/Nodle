import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { Landing } from './Landing';
import { Room } from './Room';
import type { RoomRole } from './types';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<RoomRole>('participant');

  if (roomId) {
    return (
      <ErrorBoundary>
        <Room
          roomId={roomId}
          displayName={displayName || 'Participant'}
          role={role}
          onLeave={() => setRoomId(null)}
        />
      </ErrorBoundary>
    );
  }

  return (
    <Landing
      displayName={displayName}
      onDisplayNameChange={setDisplayName}
      role={role}
      onRoleChange={setRole}
      onJoin={(id) => setRoomId(id)}
    />
  );
}
