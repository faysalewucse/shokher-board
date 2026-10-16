import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, Button, Dropdown, Input, Modal, Tooltip, message } from 'antd';
import {
  TeamOutlined, TagsOutlined, HistoryOutlined, EllipsisOutlined, EditOutlined, DeleteOutlined,
  RightOutlined, EyeOutlined, WifiOutlined,
} from '@ant-design/icons';
import { updateBoard, deleteBoard, errorMessage } from '@/services/boards';
import { useBoard } from './boardState';
import { avatarSrc, initials } from './boardUtils';
import MembersModal from './MembersModal';
import LabelsModal from './LabelsModal';
import BoardFormModal from './BoardFormModal';

function BoardName({ board, editable, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(board.name);
  if (editing) {
    const commit = () => {
      setEditing(false);
      const v = value.trim();
      if (v && v !== board.name) onSave(v);
    };
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
        style={{ fontSize: 17, fontWeight: 700, maxWidth: 360, fontFamily: 'var(--ff-display)' }}
      />
    );
  }
  return (
    <h1
      className="m-0 truncate rounded-sm px-1.5 font-display text-[19px] font-extrabold leading-8 tracking-tight text-fg transition-colors hover:bg-surface-3"
      style={{ cursor: editable ? 'pointer' : 'default' }}
      onClick={() => editable && (setValue(board.name), setEditing(true))}
      title={editable ? 'Click to rename' : board.name}
    >
      {board.name}
    </h1>
  );
}

export default function BoardHeader({ connected, onOpenActivity }) {
  const { state, dispatch, isOwner, canEdit, boardId } = useBoard();
  const { board, members } = state;
  const navigate = useNavigate();
  const [membersOpen, setMembersOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const save = async (patch) => {
    const prev = { ...board };
    dispatch({ type: 'board/patch', patch });
    try {
      const updated = await updateBoard(boardId, patch);
      // Keep our own myRole — the server computes it per viewer.
      if (updated?.id) dispatch({ type: 'board/patch', patch: { ...updated, myRole: prev.myRole } });
    } catch (err) {
      dispatch({ type: 'board/patch', patch: prev });
      message.error(errorMessage(err, 'Failed to update board'));
      throw err;
    }
  };

  const archive = () => {
    Modal.confirm({
      title: `Archive "${board.name}"?`,
      content: 'The board will be hidden for all members.',
      okText: 'Archive',
      okButtonProps: { danger: true, type: 'primary' },
      onOk: async () => {
        try {
          await deleteBoard(boardId);
          message.success('Board archived');
          navigate('/boards');
        } catch (err) {
          message.error(errorMessage(err, 'Failed to archive board'));
        }
      },
    });
  };

  const project = board.project;
  const client = project?.client;

  const moreMenu = {
    items: [
      { key: 'labels', icon: <TagsOutlined />, label: isOwner ? 'Manage labels' : 'Labels' },
      ...(isOwner ? [
        { key: 'edit', icon: <EditOutlined />, label: 'Edit board' },
        { type: 'divider' },
        { key: 'archive', icon: <DeleteOutlined />, label: 'Archive board', danger: true },
      ] : []),
    ],
    onClick: ({ key }) => {
      if (key === 'labels') setLabelsOpen(true);
      if (key === 'edit') setEditOpen(true);
      if (key === 'archive') archive();
    },
  };

  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4"
      style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-line)' }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Breadcrumb: Boards / Client / Project. Client & project pages are added in a later step. */}
        <div className="mono flex items-center gap-1 truncate px-1.5 text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
          <Link to="/boards" className="text-fg-3! hover:text-fg! hover:underline">Boards</Link>
          {client && (<><RightOutlined style={{ fontSize: 8 }} /><span>{client.name}</span></>)}
          {project && (<><RightOutlined style={{ fontSize: 8 }} /><span>{project.name}</span></>)}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <BoardName key={board.name} board={board} editable={isOwner} onSave={(name) => save({ name }).catch(() => {})} />
          {!canEdit && (
            <span className="mono-tag" style={{ color: 'var(--c-fg-2)', border: '1px dashed var(--c-line-2)' }}>
              <EyeOutlined /> View only
            </span>
          )}
          <Tooltip title={connected ? 'Live updates on' : 'Reconnecting… changes by others may be delayed'}>
            <span
              className="mono inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]"
              style={connected
                ? { color: 'var(--c-surface)', background: 'var(--c-fg)' }
                : { color: 'var(--c-fg-2)', border: '1px dashed var(--c-line-2)' }}
            >
              <WifiOutlined style={{ fontSize: 11 }} />
              {connected ? 'Live' : 'Offline'}
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Avatar.Group
          size={28}
          max={{ count: 5, style: { background: 'var(--c-fg)', color: 'var(--c-surface)', fontSize: 11, fontWeight: 700 } }}
        >
          {members.map((m) => (
            <Tooltip key={m.userId} title={`${m.user?.name} · ${m.role}`}>
              <Avatar
                size={28}
                src={avatarSrc(m.user)}
                style={{ background: 'var(--c-fg)', color: 'var(--c-surface)', fontSize: 11, fontWeight: 700, border: '2px solid var(--c-surface)' }}
              >
                {initials(m.user?.name)}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
        <Button size="small" icon={<TeamOutlined />} className="board-hbtn" onClick={() => setMembersOpen(true)}>
          <span className="hidden sm:inline">{isOwner ? 'Share' : 'Members'}</span>
        </Button>
        <Button size="small" icon={<HistoryOutlined />} className="board-hbtn" onClick={onOpenActivity}>
          <span className="hidden sm:inline">Activity</span>
        </Button>
        <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
          <Button size="small" icon={<EllipsisOutlined />} className="board-hbtn" />
        </Dropdown>
      </div>

      <MembersModal open={membersOpen} onClose={() => setMembersOpen(false)} />
      <LabelsModal open={labelsOpen} onClose={() => setLabelsOpen(false)} />
      {isOwner && (
        <BoardFormModal
          open={editOpen}
          title="Edit board"
          okText="Save"
          initial={board}
          onCancel={() => setEditOpen(false)}
          onSubmit={async (values) => {
            await save(values);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
