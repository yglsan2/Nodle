import { useState } from 'react';
import { Landing } from './Landing';
import { Room } from './Room';

export default function App() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');

  if (roomId) {
    return (
      <Room
        roomId={roomId}
        displayName={displayName || 'Participant'}
        onLeave={() => setRoomId(null)}
      />
    );
  }

  return (
    <Landing
      displayName={displayName}
      onDisplayNameChange={setDisplayName}
      onJoin={(id) => setRoomId(id)}
    />
  );
}
