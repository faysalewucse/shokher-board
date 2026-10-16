import { Navigate } from 'react-router';
import { Spin } from 'antd';
import { useAuth } from '@/context/AuthContext';

export default function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  return user ? <Navigate to="/" replace /> : children;
}
