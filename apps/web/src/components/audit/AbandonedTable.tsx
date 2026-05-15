import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { User, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface AbandonedTableProps {
  data: any[];
  sortConfig: { key: string, direction: 'asc' | 'desc' };
  requestSort: (key: string) => void;
}

export const AbandonedTable: React.FC<AbandonedTableProps> = ({ 
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
            className="cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Customer Email <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead className="text-center">Allowance Remaining</TableHead>
          <TableHead className="text-center">Cart Created (AEST/AEDT)</TableHead>
          <TableHead className="text-right w-[150px]">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell className="font-mono text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                  <User size={14} />
                </div>
                {item.email}
              </div>
            </TableCell>
            <TableCell className="text-center">
              <span className="font-bold text-orange-600">{item.days_allowance_remaining}</span>
            </TableCell>
            <TableCell className="text-center text-muted-foreground tabular-nums">
              {safeFormatDate(item.cart_created_sydney)}
            </TableCell>
            <TableCell className="text-right">
              {/* Inspection restricted to Purchase Audit */}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
