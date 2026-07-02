import { User } from '../types';
import CFCSchedulingCenter from './CFCSchedulingCenter';

interface Props {
  user: User | null;
}

export default function ProvaPraticaCFC({ user }: Props) {
  if (!user) return null;
  return <CFCSchedulingCenter user={user} />;
}
