import { User, ExamType } from '../types';
import RequestManager from './RequestManager';
import SchedulingCenter from './SchedulingCenter';
import AdminDashboard from './AdminDashboard';

interface Props {
  user: User | null;
  view: 'dashboard' | 'requests' | 'scheduling';
}

export default function CnhDoBrasil({ user, view }: Props) {
  if (!user) return null;
  if (view === 'dashboard') return <AdminDashboard user={user} filterModule="cnh" />;
  if (view === 'requests') return <RequestManager user={user} typeFilter={ExamType.COMMON} />;
  if (view === 'scheduling') return <SchedulingCenter user={user} type={ExamType.COMMON} />;
  return null;
}
