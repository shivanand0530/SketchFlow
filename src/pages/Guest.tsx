import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/auth/AuthContext';

export default function Guest() {
  const { continueAsGuest } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    continueAsGuest();
    navigate('/canvas', { replace: true });
  }, [continueAsGuest, navigate]);

  return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Opening the canvas...</div>;
}