'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { 
  TrendingUp, Package, AlertTriangle, Users, LogOut, 
  Trash2, DollarSign, CheckCircle2, RefreshCw, 
  ChevronRight, Calendar, PlusCircle, ShoppingBag, X, Menu, Pencil,
  FileText, CalendarDays, Filter, Eye, Printer, Search, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Coins, ShoppingCart
} from 'lucide-react';

interface KPIState {
  todaySales: number;
  monthlySales: number;
  todayExpenses: number;
  monthlyExpenses: number;
  todayNet: number;
  monthlyNet: number;
  activeShiftUser: string;
  activeShiftExpected: number;
}

interface PaymentBreakdown {
  cash: number;
  instapay: number;
}

interface TopItem {
  name: string;
  qty: number;
  total: number;
}

interface LowStock {
  id: string;
  name: string;
  stockQty: number;
  minStockLevel: number;
  deductUnit: string;
}

interface RawMaterial {
  id: string;
  name: string;
  stockQty: number;
  minStockLevel: number;
  purchaseUnit: string;
  deductUnit: string;
  conversionFactor: number;
  isLowStock: boolean;
}

interface RecentOrder {
  id: string;
  receiptNumber?: string | null;
  orderType: string;
  paymentMethod: string;
  status: string;
  total: number;
  discount: number;
  createdAt: string;
  table?: { name: string } | null;
}
interface RestockLog {
  id: string; quantity: number; amount: number; createdAt: string;
  rawMaterial: { name: string; purchaseUnit: string };
}
interface AttendanceRecord { id: string; employeeName: string; checkedInAt: string; checkedOutAt: string | null; }

interface CashTransactionItem {
  id: string;
  shiftId: string;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
  cashierName: string;
  operatingDate?: string;
}

interface OrderDetails extends RecentOrder {
  subtotal: number;
  discount: number;
  discountReason?: string | null;
  tax: number;
  items: Array<{
    id: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    item: { name: string };
    modifiers: Array<{
      id: string;
      unitPriceImpact: number;
      modifier: { name: string };
    }>;
  }>;
}

interface SalesSummary {
  period: string;
  total: number;
  orders: number;
}

interface ShiftSummary {
  id: string;
  openedAt: string;
  closedAt: string | null;
  cashierName: string;
  orderCount: number;
  totalSales: number;
  cashSales: number;
  instaPaySales: number;
  expectedCash: number;
  expectedInstaPay: number;
  closedCash: number | null;
  closedInstaPay: number | null;
  varianceCash: number;
  varianceInstaPay: number;
}

interface DailyExpenseSummary {
  period: string; // YYYY-MM-DD
  total: number;
  payoutsTotal: number;
  restocksTotal: number;
  count: number;
  payouts?: Array<{ id: string; shiftId: string; amount: number; reason: string; cashierName: string; createdAt: string }>;
  restocks?: Array<{ id: string; amount: number; quantity: number; materialName: string; purchaseUnit: string; createdAt: string }>;
}

interface ItemSoldSummary {
  itemId: string;
  name: string;
  qty: number;
  total: number;
  unitPrice: number;
}

interface MonthlyExpenseSummary {
  period: string; // YYYY-MM
  total: number;
  payoutsTotal: number;
  restocksTotal: number;
  count: number;
  payouts?: Array<{ id: string; shiftId: string; amount: number; reason: string; cashierName: string; createdAt: string }>;
  restocks?: Array<{ id: string; amount: number; quantity: number; materialName: string; purchaseUnit: string; createdAt: string }>;
  categoriesSummary?: Array<{ name: string; type: 'PAYOUT' | 'RESTOCK'; total: number; count: number }>;
}

interface DailyReportItem {
  date: string;
  ordersCount: number;
  totalSales: number;
  cashSales: number;
  instaPaySales: number;
  totalExpenses: number;
  payoutsTotal: number;
  restocksTotal: number;
  expensesCount: number;
  netProfit: number;
  payouts?: Array<{ id: string; shiftId: string; amount: number; reason: string; cashierName: string; createdAt: string }>;
  restocks?: Array<{ id: string; amount: number; quantity: number; materialName: string; purchaseUnit: string; createdAt: string }>;
  itemsSold?: ItemSoldSummary[];
}

