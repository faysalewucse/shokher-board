import { Space, Button, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteFilled } from '@ant-design/icons';

/**
 * Standardized row-level actions for table listings (Edit + Delete + extras).
 * Visual style (monochrome): outlined Edit button + ink-bordered Delete button
 * with filled trash icon; the confirm uses a solid black "Delete" button.
 *
 * Usage:
 *   <RowActions
 *     canEdit={canUpdate}
 *     canDelete={canDelete}
 *     onEdit={() => navigate(`/users/${r.id}`)}
 *     onDelete={() => handleDelete(r.id)}
 *     deleteConfirmTitle="Delete this item?"
 *     deleteConfirmDescription="This action cannot be undone."
 *   />
 */
export default function RowActions({
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  editTooltip = 'Edit',
  deleteTooltip = 'Delete',
  deleteConfirmTitle = 'Delete this item?',
  deleteConfirmDescription,
  extra,
  size = 'small',
}) {
  const showEdit = canEdit && typeof onEdit === 'function';
  const showDelete = canDelete && typeof onDelete === 'function';
  if (!showEdit && !showDelete && !extra) return null;

  return (
    <Space size={4} onClick={(e) => e.stopPropagation()}>
      {extra}
      {showEdit && (
        <Tooltip title={editTooltip}>
          <Button
            size={size}
            icon={<EditOutlined />}
            onClick={onEdit}
            aria-label={editTooltip}
          />
        </Tooltip>
      )}
      {showDelete && (
        <Popconfirm
          title={deleteConfirmTitle}
          description={deleteConfirmDescription}
          onConfirm={onDelete}
          okText="Delete"
          okButtonProps={{ danger: true }}
          cancelText="Cancel"
        >
          <Tooltip title={deleteTooltip}>
            <Button
              size={size}
              danger
              icon={<DeleteFilled />}
              aria-label={deleteTooltip}
            />
          </Tooltip>
        </Popconfirm>
      )}
    </Space>
  );
}
