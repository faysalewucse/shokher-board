import { useEffect, useRef } from 'react';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Joins the `board:<id>` room on the shared socket (re-joining after every
 * reconnect) and routes `board:event` payloads to `handlers`.
 *
 * handlers: { [eventType]: (payload, event) => void, '*': (event) => void }
 * Events whose actorId is the current user are ignored — those changes were
 * already applied optimistically. Exception: server re-spacing events
 * (`lists.reordered` / `cards.reordered`) are idempotent position fixes the
 * actor never applied locally, so they are always applied.
 *
 * Returns `{ connected }`.
 */
const ALWAYS_APPLY = new Set(['lists.reordered', 'cards.reordered']);

export default function useBoardSocket(boardId, handlers) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const handlersRef = useRef(handlers);
  const userIdRef = useRef(user?.id);

  useEffect(() => {
    handlersRef.current = handlers;
    userIdRef.current = user?.id;
  });

  useEffect(() => {
    if (!socket || !boardId) return undefined;

    const join = () => {
      socket.emit('board:join', { boardId }, (ack) => {
        if (ack && ack.ok === false) {
          console.warn(`board:join refused for ${boardId}:`, ack.error);
        }
      });
    };

    const onEvent = (event) => {
      if (!event || event.boardId !== boardId) return;
      const own = event.actorId && event.actorId === userIdRef.current;
      if (own && !ALWAYS_APPLY.has(event.type)) return;
      const h = handlersRef.current || {};
      h[event.type]?.(event.payload, event);
      h['*']?.(event);
    };

    socket.on('connect', join);
    socket.on('board:event', onEvent);
    if (socket.connected) join();

    return () => {
      socket.off('connect', join);
      socket.off('board:event', onEvent);
      if (socket.connected) socket.emit('board:leave', { boardId });
    };
  }, [socket, boardId]);

  return { connected };
}
