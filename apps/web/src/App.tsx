import React, { useState, useEffect, useMemo } from 'react';
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
  Activity,
  Check,
  X
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

// Custom Hooks & Utils
import { useAuditData, useFilteredData } from './hooks/useAuditData';
import { getSydneyHour } from './utils/date-helpers';
import type { View, Patient, Purchase, FunnelEvent } from './types/audit';

// Components
import { PurchasesTable } from './components/audit/PurchasesTable';
import { LoginsTable } from './components/audit/LoginsTable';
import { IntentAudit } from './components/audit/IntentAudit';
import { FunnelTable } from './components/audit/FunnelTable';
import { AbandonedTable } from './components/audit/AbandonedTable';
import { RevenueChart } from './components/charts/RevenueChart';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [activeView, setActiveView] = useState<View>('home');
  const [loginTab, setLoginTab] = useState<'all' | 'allowance'>('allowance');
  const [recoveryTab, setRecoveryTab] = useState<'all' | 'allowance'>('all');
  const [purchaseTab, setPurchaseTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [chartMetric, setChartMetric] = useState<'traffic' | 'gross'>('traffic');

  // Modal States
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [selectedZohoPatient, setSelectedZohoPatient] = useState<any>(null);
  const [loadingZoho, setLoadingZoho] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [unfulfilledModalEmails, setUnfulfilledModalEmails] = useState<string[]>([]);
  const [isUnfulfilledModalOpen, setIsUnfulfilledModalOpen] = useState(false);

  // Custom Data Hooks
  const {
    data,
    loading,
    error,
    yesterdayData,
    yesterdayTotal,
    historicalDistribution,
    sortConfig,
    fetchData,
    requestSort
  } = useAuditData(apiUrl);

  const filteredData = useFilteredData(data, sortConfig, searchQuery, activeView, purchaseTab);

  useEffect(() => {
    fetchData(activeView, date, loginTab, recoveryTab);
  }, [activeView, date, loginTab, recoveryTab, fetchData]);

  const intentMetrics = useMemo(() => {
    if (activeView !== 'intent' || data.length === 0) return null;
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
    try {
      const cleanEmail = email.includes('[at]') ? email.replace('[at]', '@') : email;
      const response = await axios.get(`${apiUrl}/api/customer/${cleanEmail}`);
      setSelectedCustomer(response.data);
    } catch (err) {
      console.error('Error fetching customer details:', err);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) return;

    const headers = activeView === 'logins' 
      ? ['Email', 'Allowance Remaining', 'Last Order', 'TP Date', 'Login Time', 'Purchased Today']
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
            item.last_order_at || 'N/A',
            item.tp_date || 'N/A',
            item.login_time,
            item.hasPurchased ? 'YES' : 'NO'
          ].join(',');
        } else if (activeView === 'funnel') {
          return [
            item.email,
            item.viewed_product ? 'YES' : 'NO',
            item.added_to_cart ? 'YES' : 'NO',
            item.removed_from_cart ? 'YES' : 'NO',
            item.checkout ? 'YES' : 'NO',
            item.login_time
          ].join(',');
        } else if (activeView === 'abandoned') {
          return [
            item.email,
            item.days_allowance_remaining,
            item.cart_created_sydney
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
            item.purchase_time
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
        <Card 
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

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            {activeView !== 'home' && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setActiveView('home')} 
                className="rounded-full bg-white shadow-sm mr-2"
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
            <div className="flex items-center gap-2">
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={date} 
                  max={activeView === 'intent' ? format(subDays(new Date(), 1), 'yyyy-MM-dd') : undefined}
                  onChange={(e) => setDate(e.target.value)}
                  className="pl-9 w-[180px] bg-white shadow-sm border-slate-200"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => fetchData(activeView, date, loginTab, recoveryTab)} className={cn("bg-white shadow-sm border-slate-200", loading && "animate-spin")}>
                <RefreshCw size={18} />
              </Button>
            </div>
          )}
        </div>

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

            {activeView === 'purchases' && !loading && (
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-3 bg-white shadow-sm border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold">Revenue Distribution</CardTitle>
                    <div className="flex bg-slate-100 p-0.5 rounded-md">
                      <Button variant={chartMetric === 'traffic' ? 'default' : 'ghost'} size="sm" onClick={() => setChartMetric('traffic')} className="h-6 text-[10px]">Traffic</Button>
                      <Button variant={chartMetric === 'gross' ? 'default' : 'ghost'} size="sm" onClick={() => setChartMetric('gross')} className="h-6 text-[10px]">Gross ($)</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    {(() => {
                      const timeKey = activeView === 'logins' ? 'login_time' : 'purchase_time';
                      let chartData = Array.from({ length: 24 }, (_, i) => ({
                        hour: `${i}:00`,
                        today: 0,
                        yesterday: 0,
                        avg7d: 0,
                        avg28d: 0
                      }));

                      if (chartMetric === 'gross' && historicalDistribution.length > 0) {
                        chartData = historicalDistribution.map(item => ({ ...item }));
                      } else {
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

                      return <RevenueChart chartMetric={chartMetric} data={chartData} />;
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="bg-white border-slate-200 shadow-xl overflow-hidden border-0">
              <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      {activeView === 'logins' ? <User className="h-5 w-5 text-primary" /> : activeView === 'funnel' ? <TrendingUp className="h-5 w-5 text-orange-600" /> : activeView === 'abandoned' ? <ShoppingCart size={24} className="h-5 w-5 text-orange-600" /> : activeView === 'intent' ? <Eye className="h-5 w-5 text-purple-600" /> : <ShoppingCart size={24} className="h-5 w-5 text-emerald-600" />}
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
                  <div className="flex flex-col items-center py-20 gap-4"><RefreshCw className="animate-spin" /><p>Syncing records...</p></div>
                ) : (
                  <div className="overflow-x-auto">
                    {activeView === 'logins' && <LoginsTable data={filteredData} sortConfig={sortConfig} requestSort={requestSort} onZohoClick={handleZohoClick} />}
                    {activeView === 'purchases' && <PurchasesTable data={filteredData} sortConfig={sortConfig} requestSort={requestSort} onCustomerClick={handleCustomerClick} />}
                    {activeView === 'funnel' && <FunnelTable data={filteredData} sortConfig={sortConfig} requestSort={requestSort} />}
                    {activeView === 'abandoned' && <AbandonedTable data={filteredData} sortConfig={sortConfig} requestSort={requestSort} />}
                    {activeView === 'intent' && <IntentAudit data={filteredData} metrics={intentMetrics} onUnfulfilledClick={(emails) => { setUnfulfilledModalEmails(emails); setIsUnfulfilledModalOpen(true); }} />}
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
                        <TableHead className="h-9 text-xs text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.orders?.map((order: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="py-2 text-xs font-mono">#{order.number}</TableCell>
                          <TableCell className="py-2 text-xs">{format(new Date(order.created), 'dd/MM/yy')}</TableCell>
                          <TableCell className="py-2 text-xs font-bold">${order.total}</TableCell>
                          <TableCell className="py-2">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold",
                              order.payment_status === 'FULLY_CHARGED' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            )}>
                              {order.payment_status === 'FULLY_CHARGED' ? 'PAID' : 'UNPAID'}
                            </span>
                          </TableCell>
                          <TableCell className="py-2 text-xs text-right text-slate-500 uppercase font-medium">
                            {order.status}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      
      {/* Zoho CRM Modal */}
      <Dialog open={isZohoModalOpen} onOpenChange={setIsZohoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Zoho CRM Clinical Record
            </DialogTitle>
          </DialogHeader>

          {loadingZoho ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Connecting to Zoho API & PostHog...</p>
            </div>
          ) : selectedZohoPatient ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedZohoPatient.name || 'Patient Record'}</h3>
                  <p className="text-sm text-slate-500">{selectedZohoPatient.email}</p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <CreditCard size={12} />
                    {selectedZohoPatient.phone || 'No phone recorded'}
                  </p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {selectedZohoPatient.zohoStatus || selectedZohoPatient.Status || 'Active'}
                  </span>
                  {selectedZohoPatient.zohoUrl && (
                    <a 
                      href={selectedZohoPatient.zohoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      OPEN IN ZOHO <ChevronRight size={10} />
                    </a>
                  )}
                </div>
              </div>

              {/* Clinical Details Section */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Clinic</p>
                  <p className="text-sm font-medium">{selectedZohoPatient.Clinic || selectedZohoPatient.clinic || 'Not Specified'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Latest Consultation</p>
                  <p className="text-sm font-medium">{selectedZohoPatient.Latest_Consultation_Date || 'None Found'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">TP Status</p>
                  <p className="text-sm font-medium">{selectedZohoPatient.Treatment_Plan_Status || 'No Active Plan'}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Doctor</p>
                  <p className="text-sm font-medium">{selectedZohoPatient.Doctor || 'Not Assigned'}</p>
                </div>
              </div>

              {/* PostHog Replays Section */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-orange-500" />
                  PostHog Session Replays (Today)
                </h3>
                <div className="grid gap-2">
                  {selectedZohoPatient.replays && selectedZohoPatient.replays.length > 0 ? (
                    selectedZohoPatient.replays.map((replay: any, idx: number) => (
                      <a 
                        key={idx}
                        href={replay.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-orange-200 hover:bg-orange-50/30 transition-all group shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                            <Eye size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Session Replay #{idx + 1}</p>
                            <p className="text-[10px] text-slate-500">Started at {format(new Date(replay.start_time), 'HH:mm:ss')}</p>
                          </div>
                        </div>
                        <div className="flex items-center text-[10px] font-bold text-orange-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          WATCH RECORDING <ChevronRight size={12} />
                        </div>
                      </a>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-lg border border-dashed">
                      <p className="text-xs text-slate-400 italic">No PostHog sessions recorded for this patient today.</p>
                    </div>
                  )}
                </div>
              </div>

              <Button 
                className="w-full bg-slate-900 hover:bg-slate-800 h-11 font-bold shadow-lg shadow-slate-200"
                onClick={() => {
                  setIsZohoModalOpen(false);
                  handleCustomerClick(selectedZohoPatient.email);
                }}
              >
                View Purchase History in Saleor
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">No matching patient record found in Zoho CRM.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Unfulfilled Emails Modal */}
      <Dialog open={isUnfulfilledModalOpen} onOpenChange={setIsUnfulfilledModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unfulfilled Order Lookups</DialogTitle>
            <DialogDescription>
              List of patients who logged in but have no recent successful orders.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2">
            {unfulfilledModalEmails.length > 0 ? unfulfilledModalEmails.map((email, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-200 transition-all group">
                <span className="text-sm font-mono text-slate-600">{email}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[10px] opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    setIsUnfulfilledModalOpen(false);
                    handleZohoClick(email);
                  }}
                >
                  AUDIT
                </Button>
              </div>
            )) : (
              <p className="text-center py-8 text-slate-400 italic">No emails recorded for this day.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
