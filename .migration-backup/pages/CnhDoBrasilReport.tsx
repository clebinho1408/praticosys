import Reports from './Reports';
import { User } from '../types';

export default function CnhDoBrasilReport({ user }: { user: User }) {
  return <Reports reportTypeProp="cnh" user={user} />;
}
