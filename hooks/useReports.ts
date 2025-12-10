import { useState, useEffect } from 'react';
import { Currency, InvoiceType, CashTransactionType, Invoice } from '../types';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { useCurrency } from './useCurrency';

export const useProfitAndLossReport = ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    const { convertToSyp } = useCurrency();
    const [reportData, setReportData] = useState<{
        totalSales: number;
        totalCost: number;
        totalExpenses: number;
        netProfit: number;
        invoices: (Invoice & { profit: number })[];
    }>({ totalSales: 0, totalCost: 0, totalExpenses: 0, netProfit: 0, invoices: [] });

    useEffect(() => {
        const generateReport = async () => {
            const products = await InventoryRepository.getProducts();
            const salesInvoices = (await SalesRepository.getInvoices()).filter(inv => {
                const invDate = inv.date.split('T')[0];
                return invDate >= startDate && invDate <= endDate && (inv.type === InvoiceType.Sale || inv.type === InvoiceType.POS);
            });
            const expenses = (await FinanceRepository.getExpenses()).filter(exp => {
                const expDate = exp.date.split('T')[0];
                return expDate >= startDate && expDate <= endDate;
            });

            let totalSales = 0;
            let totalCost = 0;

            salesInvoices.forEach(inv => {
                totalSales += inv.totalAmountInSyp;
                inv.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    if (product) {
                        totalCost += convertToSyp(product.costPrice) * item.quantity;
                    }
                });
            });

            const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amountInSyp, 0);
            const netProfit = totalSales - totalCost - totalExpenses;
            
            const invoicesWithProfit = salesInvoices.map(inv => {
                const cost = inv.items.reduce((sum, item) => {
                    const product = products.find(p => p.id === item.productId);
                    return sum + (product ? convertToSyp(product.costPrice) * item.quantity : 0);
                }, 0);
                const profit = inv.totalAmountInSyp - cost;
                return { ...inv, profit };
            });

            setReportData({ totalSales, totalCost, totalExpenses, netProfit, invoices: invoicesWithProfit });
        };
        generateReport();
    }, [startDate, endDate, convertToSyp]);

    return reportData;
};

export const useDailyCashFlowReport = ({ date }: { date: string }) => {
    const [reportData, setReportData] = useState<{
        cashIn: any[];
        cashOut: any[];
        totalIn: number;
        totalOut: number;
        netFlow: number;
    }>({ cashIn: [], cashOut: [], totalIn: 0, totalOut: 0, netFlow: 0 });

    useEffect(() => {
        const generateReport = async () => {
            const transactions = (await FinanceRepository.getCashTransactions()).filter(t => t.date.split('T')[0] === date);
            const incomeTypes = [CashTransactionType.Sale, CashTransactionType.Deposit, CashTransactionType.TransferIn];
            
            const cashIn = transactions.filter(t => incomeTypes.includes(t.type));
            const cashOut = transactions.filter(t => !incomeTypes.includes(t.type));
            
            const totalIn = cashIn.reduce((sum, t) => sum + t.amountInSyp, 0);
            const totalOut = cashOut.reduce((sum, t) => sum + t.amountInSyp, 0);
            
            setReportData({ cashIn, cashOut, totalIn, totalOut, netFlow: totalIn - totalOut });
        };
        generateReport();
    }, [date]);
    
    return reportData;
};

export const useProductMovementReport = ({ startDate, endDate, productId }: { startDate: string, endDate: string, productId: string }) => {
    const [movements, setMovements] = useState<any[]>([]);

    useEffect(() => {
        const generateReport = async () => {
            if (!productId) {
                setMovements([]);
                return;
            };
            const invoices = (await SalesRepository.getInvoices()).filter(inv => {
                const invDate = inv.date.split('T')[0];
                return invDate >= startDate && invDate <= endDate;
            }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            const productMovements = [];
            for (const inv of invoices) {
                for (const item of inv.items) {
                    if (item.productId === productId) {
                         productMovements.push({
                             date: new Date(inv.date).toLocaleDateString('ar-SY'),
                             invoice: inv.id,
                             in: inv.type === 'purchase' ? item.quantity : 0,
                             out: inv.type !== 'purchase' ? item.quantity : 0,
                         });
                    }
                }
            }
            setMovements(productMovements);
        };
        generateReport();
    }, [productId, startDate, endDate]);

    return movements;
};

export const useInventoryValuationReport = () => {
    const { convertToSyp, formatCurrency } = useCurrency();
    const [reportData, setReportData] = useState<{ valuedProducts: any[], totalValue: number }>({ valuedProducts: [], totalValue: 0 });

    useEffect(() => {
        const generateReport = async () => {
            const products = await InventoryRepository.getProducts();
            let totalValue = 0;
            const valuedProducts = products.map(p => {
                const value = p.stock * convertToSyp(p.costPrice);
                totalValue += value;
                return {
                    name: p.name,
                    sku: p.sku,
                    stock: p.stock,
                    cost: formatCurrency(p.costPrice.amount, p.costPrice.currency),
                    value: formatCurrency(value, Currency.SYP)
                }
            });
            setReportData({ valuedProducts, totalValue });
        };
        generateReport();
    }, [convertToSyp, formatCurrency]);
    
    return reportData;
};

export const useBestSellersReport = ({ startDate, endDate, sortBy }: { startDate: string, endDate: string, sortBy: 'quantity' | 'value' }) => {
    const { convertToSyp } = useCurrency();
    const [sortedProducts, setSortedProducts] = useState<any[]>([]);

    useEffect(() => {
        const generateReport = async () => {
            const salesInvoices = (await SalesRepository.getInvoices()).filter(inv => {
                const invDate = inv.date.split('T')[0];
                return invDate >= startDate && invDate <= endDate && (inv.type === 'sale' || inv.type === 'pos');
            });

            const productSales: {[key: string]: { name: string, quantity: number, value: number }} = {};
            
            salesInvoices.forEach(inv => {
                inv.items.forEach(item => {
                    if (!productSales[item.productId]) {
                        productSales[item.productId] = { name: item.productName, quantity: 0, value: 0};
                    }
                    productSales[item.productId].quantity += item.quantity;
                    productSales[item.productId].value += convertToSyp(item.totalPrice);
                });
            });
            
            const sorted = Object.values(productSales).sort((a,b) => b[sortBy] - a[sortBy]);
            setSortedProducts(sorted);
        };
        generateReport();
    }, [startDate, endDate, sortBy, convertToSyp]);
    
    return sortedProducts;
};

export const useAgingSummaryReport = () => {
    const [reportData, setReportData] = useState<{ customers: any[], suppliers: any[] }>({ customers: [], suppliers: [] });

    useEffect(() => {
        const generateReport = async () => {
            const customersRaw = await LedgerRepository.getCustomers();
            const suppliersRaw = await LedgerRepository.getSuppliers();

            const customers = [];
            for(const c of customersRaw) {
                for(const [curr, bal] of Object.entries(c.balances)) {
                    if(bal > 0) {
                        customers.push({ ...c, balance: bal, balanceCurrency: curr });
                    }
                }
            }

            const suppliers = [];
            for(const s of suppliersRaw) {
                for(const [curr, bal] of Object.entries(s.balances)) {
                    if(bal > 0) {
                        suppliers.push({ ...s, balance: bal, balanceCurrency: curr });
                    }
                }
            }
            
            setReportData({ customers, suppliers });
        };
        generateReport();
    }, []);

    return reportData;
};