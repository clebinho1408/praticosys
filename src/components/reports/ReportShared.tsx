
import React from 'react';

export const COLORS = ['#10B981', '#EF4444', '#6B7280', '#F59E0B'];

export const SCHEDULE_STATUS_TRANSLATION: Record<string, string> = {
  'OPEN': 'Aberta',
  'CLOSED': 'Fechada',
  'CONCLUDED': 'Concluída',
  'CANCELLED': 'Cancelada'
};

export const SummaryCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string }> = ({ title, value, icon: Icon, color, subtitle }) => {
  const printBgColor = color.includes('blue') ? '#eff6ff' : 
                       color.includes('green') ? '#f0fdf4' : 
                       color.includes('red') ? '#fef2f2' : 
                       color.includes('yellow') ? '#fffbeb' : 
                       color.includes('gray') ? '#f9fafb' : 
                       color.includes('orange') ? '#fff7ed' : '#ffffff';

  return (
    <div 
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:p-1 print:shadow-none print:border-black print:border relative overflow-hidden"
      style={{ ['--print-bg' as any]: printBgColor }}
    >
      <div className="print:bg-[var(--print-bg)] absolute inset-0 hidden print:block -z-10"></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 print:text-[7px] print:mb-0 print:text-black">{title}</p>
          <h3 className="text-2xl font-black text-gray-900 print:text-sm print:text-black">{value}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1 print:text-[7px] print:mt-0 print:text-black">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color} bg-opacity-10 print:hidden`}>
          <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  );
};

export const PrintStatsTable: React.FC<{ title: string; data: { label: string; value: string | number; color?: string }[] }> = ({ title, data }) => (
    <div className="hidden print:block mt-2 border border-black rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-2 py-1 font-bold text-[9px] uppercase border-b border-black text-black">{title}</div>
        <table className="w-full text-[9px] text-left">
            <tbody className="divide-y divide-black">
                {data.map((item, idx) => (
                    <tr key={idx} style={item.color ? { backgroundColor: `${item.color}15` } : undefined}>
                        <td className="px-2 py-0.5 font-bold uppercase text-black w-2/3">
                            <div className="flex items-center gap-1">
                                {item.color && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>}
                                {item.label}
                            </div>
                        </td>
                        <td className="px-2 py-0.5 text-black text-right font-bold">{item.value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export const CustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;
    return (
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 print:hidden">
            {payload.map((entry: any, index: number) => (
                <li key={`item-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: entry.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    {entry.value}
                </li>
            ))}
        </ul>
    );
};
