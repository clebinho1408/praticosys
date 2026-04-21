import Reports from './Reports';
import { User } from '../types';

export default function ProvaPraticaPCDReport({ user }: { user: User }) {
  return <Reports reportTypeProp="pcd" user={user} />;
}
