import { useAuth } from '@/context/AuthContext';

/**
 * Check if the current user has the given permission(s).
 * @param {...string} perms - Permission keys e.g. 'USER_CREATE', 'USER_DELETE_ANY'
 * @returns {boolean}
 */
const usePermission = (...perms) => {
  const { permissions } = useAuth();
  return perms.every((p) => permissions.includes(p));
};

export default usePermission;
