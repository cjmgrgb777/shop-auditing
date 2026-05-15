import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { User, CreditCard, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Purchase } from '../../types/audit';

interface PurchasesTableProps {
  data: Purchase[];
  sortConfig: { key: string, direction: 'asc' | 'desc' };
  requestSort: (key: string) => void;
  onCustomerClick: (email: string) => void;
}

export const PurchasesTable: React.FC<PurchasesTableProps> = ({ 
  data, 
  sortConfig, 
  requestSort, 
  onCustomerClick 
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
            onClick={() => requestSort('number')}
          >
            <div className="flex items-center">
              Order # <SortIcon columnKey="number" />
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Customer <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('total')}
          >
            <div className="flex items-center">
              Total <SortIcon columnKey="total" />
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('payment_status')}
          >
            <div className="flex items-center">
              Payment Status <SortIcon columnKey="payment_status" />
            </div>
          </TableHead>
          <TableHead 
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('purchase_time')}
          >
            <div className="flex items-center">
              Purchase Time (AEST) <SortIcon columnKey="purchase_time" />
            </div>
          </TableHead>
          <TableHead className="text-right">Inspection</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell className="font-mono text-xs font-bold text-slate-500">#{item.number}</TableCell>
            <TableCell className="font-mono text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                  <User size={14} />
                </div>
                {item.email}
              </div>
            </TableCell>
            <TableCell className="font-bold text-slate-900">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">AUD</span>
                ${item.total}
              </div>
            </TableCell>
            <TableCell>
              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${
                item.payment_status === 'FULLY_CHARGED' 
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
                  : 'bg-orange-50 text-orange-700 ring-orange-600/20'
              }`}>
                {item.payment_status === 'FULLY_CHARGED' ? 'Fully Paid' : 'Pending/Unpaid'}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {safeFormatDate(item.purchase_time)}
            </TableCell>
            <TableCell className="text-right">
              <button 
                className="inline-flex items-center justify-center rounded-lg h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/5 transition-colors gap-1"
                onClick={() => onCustomerClick(item.email)}
              >
                INSIGHTS
                <ChevronRight size={14} />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
