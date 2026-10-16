import { createBrowserRouter } from 'react-router';
import AdminLayout       from '@/layouts/AdminLayout';
import PrivateRoute      from './PrivateRoute';
import GuestRoute        from './GuestRoute';
import Login             from '@/pages/auth/Login';
import Register          from '@/pages/auth/Register';
import Dashboard         from '@/pages/dashboard/Dashboard';
import Users             from '@/pages/users/Users';
import Roles             from '@/pages/roles/Roles';
import AuditLogs         from '@/pages/audit-logs';
import NotificationsPage from '@/pages/notifications/index';
import Profile           from '@/pages/profile/Profile';
import Settings          from '@/pages/settings/Settings';
import NotFound          from '@/pages/NotFound';
import BoardsList        from '@/pages/boards/BoardsList';
import Board             from '@/pages/boards/Board';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <GuestRoute><Login /></GuestRoute>,
  },
  {
    path: '/register',
    element: <GuestRoute><Register /></GuestRoute>,
  },
  {
    path: '/',
    element: <PrivateRoute><AdminLayout /></PrivateRoute>,
    children: [
      { index: true,           element: <Dashboard /> },
      { path: 'boards',        element: <BoardsList /> },
      { path: 'boards/:id',    element: <Board /> }, // ?card=<id> opens the card modal
      // Clients / Projects routes go here (next step): 'clients', 'clients/:id', 'projects', 'projects/:id'
      { path: 'users',         element: <Users /> },
      { path: 'roles',         element: <Roles /> },
      { path: 'audit-logs',    element: <AuditLogs /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'profile',       element: <Profile /> },
      { path: 'settings',      element: <Settings /> },
    ],
  },
  // Catch-all 404 route (must be last)
  {
    path: '*',
    element: <NotFound />,
  },
]);

export default router;
