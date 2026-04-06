import React from 'react';
import { User } from '../types';
import { CfcModule } from '../components/dashboard/CfcModule';

interface Props {
  user: User | null;
}

export default function ProvaPraticaCFCDashboard({ user }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard - Prova Prática CFC</h2>
      </div>
      <CfcModule user={user} />
    </div>
  );
}
