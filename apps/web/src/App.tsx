import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calendar as CalendarIcon,
  RefreshCw,
  User,
  Database,
  LayoutDashboard,
  Search,
  ShoppingCart,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Eye,
  PlusCircle,
  MinusCircle,
  Check,
  X,
  Activity
} from 'lucide-react';
import { format, subDays, formatDistanceToNow } from 'date-fns';

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

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

const apiUrl = 'http://localhost:3001';

type View = 'home' | 'logins' | 'purchases' | 'funnel' | 'abandoned' | 'intent';

interface Patient {
  email: string;
  allowance: number;
  login_time: string;
  hasPurchased?: boolean;
  hasUnpaid?: boolean;
  last_order_at?: string;
  order_count?: number;
  tp_date?: string;
}

interface Purchase {
  number: string;
  email: string;
  total: number;
  currency: string;
  status: string;
  payment_status: string;
  purchase_time: string;
}

interface FunnelEvent {
  email: string;
  viewed_product: boolean;
  added_to_cart: boolean;
  removed_from_cart: boolean;
  checkout: boolean;
  login_time: string;
}

function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [loginTab, setLoginTab] = useState<'all' | 'allowance'>('allowance');
  const [recoveryTab, setRecoveryTab] = useState<'all' | 'allowance'>('all');
  const [purchaseTab, setPurchaseTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'purchase_time', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [chartMetric, setChartMetric] = useState<'traffic' | 'gross'>('traffic');
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedZohoPatient, setSelectedZohoPatient] = useState<any>(null);
  const [loadingZoho, setLoadingZoho] = useState(false);
  const [yesterdayTotal, setYesterdayTotal] = useState<number | null>(null);
  const [yesterdayData, setYesterdayData] = useState<any[]>([]);
  const [historicalDistribution, setHistoricalDistribution] = useState<any[]>([]);
  const [dataCache, setDataCache] = useState<Record<string, any>>({});

  // Customer details state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [unfulfilledModalEmails, setUnfulfilledModalEmails] = useState<string[]>([]);
  const [isUnfulfilledModalOpen, setIsUnfulfilledModalOpen] = useState(false);

  const fetchData = async (view: View, targetDate: string, currentLoginTab: 'all' | 'allowance', currentRecoveryTab: 'all' | 'allowance') => {
    if (view === 'home') return;

    const cacheKey = `${view}-${targetDate}-${currentLoginTab}-${currentRecoveryTab}`;

    // If we have cached data, show it immediately
    if (dataCache[cacheKey]) {
      setData(dataCache[cacheKey].data);
      if (view === 'purchases') {
        setYesterdayData(dataCache[cacheKey].yesterdayData || []);
        setYesterdayTotal(dataCache[cacheKey].yesterdayTotal || 0);
        setHistoricalDistribution(dataCache[cacheKey].historicalDistribution || []);
      }
      // We skip the loading spinner for cached views
    } else {
      setLoading(true);
    }

    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      let endpoint = '';
      let params = `date=${targetDate}`;

      let finalData = [];
      let yData = [];
      let yTotal = 0;
      let historyDistributionData = [];

      if (view === 'logins') {
        endpoint = 'patients';
        if (currentLoginTab === 'allowance') {
          params += '&withAllowance=true';
        }

        const [patientsRes, purchasesRes] = await Promise.all([
          axios.get(`${apiUrl}/api/patients?${params}`),
          axios.get(`${apiUrl}/api/purchases?date=${targetDate}`)
        ]);

        const purchases = purchasesRes.data;
        const paidEmails = new Set();
        const pendingEmails = new Set();

        purchases.forEach((p: any) => {
          const email = p.email?.toLowerCase().trim();
          if (!email) return;
          if (p.payment_status === 'FULLY_CHARGED') {
            paidEmails.add(email);
          } else {
            pendingEmails.add(email);
          }
        });

        finalData = patientsRes.data.map((patient: any) => {
          const patientEmail = patient.email.toLowerCase().replace('[at]', '@').trim();
          return {
            ...patient,
            hasPurchased: paidEmails.has(patientEmail),
            hasUnpaid: pendingEmails.has(patientEmail) && !paidEmails.has(patientEmail)
          };
        });
      } else if (view === 'funnel') {
        endpoint = 'funnel';
        const response = await axios.get(`${apiUrl}/api/${endpoint}?${params}`);
        finalData = response.data;
      } else if (view === 'abandoned') {
        endpoint = 'abandoned-carts';
        if (currentRecoveryTab === 'allowance') {
          params += '&withAllowance=true';
        }
        const response = await axios.get(`${apiUrl}/api/${endpoint}?${params}`);
        finalData = response.data;
      } else if (view === 'intent') {
        endpoint = 'daily-intent-audit';
        const targetDateObj = new Date(`${targetDate}T12:00:00Z`);
        const promises = [];
        for (let i = 0; i < 28; i++) {
          const d = format(subDays(targetDateObj, i), 'yyyy-MM-dd');
          promises.push(
            axios.get(`${apiUrl}/api/${endpoint}?date=${d}`)
              .then(res => res.data)
              .catch(() => null)
          );
        }
        const results = await Promise.all(promises);
        finalData = results.filter(r => r !== null);
      } else {
        endpoint = 'purchases';
        const [todayRes, yesterdayRes, historyRes] = await Promise.all([
          axios.get(`${apiUrl}/api/${endpoint}?${params}`),
          axios.get(`${apiUrl}/api/${endpoint}?date=${format(subDays(new Date(targetDate), 1), 'yyyy-MM-dd')}`),
          axios.get(`${apiUrl}/api/${endpoint}/history?date=${targetDate}`)
        ]);

        finalData = todayRes.data;
        yData = yesterdayRes.data;
        yTotal = yesterdayRes.data
          .filter((i: any) => i.payment_status === 'FULLY_CHARGED')
          .reduce((acc: number, i: any) => acc + Number(i.total), 0);

        setYesterdayData(yData);
        setYesterdayTotal(yTotal);
        historyDistributionData = historyRes.data;
        setHistoricalDistribution(historyDistributionData);

        // Use history data to also update yesterdayTotal if needed, but let's keep current logic for now
      }

      setData(finalData);

      // Update cache
      setDataCache(prev => ({
        ...prev,
        [cacheKey]: {
          data: finalData,
          yesterdayData: yData,
          yesterdayTotal: yTotal,
          historicalDistribution: historyDistributionData,
          timestamp: Date.now()
        }
      }));

      setSortConfig({ key: view === 'logins' ? 'login_time' : 'purchase_time', direction: 'desc' });
    } catch (err) {
      console.error(`Error fetching ${view}:`, err);
      setError(`Failed to fetch ${view}. Please check if the API is running.`);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = React.useMemo(() => {
    let result = [...data];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.email.toLowerCase().includes(query) ||
        (item.number && item.number.toString().includes(query))
      );
    }

    // Purchase specific filter
    if (activeView === 'purchases' && purchaseTab !== 'all') {
      const paidEmails = new Set(data.filter(i => i.payment_status === 'FULLY_CHARGED').map(i => i.email));
      if (purchaseTab === 'paid') {
        result = result.filter(item => item.payment_status === 'FULLY_CHARGED');
      } else {
        result = result.filter(item => item.payment_status !== 'FULLY_CHARGED' && !paidEmails.has(item.email));
      }
    }

    // Sort filter
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return result;
  }, [data, sortConfig, searchQuery, purchaseTab, activeView]);

  const intentMetrics = React.useMemo(() => {
    if (activeView !== 'intent' || data.length === 0) return null;

    // data is already sorted by date desc
    const today = data[0];
    const last7Days = data.slice(0, 7);
    const last28Days = data;

    const calcNonConv = (items: any[]) => {
      const loginsWithAllowance = items.reduce((acc, item) => acc + (item.total_logins_with_allowance || 0), 0);
      const didNotBuy = items.reduce((acc, item) => acc + (item.did_not_buy || 0), 0);
      return loginsWithAllowance > 0 ? Math.round((didNotBuy / loginsWithAllowance) * 100) : 0;
    };

    return {
      t24h: today.non_conversion_percent,
      t7d: calcNonConv(last7Days),
      t28d: calcNonConv(last28Days)
    };
  }, [data, activeView]);

  const handleZohoClick = async (email: string) => {
    setLoadingZoho(true);
    setIsZohoModalOpen(true);
    setSelectedZohoPatient(null);
    try {
      const cleanEmail = email.includes('[at]') ? email.replace('[at]', '@') : email;
      const response = await axios.get(`${apiUrl}/api/zoho-patient/${cleanEmail}?date=${date}`);
      setSelectedZohoPatient(response.data);
    } catch (err) {
      console.error('Error fetching Zoho details:', err);
    } finally {
      setLoadingZoho(false);
    }
  };

  const handleCustomerClick = async (email: string) => {
    setLoadingCustomer(true);
    setIsCustomerModalOpen(true);
    setSelectedCustomer(null);
    try {
      // Handle the [at] masking if present
      const cleanEmail = email.includes('[at]') ? email.replace('[at]', '@') : email;
      const response = await axios.get(`${apiUrl}/api/customer/${cleanEmail}`);
      setSelectedCustomer(response.data);
    } catch (err) {
      console.error('Error fetching customer details:', err);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;

    const headers = activeView === 'logins'
      ? ['Email', 'Allowance Remaining', '# of Orders', 'Last Order', 'TP Date', 'Login Time', 'Purchased Today']
      : activeView === 'funnel'
        ? ['Email', 'Viewed Product', 'Added to Cart', 'Removed from Cart', 'Checkout', 'Last Activity']
        : activeView === 'abandoned'
          ? ['Email', 'Allowance Remaining', 'Cart Created (Sydney)']
          : activeView === 'intent'
            ? ['Date', 'Total Logins', 'Logins With Allowance', 'Total Orders', 'Did Not Buy', 'Non-Conversion %', 'Unfulfilled Lookups']
            : ['Order Number', 'Email', 'Total', 'Currency', 'Status', 'Purchase Time'];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => {
        if (activeView === 'logins') {
          return [
            item.email,
            item.allowance,
            item.order_count || 0,
            item.last_order_at ? format(new Date(item.last_order_at), 'yyyy-MM-dd') : 'N/A',
            item.tp_date ? format(new Date(item.tp_date), 'yyyy-MM-dd') : 'N/A',
            format(new Date(item.login_time), 'yyyy-MM-dd HH:mm:ss'),
            item.hasPurchased ? 'YES' : 'NO'
          ].join(',');
        } else if (activeView === 'funnel') {
          return [
            item.email,
            item.viewed_product ? 'YES' : 'NO',
            item.added_to_cart ? 'YES' : 'NO',
            item.removed_from_cart ? 'YES' : 'NO',
            item.checkout ? 'YES' : 'NO',
            format(new Date(item.login_time), 'yyyy-MM-dd HH:mm:ss')
          ].join(',');
        } else if (activeView === 'abandoned') {
          return [
            item.email,
            item.days_allowance_remaining,
            format(new Date(item.cart_created_sydney), 'yyyy-MM-dd HH:mm:ss')
          ].join(',');
        } else if (activeView === 'intent') {
          return [
            item.date,
            item.total_logins,
            item.total_logins_with_allowance,
            item.total_orders,
            item.did_not_buy,
            item.non_conversion_percent,
            item.logins_with_unfulfilled_orders
          ].join(',');
        } else {
          return [
            item.number,
            item.email,
            item.total,
            item.currency,
            item.status,
            format(new Date(item.purchase_time), 'yyyy-MM-dd HH:mm:ss')
          ].join(',');
        }
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeView}_audit_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDate(e.target.value);
  };

  const enterView = (view: View) => {
    setActiveView(view);
    setDate(view === 'intent' ? format(subDays(new Date(), 1), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  };

  const renderHome = () => (
    <div className="space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Audit Dashboard</h2>
        <p className="text-slate-500">Select a module to begin auditing shop activity</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {/* Login Audit Card */}
        <Card
          className="group cursor-pointer border-2 border-transparent hover:border-primary/20 transition-all hover:shadow-xl bg-white"
          onClick={() => enterView('logins')}
        >
          <CardHeader className="space-y-1">
            <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <User size={28} />
            </div>
            <CardTitle className="text-xl">Login Audit</CardTitle>
            <CardDescription>Track patients logging in with active supply allowances.</CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="flex items-center text-sm font-medium text-primary">
              View Logins <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card>

        {/* Purchase Audit Card */}
        <Card
          className="group cursor-pointer border-2 border-transparent hover:border-primary/20 transition-all hover:shadow-xl bg-white"
          onClick={() => enterView('purchases')}
        >
          <CardHeader className="space-y-1">
            <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShoppingCart size={28} />
            </div>
            <CardTitle className="text-xl">Purchase Audit</CardTitle>
            <CardDescription>Monitor recent shop orders and fulfillment status from Saleor.</CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="flex items-center text-sm font-medium text-primary">
              View Purchases <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card>

        {/* Shop Funnel Audit Card */}
        <Card
          className="group cursor-pointer border-2 border-transparent hover:border-primary/20 transition-all hover:shadow-xl bg-white"
          onClick={() => enterView('funnel')}
        >
          <CardHeader className="space-y-1">
            <div className="h-12 w-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Activity size={28} />
            </div>
            <CardTitle className="text-xl">Funnel Audit</CardTitle>
            <CardDescription>Visualize the customer journey from product view to checkout.</CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="flex items-center text-sm font-medium text-primary">
              View Funnel <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card>

        {/* Recovery Audit (Abandoned Carts) */}
        <Card
          className="group cursor-pointer border-2 border-transparent hover:border-orange-500/20 transition-all hover:shadow-xl bg-white"
          onClick={() => enterView('abandoned')}
        >
          <CardHeader className="space-y-1">
            <div className="h-12 w-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <TrendingUp size={28} />
            </div>
            <CardTitle className="text-xl text-orange-700">Recovery Audit</CardTitle>
            <CardDescription>Identify users with abandoned carts for recovery actions.</CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="flex items-center text-sm font-medium text-orange-600">
              Identify Lost Carts <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card>

        {/* Order Intent Audit */}
        {/* <Card 
          className="group cursor-pointer border-2 border-transparent hover:border-purple-500/20 transition-all hover:shadow-xl bg-white"
          onClick={() => enterView('intent')}
        >
          <CardHeader className="space-y-1">
            <div className="h-12 w-12 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Eye size={28} />
            </div>
            <CardTitle className="text-xl text-purple-700">Order Intent Audit</CardTitle>
            <CardDescription>Track if users logged in to check on an unfulfilled order vs buying.</CardDescription>
          </CardHeader>
          <CardFooter>
            <div className="flex items-center text-sm font-medium text-purple-600">
              View Order Intent <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card> */}
      </div>

      {/* Quick Stats Summary */}
      <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto opacity-70">
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm">
          <TrendingUp className="text-slate-400" />
          <div className="text-sm">
            <p className="text-slate-500 font-medium">Daily Active Users</p>
            <p className="text-lg font-bold">Syncing...</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm">
          <CreditCard className="text-slate-400" />
          <div className="text-sm">
            <p className="text-slate-500 font-medium">Revenue Today</p>
            <p className="text-lg font-bold">Encrypted</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm">
          <Database className="text-slate-400" />
          <div className="text-sm">
            <p className="text-slate-500 font-medium">Gateway Status</p>
            <p className="text-lg font-bold text-emerald-600">Connected</p>
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    fetchData(activeView, date, loginTab, recoveryTab);
  }, [activeView, date, loginTab, recoveryTab]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="ml-1 text-primary" />
      : <ArrowDown size={14} className="ml-1 text-primary" />;
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';

      // Ensure strings like "2026-05-12 14:30:00" are treated as UTC by the browser
      let normalizedDateStr = dateStr;
      if (typeof dateStr === 'string' && !dateStr.includes('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
        normalizedDateStr = dateStr.replace(' ', 'T') + 'Z';
      }

      const dateObj = new Date(normalizedDateStr);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';

      return new Intl.DateTimeFormat('en-AU', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Australia/Sydney'
      }).format(dateObj);
    } catch (e) {
      return 'Error';
    }
  };

  const renderLoginsTable = () => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/30">
          <TableHead
            className="w-[350px] cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Patient Email <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead>Allowance Interval</TableHead>
          <TableHead
            className="text-center cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('order_count')}
          >
            <div className="flex items-center justify-center">
              # of Orders <SortIcon columnKey="order_count" />
            </div>
          </TableHead>
          <TableHead
            className="text-center cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('last_order_at')}
          >
            <div className="flex items-center justify-center">
              Last Order <SortIcon columnKey="last_order_at" />
            </div>
          </TableHead>
          <TableHead
            className="text-center cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('tp_date')}
          >
            <div className="flex items-center justify-center">
              TP Date <SortIcon columnKey="tp_date" />
            </div>
          </TableHead>
          <TableHead
            className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('login_time')}
          >
            <div className="flex items-center justify-end">
              Login Time (AEST/AEDT) <SortIcon columnKey="login_time" />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredData.map((patient: Patient, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell
              className="font-mono text-sm text-primary font-medium cursor-pointer hover:underline"
              onClick={() => handleZohoClick(patient.email)}
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <User size={14} />
                </div>
                <div className="flex flex-col">
                  <span>{patient.email}</span>
                  {patient.hasPurchased && (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 w-fit mt-1">
                      <ShoppingCart size={10} className="mr-1" />
                      PURCHASED TODAY
                    </span>
                  )}
                  {patient.hasUnpaid && (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 w-fit mt-1">
                      <CreditCard size={10} className="mr-1" />
                      UNPAID
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 transition-colors">
                <Database size={10} className="mr-1.5" />
                {patient.allowance} remaining
              </div>
            </TableCell>
            <TableCell className="text-center">
              <span className="font-bold text-slate-700">{patient.order_count || 0}</span>
            </TableCell>
            <TableCell className="text-center">
              {patient.last_order_at ? (
                <div className="flex flex-col items-center">
                  <span className="text-sm font-medium text-slate-700 font-mono">
                    {format(new Date(patient.last_order_at), 'dd MMM yyyy')}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-medium">
                    {formatDistanceToNow(new Date(patient.last_order_at), { addSuffix: true })}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic font-medium">No Orders</span>
              )}
            </TableCell>
            <TableCell className="text-center font-mono text-sm text-slate-500">
              {patient.tp_date ? (
                format(new Date(patient.tp_date), 'dd MMM yyyy')
              ) : (
                <span className="text-slate-300 italic text-[10px]">No TP Found</span>
              )}
            </TableCell>
            <TableCell className="text-right font-mono text-sm text-slate-500">
              {safeFormatDate(patient.login_time)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderPurchasesTable = () => (
    <Table>
      <TableHeader>
        <TableRow className="bg-slate-50/30">
          <TableHead
            className="w-[120px] cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('number')}
          >
            <div className="flex items-center">
              Order # <SortIcon columnKey="number" />
            </div>
          </TableHead>
          <TableHead
            className="w-[280px] cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('email')}
          >
            <div className="flex items-center">
              Customer Email <SortIcon columnKey="email" />
            </div>
          </TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Status</TableHead>
          <TableHead
            className="text-right cursor-pointer hover:bg-slate-100 transition-colors"
            onClick={() => requestSort('purchase_time')}
          >
            <div className="flex items-center justify-end">
              Order Date (AEST/AEDT) <SortIcon columnKey="purchase_time" />
            </div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredData.map((purchase: Purchase, index) => (
          <TableRow key={index} className="group transition-colors">
            <TableCell className="font-mono text-sm font-bold text-slate-900">
              #{purchase.number}
            </TableCell>
            <TableCell
              className="font-mono text-sm text-primary font-medium cursor-pointer hover:underline"
              onClick={() => handleCustomerClick(purchase.email)}
            >
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                  <ShoppingCart size={14} />
                </div>
                {purchase.email}
              </div>
            </TableCell>
            <TableCell>
              <span className="font-bold">
                {purchase.currency} ${Number(purchase.total).toFixed(2)}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <div className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors w-fit",
                  purchase.payment_status === 'FULLY_CHARGED' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                )}>
                  {purchase.payment_status === 'FULLY_CHARGED' ? 'PAID' : 'UNPAID'}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium uppercase px-1">
                  {purchase.status}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {safeFormatDate(purchase.purchase_time)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderFunnelTable = () => (
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
        {filteredData.map((event: FunnelEvent, index) => (
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

  const renderAbandonedTable = () => (
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
        {filteredData.map((item, index) => (
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

  const renderIntentTable = () => (
    <div className="space-y-6">
      {intentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/50 border-b">
          {/* Metric Card 24H */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Non-Conversion (Today)</p>
              <p className="text-2xl font-black text-slate-900">{intentMetrics.t24h}%</p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              intentMetrics.t24h > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            )}>
              <Activity size={20} />
            </div>
          </div>

          {/* Metric Card 7D */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Non-Conversion (7D)</p>
              <p className="text-2xl font-black text-slate-900">{intentMetrics.t7d}%</p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              intentMetrics.t7d > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
            )}>
              <Activity size={20} />
            </div>
          </div>

          {/* Metric Card 28D */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Avg Non-Conversion (28D)</p>
              <p className="text-2xl font-black text-slate-900">{intentMetrics.t28d}%</p>
            </div>
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              intentMetrics.t28d > 70 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
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
            {filteredData.map((item, index) => (
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
                    onClick={() => {
                      setUnfulfilledModalEmails(item.unfulfilled_lookups_emails || []);
                      setIsUnfulfilledModalOpen(true);
                    }}
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

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans selection:bg-primary/10">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Navigation / Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {activeView !== 'home' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveView('home')}
                className="rounded-full hover:bg-white shadow-sm mr-2"
              >
                <ArrowLeft size={20} />
              </Button>
            )}
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
              {activeView === 'purchases' ? <ShoppingCart size={24} /> : activeView === 'funnel' ? <TrendingUp size={24} /> : activeView === 'abandoned' ? <Database size={24} className="text-orange-200" /> : activeView === 'intent' ? <Eye size={24} className="text-purple-200" /> : <LayoutDashboard size={24} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {activeView === 'home' ? 'Shop Audit' : activeView === 'logins' ? 'Login Audit' : activeView === 'purchases' ? 'Purchase Audit' : activeView === 'funnel' ? 'Shop Funnel Audit' : activeView === 'intent' ? 'Order Intent Audit' : 'Recovery Audit'}
              </h1>
              {activeView !== 'home' && (
                <p className="text-sm text-muted-foreground">
                  Diving deep into {activeView} records
                </p>
              )}
            </div>
          </div>

          {activeView !== 'home' && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  max={activeView === 'intent' ? format(subDays(new Date(), 1), 'yyyy-MM-dd') : undefined}
                  onChange={handleDateChange}
                  className="pl-9 w-[180px] bg-white shadow-sm border-slate-200"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fetchData(activeView, date, loginTab, recoveryTab)}
                className={cn("bg-white shadow-sm border-slate-200", loading && "animate-spin")}
              >
                <RefreshCw size={18} />
              </Button>
            </div>
          )}
        </div>

        {/* Content Area */}
        {activeView === 'home' ? (
          renderHome()
        ) : (
          <div className="space-y-6">
            {activeView === 'funnel' && !loading && (
              <div className="grid gap-4 md:grid-cols-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <Card className="bg-white border-orange-100 shadow-sm overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Activity size={48} className="text-orange-600" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardDescription className="text-orange-600 font-bold text-[10px] uppercase tracking-wider">Currently in Shop</CardDescription>
                    <CardTitle className="text-3xl font-black text-slate-900 flex items-center gap-2">
                      {Math.floor(Math.random() * 12) + 4}
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border-blue-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-blue-600 font-bold text-[10px] uppercase tracking-wider">Product Views</CardDescription>
                    <CardTitle className="text-3xl font-black text-slate-900">
                      {data.filter(i => i.viewed_product).length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border-emerald-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-emerald-600 font-bold text-[10px] uppercase tracking-wider">Add to Carts</CardDescription>
                    <CardTitle className="text-3xl font-black text-slate-900">
                      {data.filter(i => i.added_to_cart).length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-white border-purple-100 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="text-purple-600 font-bold text-[10px] uppercase tracking-wider">Checkouts</CardDescription>
                    <CardTitle className="text-3xl font-black text-slate-900">
                      {data.filter(i => i.checkout).length}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>
            )}

            {activeView === 'purchases' && !loading && data.length > 0 && (() => {
              const paidItems = data.filter(i => i.payment_status === 'FULLY_CHARGED');
              const paidEmails = new Set(paidItems.map(i => i.email));
              const totalPaid = paidItems.reduce((acc, i) => acc + Number(i.total), 0);
              const totalUnpaid = data.filter(i => i.payment_status !== 'FULLY_CHARGED' && !paidEmails.has(i.email)).reduce((acc, i) => acc + Number(i.total), 0);

              const avgOrderValue = paidItems.length > 0 ? totalPaid / paidItems.length : 0;
              let yesterdayAov = null;
              if (yesterdayTotal !== null && yesterdayData && yesterdayData.length > 0) {
                const yPaidCount = yesterdayData.filter((i: any) => i.payment_status === 'FULLY_CHARGED').length;
                yesterdayAov = yPaidCount > 0 ? yesterdayTotal / yPaidCount : 0;
              }

              return (
                <div className="grid gap-4 md:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-500">
                  <Card className="bg-white border-emerald-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-emerald-600 font-bold text-xs uppercase tracking-wider">Total Fully Paid</CardDescription>
                      <CardTitle className="text-3xl font-black text-slate-900">
                        AUD ${totalPaid.toFixed(2)}
                      </CardTitle>
                      {yesterdayTotal !== null && (
                        <div className="flex items-center mt-1">
                          <div className={cn(
                            "flex items-center text-xs font-bold px-2 py-0.5 rounded",
                            totalPaid >= yesterdayTotal ? "text-emerald-600 bg-emerald-50" : "text-red-600 bg-red-50"
                          )}>
                            {totalPaid >= yesterdayTotal ? <ArrowUp size={12} className="mr-0.5" /> : <ArrowDown size={12} className="mr-0.5" />}
                            ${Math.abs(totalPaid - yesterdayTotal).toFixed(2)}
                          </div>
                          <span className="text-xs text-slate-400 ml-1.5 font-medium">vs yesterday</span>
                        </div>
                      )}
                    </CardHeader>
                  </Card>

                  <Card className="bg-white border-blue-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-blue-600 font-bold text-xs uppercase tracking-wider">Avg Order Value</CardDescription>
                      <CardTitle className="text-3xl font-black text-slate-900">
                        AUD ${avgOrderValue.toFixed(2)}
                      </CardTitle>
                      {yesterdayAov !== null && (
                        <div className="flex items-center mt-1">
                          <div className={cn(
                            "flex items-center text-xs font-bold px-2 py-0.5 rounded",
                            avgOrderValue >= yesterdayAov ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"
                          )}>
                            {avgOrderValue >= yesterdayAov ? <ArrowUp size={12} className="mr-0.5" /> : <ArrowDown size={12} className="mr-0.5" />}
                            ${Math.abs(avgOrderValue - yesterdayAov).toFixed(2)}
                          </div>
                          <span className="text-xs text-slate-400 ml-1.5 font-medium">vs yesterday</span>
                        </div>
                      )}
                    </CardHeader>
                  </Card>

                  <Card className="bg-white border-red-100 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardDescription className="text-red-600 font-bold text-xs uppercase tracking-wider">True Unpaid / Pending</CardDescription>
                      <CardTitle className="text-3xl font-black text-slate-900">
                        AUD ${totalUnpaid.toFixed(2)}
                      </CardTitle>
                      <CardDescription className="text-xs">Excludes users who successfully paid later</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              );
            })()}

            {!loading && data.length > 0 && activeView === 'purchases' && (
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-3 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        {chartMetric === 'traffic' ? 'Traffic Frequency' : 'Gross Revenue Distribution'}
                      </CardTitle>
                      <CardDescription className="text-[10px]">Comparing hourly {chartMetric === 'traffic' ? 'volume' : 'revenue'} vs yesterday</CardDescription>
                    </div>
                    <div className="flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
                      <Button
                        variant={chartMetric === 'traffic' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn("h-6 text-[10px] px-2 rounded-sm", chartMetric === 'traffic' ? "bg-white text-primary shadow-sm hover:bg-white" : "text-slate-500 hover:text-slate-900")}
                        onClick={() => setChartMetric('traffic')}
                      >
                        Traffic
                      </Button>
                      <Button
                        variant={chartMetric === 'gross' ? 'default' : 'ghost'}
                        size="sm"
                        className={cn("h-6 text-[10px] px-2 rounded-sm", chartMetric === 'gross' ? "bg-white text-primary shadow-sm hover:bg-white" : "text-slate-500 hover:text-slate-900")}
                        onClick={() => setChartMetric('gross')}
                      >
                        Gross ($)
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[200px] pt-4">
                    {(() => {
                      const timeKey = activeView === 'logins' ? 'login_time' : 'purchase_time';
                      // Helper to get hour in Sydney timezone
                      const getSydneyHour = (dateStr: string) => {
                        try {
                          const date = new Date(dateStr);
                          const hourStr = new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            hour12: false,
                            timeZone: 'Australia/Sydney'
                          }).format(date);
                          return parseInt(hourStr) % 24;
                        } catch (e) {
                          return NaN;
                        }
                      };

                      let chartData = Array.from({ length: 24 }, (_, i) => ({
                        hour: `${i}:00`,
                        today: 0,
                        yesterday: 0,
                        avg7d: 0,
                        avg28d: 0
                      }));

                      if (chartMetric === 'gross' && historicalDistribution.length > 0) {
                        // Use pre-calculated distribution for Gross metric
                        chartData = historicalDistribution.map(item => ({
                          ...item
                        }));
                      } else {
                        // Process Traffic or fallback for Gross
                        data.forEach(item => {
                          const hour = getSydneyHour(item[timeKey]);
                          if (!isNaN(hour) && chartData[hour]) {
                            if (chartMetric === 'traffic') {
                              chartData[hour].today++;
                            } else if (item.payment_status === 'FULLY_CHARGED') {
                              chartData[hour].today += Number(item.total);
                            }
                          }
                        });

                        if (activeView === 'purchases') {
                          yesterdayData.forEach(item => {
                            const hour = getSydneyHour(item[timeKey]);
                            if (!isNaN(hour) && chartData[hour]) {
                              if (chartMetric === 'traffic') {
                                chartData[hour].yesterday++;
                              } else if (item.payment_status === 'FULLY_CHARGED') {
                                chartData[hour].yesterday += Number(item.total);
                              }
                            }
                          });
                        }
                      }

                      // Convert to Cumulative for Gross metric
                      if (chartMetric === 'gross') {
                        let tTotal = 0, yTotal = 0, sTotal = 0, twTotal = 0;
                        chartData.forEach(item => {
                          tTotal += item.today;
                          yTotal += item.yesterday;
                          sTotal += item.avg7d || 0;
                          twTotal += item.avg28d || 0;
                          item.today = tTotal;
                          item.yesterday = yTotal;
                          item.avg7d = sTotal;
                          item.avg28d = twTotal;
                        });
                      }

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorYesterday" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
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
                    })()}
                  </CardContent>
                </Card>

              </div>
            )}

            <Card className="bg-white border-slate-200 shadow-xl overflow-hidden border-0 animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {activeView === 'logins' ? <User className="h-5 w-5 text-primary" /> : activeView === 'funnel' ? <TrendingUp className="h-5 w-5 text-orange-600" /> : activeView === 'abandoned' ? <ShoppingCart className="h-5 w-5 text-orange-600" /> : activeView === 'intent' ? <Eye className="h-5 w-5 text-purple-600" /> : <ShoppingCart className="h-5 w-5 text-emerald-600" />}
                      {activeView === 'logins' ? 'Login Audit Trail' : activeView === 'funnel' ? 'Customer Funnel Activity' : activeView === 'abandoned' ? 'Abandoned Cart Recovery' : activeView === 'intent' ? 'Order Intent Statistics' : 'Purchase Audit Trail'}
                      {!loading && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                          {filteredData.length} records
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {activeView === 'logins'
                        ? 'Real-time patient login activity and supply tracking'
                        : activeView === 'funnel'
                          ? 'End-to-end customer journey tracking from product view to checkout'
                          : activeView === 'abandoned'
                            ? 'List of users who started a cart but did not complete the purchase'
                            : activeView === 'intent'
                              ? 'Aggregated analysis of daily login intent and conversion drops due to unfulfilled orders'
                              : 'Recent customer purchases and order statuses from the production DB'}
                    </CardDescription>
                  </div>
                  {activeView === 'logins' ? (
                    <div className="flex p-1 bg-slate-200/50 rounded-lg w-fit">
                      <Button
                        variant={loginTab === 'allowance' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setLoginTab('allowance')}
                        className="text-xs h-8 px-3"
                      >
                        With Allowance
                      </Button>
                      <Button
                        variant={loginTab === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setLoginTab('all')}
                        className="text-xs h-8 px-3"
                      >
                        All Logins
                      </Button>
                    </div>
                  ) : activeView === 'abandoned' ? (
                    <div className="flex p-1 bg-slate-200/50 rounded-lg w-fit">
                      <Button
                        variant={recoveryTab === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRecoveryTab('all')}
                        className="text-xs h-8 px-3"
                      >
                        All
                      </Button>
                      <Button
                        variant={recoveryTab === 'allowance' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setRecoveryTab('allowance')}
                        className="text-xs h-8 px-3"
                      >
                        With Allowance
                      </Button>
                    </div>
                  ) : activeView === 'purchases' ? (
                    <div className="flex p-1 bg-slate-200/50 rounded-lg w-fit">
                      <Button
                        variant={purchaseTab === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPurchaseTab('all')}
                        className="text-xs h-8 px-3"
                      >
                        All
                      </Button>
                      <Button
                        variant={purchaseTab === 'paid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPurchaseTab('paid')}
                        className="text-xs h-8 px-3"
                      >
                        Fully Paid
                      </Button>
                      <Button
                        variant={purchaseTab === 'unpaid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPurchaseTab('unpaid')}
                        className="text-xs h-8 px-3"
                      >
                        Unpaid
                      </Button>
                    </div>
                  ) : null}
                  <div className="hidden md:flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-[250px] bg-white h-9 border-slate-200"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={filteredData.length === 0 || loading}
                      className="h-9 bg-white shadow-sm border-slate-200"
                    >
                      <Download size={16} className="mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Syncing real-time records...</p>
                  </div>
                ) : data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                    <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                      <Search size={32} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-900 font-bold">No records found</p>
                      <p className="text-sm text-slate-500 max-w-xs">Try selecting a different date or checking your connection.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {activeView === 'logins' ? renderLoginsTable() : activeView === 'funnel' ? renderFunnelTable() : activeView === 'abandoned' ? renderAbandonedTable() : activeView === 'intent' ? renderIntentTable() : renderPurchasesTable()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-center text-xs text-muted-foreground pb-8">
          <p>© {new Date().getFullYear()} Shop Auditing System • Australia/Sydney Timezone • Production Sync Active</p>
        </div>
      </div>

      {/* Customer Details Modal */}
      <Dialog open={isCustomerModalOpen} onOpenChange={setIsCustomerModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-3">
              {activeView === 'logins' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[10px] gap-1 font-bold border-slate-200 hover:bg-slate-50 hover:text-primary transition-all shadow-sm mr-1"
                  onClick={() => {
                    setIsCustomerModalOpen(false);
                    handleZohoClick(selectedCustomer?.email || '');
                  }}
                >
                  <ArrowLeft size={10} />
                  BACK
                </Button>
              )}
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Customer Profile
              </div>
            </DialogTitle>
            <DialogDescription>
              Viewing purchase history and account details for this patient.
            </DialogDescription>
          </DialogHeader>

          {loadingCustomer ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Retrieving Saleor profile...</p>
            </div>
          ) : selectedCustomer ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Name</p>
                  <p className="font-medium text-slate-900">{selectedCustomer.name}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{selectedCustomer.email}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-slate-400" />
                  Recent Order History
                </h3>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="h-9 text-xs">Order #</TableHead>
                        <TableHead className="h-9 text-xs">Date</TableHead>
                        <TableHead className="h-9 text-xs">Total</TableHead>
                        <TableHead className="h-9 text-xs">Payment</TableHead>
                        <TableHead className="h-9 text-xs text-right">Fulfillment Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.history.length > 0 ? (
                        selectedCustomer.history.map((order: any, idx: number) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="font-bold">#{order.number}</TableCell>
                            <TableCell>{safeFormatDate(order.date)}</TableCell>
                            <TableCell>{order.currency} {order.total.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                order.payment_status === 'FULLY_CHARGED' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                              )}>
                                {order.payment_status === 'FULLY_CHARGED' ? 'Paid' : 'Unpaid'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-600">
                              {order.status.replace(/_/g, ' ')}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No past orders found in Saleor.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-destructive">Could not find profile details for this email.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Unfulfilled Lookups Modal */}
      <Dialog open={isUnfulfilledModalOpen} onOpenChange={setIsUnfulfilledModalOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2 text-purple-700">
              <Eye className="h-5 w-5" />
              Unfulfilled Lookups
            </DialogTitle>
            <DialogDescription>
              Patients who logged in while having an order placed in the last 7 days that is not yet fulfilled.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-4">
            {unfulfilledModalEmails.length > 0 ? (
              unfulfilledModalEmails.map((email, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                      <User size={14} />
                    </div>
                    <span className="font-mono text-sm text-slate-700">{email}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 italic">
                No unfulfilled lookups found for this date.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Zoho Patient Details Modal */}
      <Dialog open={isZohoModalOpen} onOpenChange={setIsZohoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Database className="h-5 w-5 text-orange-600" />
              Zoho Patient Insight
            </DialogTitle>
            <DialogDescription>
              Direct sync with Zoho CRM profile and session recordings.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            {loadingZoho ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-orange-500/40" />
                <p className="text-sm text-muted-foreground">Searching systems...</p>
              </div>
            ) : selectedZohoPatient ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 h-full">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Full Name</p>
                          <p className="font-bold text-slate-900 text-lg leading-tight">{selectedZohoPatient.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Email Address</p>
                          <p className="font-medium text-slate-700 break-all">{selectedZohoPatient.email}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-500">Phone</p>
                          <p className="font-medium text-slate-700">{selectedZohoPatient.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      asChild
                      className="w-full h-12 bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-lg shadow-orange-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <a href={selectedZohoPatient.zohoUrl} target="_blank" rel="noopener noreferrer">
                        VIEW IN ZOHO CRM
                      </a>
                    </Button>

                    <Button
                      onClick={() => {
                        setIsZohoModalOpen(false);
                        handleCustomerClick(selectedZohoPatient.email);
                      }}
                      className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      VIEW FULL ORDER HISTORY
                    </Button>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 break-all">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Direct CRM Link</p>
                      <p className="text-[10px] font-mono text-slate-600 select-all leading-relaxed">
                        {selectedZohoPatient.zohoUrl || 'Link not available'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-500" />
                    PostHog Session Replays ({date})
                  </h3>

                  {selectedZohoPatient.replays && selectedZohoPatient.replays.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedZohoPatient.replays.map((replay: any, idx: number) => (
                        <a
                          key={idx}
                          href={replay.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-4 bg-blue-50/30 rounded-xl border border-blue-100 hover:bg-blue-50 hover:border-blue-200 transition-all group"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-900">
                              {new Date(replay.start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {replay.duration > 0 && (
                              <span className="text-[9px] text-slate-500 uppercase font-bold">
                                Duration: {Math.floor(replay.duration / 60)}m {Math.round(replay.duration % 60)}s
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-blue-600 group-hover:underline">WATCH</div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center">
                      <p className="text-[10px] text-slate-500 italic">No recordings found on this date.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="h-12 w-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <X size={24} />
                </div>
                <p className="text-sm font-bold text-slate-900">Patient Not Found</p>
                <p className="text-xs text-slate-500 mt-1">This email address could not be matched with a contact in Zoho CRM.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
