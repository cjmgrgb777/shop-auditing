import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { User, Eye, PlusCircle, MinusCircle, CreditCard, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { FunnelEvent } from '../../types/audit';

interface FunnelTableProps {
  data: FunnelEvent[];
  sortConfig: { key: string, direction: 'asc' | 'desc' };
  requestSort: (key: string) => void;
}

export const FunnelTable: React.FC<FunnelTableProps> = ({ 
  data, 
  sortConfig, 
  requestSort 
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
            className="w-[300px] cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Patient Email <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead className="text-center">Viewed Product</TableHead>
          <TableHead className="text-center">Added to Cart</TableHead>
          <TableHead className="text-center">Removed</TableHead>
          <TableHead className="text-center">Checkout</TableHead>
          <TableHead 
            className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('login_time')}
          >
            <div className="flex items-center justify-end">
              Last Activity <SortIcon columnKey="login_time" />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((event, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell className="font-mono text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                  <User size={14} />
                </div>
                {event.email}
              </div>
            </TableCell>
            <TableCell className="text-center">
              {event.viewed_product ? <Eye className="mx-auto text-blue-500" size={18} /> : <X className="mx-auto text-slate-200" size={18} />}
            </TableCell>
            <TableCell className="text-center">
              {event.added_to_cart ? <PlusCircle className="mx-auto text-emerald-500" size={18} /> : <X className="mx-auto text-slate-200" size={18} />}
            </TableCell>
            <TableCell className="text-center">
              {event.removed_from_cart ? <MinusCircle className="mx-auto text-orange-400" size={18} /> : <X className="mx-auto text-slate-200" size={18} />}
            </TableCell>
            <TableCell className="text-center">
              {event.checkout ? <CreditCard className="mx-auto text-emerald-600" size={18} /> : <X className="mx-auto text-slate-200" size={18} />}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {safeFormatDate(event.login_time)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
