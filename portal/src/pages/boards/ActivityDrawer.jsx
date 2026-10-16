import { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Skeleton, message } from 'antd';
import { getBoardActivity, errorMessage } from '@/services/boards';
import { useBoard } from './boardState';
import ActivityFeed from './ActivityFeed';

/** Board activity, cursor-paginated. Content mounts only while open. */
function ActivityContent({ boardId }) {
  const { state } = useBoard();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async (next) => {
    setLoading(true);
    try {
      const { data, meta } = await getBoardActivity(boardId, { cursor: next || undefined });
      setItems((prev) => (next ? [...prev, ...data] : data));
      setCursor(meta?.nextCursor || null);
    } catch (err) {
      message.error(errorMessage(err, 'Failed to load activity'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    getBoardActivity(boardId)
      .then(({ data, meta }) => {
        if (cancelled) return;
        setItems(data);
        setCursor(meta?.nextCursor || null);
      })
      .catch((err) => !cancelled && message.error(errorMessage(err, 'Failed to load activity')))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [boardId]);

  const context = useMemo(() => ({
    lists: state.lists,
    members: state.members,
    cardsById: Object.fromEntries(state.cards.map((c) => [c.id, c])),
  }), [state.lists, state.members, state.cards]);

  return (
    <>
      {loading && items.length === 0 ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} active avatar={{ size: 28 }} title={{ width: '40%' }} paragraph={{ rows: 1, width: '70%' }} />)}
        </div>
      ) : (
        <ActivityFeed items={items} context={context} />
      )}
      {cursor && (
        <div className="mt-4 text-center">
          <Button onClick={() => load(cursor)} loading={loading}>Load more</Button>
        </div>
      )}
    </>
  );
}

export default function ActivityDrawer({ open, onClose, boardId }) {
  return (
    <Drawer title="Activity" open={open} onClose={onClose} size="default" destroyOnHidden>
      {open && <ActivityContent boardId={boardId} />}
    </Drawer>
  );
}
