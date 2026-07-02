import Reports from './Reports';
import { User } from '../types';

export default function ProvaPraticaCFCReport({ user }: { user: User }) {
  return <Reports reportTypeProp="cfc" user={user} />;
}
