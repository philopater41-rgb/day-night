import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();

    const cairoDateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const getBusinessDateStr = (date: Date, monthly = false) => {
      const parts = Object.fromEntries(
        cairoDateParts
          .formatToParts(date)
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, part.value])
      );
      return monthly ? `${parts.year}-${parts.month}` : `${parts.year}-${parts.month}-${parts.day}`;
    };

    const todayStr = getBusinessDateStr(now, false);
    const thisMonthStr = getBusinessDateStr(now, true);

    // 1. Active Shift Info
    const activeShift = await prisma.shift.findFirst({
      where: { closedAt: null },
      include: {
        user: { select: { name: true } },
      },
    });

    // 2. Fetch all completed orders, cash transactions, and restock logs in parallel
    const [completedOrders, allCashTransactions, allRestockLogs] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        include: {
          shift: { select: { id: true, openedAt: true, cashierName: true, user: { select: { name: true } } } },
          items: {
            include: {
              item: { select: { name: true } },
            },
          },
        },
      }),
      prisma.cashTransaction.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          shift: {
            select: {
              openedAt: true,
              cashierName: true,
              user: { select: { name: true } },
            },
          },
        },
      }),
      prisma.restockLog.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          rawMaterial: {
            select: { name: true, purchaseUnit: true },
          },
        },
      }),
    ]);

    // Helper: determine the operating business date of an order
    const getOrderOperatingDate = (order: { shift?: { openedAt: Date } | null; createdAt: Date }) => {
      return order.shift?.openedAt || order.createdAt;
    };

    // Helper: determine the operating business date of a cash transaction
    const getTxOperatingDate = (tx: { shift?: { openedAt: Date } | null; createdAt: Date }) => {
      return tx.shift?.openedAt || tx.createdAt;
    };

    // 3. Process Daily & Monthly Sales
    interface PeriodSales {
      period: string;
      total: number;
      orders: number;
      cashTotal: number;
      instaPayTotal: number;
    }

    interface ItemSoldSummary {
      itemId: string;
      name: string;
      qty: number;
      total: number;
      unitPrice: number;
    }

    const dailySalesMap = new Map<string, PeriodSales>();
    const monthlySalesMap = new Map<string, PeriodSales>();
    const dayItemsSoldMap = new Map<string, Map<string, ItemSoldSummary>>();
    const monthItemsSoldMap = new Map<string, Map<string, ItemSoldSummary>>();

    const todayOrders: typeof completedOrders = [];
    const monthOrders: typeof completedOrders = [];

    for (const order of completedOrders) {
      const opDate = getOrderOperatingDate(order);
      const dayKey = getBusinessDateStr(opDate, false);
      const monthKey = getBusinessDateStr(opDate, true);

      // Daily Sales map
      const daySummary = dailySalesMap.get(dayKey) || {
        period: dayKey,
        total: 0,
        orders: 0,
        cashTotal: 0,
        instaPayTotal: 0,
      };
      daySummary.total += order.total;
      daySummary.orders += 1;
      if (order.paymentMethod === 'CASH') daySummary.cashTotal += order.total;
      else if (order.paymentMethod === 'INSTAPAY') daySummary.instaPayTotal += order.total;
      dailySalesMap.set(dayKey, daySummary);

      // Monthly Sales map
      const monthSummary = monthlySalesMap.get(monthKey) || {
        period: monthKey,
        total: 0,
        orders: 0,
        cashTotal: 0,
        instaPayTotal: 0,
      };
      monthSummary.total += order.total;
      monthSummary.orders += 1;
      if (order.paymentMethod === 'CASH') monthSummary.cashTotal += order.total;
      else if (order.paymentMethod === 'INSTAPAY') monthSummary.instaPayTotal += order.total;
      monthlySalesMap.set(monthKey, monthSummary);

      // Aggregate item-level sales for this day and month
      let dItemMap = dayItemsSoldMap.get(dayKey);
      if (!dItemMap) {
        dItemMap = new Map<string, ItemSoldSummary>();
        dayItemsSoldMap.set(dayKey, dItemMap);
      }
      let mItemMap = monthItemsSoldMap.get(monthKey);
      if (!mItemMap) {
        mItemMap = new Map<string, ItemSoldSummary>();
        monthItemsSoldMap.set(monthKey, mItemMap);
      }

      for (const oi of order.items) {
        const itemName = oi.item?.name || 'صنف';
        // Day
        const curDayItem = dItemMap.get(oi.itemId) || {
          itemId: oi.itemId,
          name: itemName,
          qty: 0,
          total: 0,
          unitPrice: oi.unitPrice,
        };
        curDayItem.qty += oi.qty;
        curDayItem.total += oi.totalPrice;
        dItemMap.set(oi.itemId, curDayItem);

        // Month
        const curMonthItem = mItemMap.get(oi.itemId) || {
          itemId: oi.itemId,
          name: itemName,
          qty: 0,
          total: 0,
          unitPrice: oi.unitPrice,
        };
        curMonthItem.qty += oi.qty;
        curMonthItem.total += oi.totalPrice;
        mItemMap.set(oi.itemId, curMonthItem);
      }

      // Check if order belongs to today or this month
      const isTodayOrder = dayKey === todayStr || (activeShift && order.shiftId === activeShift.id);
      const isMonthOrder = monthKey === thisMonthStr || isTodayOrder;
      if (isTodayOrder) todayOrders.push(order);
      if (isMonthOrder) monthOrders.push(order);
    }

    const todaySales = todayOrders.reduce((sum, order) => sum + order.total, 0);
    const monthlySales = monthOrders.reduce((sum, order) => sum + order.total, 0);

    // Payment Breakdown for today
    let todayCash = 0;
    let todayInstapay = 0;
    for (const order of todayOrders) {
      if (order.paymentMethod === 'CASH') todayCash += order.total;
      else if (order.paymentMethod === 'INSTAPAY') todayInstapay += order.total;
    }

    // 4. Process Daily & Monthly Expenses
    interface ExpenseItemPayout {
      id: string;
      shiftId: string;
      amount: number;
      reason: string;
      cashierName: string;
      createdAt: Date;
    }

    interface ExpenseItemRestock {
      id: string;
      amount: number;
      quantity: number;
      materialName: string;
      purchaseUnit: string;
      createdAt: Date;
    }

    interface DailyExpenseRecord {
      period: string; // YYYY-MM-DD
      total: number;
      payoutsTotal: number;
      restocksTotal: number;
      count: number;
      payouts: ExpenseItemPayout[];
      restocks: ExpenseItemRestock[];
    }

    interface MonthlyExpenseRecord {
      period: string; // YYYY-MM
      total: number;
      payoutsTotal: number;
      restocksTotal: number;
      count: number;
      payouts: ExpenseItemPayout[];
      restocks: ExpenseItemRestock[];
      categoriesSummary?: Array<{ name: string; type: 'PAYOUT' | 'RESTOCK'; total: number; count: number }>;
    }

    const dailyExpensesMap = new Map<string, DailyExpenseRecord>();
    const monthlyExpensesMap = new Map<string, MonthlyExpenseRecord>();

    const getOrCreateDailyExpense = (dayKey: string): DailyExpenseRecord => {
      let rec = dailyExpensesMap.get(dayKey);
      if (!rec) {
        rec = {
          period: dayKey,
          total: 0,
          payoutsTotal: 0,
          restocksTotal: 0,
          count: 0,
          payouts: [],
          restocks: [],
        };
        dailyExpensesMap.set(dayKey, rec);
      }
      return rec;
    };

    const getOrCreateMonthlyExpense = (monthKey: string): MonthlyExpenseRecord => {
      let rec = monthlyExpensesMap.get(monthKey);
      if (!rec) {
        rec = {
          period: monthKey,
          total: 0,
          payoutsTotal: 0,
          restocksTotal: 0,
          count: 0,
          payouts: [],
          restocks: [],
        };
        monthlyExpensesMap.set(monthKey, rec);
      }
      return rec;
    };

    // Process Cash Transactions (Payouts are expenses)
    const formattedCashTransactions = allCashTransactions.map((tx) => ({
      id: tx.id,
      shiftId: tx.shiftId,
      type: tx.type,
      amount: tx.amount,
      reason: tx.reason,
      createdAt: tx.createdAt,
      cashierName: tx.shift?.cashierName || tx.shift?.user?.name || 'كاشير',
      operatingDate: getTxOperatingDate(tx),
    }));

    for (const tx of formattedCashTransactions) {
      if (tx.type === 'PAYOUT') {
        const dayKey = getBusinessDateStr(tx.operatingDate, false);
        const monthKey = getBusinessDateStr(tx.operatingDate, true);

        const payoutItem: ExpenseItemPayout = {
          id: tx.id,
          shiftId: tx.shiftId,
          amount: tx.amount,
          reason: tx.reason,
          cashierName: tx.cashierName,
          createdAt: tx.createdAt,
        };

        const dRec = getOrCreateDailyExpense(dayKey);
        dRec.total += tx.amount;
        dRec.payoutsTotal += tx.amount;
        dRec.count += 1;
        dRec.payouts.push(payoutItem);

        const mRec = getOrCreateMonthlyExpense(monthKey);
        mRec.total += tx.amount;
        mRec.payoutsTotal += tx.amount;
        mRec.count += 1;
        mRec.payouts.push(payoutItem);
      }
    }

    // Process Restock Logs (Purchases are expenses)
    const formattedRestockLogs = allRestockLogs.map((log) => ({
      id: log.id,
      amount: log.amount,
      quantity: log.quantity,
      createdAt: log.createdAt,
      materialName: log.rawMaterial?.name || 'خامة مخزن',
      purchaseUnit: log.rawMaterial?.purchaseUnit || 'وحدة',
      rawMaterial: {
        name: log.rawMaterial?.name || 'خامة مخزن',
        purchaseUnit: log.rawMaterial?.purchaseUnit || 'وحدة',
      },
    }));

    for (const log of formattedRestockLogs) {
      const dayKey = getBusinessDateStr(log.createdAt, false);
      const monthKey = getBusinessDateStr(log.createdAt, true);

      const restockItem: ExpenseItemRestock = {
        id: log.id,
        amount: log.amount,
        quantity: log.quantity,
        materialName: log.materialName,
        purchaseUnit: log.purchaseUnit,
        createdAt: log.createdAt,
      };

      const dRec = getOrCreateDailyExpense(dayKey);
      dRec.total += log.amount;
      dRec.restocksTotal += log.amount;
      dRec.count += 1;
      dRec.restocks.push(restockItem);

      const mRec = getOrCreateMonthlyExpense(monthKey);
      mRec.total += log.amount;
      mRec.restocksTotal += log.amount;
      mRec.count += 1;
      mRec.restocks.push(restockItem);
    }

    // Sort Daily Expenses descending
    const dailyExpenses = [...dailyExpensesMap.values()].sort((a, b) => b.period.localeCompare(a.period));

    // Sort Monthly Expenses descending and build categoriesSummary
    const monthlyExpensesHistory = [...monthlyExpensesMap.values()]
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((mRec) => {
        const catMap = new Map<string, { name: string; type: 'PAYOUT' | 'RESTOCK'; total: number; count: number }>();
        for (const p of mRec.payouts) {
          const key = `P_${p.reason || 'مسحوبات نقدية'}`;
          const cur = catMap.get(key) || { name: p.reason || 'مسحوبات نقدية', type: 'PAYOUT', total: 0, count: 0 };
          cur.total += p.amount;
          cur.count += 1;
          catMap.set(key, cur);
        }
        for (const r of mRec.restocks) {
          const key = `R_${r.materialName || 'خامة مخزن'}`;
          const cur = catMap.get(key) || { name: r.materialName || 'خامة مخزن', type: 'RESTOCK', total: 0, count: 0 };
          cur.total += r.amount;
          cur.count += 1;
          catMap.set(key, cur);
        }
        return {
          ...mRec,
          categoriesSummary: [...catMap.values()].sort((a, b) => b.total - a.total),
        };
      });

    // Today & Month expense totals
    const todayExpenses = dailyExpensesMap.get(todayStr)?.total || 0;
    const monthlyExpenses = monthlyExpensesMap.get(thisMonthStr)?.total || 0;
    const todayNet = todaySales - todayExpenses;
    const monthlyNet = monthlySales - monthlyExpenses;

    // 5. Build Combined Comprehensive Daily Reports (Sales + Expenses + Net + ItemsSold)
    const allUniqueDays = new Set<string>([
      todayStr,
      ...dailySalesMap.keys(),
      ...dailyExpensesMap.keys(),
    ]);

    const dailyReports = [...allUniqueDays]
      .sort((a, b) => b.localeCompare(a))
      .map((dateStr) => {
        const sales = dailySalesMap.get(dateStr) || { total: 0, orders: 0, cashTotal: 0, instaPayTotal: 0, period: dateStr };
        const expenses = dailyExpensesMap.get(dateStr) || { total: 0, payoutsTotal: 0, restocksTotal: 0, count: 0, payouts: [], restocks: [], period: dateStr };
        const dayItems = dayItemsSoldMap.get(dateStr)
          ? [...dayItemsSoldMap.get(dateStr)!.values()].sort((a, b) => b.qty - a.qty || b.total - a.total)
          : [];
        return {
          date: dateStr,
          ordersCount: sales.orders,
          totalSales: sales.total,
          cashSales: sales.cashTotal,
          instaPaySales: sales.instaPayTotal,
          totalExpenses: expenses.total,
          payoutsTotal: expenses.payoutsTotal,
          restocksTotal: expenses.restocksTotal,
          expensesCount: expenses.count,
          netProfit: sales.total - expenses.total,
          payouts: expenses.payouts,
          restocks: expenses.restocks,
          itemsSold: dayItems,
        };
      });

    // 6. Build Combined Comprehensive Monthly Reports (with ItemsSold and Days array)
    const allUniqueMonths = new Set<string>([
      thisMonthStr,
      ...monthlySalesMap.keys(),
      ...monthlyExpensesMap.keys(),
    ]);

    const monthlyReports = [...allUniqueMonths]
      .sort((a, b) => b.localeCompare(a))
      .map((mStr) => {
        const sales = monthlySalesMap.get(mStr) || { total: 0, orders: 0, cashTotal: 0, instaPayTotal: 0, period: mStr };
        const expenses = monthlyExpensesMap.get(mStr) || { total: 0, payoutsTotal: 0, restocksTotal: 0, count: 0, payouts: [], restocks: [], period: mStr };
        const monthItems = monthItemsSoldMap.get(mStr)
          ? [...monthItemsSoldMap.get(mStr)!.values()].sort((a, b) => b.qty - a.qty || b.total - a.total)
          : [];
        const daysInMonth = dailyReports.filter((d) => d.date.startsWith(mStr));
        return {
          month: mStr,
          ordersCount: sales.orders,
          totalSales: sales.total,
          cashSales: sales.cashTotal,
          instaPaySales: sales.instaPayTotal,
          totalExpenses: expenses.total,
          payoutsTotal: expenses.payoutsTotal,
          restocksTotal: expenses.restocksTotal,
          expensesCount: expenses.count,
          netProfit: sales.total - expenses.total,
          itemsSold: monthItems,
          days: daysInMonth,
          daysCount: daysInMonth.length,
          payouts: expenses.payouts || [],
          restocks: expenses.restocks || [],
        };
      });

    // 7. Summarize Top Items
    const summarizeTopItemsFromOrders = (ordersList: typeof completedOrders) => {
      const summary: { [key: string]: { name: string; qty: number; total: number } } = {};
      for (const ord of ordersList) {
        for (const oi of ord.items) {
          if (!summary[oi.itemId]) {
            summary[oi.itemId] = { name: oi.item.name, qty: 0, total: 0 };
          }
          summary[oi.itemId].qty += oi.qty;
          summary[oi.itemId].total += oi.totalPrice;
        }
      }
      return Object.values(summary)
        .filter((item) => item.qty > 0)
        .sort((a, b) => b.qty - a.qty || b.total - a.total);
    };

    const topSellingToday = summarizeTopItemsFromOrders(todayOrders);
    const topSellingMonth = summarizeTopItemsFromOrders(monthOrders);
    const topSellingAll = summarizeTopItemsFromOrders(completedOrders);

    // 8. Low Stock Alerts
    const rawMaterials = await prisma.rawMaterial.findMany({
      where: {
        name: {
          notIn: [
            'Almond Milk Pack',
            'Chocolate Syrup',
            'Espresso Coffee Beans',
            'Frozen Croissant (Raw)',
            'Full Cream Milk',
            'White Sugar',
          ],
        },
      },
    });

    const lowStockAlerts = rawMaterials
      .filter((mat) => mat.stockQty < mat.minStockLevel)
      .map((mat) => ({
        id: mat.id,
        name: mat.name,
        stockQty: mat.stockQty,
        minStockLevel: mat.minStockLevel,
        deductUnit: mat.deductUnit,
      }));

    // 9. Recent Sales Orders
    const recentOrders = await prisma.salesOrder.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        table: { select: { name: true } },
      },
    });

    // 10. Shift Summaries
    const shifts = await prisma.shift.findMany({
      orderBy: { openedAt: 'desc' },
      include: {
        user: { select: { name: true } },
        orders: { select: { status: true, total: true, paymentMethod: true } },
      },
    });

    const shiftSummaries = shifts.map((shift) => {
      const shiftCompletedOrders = shift.orders.filter((order) => order.status === 'COMPLETED');
      return {
        id: shift.id,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        cashierName: shift.cashierName || shift.user.name,
        orderCount: shiftCompletedOrders.length,
        totalSales: shiftCompletedOrders.reduce((sum, order) => sum + order.total, 0),
        cashSales: shiftCompletedOrders.filter((order) => order.paymentMethod === 'CASH').reduce((sum, order) => sum + order.total, 0),
        instaPaySales: shiftCompletedOrders.filter((order) => order.paymentMethod === 'INSTAPAY').reduce((sum, order) => sum + order.total, 0),
        expectedCash: shift.expectedCash,
        expectedInstaPay: shift.expectedInstaPay,
        closedCash: shift.closedCash,
        closedInstaPay: shift.closedInstaPay,
        varianceCash: shift.varianceCash,
        varianceInstaPay: shift.varianceInstaPay,
      };
    });

    return NextResponse.json({
      kpis: {
        todaySales,
        monthlySales,
        todayExpenses,
        monthlyExpenses,
        todayNet,
        monthlyNet,
        todayOrdersCount: todayOrders.length,
        monthlyOrdersCount: monthOrders.length,
        activeShiftUser: activeShift ? (activeShift.cashierName || activeShift.user.name) : 'No Active Shift',
        activeShiftExpected: activeShift ? activeShift.expectedCash : 0,
      },
      paymentBreakdown: {
        cash: todayCash,
        instapay: todayInstapay,
      },
      topSellingItems: topSellingToday,
      topSellingItemsByPeriod: {
        today: topSellingToday,
        month: topSellingMonth,
        all: topSellingAll,
      },
      lowStockAlerts,
      recentOrders,
      // Sales summaries
      dailySales: [...dailySalesMap.values()].sort((a, b) => b.period.localeCompare(a.period)),
      monthlySalesHistory: [...monthlySalesMap.values()].sort((a, b) => b.period.localeCompare(a.period)),
      // Expenses summaries
      dailyExpenses,
      monthlyExpensesHistory,
      // Comprehensive Combined Reports
      dailyReports,
      monthlyReports,
      shiftSummaries,
      cashTransactions: formattedCashTransactions,
      restockLogs: formattedRestockLogs,
    });
  } catch (error: any) {
    console.error('GET admin analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
