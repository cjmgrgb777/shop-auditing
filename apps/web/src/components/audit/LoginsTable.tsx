import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { User, Activity, Check, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Patient } from '../../types/audit';

interface LoginsTableProps {
  data: Patient[];
  sortConfig: { key: string, direction: 'asc' | 'desc' };
  requestSort: (key: string) => void;
  onZohoClick: (email: string) => void;
}

export const LoginsTable: React.FC<LoginsTableProps> = ({ 
  data, 
  sortConfig, 
  requestSort, 
  onZohoClick 
}) => {
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={12} className="ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="ml-1 text-primary" /> : <ArrowDown size={12} className="ml-1 text-primary" />;
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-AU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney'
      }).format(new Date(dateStr));
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/30">
          <TableHead 
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Patient Email <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead className="text-center">Allowance</TableHead>
          <TableHead className="text-center">TP Date</TableHead>
          <TableHead className="text-center">Supply Status</TableHead>
          <TableHead 
            className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('login_time')}
          >
            <div className="flex items-center justify-end">
              Login Time (AEST) <SortIcon columnKey="login_time" />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((patient, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell className="font-mono text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <User size={14} />
                </div>
                <button 
                  className="hover:underline hover:text-primary transition-colors text-left"
                  onClick={() => onZohoClick(patient.email)}
                >
                  {patient.email}
                </button>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <span className="font-bold text-slate-900">{patient.allowance} days</span>
            </TableCell>
            <TableCell className="text-center font-mono text-[10px] font-bold text-slate-500">
              {patient.tp_date || '---'}
            </TableCell>
            <TableCell className="text-center">
              {patient.hasPurchased ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <Check size={10} /> ORDERED
                </span>
              ) : patient.hasUnpaid ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-inset ring-orange-600/20">
                  <Activity size={10} /> UNPAID
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-400 ring-1 ring-inset ring-slate-400/20">
                  <X size={10} /> NO PURCHASE
                </span>
              )}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {safeFormatDate(patient.login_time)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
