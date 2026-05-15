import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { format, subDays } from 'date-fns';
import type { View } from '../types/audit';

export const useAuditData = (apiUrl: string) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataCache, setDataCache] = useState<Record<string, any>>({});
  
  // Historical/Comparison State
  const [yesterdayData, setYesterdayData] = useState<any[]>([]);
  const [yesterdayTotal, setYesterdayTotal] = useState<number | null>(null);
  const [historicalDistribution, setHistoricalDistribution] = useState<any[]>([]);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: '', direction: 'desc' });

  const fetchData = useCallback(async (
    view: View, 
    targetDate: string, 
    currentLoginTab: 'all' | 'allowance', 
    currentRecoveryTab: 'all' | 'allowance'
  ) => {
    if (view === 'home') return;
    
    const cacheKey = `${view}-${targetDate}-${currentLoginTab}-${currentRecoveryTab}`;
    
    if (dataCache[cacheKey]) {
      const cached = dataCache[cacheKey];
      setData(cached.data);
      if (view === 'purchases') {
        setYesterdayData(cached.yesterdayData || []);
        setYesterdayTotal(cached.yesterdayTotal || 0);
        setHistoricalDistribution(cached.historicalDistribution || []);
      }
    } else {
      setLoading(true);
    }

    setError(null);
    try {
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
      }

      setData(finalData);
      
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
  }, [apiUrl, dataCache]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  return {
    data,
    loading,
    error,
    yesterdayData,
    yesterdayTotal,
    historicalDistribution,
    sortConfig,
    fetchData,
    requestSort,
  setData
  };
};

export const useFilteredData = (
  data: any[], 
  sortConfig: { key: string, direction: 'asc' | 'desc' }, 
  searchQuery: string, 
  activeView: View, 
  purchaseTab: 'all' | 'paid' | 'unpaid'
) => {
  return useMemo(() => {
    let result = [...data];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        (item.email && item.email.toLowerCase().includes(query)) || 
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
};

