import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export interface CurrentUser {
  user_id: string;
  name: string;
  email: string;
  given_name: string;
  family_name: string;
}

const anonymousUser: CurrentUser = {
  user_id: 'anonymous',
  name: 'User',
  email: '',
  given_name: '',
  family_name: '',
};

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser>(anonymousUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CurrentUser>('/api/me').then((res) => {
      if (res.ok && res.data && res.data.user_id !== 'anonymous') {
        setUser(res.data);
      }
      setLoading(false);
    });
  }, []);

  return { user, loading };
}
