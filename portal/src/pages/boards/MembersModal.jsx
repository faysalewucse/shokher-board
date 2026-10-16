import { useEffect, useState } from 'react';
import { Avatar, Button, List, Modal, Popconfirm, Select, Spin, message } from 'antd';
import { DeleteOutlined, UserAddOutlined } from '@ant-design/icons';
import { useAuth } from '@/context/AuthContext';
import useDebounce from '@/hooks/useDebounce';
import {
  lookupUsers, addBoardMember, updateBoardMember, removeBoardMember, errorMessage,
} from '@/services/boards';
import { useBoard } from './boardState';
import MonoTag from '@/components/MonoTag';
import { avatarSrc, initials } from './boardUtils';

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];
const ROLE_VARIANT = { owner: 'solid', member: 'outline', viewer: 'dashed' };

/** Board members: view for everyone, manage for owners. */
export default function MembersModal({ open, onClose }) {
  const { state, dispatch, isOwner, boardId } = useBoard();
  const { user: me } = useAuth();
  const { members } = state;

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pick, setPick] = useState(null);
  const [role, setRole] = useState('member');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open || !isOwner) return undefined;
    let cancelled = false;
    setSearching(true);
    lookupUsers(debounced, 20)
      .then((users) => !cancelled && setOptions(users || []))
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setSearching(false));
    return () => { cancelled = true; };
  }, [debounced, open, isOwner]);

  const memberIds = new Set(members.map((m) => m.userId));

  const add = async () => {
    if (!pick) return;
    setAdding(true);
    try {
      const created = await addBoardMember(boardId, pick, role);
      const user = options.find((u) => u.id === pick);
      dispatch({
        type: 'member/upsert',
        member: created?.userId ? created : { userId: pick, role, user },
      });
      setPick(null);
      setQuery('');
    } catch (err) {
      message.error(errorMessage(err, 'Failed to add member'));
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (m, nextRole) => {
    const prev = m.role;
    dispatch({ type: 'member/upsert', member: { ...m, role: nextRole } });
    if (m.userId === me?.id) dispatch({ type: 'board/patch', patch: { myRole: nextRole } });
    try {
      await updateBoardMember(boardId, m.userId, nextRole);
    } catch (err) {
      dispatch({ type: 'member/upsert', member: { ...m, role: prev } });
      if (m.userId === me?.id) dispatch({ type: 'board/patch', patch: { myRole: prev } });
      message.error(errorMessage(err, 'Failed to change role'));
    }
  };

  const remove = async (m) => {
    try {
      await removeBoardMember(boardId, m.userId);
      dispatch({ type: 'member/remove', userId: m.userId });
    } catch (err) {
      message.error(errorMessage(err, 'Failed to remove member'));
    }
  };

  return (
    <Modal title={`Members (${members.length})`} open={open} onCancel={onClose} footer={null} width={520} destroyOnHidden>
      {isOwner && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Select
            showSearch={{ filterOption: false, onSearch: setQuery }}
            value={pick}
            onChange={setPick}
            placeholder="Search people by name or email"
            notFoundContent={searching ? <Spin size="small" /> : 'No users'}
            style={{ flex: 1, minWidth: 200 }}
            options={options.map((u) => ({
              value: u.id,
              disabled: memberIds.has(u.id),
              label: (
                <span className="flex items-center gap-2">
                  <Avatar size={20} src={avatarSrc(u)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 10 }}>{initials(u.name)}</Avatar>
                  <span>{u.name}</span>
                  <span className="text-fg-3">{u.email}</span>
                  {memberIds.has(u.id) && <MonoTag variant="soft" style={{ marginLeft: 'auto' }}>member</MonoTag>}
                </span>
              ),
            }))}
          />
          <Select value={role} onChange={setRole} options={ROLES} style={{ width: 110 }} />
          <Button type="primary" icon={<UserAddOutlined />} onClick={add} loading={adding} disabled={!pick}>
            Add
          </Button>
        </div>
      )}

      <List
        dataSource={members}
        rowKey="userId"
        renderItem={(m) => (
          <List.Item
            actions={isOwner ? [
              <Select
                key="role"
                size="small"
                value={m.role}
                options={ROLES}
                onChange={(r) => changeRole(m, r)}
                style={{ width: 100 }}
              />,
              <Popconfirm key="rm" title={`Remove ${m.user?.name || 'member'}?`} okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => remove(m)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Remove member" />
              </Popconfirm>,
            ] : [<MonoTag key="role" variant={ROLE_VARIANT[m.role] || 'soft'}>{m.role}</MonoTag>]}
          >
            <List.Item.Meta
              avatar={<Avatar src={avatarSrc(m.user)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)' }}>{initials(m.user?.name)}</Avatar>}
              title={<span>{m.user?.name}{m.userId === me?.id && <span className="text-fg-3"> (you)</span>}</span>}
              description={m.user?.email}
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}
