
import React from 'react';
import { useParams } from 'react-router-dom';
import CfcReports from '../src/components/reports/CfcReports';
import CnhReports from '../src/components/reports/CnhReports';
import PcdReports from '../src/components/reports/PcdReports';

const Reports: React.FC = () => {
  const { reportType } = useParams<{ reportType: string }>();

  // Use reportType to determine which component to render
  // reportType comes from the URL, e.g., /reports/cfc, /reports/cnh, /reports/pcd
  
  const normalizedType = reportType?.toLowerCase();

  if (normalizedType === 'cfc') {
    return <CfcReports />;
  }

  if (normalizedType === 'pcd') {
    return <PcdReports />;
  }

  // Default to CNH if no type or unknown type
  return <CnhReports />;
};

export default Reports;
