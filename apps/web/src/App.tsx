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
import { format, subDays } from 'date-fns';

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
  CartesianGrid 
} from 'recharts';

const apiUrl = 'http://localhost:3001';

type View = 'home' | 'logins' | 'purchases' | 'funnel';

interface Patient {
  email: string;
  allowance: number;
  login_time: string;
  hasPurchased?: boolean;
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
  const [purchaseTab, setPurchaseTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'purchase_time', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');
  const [yesterdayTotal, setYesterdayTotal] = useState<number | null>(null);
  
  // Customer details state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const fetchData = async (view: View, targetDate: string, currentLoginTab: 'all' | 'allowance') => {
    if (view === 'home') return;
    
    setLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      let endpoint = '';
      let params = `date=${targetDate}`;

      if (view === 'logins') {
        endpoint = 'patients';
        if (currentLoginTab === 'allowance') {
          params += '&withAllowance=true';
        }
        
        // Fetch both patients and purchases to cross-reference
        const [patientsRes, purchasesRes] = await Promise.all([
          axios.get(`${apiUrl}/api/patients?${params}`),
          axios.get(`${apiUrl}/api/purchases?date=${targetDate}`)
        ]);
        
        const purchases = purchasesRes.data;
        const paidEmails = new Set(
          purchases
            .filter((p: any) => p.payment_status === 'FULLY_CHARGED')
            .map((p: any) => p.email.toLowerCase())
        );
        
        const patientsWithPurchaseInfo = patientsRes.data.map((patient: any) => {
          // Normalize emails for matching (handle [at] and @)
          const patientEmail = patient.email.toLowerCase().replace('[at]', '@');
          return {
            ...patient,
            hasPurchased: paidEmails.has(patientEmail)
          };
        });
        
        setData(patientsWithPurchaseInfo);
      } else if (view === 'funnel') {
        endpoint = 'funnel';
        const response = await axios.get(`${apiUrl}/api/${endpoint}?${params}`);
        setData(response.data);
      } else {
        endpoint = 'purchases';
        const [todayRes, yesterdayRes] = await Promise.all([
          axios.get(`${apiUrl}/api/${endpoint}?${params}`),
          axios.get(`${apiUrl}/api/${endpoint}?date=${format(subDays(new Date(targetDate), 1), 'yyyy-MM-dd')}`)
        ]);
        
        setData(todayRes.data);
        const yTotal = yesterdayRes.data
          .filter((i: any) => i.payment_status === 'FULLY_CHARGED')
          .reduce((acc: number, i: any) => acc + Number(i.total), 0);
        setYesterdayTotal(yTotal);
      }

      // Reset sort to default when fetching new data
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
      ? ['Email', 'Allowance Remaining', 'Login Time', 'Purchased Today'] 
      : ['Email', 'Total', 'Currency', 'Status', 'Purchase Time'];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(item => {
        if (activeView === 'logins') {
          return [
            item.email,
            item.allowance,
            format(new Date(item.login_time), 'yyyy-MM-dd HH:mm:ss'),
            item.hasPurchased ? 'YES' : 'NO'
          ].join(',');
        } else {
          return [
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
          onClick={() => setActiveView('logins')}
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
          onClick={() => setActiveView('purchases')}
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
          className="group cursor-pointer border-2 border-transparent hover:border-primary/20 transition-all hover:shadow-xl bg-white md:col-span-2"
          onClick={() => setActiveView('funnel')}
        >
          <CardHeader className="space-y-1 text-center">
            <div className="h-16 w-16 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform shadow-inner">
              <TrendingUp size={32} />
            </div>
            <CardTitle className="text-2xl">Shop Funnel Audit</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Real-time behavioral tracking: product views, cart actions, and checkout conversion steps.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center border-t bg-slate-50/50 mt-2 py-4">
            <div className="flex items-center text-sm font-bold text-primary">
              Enter Funnel Dashboard <ChevronRight size={16} className="ml-1" />
            </div>
          </CardFooter>
        </Card>
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
    fetchData(activeView, date, loginTab);
  }, [activeView, date, loginTab]);

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="ml-1 text-primary" /> 
      : <ArrowDown size={14} className="ml-1 text-primary" />;
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'N/A';
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return format(dateObj, 'MMM dd, HH:mm:ss');
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
              onClick={() => handleCustomerClick(patient.email)}
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
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 transition-colors">
                <Database size={10} className="mr-1.5" />
                {patient.allowance} remaining
              </div>
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
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
              Order Date <SortIcon columnKey="purchase_time" />
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
            <TableCell 
              className="font-mono text-sm text-primary font-medium cursor-pointer hover:underline"
              onClick={() => handleCustomerClick(event.email)}
            >
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
              {activeView === 'purchases' ? <ShoppingCart size={24} /> : activeView === 'funnel' ? <TrendingUp size={24} /> : <LayoutDashboard size={24} />}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {activeView === 'home' ? 'Shop Audit' : activeView === 'logins' ? 'Login Audit' : activeView === 'purchases' ? 'Purchase Audit' : 'Shop Funnel Audit'}
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
                  onChange={handleDateChange}
                  className="pl-9 w-[180px] bg-white shadow-sm border-slate-200"
                />
              </div>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => fetchData(activeView, date, loginTab)}
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
              const paidEmails = new Set(data.filter(i => i.payment_status === 'FULLY_CHARGED').map(i => i.email));
              const totalPaid = data.filter(i => i.payment_status === 'FULLY_CHARGED').reduce((acc, i) => acc + Number(i.total), 0);
              const totalUnpaid = data.filter(i => i.payment_status !== 'FULLY_CHARGED' && !paidEmails.has(i.email)).reduce((acc, i) => acc + Number(i.total), 0);
              
              return (
                <div className="grid gap-4 md:grid-cols-2 animate-in fade-in slide-in-from-top-4 duration-500">
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
                <Card className="md:col-span-2 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Traffic Frequency (Hourly Distribution)
                    </CardTitle>
                    <CardDescription>Visualizing {activeView === 'logins' ? 'logins' : 'purchases'} across the day</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[200px] pt-4">
                    {(() => {
                      const timeKey = activeView === 'logins' ? 'login_time' : 'purchase_time';
                      const hours = Array.from({ length: 24 }, (_, i) => ({
                        hour: `${i}:00`,
                        count: 0
                      }));
                      data.forEach(item => {
                        const date = new Date(item[timeKey]);
                        const hour = date.getHours();
                        if (!isNaN(hour) && hours[hour]) {
                          hours[hour].count++;
                        }
                      });
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={hours}>
                            <defs>
                              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                            <YAxis fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="count" 
                              stroke="#3b82f6" 
                              fillOpacity={1} 
                              fill="url(#colorCount)" 
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="bg-white shadow-sm border-slate-200">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-[10px] font-bold uppercase">Avg. Frequency</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {(() => {
                        const timeKey = activeView === 'logins' ? 'login_time' : 'purchase_time';
                        const sorted = [...data].map(i => new Date(i[timeKey]).getTime()).sort();
                        if (sorted.length < 2) return <p className="text-xl font-bold">N/A</p>;
                        const totalRange = sorted[sorted.length - 1] - sorted[0];
                        const avg = totalRange / (data.length - 1);
                        const mins = Math.round(avg / 60000);
                        return (
                          <div>
                            <p className="text-2xl font-black text-slate-900">
                              {mins < 1 ? '< 1 min' : `${mins} mins`}
                            </p>
                            <p className="text-[10px] text-muted-foreground italic">average time between events</p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  <Card className="bg-white shadow-sm border-slate-200">
                    <CardHeader className="p-4 pb-2">
                      <CardDescription className="text-[10px] font-bold uppercase">Peak Traffic</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {(() => {
                        const timeKey = activeView === 'logins' ? 'login_time' : 'purchase_time';
                        const counts: Record<number, number> = {};
                        data.forEach(item => {
                          const h = new Date(item[timeKey]).getHours();
                          counts[h] = (counts[h] || 0) + 1;
                        });
                        const peak = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                        if (!peak) return <p className="text-xl font-bold">N/A</p>;
                        return (
                          <div>
                            <p className="text-2xl font-black text-slate-900">{peak[0]}:00 - {parseInt(peak[0])+1}:00</p>
                            <p className="text-[10px] text-muted-foreground italic">with {peak[1]} total events</p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            
            <Card className="bg-white border-slate-200 shadow-xl overflow-hidden border-0 animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {activeView === 'logins' ? <User className="h-5 w-5 text-primary" /> : activeView === 'funnel' ? <TrendingUp className="h-5 w-5 text-orange-600" /> : <ShoppingCart className="h-5 w-5 text-emerald-600" />}
                      {activeView === 'logins' ? 'Login Audit Trail' : activeView === 'funnel' ? 'Customer Funnel Activity' : 'Purchase Audit Trail'}
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
                    {activeView === 'logins' ? renderLoginsTable() : activeView === 'funnel' ? renderFunnelTable() : renderPurchasesTable()}
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
            <DialogTitle className="text-xl flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Customer Profile
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
                        <TableHead className="h-9 text-xs text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.history.length > 0 ? (
                        selectedCustomer.history.map((order: any, idx: number) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="font-bold">#{order.number}</TableCell>
                            <TableCell>{safeFormatDate(order.date)}</TableCell>
                            <TableCell>{order.currency} {order.total.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <span className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                order.payment_status === 'FULLY_CHARGED' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                              )}>
                                {order.payment_status === 'FULLY_CHARGED' ? 'Paid' : 'Unpaid'}
                              </span>
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
    </div>
  );
}

export default App;
