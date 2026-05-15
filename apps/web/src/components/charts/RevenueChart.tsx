import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend
} from 'recharts';

interface RevenueChartProps {
  data: any[];
  chartMetric: 'traffic' | 'gross';
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, chartMetric }) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorYesterday" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/>
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis 
          dataKey="hour" 
          fontSize={10} 
          tickLine={false} 
          axisLine={false}
          interval={3}
        />
        <YAxis 
          fontSize={10} 
          tickLine={false} 
          axisLine={false} 
          tickFormatter={(value) => chartMetric === 'gross' ? `$${Math.round(value)}` : value}
        />
        <Tooltip 
          itemSorter={(item) => {
            const order: Record<string, number> = { 'Today': 1, 'Yesterday': 2, 'avg7d': 3, 'avg28d': 4 };
            return order[item.name as string] || 5;
          }}
          formatter={(value: any, name: string) => {
            const formattedValue = chartMetric === 'gross' ? `$${Number(value).toFixed(2)}` : value;
            let label = name;
            if (name === 'avg7d') label = '7 Days Ago';
            if (name === 'avg28d') label = '28 Days Ago';
            if (name === 'today') label = 'Today';
            if (name === 'yesterday') label = 'Yesterday';
            return [formattedValue, label];
          }}
          contentStyle={{ 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            fontSize: '12px',
            fontWeight: '600'
          }}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36} 
          content={() => (
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3b82f6]"></div>
                <span className="text-[11px] font-bold text-slate-600">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#94a3b8]"></div>
                <span className="text-[11px] font-bold text-slate-600">Yesterday</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
                <span className="text-[11px] font-bold text-slate-600">7 Days Ago</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#a855f7]"></div>
                <span className="text-[11px] font-bold text-slate-600">28 Days Ago</span>
              </div>
            </div>
          )}
        />
        {chartMetric === 'gross' && (
          <>
            <Area 
              type="linear" 
              dataKey="avg28d" 
              stroke="#a855f7" 
              strokeWidth={2} 
              strokeDasharray="3 3"
              fill="transparent" 
              name="avg28d"
            />
            <Area 
              type="linear" 
              dataKey="avg7d" 
              stroke="#f59e0b" 
              strokeWidth={2} 
              strokeDasharray="4 4"
              fill="transparent" 
              name="avg7d"
            />
          </>
        )}
        <Area 
          type={chartMetric === 'gross' ? "linear" : "monotone"} 
          dataKey="yesterday" 
          stroke="#94a3b8" 
          strokeWidth={2}
          strokeDasharray="5 5"
          fillOpacity={1} 
          fill="url(#colorYesterday)" 
          name="Yesterday"
          connectNulls
        />
        <Area 
          type={chartMetric === 'gross' ? "linear" : "monotone"} 
          dataKey="today" 
          stroke="#3b82f6" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorToday)" 
          name="Today"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
