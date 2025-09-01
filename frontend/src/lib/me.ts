// frontend/src/lib/me.ts
import { http } from './http';

export interface Me {
  id: string;
  email: string;
  name: string | null;
}

export const fetchMe = (): Promise<Me> => 
  http.get('/auth/me').then(r => r.data);