interface MonthlyReportItem {
  month: string;
  ordersCount: number;
  totalSales: number;
  cashSales: number;
  instaPaySales: number;
  totalExpenses: number;
  payoutsTotal: number;
  restocksTotal: number;
  expensesCount: number;
  netProfit: number;
  itemsSold?: ItemSoldSummary[];
  days?: DailyReportItem[];
  daysCount?: number;
  payouts?: Array<{ id: string; shiftId: string; amount: number; reason: string; cashierName: string; createdAt: string }>;
  restocks?: Array<{ id: string; amount: number; quantity: number; materialName: string; purchaseUnit: string; createdAt: string }>;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAppStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'reports' | 'inventory' | 'recipes' | 'expenses'>('dashboard');
  const [cashTransactions, setCashTransactions] = useState<CashTransactionItem[]>([]);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseFilterType, setExpenseFilterType] = useState<'ALL' | 'PAYOUTS' | 'RESTOCKS'>('ALL');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');

  // Daily & Monthly Expenses & Combined Reports
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseSummary[]>([]);
  const [monthlyExpensesHistory, setMonthlyExpensesHistory] = useState<MonthlyExpenseSummary[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReportItem[]>([]);
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReportItem[]>([]);

  // Expenses Tab dedicated Sub-tabs: 'daily' vs 'monthly'
  const [expensesSubTab, setExpensesSubTab] = useState<'daily' | 'monthly'>('daily');
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<string>('');
  const [selectedExpenseMonth, setSelectedExpenseMonth] = useState<string>('');
  const [monthlyExpensesViewMode, setMonthlyExpensesViewMode] = useState<'breakdown' | 'days' | 'transactions'>('breakdown');

  // Reports Tab states
  const [reportsSubTab, setReportsSubTab] = useState<'daily' | 'monthly'>('daily');
  const [selectedReportDate, setSelectedReportDate] = useState<string>('');
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('');
  const [dailyReportItemSearch, setDailyReportItemSearch] = useState<string>('');
  const [monthlyReportItemSearch, setMonthlyReportItemSearch] = useState<string>('');
  const [monthlyReportViewMode, setMonthlyReportViewMode] = useState<'items' | 'days' | 'expenses'>('items');
  const [showDayIndividualOrders, setShowDayIndividualOrders] = useState<boolean>(false);
  const [selectedDayReportOrders, setSelectedDayReportOrders] = useState<any[]>([]);
  const [loadingDayReportOrders, setLoadingDayReportOrders] = useState<boolean>(false);
  const [dayReportSearch, setDayReportSearch] = useState<string>('');
  const [dayReportActiveSection, setDayReportActiveSection] = useState<'all' | 'orders' | 'expenses'>('all');

  // API Data States
  const [kpis, setKpis] = useState<KPIState>({
    todaySales: 0,
    monthlySales: 0,
    todayExpenses: 0,
    monthlyExpenses: 0,
    todayNet: 0,
    monthlyNet: 0,
    activeShiftUser: 'Loading...',
    activeShiftExpected: 0
  });
  
  const [payments, setPayments] = useState<PaymentBreakdown>({ cash: 0, instapay: 0 });
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topItemsByPeriod, setTopItemsByPeriod] = useState<{ today: TopItem[]; month: TopItem[]; all: TopItem[] }>({ today: [], month: [], all: [] });
  const [topItemsPeriod, setTopItemsPeriod] = useState<'today' | 'month' | 'all'>('today');
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const inventoryTableScrollRef = useRef<HTMLDivElement>(null);
  const [dailySales, setDailySales] = useState<SalesSummary[]>([]);
  const [showPeriodOrders, setShowPeriodOrders] = useState(false);
  const [periodOrdersTitle, setPeriodOrdersTitle] = useState('');
  const [periodOrders, setPeriodOrders] = useState<any[]>([]);
  const [loadingPeriodOrders, setLoadingPeriodOrders] = useState(false);
  const [periodOrderSearch, setPeriodOrderSearch] = useState('');
  const [monthlySalesHistory, setMonthlySalesHistory] = useState<SalesSummary[]>([]);
  const [shiftSummaries, setShiftSummaries] = useState<ShiftSummary[]>([]);
  
  // Inventory list state
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [restockLogs, setRestockLogs] = useState<RestockLog[]>([]);
  const [monthlyRestockTotal, setMonthlyRestockTotal] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceRecord[]>([]);
  
  // Recipes tab states
  const [recipesItems, setRecipesItems] = useState<any[]>([]);
  const [recipesModifiers, setRecipesModifiers] = useState<any[]>([]);
  const [selectedRecipeTarget, setSelectedRecipeTarget] = useState<{ type: 'item' | 'modifier'; id: string; name: string } | null>(null);
  const [recipeIngredients, setRecipeIngredients] = useState<Array<{ rawMaterialId: string; quantity: number }>>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);

  // New Material inputs
  const [newMatName, setNewMatName] = useState('');
  const [newMatStock, setNewMatStock] = useState('');
  const [newMatMinStock, setNewMatMinStock] = useState('');
  const [newMatUnit, setNewMatUnit] = useState('');
  const [newMatCustomUnit, setNewMatCustomUnit] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemNewCategory, setNewItemNewCategory] = useState('');

  // Loading states
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Modals
  const [showRestock, setShowRestock] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [restockAmount, setRestockAmount] = useState('');

  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Guard: Admin Check
  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    if (user.role !== 'ADMIN') {
      router.push('/pos');
    }
  }, [user, router]);

  useEffect(() => {
    setTodayLabel(new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }));
  }, []);

  const triggerAlert = (type: 'success' | 'error', text: string) => {
    setAlertMsg({ type, text });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  // Fetch Analytics (Dashboard)
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/admin-analytics');
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis);
        setPayments(data.paymentBreakdown);
        setTopItems(data.topSellingItems);
        setTopItemsByPeriod(data.topSellingItemsByPeriod || { today: data.topSellingItems, month: [], all: [] });
        setLowStock(data.lowStockAlerts);
        setRecentOrders(data.recentOrders);
        setDailySales(data.dailySales);
        setMonthlySalesHistory(data.monthlySalesHistory);
        setDailyExpenses(data.dailyExpenses || []);
        setMonthlyExpensesHistory(data.monthlyExpensesHistory || []);
        setDailyReports(data.dailyReports || []);
        setMonthlyReports(data.monthlyReports || []);
        if (data.restockLogs) {
          setRestockLogs(data.restockLogs);
        }
        if (data.dailyReports?.length) {
          setSelectedReportDate((prev) => prev || data.dailyReports[0].date);
        }
        if (data.monthlyReports?.length) {
          setSelectedReportMonth((prev) => prev || data.monthlyReports[0].month);
        }
        if (data.dailyExpenses?.length) {
          setSelectedExpenseDate((prev) => prev || data.dailyExpenses[0].period);
        }
        if (data.monthlyExpensesHistory?.length) {
          setSelectedExpenseMonth((prev) => prev || data.monthlyExpensesHistory[0].period);
        }
        setShiftSummaries(data.shiftSummaries);
        setCashTransactions(data.cashTransactions || []);
        const attendanceRes = await fetch('/api/attendance');
        if (attendanceRes.ok) {
          const attendance = await attendanceRes.json();
          setTodayAttendance(attendance.todayRecords || []);
          setMonthlyAttendance(attendance.monthlyRecords || []);
        }
      }
    } catch (e) {
      console.error(e);
      triggerAlert('error', 'فشل تحميل التقارير المالية.');
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch Inventory Materials
  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.rawMaterials);
      }
    } catch (e) {
      console.error(e);
      triggerAlert('error', 'فشل تحميل بيانات المخزن.');
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  const fetchRestockLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/restock');
      if (!res.ok) return;
      const data = await res.json();
      setRestockLogs(data.logs || []);
      setMonthlyRestockTotal(data.monthlyTotal || 0);
    } catch (error) { console.error(error); }
  }, []);

  const fetchDayReportOrders = useCallback(async (dateStr: string) => {
    if (!dateStr) return;
    setLoadingDayReportOrders(true);
    try {
      const res = await fetch(`/api/sales-orders?date=${encodeURIComponent(dateStr)}`);
      const data = await res.json();
      setSelectedDayReportOrders(data.orders || []);
    } catch (e) {
      console.error('Error fetching day report orders:', e);
    } finally {
      setLoadingDayReportOrders(false);
    }
  }, []);

  useEffect(() => {
    if (selectedReportDate && (activeTab === 'reports' || activeTab === 'dashboard')) {
      fetchDayReportOrders(selectedReportDate);
    }
  }, [selectedReportDate, activeTab, fetchDayReportOrders]);

  const formatDateArabic = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
      return d.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatMonthArabic = (monthStr: string) => {
    if (!monthStr) return '';
    try {
      const d = new Date(`${monthStr}-01T12:00:00`);
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
      });
    } catch {
      return monthStr;
    }
  };

  const openPeriodOrders = async (period: string, title: string, type: 'date' | 'month' | 'shift' = 'date') => {
    setPeriodOrdersTitle(title);
    setShowPeriodOrders(true);
    setLoadingPeriodOrders(true);
    setPeriodOrders([]);
    setPeriodOrderSearch('');

    try {
      const paramKey = type === 'date' ? 'date' : type === 'month' ? 'month' : 'shiftId';
      const res = await fetch(`/api/sales-orders?${paramKey}=${encodeURIComponent(period)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحميل فواتير هذه الفترة');
      setPeriodOrders(data.orders || []);
    } catch (error: any) {
      triggerAlert('error', error.message || 'فشل تحميل الفواتير');
    } finally {
      setLoadingPeriodOrders(false);
    }
  };

  const openOrderDetails = async (orderId: string) => {
    setShowOrderDetails(true);
    setSelectedOrder(null);
    setLoadingOrderDetails(true);

    try {
      const res = await fetch(`/api/sales-orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تحميل تفاصيل الفاتورة');
      setSelectedOrder(data.order);
    } catch (error: any) {
      setShowOrderDetails(false);
      triggerAlert('error', error.message || 'فشل تحميل تفاصيل الفاتورة');
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  // Fetch Recipes
  const fetchRecipes = useCallback(async () => {
    setLoadingRecipes(true);
    try {
      const res = await fetch('/api/recipes');
      if (res.ok) {
        const data = await res.json();
        setRecipesItems(data.items);
        setRecipesModifiers(data.modifiers);
      }
    } catch (e) {
      console.error(e);
      triggerAlert('error', 'فشل تحميل الوصفات ومقادير الأصناف.');
    } finally {
      setLoadingRecipes(false);
    }
  }, []);

  // Trigger loading based on selected tab
  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'reports' || activeTab === 'expenses') {
      fetchAnalytics();
    } else if (activeTab === 'inventory') {
      fetchInventory();
      fetchRestockLogs();
    } else if (activeTab === 'recipes') {
      fetchRecipes();
      fetchInventory();
    }
  }, [activeTab, fetchAnalytics, fetchInventory, fetchRecipes, fetchRestockLogs]);

  // Handle Restock Form POST
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || !qtyInput || restockAmount === '') return;
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawMaterialId: selectedMaterialId,
          quantity: parseFloat(qtyInput),
          amount: parseFloat(restockAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت عملية التوريد');

      triggerAlert('success', 'تم شحن وتوريد الخامة للمخزن بنجاح.');
      setShowRestock(false);
      setQtyInput('');
      setRestockAmount('');
      fetchInventory();
      fetchRestockLogs();
    } catch (err: any) {
      triggerAlert('error', err.message || 'خطأ في عملية التوريد');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Add New Raw Material
  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const unit = newMatUnit === 'أخرى' ? newMatCustomUnit.trim() : newMatUnit;
    if (!newMatName || !unit) return;
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMatName,
          stockQty: parseFloat(newMatStock) || 0.0,
          minStockLevel: parseFloat(newMatMinStock) || 0.0,
          purchaseUnit: unit,
          deductUnit: unit,
          conversionFactor: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت إضافة الخامة');

      triggerAlert('success', 'تم إضافة الخامة الجديدة بنجاح للمخزن.');
      setShowAddMaterial(false);
      setNewMatName('');
      setNewMatStock('');
      setNewMatMinStock('');
      setNewMatUnit('');
      setNewMatCustomUnit('');
      fetchInventory();
    } catch (err: any) {
      triggerAlert('error', err.message || 'خطأ في إضافة الخامة');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Handle Save Recipe
  const handleSaveRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeTarget) return;
    setSubmitLoading(true);

    try {
      const isItem = selectedRecipeTarget.type === 'item';
      const body = {
        itemId: isItem ? selectedRecipeTarget.id : undefined,
        modifierId: !isItem ? selectedRecipeTarget.id : undefined,
        ingredients: recipeIngredients.filter(ing => ing.rawMaterialId && ing.quantity > 0),
      };

      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('فشل حفظ تفاصيل الوصفة');

      triggerAlert('success', 'تم حفظ وتحديث مقادير الوصفة بنجاح.');
      setSelectedRecipeTarget(null);
      fetchRecipes();
    } catch (err: any) {
      triggerAlert('error', err.message || 'خطأ في حفظ الوصفة');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Add ingredient row to builder
  const addRecipeRow = () => {
    setRecipeIngredients(prev => [...prev, { rawMaterialId: '', quantity: 0 }]);
  };

  // Remove ingredient row from builder
  const removeRecipeRow = (idx: number) => {
    setRecipeIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Update ingredient row in builder
  const updateRecipeRow = (idx: number, field: 'rawMaterialId' | 'quantity', value: any) => {
    setRecipeIngredients(prev => prev.map((ing, i) => {
      if (i === idx) {
        return {
          ...ing,
          [field]: field === 'quantity' ? parseFloat(value) || 0 : value,
        };
      }
      return ing;
    }));
  };

  // Open recipe builder
  const startEditRecipe = (target: { type: 'item' | 'modifier'; id: string; name: string; recipe: any[] }) => {
    setSelectedRecipeTarget(target);
    const existing = target.recipe.map(ing => ({
      rawMaterialId: ing.rawMaterialId,
      quantity: ing.quantity,
    }));
    setRecipeIngredients(existing.length > 0 ? existing : [{ rawMaterialId: '', quantity: 0 }]);
  };

  const handleAdminUpdateItemPrice = async (item: { id: string; name: string; price: number }) => {
    const enteredPrice = window.prompt(`السعر الجديد لـ ${item.name}`, String(item.price));
    if (enteredPrice === null) return;
    const price = Number(enteredPrice);
    if (!Number.isFinite(price) || price < 0) {
      triggerAlert('error', 'اكتب سعرًا صحيحًا أكبر من أو يساوي صفر.');
      return;
    }

    try {
      const res = await fetch('/api/items/price', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, price }),
      });
      if (!res.ok) throw new Error();
      setRecipesItems((currentItems) => currentItems.map((currentItem) => currentItem.id === item.id ? { ...currentItem, price } : currentItem));
      triggerAlert('success', `تم تعديل سعر ${item.name} إلى EGP ${price.toFixed(2)}`);
    } catch {
      triggerAlert('error', 'تعذر تعديل سعر الصنف.');
    }
  };

  const handleUpdateMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    setSubmitLoading(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMaterialId: editingMaterial.id, ...editingMaterial, conversionFactor: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تعديل الخامة');
      triggerAlert('success', 'تم تعديل بيانات الخامة.');
      setEditingMaterial(null);
      fetchInventory();
    } catch (error: any) {
      triggerAlert('error', error.message || 'تعذر تعديل الخامة.');
    } finally { setSubmitLoading(false); }
  };

  const handleDeleteMaterial = async (material: RawMaterial) => {
    if (!window.confirm(`حذف خامة «${material.name}»؟ سيتم حذفها من الوصفات المرتبطة بها أيضًا.`)) return;
    setSubmitLoading(true);
    try {
      const res = await fetch('/api/inventory', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawMaterialId: material.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الخامة');
      triggerAlert('success', 'تم حذف الخامة.');
      fetchInventory();
      fetchRecipes();
    } catch (error: any) {
      triggerAlert('error', error.message || 'تعذر حذف الخامة.');
    } finally { setSubmitLoading(false); }
  };

  const handleRemoveMenuItem = async (item: { id: string; name: string }) => {
    if (!window.confirm(`حذف ${item.name} من المنيو؟ لن يظهر في الكاشير، لكن الفواتير القديمة ستظل محفوظة.`)) return;
    try {
      const res = await fetch(`/api/items?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecipesItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      triggerAlert('success', `تم حذف ${item.name} من المنيو.`);
    } catch (error: any) { triggerAlert('error', error.message || 'تعذر حذف الصنف.'); }
  };

  const handleUpdateStockAlertLevel = async (material: RawMaterial) => {
    const entered = window.prompt(`حد التنبيه الجديد لـ ${material.name} (${material.deductUnit})`, String(material.minStockLevel));
    if (entered === null) return;
    const minStockLevel = Number(entered);
    if (!Number.isFinite(minStockLevel) || minStockLevel < 0) {
      triggerAlert('error', 'اكتب حد تنبيه صحيحًا صفر أو أكبر.');
      return;
    }
    try {
      const res = await fetch('/api/inventory', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rawMaterialId: material.id, minStockLevel }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, minStockLevel, isLowStock: item.stockQty < minStockLevel } : item));
      triggerAlert('success', 'تم تعديل حد التنبيه.');
    } catch (error: any) { triggerAlert('error', error.message || 'تعذر تعديل حد التنبيه.'); }
  };

  const openAddMenuItem = () => {
    const firstCategory = recipesItems[0]?.category?.name || '';
    setNewItemName('');
    setNewItemPrice('');
    setNewItemCategory(firstCategory);
    setNewItemNewCategory('');
    setShowAddMenuItem(true);
  };

  const handleAddMenuItemSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const categoryName = newItemNewCategory.trim() || newItemCategory;
    const price = Number(newItemPrice);
    if (!newItemName.trim() || !categoryName || !Number.isFinite(price) || price < 0) {
      triggerAlert('error', 'اكتب اسم الصنف والقسم والسعر الصحيح.');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName, price, categoryName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecipesItems((current) => [...current, data.item].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setShowAddMenuItem(false);
      triggerAlert('success', `تمت إضافة ${data.item.name} بدون وصفة مخزون.`);
    } catch (error: any) {
      triggerAlert('error', error.message || 'تعذر إضافة الصنف.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // SVG Chart Computations
  const rawTopItems = topItemsByPeriod[topItemsPeriod] || topItems;
  const displayedTopItems = (rawTopItems || []).filter((item) => (item.qty || 0) > 0);
  const maxItemTotal = displayedTopItems.reduce((max, i) => Math.max(max, i.total), 0) || 1;
  const totalPaymentSum = (payments.cash + payments.instapay) || 1;
  const cashPct = Math.round((payments.cash / totalPaymentSum) * 100);
  const instapayPct = Math.round((payments.instapay / totalPaymentSum) * 100);

  if (!mounted) {
    return <div className="flex h-screen items-center justify-center bg-[#090d16] text-sm font-semibold text-gray-300" dir="rtl">جاري تحميل لوحة الإدارة...</div>;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#090d16] text-gray-200 overflow-hidden text-right" dir="rtl">
      
      {/* Mobile Top Header (only visible on mobile/tablet screens < md) */}
      <header className="md:hidden h-14 bg-[#0c1424] border-b border-white/5 px-4 flex items-center justify-between shrink-0 no-print">
        <button 
          onClick={() => setShowMobileSidebar(true)}
          className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-white leading-tight">داي أند نايت (الإدارة)</h1>
        </div>
      </header>

      {/* Mobile Drawer Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm md:hidden flex justify-end no-print" onClick={() => setShowMobileSidebar(false)}>
          <aside className="w-64 bg-[#0c1424] h-full p-6 flex flex-col justify-between border-r border-white/5 animate-slide-left text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-8">
              <div className="flex items-center justify-between flex-row-reverse">
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                    DN
                  </div>
                  <span className="text-xs font-bold text-white">لوحة الإدارة</span>
                </div>
              </div>

              {/* Mobile Navigation links */}
              <nav className="space-y-1.5">
                <button
                  onClick={() => { setActiveTab('dashboard'); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                    activeTab === 'dashboard'
                      ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 shrink-0" />
                  <span className="w-full text-right">تحليلات المبيعات والأرباح</span>
                </button>

                <button
                  onClick={() => { setActiveTab('reports'); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                    activeTab === 'reports'
                      ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span className="w-full text-right">التقرير المالي (اليومي والشهري)</span>
                </button>

                <button
                  onClick={() => { setActiveTab('inventory'); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                    activeTab === 'inventory'
                      ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span className="w-full text-right">مخزن الخامات والمواد</span>
                </button>

                <button
                  onClick={() => { setActiveTab('recipes'); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                    activeTab === 'recipes'
                      ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span className="w-full text-right">وصفات الأصناف</span>
                </button>

                <button
                  onClick={() => { setActiveTab('expenses'); setShowMobileSidebar(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                    activeTab === 'expenses'
                      ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-4 h-4 shrink-0" />
                  <span className="w-full text-right">سجل المصروفات والمسحوبات</span>
                </button>
              </nav>
            </div>

            {/* Mobile Sidebar Footer */}
            <div className="space-y-4 pt-4 border-t border-white/5">
              <button 
                onClick={() => router.push('/pos')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-bold transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>فتح شاشة البيع والكاشير</span>
              </button>

              <div className="flex items-center justify-between flex-row-reverse">
                <div className="text-right">
                  <p className="text-white font-semibold leading-tight text-xs">{user?.name}</p>
                  <p className="text-gray-500 text-[9px] uppercase tracking-wider">مدير النظام</p>
                </div>
                <button 
                  onClick={() => { logout(); router.push('/'); }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition-all"
                  title="تسجيل خروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 1. Left Navigation Sidebar (Hidden on mobile) */}
      <aside className="hidden md:flex w-64 bg-[#0c1424] border-l border-white/5 flex-col justify-between p-6 shrink-0 no-print">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 justify-start flex-row-reverse">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/10">
              DN
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">داي أند نايت</h1>
              <span className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">نظام الإدارة وجرد المخازن</span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                activeTab === 'dashboard'
                  ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span className="w-full text-right">تحليلات المبيعات والأرباح</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                activeTab === 'reports'
                  ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="w-full text-right">التقرير المالي (اليومي والشهري)</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                activeTab === 'inventory'
                  ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span className="w-full text-right">مخزن الخامات والمواد</span>
            </button>

            <button
              onClick={() => setActiveTab('recipes')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                activeTab === 'recipes'
                  ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="w-full text-right">وصفات الأصناف (BOM)</span>
            </button>

            <button
              onClick={() => setActiveTab('expenses')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all flex-row-reverse ${
                activeTab === 'expenses'
                  ? 'bg-cyan-500/15 text-cyan-400 border-r-4 border-cyan-500'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0" />
              <span className="w-full text-right">سجل المصروفات والمسحوبات</span>
            </button>
          </nav>
        </div>

        {/* User Info / Portal switcher */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <button 
            onClick={() => router.push('/pos')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>فتح شاشة البيع والكاشير</span>
          </button>

          <div className="flex items-center justify-between flex-row-reverse">
            <div className="text-right">
              <p className="text-white font-semibold leading-tight">{user?.name}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">مدير النظام</p>
            </div>
            <button 
              onClick={() => { logout(); router.push('/'); }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition-all"
              title="تسجيل خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Workspace */}
      <main className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden">
        
        {/* Top Header Banner */}
        <header className="h-16 border-b border-white/5 px-4 md:px-8 flex items-center justify-between shrink-0 bg-[#090d16] flex-row-reverse no-print">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
              تاريخ اليوم: {todayLabel || '...'}
            </span>
          </div>

          {/* Active status widget */}
          <div className="text-[10px] sm:text-xs text-right">
            <span className="text-gray-400 hidden sm:inline">الوردية شغالة حالياً مع: </span>
            <span className="font-bold text-purple-400">{kpis.activeShiftUser}</span>
          </div>
        </header>

        {/* Tab content viewports */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
          
          {/* TAB 1: EXECUTIVE ANALYTICS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <>
              {loadingAnalytics ? (
                <div className="h-96 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>جاري حساب الأرقام والتقارير المالية...</span>
                </div>
              ) : (
                <>
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-1">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl"></div>
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block text-right">إجمالي مبيعات اليوم</span>
                      <p className="text-3xl font-black text-white mt-2 text-right">EGP {kpis.todaySales.toFixed(2)}</p>
                      <span className="text-[10px] text-cyan-400 mt-2 block text-right">إيراد درج الكاشير والطلبات اليوم</span>
                    </div>

                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-5">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl"></div>
                      <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold block text-right">مبيعات الشهر الحالي</span>
                      <p className="text-3xl font-black text-white mt-2 text-right">EGP {kpis.monthlySales.toFixed(2)}</p>
                      <span className="text-[10px] text-purple-400 mt-2 block text-right">المبيعات التراكمية من أول الشهر</span>
                    </div>
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-2">
                      <span className="text-xs text-gray-400 font-semibold block text-right">مصروفات اليوم</span>
                      <p className="text-3xl font-black text-rose-400 mt-2 text-right">EGP {kpis.todayExpenses.toFixed(2)}</p>
                      <span className="text-[10px] text-gray-500 mt-2 block text-right">إجمالي توريدات اليوم</span>
                    </div>
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-6">
                      <span className="text-xs text-gray-400 font-semibold block text-right">مصروفات الشهر الحالي</span>
                      <p className="text-3xl font-black text-rose-400 mt-2 text-right">EGP {kpis.monthlyExpenses.toFixed(2)}</p>
                      <span className="text-[10px] text-gray-500 mt-2 block text-right">توريد الشهر + صرف الستاف</span>
                    </div>
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-4">
                      <span className="text-xs text-gray-400 font-semibold block text-right">صافي اليوم</span>
                      <p className={`text-3xl font-black mt-2 text-right ${kpis.todayNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>EGP {kpis.todayNet.toFixed(2)}</p>
                      <span className="text-[10px] text-gray-500 mt-2 block text-right">مبيعات اليوم − مصروفات اليوم</span>
                    </div>
                    <div className="glass-panel rounded-2xl p-6 relative overflow-hidden order-8">
                      <span className="text-xs text-gray-400 font-semibold block text-right">صافي الشهر</span>
                      <p className={`text-3xl font-black mt-2 text-right ${kpis.monthlyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>EGP {kpis.monthlyNet.toFixed(2)}</p>
                      <span className="text-[10px] text-gray-500 mt-2 block text-right">مبيعات الشهر − مصروفات الشهر</span>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {[
                      ['سجل حضور اليوم', todayAttendance],
                      ['سجل حضور الشهر الحالي', monthlyAttendance],
                    ].map(([title, records]) => (
                      <div key={title as string} className="glass-panel rounded-2xl p-5 text-right">
                        <h3 className="font-bold text-sm text-white">{title as string}</h3>
                        <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
                          {(records as AttendanceRecord[]).length ? (records as AttendanceRecord[]).map((record) => {
                            const checkIn = new Date(record.checkedInAt);
                            const checkOut = record.checkedOutAt ? new Date(record.checkedOutAt) : null;
                            const hours = checkOut ? ((checkOut.getTime() - checkIn.getTime()) / 3600000).toFixed(2) : null;
                            return <div key={record.id} className="rounded-lg bg-white/5 px-3 py-2 text-xs">
                              <div className="flex justify-between flex-row-reverse"><span className="font-bold text-white">{record.employeeName}</span><span className={checkOut ? 'text-emerald-400' : 'text-amber-400'}>{checkOut ? `${hours} ساعة` : 'حاضر الآن'}</span></div>
                              <p className="mt-1 text-gray-400">حضور: {checkIn.toLocaleString('ar-EG')}</p>
                              <p className="mt-1 text-gray-400">انصراف: {checkOut ? checkOut.toLocaleString('ar-EG') : 'لم يسجل انصرافًا بعد'}</p>
                            </div>;
                          }) : <p className="py-6 text-center text-xs text-gray-500">لا توجد تسجيلات حضور.</p>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Owner reports: all recorded days, months, and shifts */}
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="glass-panel rounded-2xl p-5 text-right">
                      <div className="flex items-center justify-between flex-row-reverse">
                        <h3 className="font-bold text-sm text-white">المبيعات والمصروفات حسب اليوم</h3>
                        <button
                          onClick={() => setActiveTab('reports')}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                        >
                          عرض التقرير اليومي الشامل ↗
                        </button>
                      </div>
                      <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
                        {dailyReports.length ? dailyReports.map((day) => (
                          <div
                            key={day.date}
                            className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/40 p-3 text-xs transition-all text-right"
                          >
                            <div className="flex justify-between items-center flex-row-reverse">
                              <span className="text-white font-bold">
                                {formatDateArabic(day.date)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openPeriodOrders(day.date, `فواتير يوم: ${formatDateArabic(day.date)}`, 'date')}
                                  className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold text-[10px] transition-all cursor-pointer"
                                  title="عرض فواتير هذا اليوم"
                                >
                                  {day.ordersCount} فاتورة ↗
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('reports');
                                    setReportsSubTab('daily');
                                    setSelectedReportDate(day.date);
                                  }}
                                  className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 hover:bg-purple-500 hover:text-white font-semibold text-[10px] transition-all cursor-pointer"
                                  title="فتح تقرير اليوم بالتفصيل"
                                >
                                  التقرير ↗
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-white/5 text-[11px] text-center">
                              <div>
                                <span className="text-gray-400 block text-[9px]">المبيعات</span>
                                <span className="font-bold text-cyan-400 font-mono">EGP {day.totalSales.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px]">المصروفات</span>
                                <span className="font-bold text-rose-400 font-mono">EGP {day.totalExpenses.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px]">الصافي</span>
                                <span className={`font-bold font-mono ${day.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  EGP {day.netProfit.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )) : <p className="py-6 text-center text-xs text-gray-500">لا توجد سجلات مسجلة.</p>}
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-5 text-right">
                      <div className="flex items-center justify-between flex-row-reverse">
                        <h3 className="font-bold text-sm text-white">المبيعات والمصروفات حسب الشهر</h3>
                        <button
                          onClick={() => {
                            setActiveTab('reports');
                            setReportsSubTab('monthly');
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold cursor-pointer"
                        >
                          عرض التقرير الشهري الشامل ↗
                        </button>
                      </div>
                      <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
                        {monthlyReports.length ? monthlyReports.map((month) => (
                          <div
                            key={month.month}
                            className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-purple-500/40 p-3 text-xs transition-all text-right"
                          >
                            <div className="flex justify-between items-center flex-row-reverse">
                              <span className="text-white font-bold">
                                {formatMonthArabic(month.month)}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openPeriodOrders(month.month, `فواتير شهر: ${formatMonthArabic(month.month)}`, 'month')}
                                  className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 hover:bg-purple-500 hover:text-white font-semibold text-[10px] transition-all cursor-pointer"
                                  title="عرض فواتير هذا الشهر"
                                >
                                  {month.ordersCount} فاتورة ↗
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('reports');
                                    setReportsSubTab('monthly');
                                    setSelectedReportMonth(month.month);
                                  }}
                                  className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500 hover:text-black font-semibold text-[10px] transition-all cursor-pointer"
                                  title="عرض التقرير الشهري المفصل"
                                >
                                  التقرير ↗
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1 pt-1.5 border-t border-white/5 text-[11px] text-center">
                              <div>
                                <span className="text-gray-400 block text-[9px]">مبيعات الشهر</span>
                                <span className="font-bold text-purple-400 font-mono">EGP {month.totalSales.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px]">مصروفات الشهر</span>
                                <span className="font-bold text-rose-400 font-mono">EGP {month.totalExpenses.toFixed(1)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block text-[9px]">صافي الشهر</span>
                                <span className={`font-bold font-mono ${month.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  EGP {month.netProfit.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )) : <p className="py-6 text-center text-xs text-gray-500">لا توجد سجلات مسجلة.</p>}
                      </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-5 text-right">
                      <h3 className="font-bold text-sm text-white">سجل الورديات</h3>
                      <div className="mt-4 max-h-72 overflow-y-auto space-y-2 pr-1">
                        {shiftSummaries.length ? shiftSummaries.map((shift) => (
                          <div key={shift.id} className="rounded-lg bg-white/5 px-3 py-2 text-xs">
                            <div className="flex justify-between flex-row-reverse">
                              <span className="font-semibold text-white">{shift.cashierName}</span>
                              <span className={shift.closedAt ? 'text-gray-400' : 'text-emerald-400'}>{shift.closedAt ? 'مقفلة' : 'مفتوحة'}</span>
                            </div>
                            <p className="mt-1 text-gray-400">{new Date(shift.openedAt).toLocaleString('ar-EG')}</p>
                            <div className="mt-1 flex justify-between items-center flex-row-reverse">
                              <button
                                type="button"
                                onClick={() => openPeriodOrders(shift.id, `فواتير وردية: ${shift.cashierName} (${new Date(shift.openedAt).toLocaleDateString('ar-EG')})`, 'shift')}
                                className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-black text-[10px] font-bold transition-all cursor-pointer"
                              >
                                {shift.orderCount} فاتورة ↗
                              </button>
                              <span className="font-bold text-cyan-400">EGP {shift.totalSales.toFixed(2)}</span>
                            </div>
                            <p className="mt-1 text-[10px] text-gray-500">كاش {shift.cashSales.toFixed(2)} · إنستا باي {shift.instaPaySales.toFixed(2)}</p>
                            {shift.closedAt && (
                              <div className="mt-2 border-t border-white/5 pt-2 text-[10px]">
                                <p className="text-gray-400">الدرج: متوقع EGP {shift.expectedCash.toFixed(2)} · فعلي EGP {(shift.closedCash || 0).toFixed(2)}</p>
                                {shift.varianceCash < 0 ? (
                                  <p className="mt-1 font-bold text-rose-400">عجز كاش: EGP {Math.abs(shift.varianceCash).toFixed(2)}</p>
                                ) : shift.varianceCash > 0 ? (
                                  <p className="mt-1 font-bold text-emerald-400">زيادة كاش: EGP {shift.varianceCash.toFixed(2)}</p>
                                ) : (
                                  <p className="mt-1 font-bold text-emerald-400">الكاش مطابق للتسوية</p>
                                )}
                              </div>
                            )}
                          </div>
                        )) : <p className="py-6 text-center text-xs text-gray-500">لا توجد ورديات مسجلة.</p>}
                      </div>
                    </div>
                  </div>

                  {/* Charts & Warning Widgets */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Top Selling Items (Custom SVG Horizontal Bar Chart) */}
                    <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-row-reverse">
                        <div className="flex items-center gap-2 flex-row-reverse">
                          <h3 className="font-bold text-sm text-white text-right">الأصناف الأكثر مبيعًا</h3>
                          {displayedTopItems.length > 0 && (
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-400 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                              {displayedTopItems.length} صنف
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 rounded-lg bg-slate-900/70 p-1">
                          {([
                            ['today', 'اليوم'],
                            ['month', 'الشهر'],
                            ['all', 'كل الوقت'],
                          ] as const).map(([period, label]) => (
                            <button
                              key={period}
                              onClick={() => setTopItemsPeriod(period)}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${topItemsPeriod === period ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-3 pt-2 max-h-[440px] overflow-y-auto pl-1 pr-1 custom-scrollbar">
                        {displayedTopItems.length > 0 ? (
                          displayedTopItems.map((item, idx) => {
                            const barPct = Math.max((item.total / maxItemTotal) * 100, 2);
                            return (
                              <div key={idx} className="space-y-1.5 p-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/70 transition-colors border border-white/5">
                                <div className="flex justify-between text-xs font-semibold flex-row-reverse text-right items-center">
                                  <div className="flex items-center gap-2 flex-row-reverse">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-gray-400'}`}>
                                      {idx + 1}
                                    </span>
                                    <span className="text-white">{item.name}</span>
                                    <span className="text-cyan-400 text-[11px] font-semibold bg-cyan-950/70 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                      {item.qty} {item.qty === 1 ? 'قطعة' : 'قطع'}
                                    </span>
                                  </div>
                                  <span className="text-emerald-400 font-bold">EGP {item.total.toFixed(2)}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-l from-cyan-500 to-purple-600 rounded-full transition-all duration-500"
                                    style={{ width: `${barPct}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-xs text-gray-500 italic py-6 text-center">لا توجد مبيعات في هذه الفترة.</p>
                        )}
                      </div>
                    </div>

                    {/* Live Inventory Alert Status Widget */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
                      <h3 className="font-bold text-sm text-white flex items-center gap-2 flex-row-reverse justify-start">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>خامات أوشكت على النفاد</span>
                      </h3>

                      <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[220px] pl-1">
                        {lowStock.length > 0 ? (
                          lowStock.map((alert) => (
                            <div key={alert.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between gap-3 text-xs flex-row-reverse">
                              <div className="text-right">
                                <h4 className="font-semibold text-white">{alert.name}</h4>
                                <p className="text-gray-500 mt-0.5">حد الأمان للتنبيه: {alert.minStockLevel} {alert.deductUnit}</p>
                              </div>
                              <div className="text-left shrink-0">
                                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full font-bold text-[10px]">
                                  {alert.stockQty} {alert.deductUnit} متبقي
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-1.5 py-6">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400/80 stroke-1" />
                            <p className="text-xs">كل خامات ومكونات المخزن آمنة</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown & Recent Orders */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Payment breakdown rings */}
                    <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between gap-4">
                      <h3 className="font-bold text-sm text-white text-right">طرق تحصيل النقدية اليوم</h3>
                      
                      <div className="space-y-4 py-2">
                        {totalPaymentSum > 1 ? (
                          <>
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs flex-row-reverse">
                                <span className="text-cyan-400 font-semibold">كاش (درج النقدية)</span>
                                <span className="font-bold text-white">EGP {payments.cash.toFixed(2)} ({cashPct}%)</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${cashPct}%` }}></div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-xs flex-row-reverse">
                                <span className="text-purple-400 font-semibold">إنستا باي (InstaPay)</span>
                                <span className="font-bold text-white">EGP {payments.instapay.toFixed(2)} ({instapayPct}%)</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${instapayPct}%` }}></div>
                              </div>
                            </div>

                          </>
                        ) : (
                          <p className="text-xs text-gray-500 italic py-6 text-center">لا توجد مبيعات لحساب النسب حالياً.</p>
                        )}
                      </div>
                    </div>

                    {/* Recent sales orders list */}
                    <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-4">
                      <h3 className="font-bold text-sm text-white text-right">آخر الفواتير الصادرة</h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-white/5 text-gray-500">
                              <th className="py-2.5">رقم الفاتورة</th>
                              <th className="py-2.5">الوقت</th>
                              <th className="py-2.5">نوع الأوردر</th>
                              <th className="py-2.5">طريقة الدفع</th>
                              <th className="py-2.5 text-left font-bold">الحساب</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentOrders.length > 0 ? (
                              recentOrders.map((ord) => (
                                <tr key={ord.id} onClick={() => openOrderDetails(ord.id)} className="border-b border-white/5 text-gray-300 cursor-pointer hover:bg-cyan-500/5 transition-colors">
                                  <td className="py-3">
                                    <p className="font-mono text-cyan-400 underline underline-offset-4 decoration-cyan-400/40">{ord.receiptNumber || ord.id.slice(0, 8)}</p>
                                    {ord.discount > 0 && <p className="mt-1 text-[10px] font-bold text-rose-300">خصم: EGP {ord.discount.toFixed(2)}</p>}
                                  </td>
                                  <td className="py-3">{new Date(ord.createdAt).toLocaleTimeString()}</td>
                                  <td className="py-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                        ord.orderType === 'DINE_IN' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'
                                      }`}>
                                        {ord.orderType === 'DINE_IN' ? `صالة (${ord.table?.name || 'طاولة'})` : 'تيك أواي'}
                                      </span>
                                  </td>
                                  <td className="py-3 font-bold text-[10px] uppercase tracking-wider">{ord.paymentMethod === 'CASH' ? 'كاش' : 'إنستا باي'}</td>
                                  <td className="py-3 text-left font-bold text-white">EGP {ord.total.toFixed(2)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-gray-500 italic">مفيش فواتير صدرت لسه.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* TAB 2: INVENTORY STOCK MANAGEMENT */}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-row-reverse">
                <div className="text-right">
                  <h2 className="text-xl font-bold text-white">مخزن وجرد الخامات</h2>
                  <p className="text-xs text-gray-400 mt-1">تابع رصيد المكونات والخامات الحالي، وسجل التوريدات الجديدة.</p>
                </div>
                <div className="flex gap-3 flex-row-reverse">
                  <button 
                    onClick={() => setShowAddMaterial(true)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>إضافة مادة خام جديدة</span>
                  </button>

                  <button 
                    onClick={() => { setSelectedMaterialId(materials[0]?.id || ''); setShowRestock(true); }}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>توريد خامات جديدة</span>
                  </button>
                </div>
              </div>

              {loadingInventory ? (
                <div className="h-96 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>جاري تحميل بيانات وجرد المخزن...</span>
                </div>
              ) : (
                <>
                <div className="glass-panel rounded-2xl p-4 flex items-center justify-between flex-row-reverse">
                  <div><p className="text-xs text-gray-400">مصروفات التوريد هذا الشهر</p><p className="text-2xl font-bold text-amber-400 mt-1">EGP {monthlyRestockTotal.toFixed(2)}</p></div>
                  <span className="text-xs text-gray-500">يشمل كل التوريدات المسجلة</span>
                </div>
                <div className="glass-panel rounded-2xl p-3">
                  <div className="flex items-center justify-between mb-2 text-[10px] text-gray-400">
                    <span>اسحب الجدول يمينًا ويسارًا أو استخدم الأسهم</span>
                    <div className="flex gap-1" dir="ltr">
                      <button type="button" onClick={() => inventoryTableScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })} className="px-2 py-1 rounded bg-white/10 text-white">←</button>
                      <button type="button" onClick={() => inventoryTableScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })} className="px-2 py-1 rounded bg-white/10 text-white">→</button>
                    </div>
                  </div>
                  <div ref={inventoryTableScrollRef} className="w-full max-h-[55dvh] overflow-auto touch-auto overscroll-contain rounded-xl border border-white/5" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'auto' }}>
                  <table className="min-w-[900px] text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 border-b border-white/5 text-gray-400">
                        <th className="p-4">اسم المادة الخام</th>
                        <th className="p-4">الرصيد الحالي بالمخزن</th>
                        <th className="p-4">حد التنبيه للنفاد</th>
                        <th className="p-4">الوحدة</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4">العمليات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((mat) => (
                        <tr key={mat.id} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                          <td className="p-4 font-semibold text-white">{mat.name}</td>
                          <td className="p-4 font-mono font-bold text-cyan-400">
                            {mat.stockQty} {mat.deductUnit}
                          </td>
                          <td className="p-4"><button onClick={() => handleUpdateStockAlertLevel(mat)} className="text-gray-300 hover:text-cyan-400 underline decoration-dotted underline-offset-4">{mat.minStockLevel} {mat.deductUnit}</button></td>
                          <td className="p-4 text-gray-500 uppercase tracking-wider">{mat.deductUnit}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              mat.isLowStock 
                                ? 'bg-red-500/10 text-red-400 border border-red-500/15' 
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                            }`}>
                              {mat.isLowStock ? 'ناقص / يحتاج توريد' : 'آمن وممتاز'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2 flex-row-reverse">
                              <button
                                onClick={() => { setSelectedMaterialId(mat.id); setQtyInput(''); setShowRestock(true); }}
                                className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg text-[10px] font-bold transition-all"
                              >
                                توريد
                              </button>
                              <button
                                onClick={() => setEditingMaterial({ ...mat })}
                                className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-lg text-[10px] font-bold transition-all"
                              >
                                تعديل
                              </button>
                              <button
                                onClick={() => void handleDeleteMaterial(mat)}
                                disabled={submitLoading}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 font-bold text-sm text-white">سجل التوريدات</div>
                  <div className="max-h-64 overflow-y-auto"><table className="w-full text-right text-xs"><thead><tr className="text-gray-500 border-b border-white/5"><th className="p-3">التاريخ والوقت</th><th className="p-3">الخامة</th><th className="p-3">الكمية</th><th className="p-3">المبلغ</th></tr></thead><tbody>{restockLogs.length ? restockLogs.map((log) => <tr key={log.id} className="border-b border-white/5 text-gray-300"><td className="p-3">{new Date(log.createdAt).toLocaleString('ar-EG')}</td><td className="p-3 font-semibold text-white">{log.rawMaterial.name}</td><td className="p-3">{log.quantity} {log.rawMaterial.purchaseUnit}</td><td className="p-3 font-bold text-amber-400">EGP {log.amount.toFixed(2)}</td></tr>) : <tr><td colSpan={4} className="p-6 text-center text-gray-500">لا توجد توريدات مسجلة بعد.</td></tr>}</tbody></table></div>
                </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: RECIPES MANAGEMENT (BOM) */}
          {activeTab === 'recipes' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4 flex-row-reverse">
                <div className="text-right">
                  <h2 className="text-xl font-bold text-white">إدارة وصفات ومكونات الأصناف (BOM)</h2>
                  <p className="text-xs text-gray-400 mt-1">حدد المكونات والخامات التي يستهلكها كل صنف أو إضافة ليتم خصمها تلقائياً من المخزن فور البيع.</p>
                </div>
                <button onClick={openAddMenuItem} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <PlusCircle className="w-4 h-4" />
                  إضافة صنف
                </button>
              </div>

              {loadingRecipes ? (
                <div className="h-96 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>جاري تحميل قائمة الوصفات والمنتجات...</span>
                </div>
              ) : selectedRecipeTarget ? (
                // --- RECIPE BUILDER WORKSPACE ---
                <div className="glass-panel rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-row-reverse">
                    <div className="text-right">
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-bold">
                        {selectedRecipeTarget.type === 'item' ? 'صنف منيو' : 'إضافة للطلب'}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">تعديل مقادير الوصفة لـ: {selectedRecipeTarget.name}</h3>
                    </div>
                    <button
                      onClick={() => setSelectedRecipeTarget(null)}
                      className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 text-xs font-semibold"
                    >
                      إلغاء والرجوع للقائمة
                    </button>
                  </div>

                  <form onSubmit={handleSaveRecipeSubmit} className="space-y-5">
                    <div className="space-y-3">
                      <div className="grid grid-cols-12 gap-4 text-xs text-gray-400 font-bold px-2 flex-row-reverse text-right">
                        <div className="col-span-6">اسم المادة الخام من المخزن</div>
                        <div className="col-span-4">الكمية المستهلكة (بوحدة الاستهلاك الصغرى)</div>
                        <div className="col-span-2 text-left">حذف</div>
                      </div>

                      {recipeIngredients.map((ing, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-6">
                            <select
                              required
                              value={ing.rawMaterialId}
                              onChange={(e) => updateRecipeRow(idx, 'rawMaterialId', e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                            >
                              <option value="">اختار المادة الخام...</option>
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} ({m.deductUnit})</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-4 relative">
                            <input
                              type="number"
                              required
                              value={ing.quantity || ''}
                              onChange={(e) => updateRecipeRow(idx, 'quantity', e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 pl-12 pr-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right"
                              placeholder="0.00"
                              min="0"
                              step="any"
                            />
                            <span className="absolute left-3 top-2 text-[10px] text-gray-500">
                              {materials.find(m => m.id === ing.rawMaterialId)?.deductUnit || ''}
                            </span>
                          </div>
                          <div className="col-span-2 text-left">
                            <button
                              type="button"
                              onClick={() => removeRecipeRow(idx)}
                              className="p-2 text-rose-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-white/5 justify-between">
                      <button
                        type="button"
                        onClick={addRecipeRow}
                        className="px-3.5 py-2 border border-dashed border-white/10 hover:border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>إضافة مادة خام للوصفة</span>
                      </button>

                      <button
                        type="submit"
                        disabled={submitLoading}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/10"
                      >
                        {submitLoading ? 'جاري الحفظ...' : 'حفظ وتثبيت الوصفة'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                // --- RECIPES LIST VIEWER ---
                <div className="grid grid-cols-1 gap-6">
                  {/* Items Recipes */}
                  <div className="glass-panel rounded-2xl p-6 space-y-4">
                    <h3 className="font-bold text-sm text-white text-right pb-2 border-b border-white/5">وصفات أصناف المنيو</h3>
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto pl-1">
                      {recipesItems.map((item) => (
                        <div key={item.id} className="p-3.5 bg-slate-900/50 border border-white/5 rounded-xl flex items-center justify-between gap-4 text-xs flex-row-reverse">
                          <div className="text-right">
                            <h4 className="font-bold text-white text-sm">{item.name}</h4>
                            <p className="text-gray-500 mt-1">
                              {item.recipe.length > 0 ? (
                                <span className="flex flex-wrap gap-1 mt-0.5 justify-start">
                                  {item.recipe.map((ing: any, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-white/5 rounded border border-white/5 text-[10px] text-gray-300">
                                      {ing.rawMaterial.name} ({ing.quantity}{ing.rawMaterial.deductUnit})
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-500">لا توجد وصفة (لن يخصم من المخزن)</span>
                              )}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleAdminUpdateItemPrice(item)}
                              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg font-semibold transition-all"
                            >
                              السعر: EGP {item.price.toFixed(2)}
                            </button>
                            <button
                              onClick={() => startEditRecipe({ type: 'item', id: item.id, name: item.name, recipe: item.recipe })}
                              className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg font-semibold transition-all"
                            >
                              تعديل الوصفة
                            </button>
                            <button
                              onClick={() => handleRemoveMenuItem(item)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-semibold transition-all"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXPENSES & CASH PAYOUTS LOG */}
          {activeTab === 'expenses' && (() => {
            const effectiveDay = selectedExpenseDate || (dailyExpenses[0]?.period || '');
            const effectiveMonth = selectedExpenseMonth || (monthlyExpensesHistory[0]?.period || '');

            // 1. Day Data
            const dayPayouts = cashTransactions.filter(
              (t) => t.type === 'PAYOUT' && (t.createdAt?.slice(0, 10) === effectiveDay || t.operatingDate?.slice?.(0, 10) === effectiveDay)
            );
            const dayRestocks = restockLogs.filter((l) => l.createdAt?.slice(0, 10) === effectiveDay);
            const dayPayoutsSum = dayPayouts.reduce((sum, t) => sum + t.amount, 0);
            const dayRestocksSum = dayRestocks.reduce((sum, l) => sum + l.amount, 0);
            const dayTotalExpenses = dayPayoutsSum + dayRestocksSum;

            const dayAllTransactions = [
              ...dayPayouts.map((p) => ({
                id: p.id,
                kind: 'PAYOUT' as const,
                title: p.reason,
                actor: p.cashierName,
                amount: p.amount,
                createdAt: p.createdAt,
              })),
              ...dayRestocks.map((r) => ({
                id: r.id,
                kind: 'RESTOCK' as const,
                title: `توريد ${r.rawMaterial?.name || 'خامة'} (${r.quantity} ${r.rawMaterial?.purchaseUnit || ''})`,
                actor: 'المخزن',
                amount: r.amount,
                createdAt: r.createdAt,
              })),
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const filteredDayTxList = dayAllTransactions.filter((item) => {
              if (expenseFilterType === 'PAYOUTS' && item.kind !== 'PAYOUT') return false;
              if (expenseFilterType === 'RESTOCKS' && item.kind !== 'RESTOCK') return false;
              if (expenseSearch) {
                const s = expenseSearch.toLowerCase();
                return item.title.toLowerCase().includes(s) || item.actor.toLowerCase().includes(s);
              }
              return true;
            });

            // 2. Month Data
            const monthReport = monthlyExpensesHistory.find((m) => m.period === effectiveMonth) || {
              period: effectiveMonth || '',
              total: 0,
              payoutsTotal: 0,
              restocksTotal: 0,
              count: 0,
            };
            const monthPayoutsSum = monthReport.payoutsTotal;
            const monthRestocksSum = monthReport.restocksTotal;
            const monthTotalExpenses = monthReport.total;

            const monthAllTransactions = [
              ...cashTransactions
                .filter((t) => t.type === 'PAYOUT' && (t.createdAt?.startsWith(effectiveMonth) || t.operatingDate?.startsWith?.(effectiveMonth)))
                .map((p) => ({
                  id: p.id,
                  kind: 'PAYOUT' as const,
                  title: p.reason,
                  actor: p.cashierName,
                  amount: p.amount,
                  createdAt: p.createdAt,
                })),
              ...restockLogs
                .filter((l) => l.createdAt?.startsWith(effectiveMonth))
                .map((r) => ({
                  id: r.id,
                  kind: 'RESTOCK' as const,
                  title: `توريد ${r.rawMaterial?.name || 'خامة'} (${r.quantity} ${r.rawMaterial?.purchaseUnit || ''})`,
                  actor: 'المخزن',
                  amount: r.amount,
                  createdAt: r.createdAt,
                })),
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const filteredMonthTxList = monthAllTransactions.filter((item) => {
              if (expenseFilterType === 'PAYOUTS' && item.kind !== 'PAYOUT') return false;
              if (expenseFilterType === 'RESTOCKS' && item.kind !== 'RESTOCK') return false;
              if (expenseSearch) {
                const s = expenseSearch.toLowerCase();
                return item.title.toLowerCase().includes(s) || item.actor.toLowerCase().includes(s);
              }
              return true;
            });

            return (
              <div className="space-y-4 sm:space-y-6">
                {/* Header with Sub-tab Switcher: Daily vs Monthly */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 no-print text-right" dir="rtl">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
                      <span>سجل وإدارة المصروفات</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                      خانة مخصصة لليوميات وأخرى للشهر بالكامل مع إمكانية فتح أي يوم أو شهر لمعرفة تفاصيل كل ما حدث فيه بدقة.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Dedicated Sub-tab Pills (Full width grid on mobile) */}
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-white/10 w-full sm:w-auto gap-1">
                      <button
                        type="button"
                        onClick={() => setExpensesSubTab('daily')}
                        className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          expensesSubTab === 'daily'
                            ? 'bg-cyan-500 text-black shadow-md font-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">📅 يوميات المصروفات (حسب اليوم)</span>
                        <span className="sm:hidden">📅 اليوميات</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpensesSubTab('monthly')}
                        className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          expensesSubTab === 'monthly'
                            ? 'bg-purple-500 text-white shadow-md font-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">🗓️ مصروفات الشهور (حسب الشهر)</span>
                        <span className="sm:hidden">🗓️ الشهور</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={fetchAnalytics}
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl transition-all shrink-0"
                      title="تحديث البيانات"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingAnalytics ? 'animate-spin text-cyan-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* 1. KHANAT AL-YAWMIYAT (يوميات المصروفات حسب اليوم) */}
                {/* ======================================================== */}
                {expensesSubTab === 'daily' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Day Selection Bar */}
                    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 text-right no-print" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-xs font-bold text-gray-300 shrink-0">اختر أي يوم:</span>
                          <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/40 px-3 py-1.5 rounded-xl">
                            <CalendarDays className="w-4 h-4 text-cyan-400 shrink-0" />
                            <input
                              type="date"
                              value={effectiveDay}
                              onChange={(e) => setSelectedExpenseDate(e.target.value)}
                              className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Quick Pills */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const today = new Date().toISOString().slice(0, 10);
                              setSelectedExpenseDate(today);
                            }}
                            className="py-1 px-3 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all text-center"
                          >
                            اليوم
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() - 1);
                              setSelectedExpenseDate(d.toISOString().slice(0, 10));
                            }}
                            className="py-1 px-3 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all text-center"
                          >
                            أمس
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-center shrink-0">
                          📅 {formatDateArabic(effectiveDay)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('reports');
                            setReportsSubTab('daily');
                            setSelectedReportDate(effectiveDay);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
                        >
                          <span>التقرير المالي لهذا اليوم ↗</span>
                        </button>
                      </div>
                    </div>

                    {/* Day Hero KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right relative overflow-hidden border-rose-500/30">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">إجمالي مصروفات اليوم</span>
                        <p className="text-lg sm:text-2xl lg:text-3xl font-black text-rose-400 mt-1 font-mono truncate">
                          EGP {dayTotalExpenses.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          مسحوبات + فواتير
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">مسحوبات درج الكاشير</span>
                        <p className="text-lg sm:text-2xl font-black text-amber-400 mt-1 font-mono truncate">
                          EGP {dayPayoutsSum.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          {dayPayouts.length} عمليات سحب نقدي
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">فواتير توريد الخامات</span>
                        <p className="text-lg sm:text-2xl font-black text-cyan-400 mt-1 font-mono truncate">
                          EGP {dayRestocksSum.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          {dayRestocks.length} فواتير توريد مخزن
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">عدد الحركات المنصرفة</span>
                        <p className="text-lg sm:text-2xl font-black text-purple-300 mt-1 font-mono truncate">
                          {dayAllTransactions.length} <span className="text-xs font-normal text-gray-400">حركة</span>
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          سجلات الصرف في هذا اليوم
                        </span>
                      </div>
                    </div>

                    {/* Day Detailed Statement */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4 text-right" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                            <span>كشف حساب ما حدث في يوم: {formatDateArabic(effectiveDay)}</span>
                          </h3>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            قائمة تفصيلية بجميع المسحوبات ومشتريات الخامات المنصرفة في هذا اليوم بالاسم والوقت والمبلغ.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          {/* Filter pills */}
                          <div className="grid grid-cols-3 sm:flex items-center p-1 rounded-xl bg-slate-900 border border-white/5">
                            {(['ALL', 'PAYOUTS', 'RESTOCKS'] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setExpenseFilterType(type)}
                                className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap ${
                                  expenseFilterType === type
                                    ? 'bg-amber-500 text-black'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                              >
                                {type === 'ALL' && `الكل (${dayAllTransactions.length})`}
                                {type === 'PAYOUTS' && `الدرج (${dayPayouts.length})`}
                                {type === 'RESTOCKS' && `المخزن (${dayRestocks.length})`}
                              </button>
                            ))}
                          </div>

                          <div className="w-full sm:w-48">
                            <input
                              type="text"
                              value={expenseSearch}
                              onChange={(e) => setExpenseSearch(e.target.value)}
                              placeholder="بحث في البنود..."
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-right"
                            />
                          </div>
                        </div>
                      </div>

                      {filteredDayTxList.length ? (
                        <>
                          {/* Mobile Cards View (< sm) */}
                          <div className="sm:hidden space-y-2.5">
                            {filteredDayTxList.map((item) => (
                              <div key={item.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sm text-white">{item.title}</span>
                                  <span className="font-bold font-mono text-rose-400 text-sm shrink-0">
                                    EGP {item.amount.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.kind === 'PAYOUT'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  }`}>
                                    {item.kind === 'PAYOUT' ? 'مسحوب نقدية من الدرج' : 'توريد خامة للمخزن'}
                                  </span>
                                  <span>بواسطة: {item.actor}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  {new Date(item.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table View (>= sm) */}
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400">
                                  <th className="p-3.5">المبلغ</th>
                                  <th className="p-3.5">البيان / السبب</th>
                                  <th className="p-3.5">النوع</th>
                                  <th className="p-3.5">المسؤول / الكاشير</th>
                                  <th className="p-3.5">التوقيت</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredDayTxList.map((item) => (
                                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                                    <td className="p-3.5 font-bold font-mono text-rose-400 text-sm">
                                      EGP {item.amount.toFixed(2)}
                                    </td>
                                    <td className="p-3.5 font-semibold text-white">
                                      {item.title}
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                        item.kind === 'PAYOUT'
                                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                      }`}>
                                        {item.kind === 'PAYOUT' ? 'مسحوب نقدية من الدرج' : 'توريد وشحن خامة للمخزن'}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-gray-300">
                                      {item.actor}
                                    </td>
                                    <td className="p-3.5 font-mono text-gray-400 text-[11px]">
                                      {new Date(item.createdAt).toLocaleTimeString('ar-EG', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <p className="py-8 text-center text-xs text-gray-500">لا توجد مسحوبات أو مشتريات خامات مطابقة لهذا اليوم.</p>
                      )}
                    </div>

                    {/* All Days Archive (يوميات الأيام السابقة) */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4 text-right no-print" dir="rtl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg">
                          {dailyExpenses.length} يوم مسجل
                        </span>
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
                            <span>أرشيف مصروفات الأيام السابقة (يوم بيوم)</span>
                          </h3>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            اضغط على أي يوم لعرض تفاصيل كل ما تم صرفه وسحبه فيه.
                          </p>
                        </div>
                      </div>

                      {/* Mobile Cards for Days Archive (< sm) */}
                      <div className="sm:hidden space-y-2.5">
                        {dailyExpenses.map((day) => {
                          const isCur = effectiveDay === day.period;
                          return (
                            <div
                              key={day.period}
                              className={`p-3.5 rounded-xl border transition-all text-right space-y-2.5 ${
                                isCur
                                  ? 'bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                                  : 'bg-slate-900/60 border-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-white">
                                  {formatDateArabic(day.period)}
                                </span>
                                <span className="font-mono font-bold text-rose-400 text-sm">
                                  EGP {day.total.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-gray-400">
                                <span>درج: {day.payoutsTotal.toFixed(0)}</span>
                                <span>مخزن: {day.restocksTotal.toFixed(0)}</span>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 font-mono font-bold text-[10px]">
                                  {day.count} حركة
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedExpenseDate(day.period)}
                                className={`w-full py-2 rounded-lg text-xs font-bold transition-all text-center ${
                                  isCur
                                    ? 'bg-cyan-500 text-black shadow-md'
                                    : 'bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/5'
                                }`}
                              >
                                {isCur ? 'المعروض حالياً ✓' : 'عرض مصروفات هذا اليوم ↗'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table for Days Archive (>= sm) */}
                      <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5 max-h-96">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                              <th className="p-3.5">تاريخ اليوم</th>
                              <th className="p-3.5">إجمالي المصروفات</th>
                              <th className="p-3.5">مسحوبات الدرج</th>
                              <th className="p-3.5">توريدات المخزن</th>
                              <th className="p-3.5">عدد الحركات</th>
                              <th className="p-3.5">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyExpenses.map((day) => {
                              const isCur = effectiveDay === day.period;
                              return (
                                <tr
                                  key={day.period}
                                  className={`border-b border-white/5 transition-colors ${
                                    isCur ? 'bg-cyan-500/10 text-white font-semibold' : 'hover:bg-white/5 text-gray-300'
                                  }`}
                                >
                                  <td className="p-3.5 font-bold">
                                    {formatDateArabic(day.period)} <span className="text-gray-500 text-[10px] font-mono">({day.period})</span>
                                  </td>
                                  <td className="p-3.5 font-mono font-bold text-rose-400">
                                    EGP {day.total.toFixed(2)}
                                  </td>
                                  <td className="p-3.5 font-mono text-amber-400">
                                    EGP {day.payoutsTotal.toFixed(2)}
                                  </td>
                                  <td className="p-3.5 font-mono text-cyan-400">
                                    EGP {day.restocksTotal.toFixed(2)}
                                  </td>
                                  <td className="p-3.5 font-mono">
                                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-gray-300 text-[11px]">
                                      {day.count} حركة
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedExpenseDate(day.period)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        isCur
                                          ? 'bg-cyan-500 text-black shadow-md'
                                          : 'bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/5'
                                      }`}
                                    >
                                      {isCur ? 'المعروض حالياً ✓' : 'عرض مصروفات اليوم ↗'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. KHANAT AL-SHAHR (مصروفات الشهور حسب الشهر) */}
                {/* ======================================================== */}
                {expensesSubTab === 'monthly' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Month Selection Bar */}
                    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 text-right no-print" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-xs font-bold text-white shrink-0">اختر الشهر:</span>
                          <div className="flex items-center gap-2 bg-slate-900 border border-purple-500/40 px-3 py-1.5 rounded-xl">
                            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                            <select
                              value={effectiveMonth}
                              onChange={(e) => setSelectedExpenseMonth(e.target.value)}
                              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                            >
                              {monthlyExpensesHistory.map((m) => (
                                <option key={m.period} value={m.period} className="bg-slate-900 text-white">
                                  {formatMonthArabic(m.period)} ({m.period})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const thisMonth = new Date().toISOString().slice(0, 7);
                            setSelectedExpenseMonth(thisMonth);
                          }}
                          className="py-1 px-3 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 transition-all text-center w-full sm:w-auto"
                        >
                          الشهر الحالي
                        </button>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2">
                        <span className="text-xs text-purple-400 font-bold bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl text-center shrink-0">
                          🗓️ {formatMonthArabic(effectiveMonth)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('reports');
                            setReportsSubTab('monthly');
                            setSelectedReportMonth(effectiveMonth);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs transition-all flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
                        >
                          <span>التقرير المالي لهذا الشهر ↗</span>
                        </button>
                      </div>
                    </div>

                    {/* Month Hero KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right border-purple-500/30">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">توتال مصروفات الشهر</span>
                        <p className="text-lg sm:text-2xl lg:text-3xl font-black text-rose-400 mt-1 font-mono truncate">
                          EGP {monthTotalExpenses.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          شهر {formatMonthArabic(effectiveMonth)}
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">مسحوبات الدرج</span>
                        <p className="text-lg sm:text-2xl font-black text-amber-400 mt-1 font-mono truncate">
                          EGP {monthPayoutsSum.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          مسحوبات الكاشير التراكمية
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">توريدات المخزن</span>
                        <p className="text-lg sm:text-2xl font-black text-cyan-400 mt-1 font-mono truncate">
                          EGP {monthRestocksSum.toFixed(2)}
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          فواتير الخامات التراكمية
                        </span>
                      </div>

                      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 text-right">
                        <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">عدد الحركات المنصرفة</span>
                        <p className="text-lg sm:text-2xl font-black text-purple-300 mt-1 font-mono truncate">
                          {monthReport.count || monthAllTransactions.length} <span className="text-xs font-normal text-gray-400">حركة</span>
                        </p>
                        <span className="text-[9px] sm:text-[10px] text-gray-500 mt-1 block truncate">
                          إجمالي حركات الشهر
                        </span>
                      </div>
                    </div>

                    {/* Month Detailed Statement */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4 text-right" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
                            <span>كشف حساب ما حدث في شهر: {formatMonthArabic(effectiveMonth)}</span>
                          </h3>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            قائمة بجميع المسحوبات ومشتريات الخامات المنصرفة طوال هذا الشهر بالكامل.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="grid grid-cols-3 sm:flex items-center p-1 rounded-xl bg-slate-900 border border-white/5">
                            {(['ALL', 'PAYOUTS', 'RESTOCKS'] as const).map((type) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setExpenseFilterType(type)}
                                className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap ${
                                  expenseFilterType === type
                                    ? 'bg-purple-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                              >
                                {type === 'ALL' && `الكل (${monthAllTransactions.length})`}
                                {type === 'PAYOUTS' && 'الدرج'}
                                {type === 'RESTOCKS' && 'المخزن'}
                              </button>
                            ))}
                          </div>

                          <div className="w-full sm:w-48">
                            <input
                              type="text"
                              value={expenseSearch}
                              onChange={(e) => setExpenseSearch(e.target.value)}
                              placeholder="بحث في بنود الشهر..."
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-right"
                            />
                          </div>
                        </div>
                      </div>

                      {filteredMonthTxList.length ? (
                        <>
                          {/* Mobile Cards for Month Tx (< sm) */}
                          <div className="sm:hidden space-y-2.5">
                            {filteredMonthTxList.map((item) => (
                              <div key={item.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sm text-white">{item.title}</span>
                                  <span className="font-bold font-mono text-rose-400 text-sm shrink-0">
                                    EGP {item.amount.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    item.kind === 'PAYOUT'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                  }`}>
                                    {item.kind === 'PAYOUT' ? 'مسحوب نقدية من الدرج' : 'توريد خامة للمخزن'}
                                  </span>
                                  <span>بواسطة: {item.actor}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 font-mono">
                                  {new Date(item.createdAt).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table for Month Tx (>= sm) */}
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400">
                                  <th className="p-3.5">المبلغ</th>
                                  <th className="p-3.5">البيان / السبب</th>
                                  <th className="p-3.5">النوع</th>
                                  <th className="p-3.5">المسؤول / الكاشير</th>
                                  <th className="p-3.5">التاريخ والوقت</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredMonthTxList.map((item) => (
                                  <tr key={item.id} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                                    <td className="p-3.5 font-bold font-mono text-rose-400 text-sm">
                                      EGP {item.amount.toFixed(2)}
                                    </td>
                                    <td className="p-3.5 font-semibold text-white">
                                      {item.title}
                                    </td>
                                    <td className="p-3.5">
                                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                        item.kind === 'PAYOUT'
                                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                      }`}>
                                        {item.kind === 'PAYOUT' ? 'مسحوب نقدية من الدرج' : 'توريد وشحن خامة للمخزن'}
                                      </span>
                                    </td>
                                    <td className="p-3.5 text-gray-300">
                                      {item.actor}
                                    </td>
                                    <td className="p-3.5 font-mono text-gray-400 text-[11px]">
                                      {new Date(item.createdAt).toLocaleString('ar-EG', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <p className="py-8 text-center text-xs text-gray-500">لا توجد حركات مسجلة لهذا الشهر.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB: COMPREHENSIVE DAILY & MONTHLY REPORTS */}
          {activeTab === 'reports' && (() => {
            const effectiveReportDay = selectedReportDate || (dailyReports[0]?.date || '');
            const effectiveReportMonth = selectedReportMonth || (monthlyReports[0]?.month || '');

            const activeDayReport = dailyReports.find((r) => r.date === effectiveReportDay) || {
              date: effectiveReportDay || '',
              ordersCount: 0,
              totalSales: 0,
              cashSales: 0,
              instaPaySales: 0,
              totalExpenses: 0,
              payoutsTotal: 0,
              restocksTotal: 0,
              expensesCount: 0,
              netProfit: 0,
              itemsSold: [],
            };

            const dayExpensesList = [
              ...cashTransactions
                .filter((t) => t.type === 'PAYOUT' && (t.createdAt?.slice(0, 10) === effectiveReportDay || t.operatingDate?.slice?.(0, 10) === effectiveReportDay))
                .map((t) => ({
                  id: t.id,
                  type: 'مسحوبات درج (كاشير)',
                  title: t.reason,
                  amount: t.amount,
                  actor: t.cashierName,
                  createdAt: t.createdAt,
                })),
              ...restockLogs
                .filter((l) => l.createdAt?.slice(0, 10) === effectiveReportDay)
                .map((l) => ({
                  id: l.id,
                  type: 'توريد وشحن خامات',
                  title: `توريد ${l.rawMaterial?.name || 'خامة'} (${l.quantity} ${l.rawMaterial?.purchaseUnit || ''})`,
                  amount: l.amount,
                  actor: 'المخزن',
                  createdAt: l.createdAt,
                })),
            ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            // Items sold for this day
            const dayItemsSold = (activeDayReport.itemsSold || []).filter((item) => {
              if (!dailyReportItemSearch) return true;
              return item.name.toLowerCase().includes(dailyReportItemSearch.toLowerCase());
            });

            const dayTotalItemsQty = (activeDayReport.itemsSold || []).reduce((sum, item) => sum + item.qty, 0);

            // Filtered day sales orders
            const filteredDayOrders = selectedDayReportOrders.filter((order) => {
              if (!dayReportSearch) return true;
              const s = dayReportSearch.toLowerCase();
              const matchReceipt = order.receiptNumber?.toLowerCase().includes(s);
              const matchTable = order.table?.name?.toLowerCase().includes(s);
              const matchItems = order.items?.some((i: any) => i.item?.name?.toLowerCase().includes(s));
              return matchReceipt || matchTable || matchItems;
            });

            // Month specific report data
            const activeMonthReport = monthlyReports.find((m) => m.month === effectiveReportMonth) || {
              month: effectiveReportMonth || '',
              ordersCount: 0,
              totalSales: 0,
              cashSales: 0,
              instaPaySales: 0,
              totalExpenses: 0,
              payoutsTotal: 0,
              restocksTotal: 0,
              expensesCount: 0,
              netProfit: 0,
              itemsSold: [],
            };

            const monthDaysList = dailyReports.filter((r) => r.date.startsWith(effectiveReportMonth));

            // Month items sold
            const monthItemsSold = (activeMonthReport.itemsSold || []).filter((item) => {
              if (!monthlyReportItemSearch) return true;
              return item.name.toLowerCase().includes(monthlyReportItemSearch.toLowerCase());
            });

            const monthTotalItemsQty = (activeMonthReport.itemsSold || []).reduce((sum, item) => sum + item.qty, 0);

            return (
              <div className="space-y-4 sm:space-y-6">
                {/* Header with Sub-tab Switcher & Print */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 no-print text-right" dir="rtl">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 shrink-0" />
                      <span>التقرير المالي الشامل</span>
                    </h2>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                      توتال مبيعات اليوم وتوتال الأصناف بالكميات (مثل: 10 مياه و50 كنز)، وتوتال الشهر مع استعراض أي يوم.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Sub-tab pills (Full width grid on mobile) */}
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-white/10 w-full sm:w-auto gap-1">
                      <button
                        type="button"
                        onClick={() => setReportsSubTab('daily')}
                        className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          reportsSubTab === 'daily'
                            ? 'bg-cyan-500 text-black shadow-md font-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                        <span>التقرير اليومي</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setReportsSubTab('monthly')}
                        className={`py-2 px-3 sm:px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                          reportsSubTab === 'monthly'
                            ? 'bg-purple-500 text-white shadow-md font-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                        <span>التقرير الشهري</span>
                      </button>
                    </div>

                    {/* Print icon button (icon-only, no word طباعة) */}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-xl transition-all shrink-0"
                      title="طباعة التقرير"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* ======================================================== */}
                {/* 1. DAILY REPORT VIEW (التقرير اليومي الشامل) */}
                {/* ======================================================== */}
                {reportsSubTab === 'daily' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Day Picker Toolbar */}
                    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 text-right no-print" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                        {/* Day input */}
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-xs font-bold text-gray-300 shrink-0">اختر اليوم:</span>
                          <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/40 px-3 py-1.5 rounded-xl">
                            <CalendarDays className="w-4 h-4 text-cyan-400 shrink-0" />
                            <input
                              type="date"
                              value={effectiveReportDay}
                              onChange={(e) => setSelectedReportDate(e.target.value)}
                              className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Quick pills for recent days */}
                        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar w-full sm:w-auto">
                          <span className="text-[11px] text-gray-500 shrink-0 hidden sm:inline">أيام سريعة:</span>
                          {dailyReports.slice(0, 6).map((day) => (
                            <button
                              key={day.date}
                              type="button"
                              onClick={() => setSelectedReportDate(day.date)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                                effectiveReportDay === day.date
                                  ? 'bg-cyan-500 text-black font-bold shadow-md'
                                  : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                              }`}
                            >
                              {day.date.slice(8, 10)}/{day.date.slice(5, 7)} ({day.ordersCount})
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Day Label Badge */}
                      <div className="flex items-center justify-end">
                        <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl text-center w-full sm:w-auto shrink-0 whitespace-nowrap">
                          📅 {formatDateArabic(effectiveReportDay)}
                        </span>
                      </div>
                    </div>

                    {/* Prominent Day KPI Banner */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-6 relative overflow-hidden text-right border-cyan-500/30" dir="rtl">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-cyan-500/10 to-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="flex items-start justify-between gap-2 sm:gap-4 border-b border-white/10 pb-3 sm:pb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-xl font-black text-white">
                              التقرير المالي ليوم: {formatDateArabic(effectiveReportDay) || effectiveReportDay}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30 shrink-0">
                              {effectiveReportDay}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                            كشف حساب المبيعات، المصروفات، صافي الأرباح، والأصناف المباعة خلال هذا اليوم.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-black border shrink-0 whitespace-nowrap shadow-sm ${
                            activeDayReport.netProfit >= 0
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}>
                            {activeDayReport.netProfit >= 0 ? 'يوم رابح ✓' : 'يوم عجز ✕'}
                          </span>
                        </div>
                      </div>

                      {/* 6 Core Metric Badges for the Day */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3.5 mt-4 sm:mt-5">
                        {/* 1. عدد الفواتير */}
                        <div className="rounded-xl bg-slate-900/80 border border-cyan-500/30 p-3 sm:p-3.5 text-right relative overflow-hidden">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">عدد فواتير اليوم</span>
                          <p className="text-lg sm:text-2xl font-black text-cyan-400 mt-1 font-mono truncate">
                            {activeDayReport.ordersCount} <span className="text-xs font-normal text-cyan-300">فاتورة</span>
                          </p>
                          <span className="text-[9px] text-cyan-500/80 mt-1 block truncate">الطلبات المكتملة</span>
                        </div>

                        {/* 2. إجمالي المبيعات */}
                        <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3 sm:p-3.5 text-right">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">إجمالي المبيعات</span>
                          <p className="text-lg sm:text-2xl font-black text-white mt-1 font-mono truncate">
                            EGP {activeDayReport.totalSales.toFixed(2)}
                          </p>
                          <span className="text-[9px] text-gray-400 mt-1 block truncate">
                            كاش: {activeDayReport.cashSales.toFixed(0)} | إنستا: {activeDayReport.instaPaySales.toFixed(0)}
                          </span>
                        </div>

                        {/* 3. إجمالي المصروفات */}
                        <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3 sm:p-3.5 text-right">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">إجمالي المصروفات</span>
                          <p className="text-lg sm:text-2xl font-black text-rose-400 mt-1 font-mono truncate">
                            EGP {activeDayReport.totalExpenses.toFixed(2)}
                          </p>
                          <span className="text-[9px] text-gray-400 mt-1 block truncate">
                            درج: {activeDayReport.payoutsTotal.toFixed(0)} | مخزن: {activeDayReport.restocksTotal.toFixed(0)}
                          </span>
                        </div>

                        {/* 4. صافي ربح اليوم */}
                        <div className="rounded-xl bg-slate-900/80 border border-emerald-500/30 p-3 sm:p-3.5 text-right">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">صافي الربح</span>
                          <p className={`text-lg sm:text-2xl font-black mt-1 font-mono truncate ${activeDayReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            EGP {activeDayReport.netProfit.toFixed(2)}
                          </p>
                          <span className="text-[9px] text-gray-400 mt-1 block truncate">المبيعات − المصروفات</span>
                        </div>

                        {/* 5. متوسط الفاتورة */}
                        <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3 sm:p-3.5 text-right">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">متوسط الفاتورة</span>
                          <p className="text-base sm:text-xl font-bold text-purple-300 mt-1 font-mono truncate">
                            EGP {(activeDayReport.ordersCount > 0 ? activeDayReport.totalSales / activeDayReport.ordersCount : 0).toFixed(1)}
                          </p>
                          <span className="text-[9px] text-gray-500 mt-1 block truncate">معدل الصرف للطلب</span>
                        </div>

                        {/* 6. نسبة الربحية */}
                        <div className="rounded-xl bg-slate-900/80 border border-white/10 p-3 sm:p-3.5 text-right">
                          <span className="text-[10px] sm:text-[11px] text-gray-400 block font-semibold">هامش الربح</span>
                          <p className="text-base sm:text-xl font-bold text-amber-400 mt-1 font-mono truncate">
                            {activeDayReport.totalSales > 0 ? ((activeDayReport.netProfit / activeDayReport.totalSales) * 100).toFixed(1) : 0}%
                          </p>
                          <span className="text-[9px] text-gray-500 mt-1 block truncate">نسبة الصافي للمبيعات</span>
                        </div>
                      </div>
                    </div>

                    {/* ======================================================== */}
                    {/* KEY FEATURE: ITEMS SOLD TODAY (توتال مبيعات الأصناف والكميات لليوم) */}
                    {/* ======================================================== */}
                    <div className="glass-panel rounded-2xl p-3.5 sm:p-6 text-right space-y-4 border-cyan-500/20" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-cyan-400 shrink-0" />
                            <h3 className="text-sm sm:text-base font-bold text-white">
                              توتال مبيعات الأصناف والكميات لليوم (مثلاً: 10 مياه، 50 كنز...)
                            </h3>
                          </div>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            تجميع كميات وتوتال كل صنف تم بيعه خلال هذا اليوم بالكامل لتتبع حركة المبيعات صنفاً بصنف.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <span className="text-xs bg-cyan-500/10 text-cyan-300 font-bold px-3 py-1.5 rounded-xl border border-cyan-500/20 text-center shrink-0">
                            {activeDayReport.itemsSold?.length || 0} صنف · {dayTotalItemsQty} قطعة مباعة
                          </span>

                          <div className="w-full sm:w-48">
                            <input
                              type="text"
                              value={dailyReportItemSearch}
                              onChange={(e) => setDailyReportItemSearch(e.target.value)}
                              placeholder="بحث باسم الصنف..."
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-right"
                            />
                          </div>
                        </div>
                      </div>

                      {dayItemsSold.length ? (
                        <>
                          {/* Mobile Cards for Items Sold (< sm) */}
                          <div className="sm:hidden space-y-2.5">
                            {dayItemsSold.map((it) => {
                              const pct = activeDayReport.totalSales > 0 ? (it.total / activeDayReport.totalSales) * 100 : 0;
                              return (
                                <div key={it.itemId} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-sm text-white">{it.name}</span>
                                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 font-black font-mono text-xs border border-cyan-500/30 shrink-0">
                                      {it.qty} قطعة
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs font-mono text-gray-300">
                                    <span>سعر الوحدة: EGP {it.unitPrice.toFixed(2)}</span>
                                    <span className="font-bold text-amber-400 text-sm">
                                      الإجمالي: EGP {it.total.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-mono text-[10px] text-gray-400 shrink-0">
                                      {pct.toFixed(1)}% من مبيعات اليوم
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop Table (>= sm) */}
                          <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                  <th className="p-3.5">اسم الصنف</th>
                                  <th className="p-3.5">الكمية المباعة اليوم</th>
                                  <th className="p-3.5">سعر الوحدة</th>
                                  <th className="p-3.5">إجمالي المبيعات</th>
                                  <th className="p-3.5">النسبة من مبيعات اليوم</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dayItemsSold.map((it) => {
                                  const pct = activeDayReport.totalSales > 0 ? (it.total / activeDayReport.totalSales) * 100 : 0;
                                  return (
                                    <tr key={it.itemId} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                                      <td className="p-3.5 font-bold text-white text-sm">
                                        {it.name}
                                      </td>
                                      <td className="p-3.5">
                                        <span className="px-3 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 font-black font-mono text-sm border border-cyan-500/20">
                                          {it.qty} <span className="text-[10px] font-normal">قطعة / علبة</span>
                                        </span>
                                      </td>
                                      <td className="p-3.5 font-mono text-gray-300">
                                        EGP {it.unitPrice.toFixed(2)}
                                      </td>
                                      <td className="p-3.5 font-mono font-black text-amber-400 text-sm">
                                        EGP {it.total.toFixed(2)}
                                      </td>
                                      <td className="p-3.5 min-w-[150px]">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                                              style={{ width: `${Math.min(pct, 100)}%` }}
                                            ></div>
                                          </div>
                                          <span className="font-mono text-[11px] text-gray-400 w-10 text-left">
                                            {pct.toFixed(1)}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center text-xs text-gray-500 bg-slate-900/30 rounded-xl">
                          لا توجد أصناف مباعة مسجلة في هذا اليوم.
                        </div>
                      )}
                    </div>

                    {/* Expenses for this Day */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 text-right space-y-4" dir="rtl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>مصروفات ومسحوبات هذا اليوم ({dayExpensesList.length} بنود)</span>
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            المسحوبات النقدية من الدرج وفواتير شراء الخامات المنصرفة في هذا اليوم.
                          </p>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg shrink-0">
                          EGP {activeDayReport.totalExpenses.toFixed(2)}
                        </span>
                      </div>

                      {dayExpensesList.length ? (
                        <>
                          {/* Mobile Cards for Day Expenses (< sm) */}
                          <div className="sm:hidden space-y-2.5">
                            {dayExpensesList.map((exp) => (
                              <div key={exp.id} className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-sm text-white">{exp.title}</span>
                                  <span className="font-mono font-bold text-rose-400 text-sm">
                                    EGP {exp.amount.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t border-white/5">
                                  <span>{exp.type}</span>
                                  <span>{exp.actor}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop Table (>= sm) */}
                          <div className="hidden sm:block overflow-x-auto max-h-64 rounded-xl border border-white/5">
                            <table className="w-full text-right text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900/70 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                  <th className="p-3">المبلغ</th>
                                  <th className="p-3">البيان</th>
                                  <th className="p-3">النوع</th>
                                  <th className="p-3">المسؤول</th>
                                  <th className="p-3">الوقت</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dayExpensesList.map((exp) => (
                                  <tr key={exp.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-mono font-bold text-rose-400">
                                      EGP {exp.amount.toFixed(2)}
                                    </td>
                                    <td className="p-3 font-medium text-white">{exp.title}</td>
                                    <td className="p-3 text-gray-400">{exp.type}</td>
                                    <td className="p-3 text-gray-300">{exp.actor}</td>
                                    <td className="p-3 font-mono text-gray-500 text-[11px]">
                                      {new Date(exp.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <p className="py-6 text-center text-xs text-gray-500 bg-slate-900/30 rounded-xl">لا توجد مصروفات أو مسحوبات مسجلة في هذا اليوم.</p>
                      )}
                    </div>

                    {/* Sales Orders List for this Day */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4 text-right" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-cyan-400 shrink-0" />
                            <h4 className="text-sm font-bold text-white">
                              فواتير مبيعات اليوم ({filteredDayOrders.length} فاتورة)
                            </h4>
                          </div>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            استعراض كل فاتورة بيع تمت خلال هذا اليوم بالتفصيل.
                          </p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDayIndividualOrders(!showDayIndividualOrders)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 border border-white/5 transition-all text-center whitespace-nowrap"
                          >
                            {showDayIndividualOrders ? 'إخفاء الفواتير ▲' : 'إظهار الفواتير ▼'}
                          </button>

                          {showDayIndividualOrders && (
                            <div className="w-full sm:w-48">
                              <input
                                type="text"
                                value={dayReportSearch}
                                onChange={(e) => setDayReportSearch(e.target.value)}
                                placeholder="بحث برقم الفاتورة أو الصنف..."
                                className="w-full bg-slate-900 border border-white/10 rounded-xl py-1 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-right"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {showDayIndividualOrders && (
                        <div className="space-y-3">
                          {loadingDayReportOrders ? (
                            <div className="py-8 flex items-center justify-center gap-2 text-xs text-gray-400">
                              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                              <span>جاري تحميل الفواتير...</span>
                            </div>
                          ) : filteredDayOrders.length ? (
                            <>
                              {/* Mobile Cards for Orders (< sm) */}
                              <div className="sm:hidden space-y-2.5">
                                {filteredDayOrders.map((ord) => (
                                  <div key={ord.id} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono font-bold text-cyan-400 text-xs">
                                        {ord.receiptNumber || ord.id.slice(0, 8)}
                                      </span>
                                      <span className="font-mono font-bold text-white text-sm">
                                        EGP {ord.total.toFixed(2)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-300 truncate">
                                      {ord.items?.map((i: any) => `${i.item?.name} (${i.qty})`).join('، ')}
                                    </p>
                                    <div className="flex justify-between items-center text-[10px] text-gray-400 pt-1 border-t border-white/5">
                                      <span className={`px-2 py-0.5 rounded font-bold ${ord.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        {ord.paymentMethod === 'CASH' ? 'كاش' : 'إنستا باي'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => openOrderDetails(ord.id)}
                                        className="px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300 font-bold"
                                      >
                                        تفاصيل الفاتورة ↗
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Desktop Table (>= sm) */}
                              <div className="hidden sm:block overflow-x-auto max-h-80 rounded-xl border border-white/5">
                                <table className="w-full text-right text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-900/70 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                      <th className="p-3">رقم الفاتورة</th>
                                      <th className="p-3">الوقت</th>
                                      <th className="p-3">نوع الطلب</th>
                                      <th className="p-3">الدفع</th>
                                      <th className="p-3">الأصناف</th>
                                      <th className="p-3">الإجمالي</th>
                                      <th className="p-3">تفاصيل</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredDayOrders.map((ord) => (
                                      <tr key={ord.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-3 font-mono font-bold text-cyan-400">
                                          {ord.receiptNumber || ord.id.slice(0, 8)}
                                        </td>
                                        <td className="p-3 font-mono text-gray-400 text-[11px]">
                                          {new Date(ord.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${ord.orderType === 'DINE_IN' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-purple-500/10 text-purple-300'}`}>
                                            {ord.orderType === 'DINE_IN' ? `صالة (${ord.table?.name || 'طاولة'})` : 'تيك أواي'}
                                          </span>
                                        </td>
                                        <td className="p-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ord.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {ord.paymentMethod === 'CASH' ? 'كاش' : 'إنستا باي'}
                                          </span>
                                        </td>
                                        <td className="p-3 text-gray-300 max-w-xs truncate">
                                          {ord.items?.map((i: any) => `${i.item?.name} (${i.qty})`).join('، ')}
                                        </td>
                                        <td className="p-3 font-mono font-bold text-white">
                                          EGP {ord.total.toFixed(2)}
                                        </td>
                                        <td className="p-3">
                                          <button
                                            type="button"
                                            onClick={() => openOrderDetails(ord.id)}
                                            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black font-semibold text-[10px] transition-all cursor-pointer"
                                          >
                                            عرض ↗
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          ) : (
                            <p className="py-6 text-center text-xs text-gray-500 bg-slate-900/30 rounded-xl">لا توجد فواتير مبيعات مسجلة في هذا اليوم.</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Archive of All Recorded Days */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 space-y-4 text-right no-print" dir="rtl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 shrink-0" />
                            <span>أرشيف جميع الأيام السابقة (المبيعات والمصروفات والأرباح)</span>
                          </h3>
                          <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            جدول مقارنة لجميع الأيام السابقة؛ اضغط على أي يوم لفتح تقريره اليومي الكامل.
                          </p>
                        </div>
                        <span className="text-xs text-cyan-400 font-bold bg-cyan-500/10 px-2.5 py-1 rounded-lg shrink-0">
                          {dailyReports.length} يوم مسجل
                        </span>
                      </div>

                      {/* Mobile Cards for Daily Archive (< sm) */}
                      <div className="sm:hidden space-y-2.5">
                        {dailyReports.map((day) => {
                          const isCur = effectiveReportDay === day.date;
                          return (
                            <div
                              key={day.date}
                              className={`p-3.5 rounded-xl border transition-all text-right space-y-2.5 ${
                                isCur
                                  ? 'bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                                  : 'bg-slate-900/60 border-white/5'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-white">
                                  {formatDateArabic(day.date)}
                                </span>
                                <span className={`font-mono font-black text-sm ${day.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  صافي: EGP {day.netProfit.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-gray-400">
                                <span>مبيعات: {day.totalSales.toFixed(0)}</span>
                                <span>مصروفات: {day.totalExpenses.toFixed(0)}</span>
                                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono font-bold text-[10px]">
                                  {day.ordersCount} فاتورة
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedReportDate(day.date)}
                                className={`w-full py-2 rounded-lg text-xs font-bold transition-all text-center ${
                                  isCur
                                    ? 'bg-cyan-500 text-black shadow-md'
                                    : 'bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/5'
                                }`}
                              >
                                {isCur ? 'المعروض حالياً ✓' : 'عرض تقرير هذا اليوم ↗'}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table (>= sm) */}
                      <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5 max-h-96">
                        <table className="w-full text-right text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                              <th className="p-3.5">تاريخ اليوم</th>
                              <th className="p-3.5">عدد الفواتير</th>
                              <th className="p-3.5">إجمالي المبيعات</th>
                              <th className="p-3.5">إجمالي المصروفات</th>
                              <th className="p-3.5">صافي الربح</th>
                              <th className="p-3.5">الحالة</th>
                              <th className="p-3.5">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyReports.map((day) => {
                              const isCur = effectiveReportDay === day.date;
                              return (
                                <tr
                                  key={day.date}
                                  className={`border-b border-white/5 transition-colors ${
                                    isCur ? 'bg-cyan-500/10 text-white font-semibold' : 'hover:bg-white/5 text-gray-300'
                                  }`}
                                >
                                  <td className="p-3.5 font-bold">
                                    {formatDateArabic(day.date)} <span className="text-gray-500 text-[10px] font-mono">({day.date})</span>
                                  </td>
                                  <td className="p-3.5">
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-bold font-mono text-xs">
                                      {day.ordersCount} فاتورة
                                    </span>
                                  </td>
                                  <td className="p-3.5 font-mono font-bold text-cyan-400">
                                    EGP {day.totalSales.toFixed(2)}
                                  </td>
                                  <td className="p-3.5 font-mono font-bold text-rose-400">
                                    EGP {day.totalExpenses.toFixed(2)}
                                  </td>
                                  <td className="p-3.5 font-mono font-bold">
                                    <span className={day.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                      EGP {day.netProfit.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${day.netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                      {day.netProfit >= 0 ? 'أرباح' : 'عجز'}
                                    </span>
                                  </td>
                                  <td className="p-3.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedReportDate(day.date)}
                                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                        isCur
                                          ? 'bg-cyan-500 text-black shadow-md'
                                          : 'bg-white/5 hover:bg-cyan-500/20 text-cyan-300 border border-white/5'
                                      }`}
                                    >
                                      {isCur ? 'المعروض حالياً ✓' : 'عرض تقرير هذا اليوم ↗'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ======================================================== */}
                {/* 2. MONTHLY REPORT VIEW (التقرير الشهري الشامل) */}
                {/* ======================================================== */}
                {reportsSubTab === 'monthly' && (
                  <div className="space-y-4 sm:space-y-6">
                    {/* Month Picker */}
                    <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3 text-right no-print" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                        <div className="flex items-center justify-between sm:justify-start gap-2">
                          <span className="text-xs font-bold text-white shrink-0">اختر الشهر:</span>
                          <div className="bg-slate-900 border border-purple-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
                            <select
                              value={effectiveReportMonth}
                              onChange={(e) => setSelectedReportMonth(e.target.value)}
                              className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
                            >
                              {monthlyReports.map((m) => (
                                <option key={m.month} value={m.month} className="bg-slate-900 text-white">
                                  {formatMonthArabic(m.month)} ({m.month})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <span className="text-xs text-purple-300 font-bold bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl text-center sm:text-right shrink-0">
                        {monthDaysList.length} أيام مسجلة في هذا الشهر
                      </span>
                    </div>

                    {/* Monthly KPI Cards */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-6 text-right border-purple-500/30" dir="rtl">
                      <div className="border-b border-white/10 pb-3 sm:pb-4">
                        <h3 className="text-base sm:text-xl font-black text-white">
                          التقرير الشامل لشهر: {formatMonthArabic(effectiveReportMonth)} ({effectiveReportMonth})
                        </h3>
                        <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                          ملخص المبيعات، المصروفات، وصافي الأرباح التراكمية لشهر {formatMonthArabic(effectiveReportMonth)}.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mt-4 sm:mt-5">
                        <div className="glass-panel rounded-xl p-3.5 sm:p-4 text-right">
                          <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">إجمالي مبيعات الشهر</span>
                          <p className="text-lg sm:text-2xl font-black text-white mt-1 font-mono truncate">
                            EGP {activeMonthReport.totalSales.toFixed(2)}
                          </p>
                          <span className="text-[9px] sm:text-[10px] text-gray-400 mt-1 block font-mono truncate">
                            كاش: {activeMonthReport.cashSales.toFixed(0)} | إنستا: {activeMonthReport.instaPaySales.toFixed(0)}
                          </span>
                        </div>

                        <div className="glass-panel rounded-xl p-3.5 sm:p-4 text-right">
                          <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">إجمالي مصروفات الشهر</span>
                          <p className="text-lg sm:text-2xl font-black text-rose-400 mt-1 font-mono truncate">
                            EGP {activeMonthReport.totalExpenses.toFixed(2)}
                          </p>
                          <span className="text-[9px] sm:text-[10px] text-gray-400 mt-1 block truncate">
                            مسحوبات كاشير + مشتريات خامات
                          </span>
                        </div>

                        <div className="glass-panel rounded-xl p-3.5 sm:p-4 text-right">
                          <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">صافي أرباح الشهر</span>
                          <p className={`text-lg sm:text-2xl font-black mt-1 font-mono truncate ${activeMonthReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            EGP {activeMonthReport.netProfit.toFixed(2)}
                          </p>
                          <span className="text-[9px] sm:text-[10px] text-gray-400 mt-1 block truncate">
                            هامش الربح: {activeMonthReport.totalSales > 0 ? ((activeMonthReport.netProfit / activeMonthReport.totalSales) * 100).toFixed(1) : 0}%
                          </span>
                        </div>

                        <div className="glass-panel rounded-xl p-3.5 sm:p-4 text-right">
                          <span className="text-[11px] sm:text-xs text-gray-400 font-semibold block">إجمالي الفواتير</span>
                          <p className="text-lg sm:text-2xl font-black text-purple-300 mt-1 font-mono truncate">
                            {activeMonthReport.ordersCount} <span className="text-xs font-normal text-gray-400">فاتورة</span>
                          </p>
                          <span className="text-[9px] sm:text-[10px] text-gray-400 mt-1 block truncate">
                            متوسط الفاتورة: EGP {(activeMonthReport.ordersCount > 0 ? activeMonthReport.totalSales / activeMonthReport.ordersCount : 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sub-view switcher for Monthly Report */}
                    <div className="glass-panel rounded-2xl p-4 sm:p-5 text-right space-y-4" dir="rtl">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-white/5 w-full sm:w-auto gap-1">
                          <button
                            type="button"
                            onClick={() => setMonthlyReportViewMode('items')}
                            className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap ${
                              monthlyReportViewMode === 'items'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            🛒 مبيعات الأصناف التراكمية
                          </button>

                          <button
                            type="button"
                            onClick={() => setMonthlyReportViewMode('days')}
                            className={`py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all text-center whitespace-nowrap ${
                              monthlyReportViewMode === 'days'
                                ? 'bg-purple-500 text-white shadow-md'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            📅 جدول أيام الشهر (يوم بيوم)
                          </button>
                        </div>

                        {monthlyReportViewMode === 'items' && (
                          <div className="w-full sm:w-56">
                            <input
                              type="text"
                              value={monthlyReportItemSearch}
                              onChange={(e) => setMonthlyReportItemSearch(e.target.value)}
                              placeholder="بحث في أصناف الشهر..."
                              className="w-full bg-slate-900 border border-white/10 rounded-xl py-1.5 px-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-right"
                            />
                          </div>
                        )}
                      </div>

                      {/* 1. Month Items Sold Total */}
                      {monthlyReportViewMode === 'items' && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                            <span className="text-xs bg-purple-500/10 text-purple-300 font-bold px-3 py-1 rounded-lg border border-purple-500/20 shrink-0">
                              {activeMonthReport.itemsSold?.length || 0} صنف مختلف · {monthTotalItemsQty} قطعة مباعة في الشهر
                            </span>
                            <p className="text-[11px] sm:text-xs text-gray-400">
                              إجمالي كميات وتوتال مبيعات كل صنف تم بيعه طوال شهر {formatMonthArabic(effectiveReportMonth)}.
                            </p>
                          </div>

                          {monthItemsSold.length ? (
                            <>
                              {/* Mobile Cards for Month Items (< sm) */}
                              <div className="sm:hidden space-y-2.5">
                                {monthItemsSold.map((it) => {
                                  const pct = activeMonthReport.totalSales > 0 ? (it.total / activeMonthReport.totalSales) * 100 : 0;
                                  return (
                                    <div key={it.itemId} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-sm text-white">{it.name}</span>
                                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-black font-mono text-xs border border-purple-500/30 shrink-0">
                                          {it.qty} قطعة
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs font-mono text-gray-300">
                                        <span>سعر الوحدة: EGP {it.unitPrice.toFixed(2)}</span>
                                        <span className="font-bold text-amber-400 text-sm">
                                          الإجمالي: EGP {it.total.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 pt-1">
                                        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                          ></div>
                                        </div>
                                        <span className="font-mono text-[10px] text-gray-400 shrink-0">
                                          {pct.toFixed(1)}% من مبيعات الشهر
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Desktop Table (>= sm) */}
                              <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                                <table className="w-full text-right text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                      <th className="p-3.5">اسم الصنف</th>
                                      <th className="p-3.5">الكمية المباعة في الشهر</th>
                                      <th className="p-3.5">سعر الوحدة</th>
                                      <th className="p-3.5">إجمالي المبيعات</th>
                                      <th className="p-3.5">النسبة من مبيعات الشهر</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthItemsSold.map((it) => {
                                      const pct = activeMonthReport.totalSales > 0 ? (it.total / activeMonthReport.totalSales) * 100 : 0;
                                      return (
                                        <tr key={it.itemId} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                                          <td className="p-3.5 font-bold text-white text-sm">
                                            {it.name}
                                          </td>
                                          <td className="p-3.5">
                                            <span className="px-3 py-1 rounded-lg bg-purple-500/15 text-purple-300 font-black font-mono text-sm border border-purple-500/20">
                                              {it.qty} <span className="text-[10px] font-normal">قطعة / علبة</span>
                                            </span>
                                          </td>
                                          <td className="p-3.5 font-mono text-gray-300">
                                            EGP {it.unitPrice.toFixed(2)}
                                          </td>
                                          <td className="p-3.5 font-mono font-black text-amber-400 text-sm">
                                            EGP {it.total.toFixed(2)}
                                          </td>
                                          <td className="p-3.5 min-w-[150px]">
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                                ></div>
                                              </div>
                                              <span className="font-mono text-[11px] text-gray-400 w-10 text-left">
                                                {pct.toFixed(1)}%
                                              </span>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          ) : (
                            <div className="py-8 text-center text-xs text-gray-500 bg-slate-900/30 rounded-xl">
                              لا توجد أصناف مباعة مسجلة في هذا الشهر.
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Month Days Breakdown (جدول أيام الشهر) */}
                      {monthlyReportViewMode === 'days' && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                            <span className="text-xs bg-purple-500/10 text-purple-300 font-bold px-3 py-1 rounded-lg border border-purple-500/20 shrink-0">
                              {monthDaysList.length} أيام بيع ونشاط في هذا الشهر
                            </span>
                            <p className="text-[11px] sm:text-xs text-gray-400">
                              تفاصيل مبيعات ومصروفات كل يوم من أيام شهر {formatMonthArabic(effectiveReportMonth)} على حدة.
                            </p>
                          </div>

                          {monthDaysList.length ? (
                            <>
                              {/* Mobile Cards for Month Days (< sm) */}
                              <div className="sm:hidden space-y-2.5">
                                {monthDaysList.map((day) => (
                                  <div key={day.date} className="p-3.5 rounded-xl bg-slate-900/90 border border-white/10 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-sm text-white">
                                        {formatDateArabic(day.date)}
                                      </span>
                                      <span className={`font-mono font-bold text-sm ${day.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        صافي: EGP {day.netProfit.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-gray-400">
                                      <span>مبيعات: {day.totalSales.toFixed(0)}</span>
                                      <span>مصروفات: {day.totalExpenses.toFixed(0)}</span>
                                      <span className="px-2 py-0.5 rounded bg-white/5 font-mono text-[10px]">
                                        {day.ordersCount} طلب
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReportsSubTab('daily');
                                        setSelectedReportDate(day.date);
                                      }}
                                      className="w-full py-2 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold text-xs transition-all text-center"
                                    >
                                      عرض التقرير اليومي لهذا اليوم ↗
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {/* Desktop Table (>= sm) */}
                              <div className="hidden sm:block overflow-x-auto rounded-xl border border-white/5">
                                <table className="w-full text-right text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                                      <th className="p-3.5">اليوم</th>
                                      <th className="p-3.5">عدد الفواتير</th>
                                      <th className="p-3.5">إجمالي المبيعات</th>
                                      <th className="p-3.5">إجمالي المصروفات</th>
                                      <th className="p-3.5">صافي الربح</th>
                                      <th className="p-3.5">الإجراء</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthDaysList.map((day) => (
                                      <tr key={day.date} className="border-b border-white/5 hover:bg-white/5 text-gray-300 transition-colors">
                                        <td className="p-3.5 font-bold text-white">
                                          {formatDateArabic(day.date)} <span className="text-gray-500 text-[10px] font-mono">({day.date})</span>
                                        </td>
                                        <td className="p-3.5">
                                          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono font-bold text-xs">
                                            {day.ordersCount} فاتورة
                                          </span>
                                        </td>
                                        <td className="p-3.5 font-mono font-bold text-white">
                                          EGP {day.totalSales.toFixed(2)}
                                        </td>
                                        <td className="p-3.5 font-mono font-bold text-rose-400">
                                          EGP {day.totalExpenses.toFixed(2)}
                                        </td>
                                        <td className="p-3.5 font-mono font-bold">
                                          <span className={day.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                            EGP {day.netProfit.toFixed(2)}
                                          </span>
                                        </td>
                                        <td className="p-3.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReportsSubTab('daily');
                                              setSelectedReportDate(day.date);
                                            }}
                                            className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold text-xs transition-all"
                                          >
                                            فتح اليوم ↗
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </>
                          ) : (
                            <div className="py-8 text-center text-xs text-gray-500 bg-slate-900/30 rounded-xl">
                              لا توجد أيام مسجلة لهذا الشهر.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </main>

      {/* ======================================================== */}
      {/* 3. Admin Modals (Restock, Alerts) */}
      {/* ======================================================== */}

      {/* Alert Banner */}
      {alertMsg && (
        <div className={`fixed bottom-4 left-4 z-50 p-4 rounded-xl shadow-lg border text-sm flex items-center gap-3 transition-all animate-float flex-row-reverse ${
          alertMsg.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {alertMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{alertMsg.text}</span>
        </div>
      )}

      {/* ADD MENU ITEM DIALOG */}
      {showAddMenuItem && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAddMenuItem(false)}>
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowAddMenuItem(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2">إضافة صنف جديد</h3>
            <p className="text-xs text-amber-300/90 mb-6">الصنف سيظهر في الكاشير بدون وصفة، لذلك لن يخصم من المخزن حتى تضيف وصفته.</p>

            <form onSubmit={handleAddMenuItemSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">اسم الصنف</label>
                <input type="text" required value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500 text-right" placeholder="مثال: كريب نوتيلا" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">السعر (EGP)</label>
                <input type="number" required min="0" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500 text-right" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">القسم</label>
                <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} disabled={Boolean(newItemNewCategory.trim())} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-40">
                  {Array.from(new Set(recipesItems.map((item) => item.category?.name).filter(Boolean))).sort((a: string, b: string) => a.localeCompare(b, 'ar')).map((categoryName: string) => <option key={categoryName} value={categoryName}>{categoryName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">أو أضف قسمًا جديدًا</label>
                <input type="text" value={newItemNewCategory} onChange={(e) => setNewItemNewCategory(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500 text-right" placeholder="اتركه فارغًا لاستخدام القسم المختار" />
              </div>
              <button type="submit" disabled={submitLoading} className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl shadow-lg transition-all">
                {submitLoading ? 'جاري إضافة الصنف...' : 'إضافة الصنف'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PERIOD / DAY INVOICES LIST MODAL */}
      {showPeriodOrders && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setShowPeriodOrders(false)}>
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button 
              onClick={() => setShowPeriodOrders(false)} 
              className="absolute top-4 left-4 p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-all" 
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="border-b border-white/10 pb-4 mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{periodOrdersTitle}</span>
              </h3>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
                <p className="text-gray-400">
                  إجمالي عدد الفواتير: <span className="font-bold text-cyan-400 font-mono">{periodOrders.length}</span> فاتورة
                </p>
                <p className="text-gray-400">
                  إجمالي المبلغ: <span className="font-bold text-emerald-400 font-mono text-sm">EGP {periodOrders.reduce((sum, ord) => sum + ord.total, 0).toFixed(2)}</span>
                </p>
              </div>
            </div>

            {/* Search filter in day's orders */}
            <div className="mb-4">
              <input
                type="text"
                value={periodOrderSearch}
                onChange={(e) => setPeriodOrderSearch(e.target.value)}
                placeholder="بحث برقم الفاتورة أو نوع الدفع أو الصالة..."
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl py-2 px-3.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-right"
              />
            </div>

            {/* Invoices Table */}
            <div className="flex-1 overflow-y-auto min-h-0 border border-white/5 rounded-xl">
              {loadingPeriodOrders ? (
                <div className="h-60 flex items-center justify-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                  <span>جاري تحميل فواتير اليوم...</span>
                </div>
              ) : (
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-white/5 text-gray-400 sticky top-0 backdrop-blur-md">
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">الوقت</th>
                      <th className="p-3">النوع</th>
                      <th className="p-3">طريقة الدفع</th>
                      <th className="p-3">الخصم</th>
                      <th className="p-3">الإجمالي</th>
                      <th className="p-3 text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodOrders
                      .filter((ord) => {
                        if (!periodOrderSearch.trim()) return true;
                        const q = periodOrderSearch.toLowerCase();
                        const num = (ord.receiptNumber || ord.id).toLowerCase();
                        const type = ord.orderType === 'DINE_IN' ? 'صالة' : 'تيك اواي تيك أواي';
                        const pay = ord.paymentMethod === 'CASH' ? 'كاش' : 'انستا باي إنستا';
                        return num.includes(q) || type.includes(q) || pay.includes(q);
                      })
                      .length ? (
                      periodOrders
                        .filter((ord) => {
                          if (!periodOrderSearch.trim()) return true;
                          const q = periodOrderSearch.toLowerCase();
                          const num = (ord.receiptNumber || ord.id).toLowerCase();
                          const type = ord.orderType === 'DINE_IN' ? 'صالة' : 'تيك اواي تيك أواي';
                          const pay = ord.paymentMethod === 'CASH' ? 'كاش' : 'انستا باي إنستا';
                          return num.includes(q) || type.includes(q) || pay.includes(q);
                        })
                        .map((ord) => (
                          <tr
                            key={ord.id}
                            onClick={() => openOrderDetails(ord.id)}
                            className="border-b border-white/5 hover:bg-cyan-500/10 text-gray-300 transition-colors cursor-pointer"
                          >
                            <td className="p-3 font-mono font-bold text-cyan-400">
                              {ord.receiptNumber || ord.id.slice(0, 8)}
                            </td>
                            <td className="p-3 font-mono text-gray-400">
                              {new Date(ord.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                ord.orderType === 'DINE_IN' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-amber-500/10 text-amber-400'
                              }`}>
                                {ord.orderType === 'DINE_IN' ? `صالة (${ord.table?.name || 'طاولة'})` : 'تيك أواي'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-[10px]">
                              {ord.paymentMethod === 'CASH' ? 'كاش' : 'إنستا باي'}
                            </td>
                            <td className="p-3">
                              {ord.discount > 0 ? (
                                <span className="text-rose-400 font-bold font-mono text-[11px]">- EGP {ord.discount.toFixed(2)}</span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                            <td className="p-3 font-bold font-mono text-white text-sm">
                              EGP {ord.total.toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOrderDetails(ord.id);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 text-[10px] font-bold transition-all"
                              >
                                عرض الأصناف
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-500 text-xs">
                          لا توجد فواتير مطابقة للبحث.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPeriodOrders(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE DETAILS DIALOG */}
      {showOrderDetails && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowOrderDetails(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setShowOrderDetails(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>

            {loadingOrderDetails ? (
              <div className="h-48 flex items-center justify-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
                <span>جاري تحميل تفاصيل الفاتورة...</span>
              </div>
            ) : selectedOrder && (
              <>
                <div className="border-b border-white/10 pb-4 mb-4">
                  <h3 className="text-lg font-bold text-white">تفاصيل الفاتورة</h3>
                  <p className="font-mono text-sm text-cyan-400 mt-1">{selectedOrder.receiptNumber || selectedOrder.id.slice(0, 8)}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs">
                    <p className="text-gray-400">التاريخ: <span className="text-white">{new Date(selectedOrder.createdAt).toLocaleString('ar-EG')}</span></p>
                    <p className="text-gray-400">الدفع: <span className="text-white">{selectedOrder.paymentMethod === 'CASH' ? 'كاش' : 'إنستا باي'}</span></p>
                    <p className="text-gray-400">النوع: <span className="text-white">{selectedOrder.orderType === 'DINE_IN' ? `صالة - ${selectedOrder.table?.name || 'طاولة'}` : 'تيك أواي'}</span></p>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedOrder.items.map((line) => (
                    <div key={line.id} className="rounded-xl bg-slate-900/70 border border-white/5 p-3">
                      <div className="flex justify-between gap-3 text-sm font-bold text-white">
                        <span>{line.item.name} <span className="text-gray-400 font-normal">× {line.qty}</span></span>
                        <span className="whitespace-nowrap">EGP {line.totalPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between mt-1 text-[11px] text-gray-400">
                        <span>سعر القطعة: EGP {line.unitPrice.toFixed(2)}</span>
                        {line.modifiers.length > 0 && <span>إضافات: EGP {line.modifiers.reduce((sum, mod) => sum + mod.unitPriceImpact, 0).toFixed(2)}</span>}
                      </div>
                      {line.modifiers.length > 0 && <p className="mt-2 text-[11px] text-purple-300">{line.modifiers.map((mod) => mod.modifier.name).join('، ')}</p>}
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 mt-5 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-gray-400"><span>الإجمالي قبل الخصم</span><span>EGP {selectedOrder.subtotal.toFixed(2)}</span></div>
                  {selectedOrder.discount > 0 && <>
                    <div className="flex justify-between text-rose-300"><span>الخصم</span><span>- EGP {selectedOrder.discount.toFixed(2)}</span></div>
                    <p className="text-xs text-rose-200/90">سبب الخصم: {selectedOrder.discountReason || 'غير مسجل (فاتورة قديمة)'}</p>
                  </>}
                  <div className="flex justify-between text-base font-bold text-cyan-400"><span>الإجمالي النهائي</span><span>EGP {selectedOrder.total.toFixed(2)}</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* RESTOCK DIALOG */}
      {showRestock && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowRestock(false)}>
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button 
              onClick={() => setShowRestock(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2">توريد وشحن خامات للمخزن</h3>
            <p className="text-xs text-gray-400 mb-6">اكتب الكمية الموردة بوحدة الخامة المسجلة.</p>
            
            <form onSubmit={handleRestockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">اختار الخامة</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.deductUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">الكمية المراد إضافتها ({materials.find((m) => m.id === selectedMaterialId)?.deductUnit || 'الوحدة'})</label>
                <input
                  type="number"
                  required
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-cyan-500 text-right"
                  placeholder="مثال: 5"
                  min="0"
                  step="any"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">إجمالي مبلغ التوريد (EGP)</label>
                <input type="number" required value={restockAmount} onChange={(e) => setRestockAmount(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:border-amber-500 text-right" placeholder="مثال: 500" min="0" step="0.01" />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl shadow-lg transition-all mt-2"
              >
                {submitLoading ? 'جاري شحن الرصيد...' : 'تأكيد إضافة الرصيد للمخزن'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW RAW MATERIAL MODAL */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingMaterial(null)}>
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button onClick={() => setEditingMaterial(null)} className="absolute top-4 left-4 text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold text-white mb-5">تعديل بيانات الخامة</h3>
            <form onSubmit={handleUpdateMaterialSubmit} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">اسم المادة الخام</label><input required value={editingMaterial.name} onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">الرصيد الحالي</label><input type="number" required min="0" step="any" value={editingMaterial.stockQty} onChange={(e) => setEditingMaterial({ ...editingMaterial, stockQty: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right" /></div>
                <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">حد التنبيه</label><input type="number" required min="0" step="any" value={editingMaterial.minStockLevel} onChange={(e) => setEditingMaterial({ ...editingMaterial, minStockLevel: Number(e.target.value) })} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-400 mb-1.5">الوحدة</label><input required value={editingMaterial.deductUnit} onChange={(e) => setEditingMaterial({ ...editingMaterial, purchaseUnit: e.target.value, deductUnit: e.target.value })} className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right" /></div>
              <button type="submit" disabled={submitLoading} className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl disabled:opacity-50">{submitLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
            </form>
          </div>
        </div>
      )}

      {showAddMaterial && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAddMaterial(false)}>
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 relative text-right" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <button 
              onClick={() => setShowAddMaterial(false)}
              className="absolute top-4 left-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-2">إضافة مادة خام جديدة للمخزن</h3>
            <p className="text-xs text-gray-400 mb-6">سجل تفاصيل المادة الخام الجديدة، رصيد الافتتاح، ووحدات القياس.</p>
            
            <form onSubmit={handleAddMaterialSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5">اسم المادة الخام</label>
                <input
                  type="text"
                  required
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right"
                  placeholder="مثال: حليب كامل الدسم المراعي"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">الرصيد الافتتاحي</label>
                  <input
                    type="number"
                    value={newMatStock}
                    onChange={(e) => setNewMatStock(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right"
                    placeholder="0.00"
                    min="0"
                    step="any"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">حد التنبيه للنفاد</label>
                  <input
                    type="number"
                    value={newMatMinStock}
                    onChange={(e) => setNewMatMinStock(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-cyan-500 text-right"
                    placeholder="مثال: 10"
                    min="0"
                    step="any"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-gray-400 mb-1.5">الوحدة</label>
                <select
                  required
                  value={newMatUnit}
                  onChange={(e) => setNewMatUnit(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:outline-none focus:border-cyan-500 text-right"
                >
                  <option value="">اختار الوحدة</option>
                  <option value="مل">مل</option>
                  <option value="جم">جم</option>
                  <option value="حبة">حبة</option>
                  <option value="أخرى">أخرى (اكتبها بنفسك)</option>
                </select>
              </div>
              {newMatUnit === 'أخرى' && (
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 mb-1.5">اكتب الوحدة</label>
                  <input
                    type="text"
                    required
                    value={newMatCustomUnit}
                    onChange={(e) => setNewMatCustomUnit(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-[11px] text-white focus:outline-none focus:border-cyan-500 text-right"
                    placeholder="مثال: كيس أو زجاجة"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-xl shadow-lg transition-all mt-3 text-xs"
              >
                {submitLoading ? 'جاري إضافة الخامة...' : 'إضافة المادة الخام وتأكيد الحفظ'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
