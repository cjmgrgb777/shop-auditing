import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Activity, Eye } from 'lucide-react';
import { cn } from "@/lib/utils";

interface IntentAuditProps {
  data: any[];
  metrics: any;
  onUnfulfilledClick: (emails: string[]) => void;
}

export const IntentAudit: React.FC<IntentAuditProps> = ({ 
  data, 
  metrics, 
  onUnfulfilledClick 
}) => {
  return (
    <div className="space-y-6">
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/50 border-b">
           {/* Metric Card 24H */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Non-Conversion (Today)</p>
                <p className="text-2xl font-black text-slate-900">{metrics.t24h}%</p>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                metrics.t24h > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                <Activity size={20} />
              </div>
           </div>

           {/* Metric Card 7D */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Non-Conversion (7D)</p>
                <p className="text-2xl font-black text-slate-900">{metrics.t7d}%</p>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                metrics.t7d > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                <Activity size={20} />
              </div>
           </div>

           {/* Metric Card 28D */}
           <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Non-Conversion (28D)</p>
                <p className="text-2xl font-black text-slate-900">{metrics.t28d}%</p>
              </div>
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center",
                metrics.t28d > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
              )}>
                <Activity size={20} />
              </div>
           </div>
        </div>
      )}
      <div className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/30">
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Total Logins</TableHead>
              <TableHead className="text-center">Logins (Allowance)</TableHead>
              <TableHead className="text-center">Total Orders</TableHead>
              <TableHead className="text-center">Did Not Buy</TableHead>
              <TableHead className="text-center">Non-Conversion %</TableHead>
              <TableHead className="text-right">Unfulfilled Lookups</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index} className="group transition-colors">
                <TableCell className="font-medium text-slate-900">{item.date}</TableCell>
                <TableCell className="text-center">{item.total_logins}</TableCell>
                <TableCell className="text-center font-bold text-slate-900">{item.total_logins_with_allowance}</TableCell>
                <TableCell className="text-center text-emerald-600 font-bold">{item.total_orders}</TableCell>
                <TableCell className="text-center text-orange-600 font-bold">{item.did_not_buy}</TableCell>
                <TableCell className="text-center font-mono">
                  <span className={cn(
                    "px-2 py-1 rounded-md text-xs font-bold",
                    item.non_conversion_percent > 70 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  )}>
                    {item.non_conversion_percent}%
                  </span>
                </TableCell>
                <TableCell className="text-right font-bold text-purple-700">
                  <button 
                    className="hover:underline cursor-pointer"
                    onClick={() => onUnfulfilledClick(item.unfulfilled_lookups_emails || [])}
                  >
                    {item.logins_with_unfulfilled_orders}
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
