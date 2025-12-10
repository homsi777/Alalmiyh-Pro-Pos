import React, { useState, useEffect } from 'react';
import { Screen, Customer, Supplier, Currency, Product } from '../types';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { useCurrency } from '../hooks/useCurrency';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { ArrowRight, Printer } from '../components/icons';
import { NavigateFunction } from '../App';
import useGlobalStore from '../store/useGlobalStore';
import useNotificationStore from '../store/useNotificationStore';
import { 
    useProfitAndLossReport, 
    useDailyCashFlowReport, 
    useProductMovementReport, 
    useInventoryValuationReport,
    useBestSellersReport,
    useAgingSummaryReport
} from '../hooks/useReports';

type ReportType = 
    | 'none'
    | 'salesSummary'
    | 'dailyCashFlow'
    | 'productMovement'
    | 'inventoryValuation'
    | 'bestSellers'
    | 'accountStatementLinker'
    | 'agingSummary';

const ReportsScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
    const today = new Date().toISOString().split('T')[0];
    const [reportType, setReportType] = useState<ReportType>('none');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const [activeReport, setActiveReport] = useState<{type: ReportType, filters: any} | null>(null);
    const notify = useNotificationStore((state) => state.notify);

    const handleGenerateReport = () => {
        setActiveReport({ type: reportType, filters: { startDate, endDate } });
    };
    
    const handlePrint = () => {
        if (activeReport) {
            window.print();
        } else {
            notify('يرجى إنشاء تقرير أولاً قبل الطباعة.', 'info');
        }
    };
    
    const renderReport = () => {
        if (!activeReport) {
            return <p className="text-center text-gray-500 py-10">الرجاء اختيار تقرير وتطبيق المرشحات لعرض البيانات.</p>;
        }

        switch (activeReport.type) {
            case 'salesSummary':
                return <ProfitAndLossReport startDate={activeReport.filters.startDate} endDate={activeReport.filters.endDate} />;
            case 'dailyCashFlow':
                return <DailyCashFlowReport date={activeReport.filters.endDate} />;
            case 'productMovement':
                 return <ProductMovementReport startDate={activeReport.filters.startDate} endDate={activeReport.filters.endDate} />;
            case 'inventoryValuation':
                return <InventoryValuationReport />;
            case 'bestSellers':
                return <BestSellersReport startDate={activeReport.filters.startDate} endDate={activeReport.filters.endDate} />;
            case 'accountStatementLinker':
                return <AccountStatementLinker navigate={navigate} />;
            case 'agingSummary':
                return <AgingSummaryReport />;
            default:
                return null;
        }
    }

    const showDateRange = ['salesSummary', 'productMovement', 'bestSellers'].includes(reportType);
    const showSingleDate = reportType === 'dailyCashFlow';

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <header className="flex items-center justify-between mb-6 gap-4 flex-wrap no-print">
                <div className="flex items-center">
                    <button onClick={() => navigate(Screen.Home)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <ArrowRight />
                    </button>
                    <h1 className="text-3xl font-bold mx-4">التقارير</h1>
                </div>
            </header>
            
            <Card className="p-4 mb-6 no-print">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Select label="اختر التقرير" value={reportType} onChange={e => { setReportType(e.target.value as ReportType); setActiveReport(null); } }>
                        <option value="none">-- لم يتم اختيار تقرير --</option>
                        <optgroup label="المبيعات والمالية">
                            <option value="salesSummary">ملخص الأرباح والخسائر</option>
                            <option value="dailyCashFlow">حركة الصندوق اليومية</option>
                        </optgroup>
                        <optgroup label="المخزون">
                            <option value="productMovement">حركة المنتجات المفصلة</option>
                            <option value="inventoryValuation">جرد المخزون الحالي</option>
                            <option value="bestSellers">أفضل المنتجات مبيعاً</option>
                        </optgroup>
                        <optgroup label="الذمم والحسابات">
                            <option value="accountStatementLinker">كشف حساب عميل/مورد</option>
                            <option value="agingSummary">ملخص أعمار الذمم</option>
                        </optgroup>
                    </Select>

                    {showDateRange && (
                        <>
                            <Input label="من تاريخ" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                            <Input label="إلى تاريخ" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </>
                    )}
                    
                    {showSingleDate && (
                         <Input label="اختر اليوم" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    )}

                    <div className="flex gap-2">
                        <Button onClick={handleGenerateReport} className="flex-grow" disabled={reportType==='none'}>تطبيق</Button>
                        <Button onClick={handlePrint} variant="secondary" leftIcon={<Printer className="w-5 h-5"/>} disabled={!activeReport}>طباعة</Button>
                    </div>
                </div>
            </Card>

            <div id="printable-report">
                {renderReport()}
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS FOR EACH REPORT ---

const ReportWrapper: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => {
    const { companyInfo } = useGlobalStore.getState();
    return (
        <div className="animate-fade-in">
            <div className="print:hidden mb-4">
                <h2 className="text-2xl font-bold text-primary">{title}</h2>
            </div>
            <div className="hidden print:block mb-6 text-center">
                 <h1 className="text-xl font-bold">{companyInfo.name}</h1>
                 <h2 className="text-lg font-semibold">{title}</h2>
                 <p className="text-sm">بتاريخ: {new Date().toLocaleDateString('ar-SY')}</p>
            </div>
            {children}
        </div>
    )
};

const ProfitAndLossReport: React.FC<{startDate: string, endDate: string}> = ({startDate, endDate}) => {
    const { totalSales, totalCost, totalExpenses, netProfit, invoices } = useProfitAndLossReport({ startDate, endDate });
    const { formatCurrency } = useCurrency();

    return (
        <ReportWrapper title="ملخص الأرباح والخسائر">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-4 text-center bg-green-50 dark:bg-green-900/50">
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">إجمالي المبيعات</p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">{formatCurrency(totalSales, Currency.SYP)}</p>
                </Card>
                 <Card className="p-4 text-center bg-orange-50 dark:bg-orange-900/50">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">تكلفة البضاعة</p>
                    <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">{formatCurrency(totalCost, Currency.SYP)}</p>
                </Card>
                <Card className="p-4 text-center bg-red-50 dark:bg-red-900/50">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">إجمالي المصاريف</p>
                    <p className="text-2xl font-bold text-red-800 dark:text-red-200">{formatCurrency(totalExpenses, Currency.SYP)}</p>
                </Card>
                 <Card className="p-4 text-center bg-blue-50 dark:bg-blue-900/50">
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">صافي الربح</p>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(netProfit, Currency.SYP)}</p>
                </Card>
            </div>
             <Table headers={['رقم الفاتورة', 'التاريخ', 'قيمة المبيع', 'الربح من الفاتورة']}
                rows={invoices.map(inv => [inv.id, new Date(inv.date).toLocaleDateString('ar-SY'), formatCurrency(inv.totalAmountInSyp, Currency.SYP), formatCurrency(inv.profit, Currency.SYP)])}
            />
        </ReportWrapper>
    );
};

const DailyCashFlowReport: React.FC<{date: string}> = ({date}) => {
    const { cashIn, cashOut, totalIn, totalOut, netFlow } = useDailyCashFlowReport({ date });
    const { formatCurrency } = useCurrency();

    return (
        <ReportWrapper title={`حركة الصندوق ليوم ${date}`}>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                 <Card className="p-4 text-center bg-green-50 dark:bg-green-900/50"><p>الإجمالي الداخل</p><p className="font-bold text-xl">{formatCurrency(totalIn, Currency.SYP)}</p></Card>
                 <Card className="p-4 text-center bg-red-50 dark:bg-red-900/50"><p>الإجمالي الخارج</p><p className="font-bold text-xl">{formatCurrency(totalOut, Currency.SYP)}</p></Card>
                 <Card className="p-4 text-center bg-blue-50 dark:bg-blue-900/50"><p>صافي الحركة</p><p className="font-bold text-xl">{formatCurrency(netFlow, Currency.SYP)}</p></Card>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold text-lg mb-2 text-green-600">النقد الداخل</h3>
                    <Table headers={['البيان', 'المبلغ']} rows={cashIn.map(t => [t.description, formatCurrency(t.amountInSyp, Currency.SYP)])} />
                </div>
                 <div>
                    <h3 className="font-bold text-lg mb-2 text-red-600">النقد الخارج</h3>
                    <Table headers={['البيان', 'المبلغ']} rows={cashOut.map(t => [t.description, formatCurrency(t.amountInSyp, Currency.SYP)])} />
                </div>
            </div>
        </ReportWrapper>
    );
};

const ProductMovementReport: React.FC<{startDate: string, endDate: string}> = ({startDate, endDate}) => {
    const [products, setProducts] = useState<Product[]>([]);
    useEffect(() => {
        const fetchProducts = async () => {
            setProducts(await InventoryRepository.getProducts());
        };
        fetchProducts();
    }, []);
    const [selectedProductId, setSelectedProductId] = useState<string>('');
    const movements = useProductMovementReport({ startDate, endDate, productId: selectedProductId });
    
    return (
        <ReportWrapper title="حركة المنتجات المفصلة">
            <div className="mb-4 no-print">
                <Select label="اختر المنتج" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)}>
                    <option value="">-- اختر المنتج --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
            </div>
            {selectedProductId ? (
                 <Table headers={['التاريخ', 'رقم الفاتورة', 'كمية داخلة', 'كمية خارجة']}
                    rows={movements.map(m => [m.date, m.invoice, m.in || '-', m.out || '-'])}
                />
            ) : <p className="text-center text-gray-500">الرجاء اختيار منتج لعرض حركته.</p>}
        </ReportWrapper>
    );
};

const InventoryValuationReport: React.FC = () => {
    const { valuedProducts, totalValue } = useInventoryValuationReport();
    const { formatCurrency } = useCurrency();

    return (
        <ReportWrapper title="جرد وتقييم المخزون الحالي">
            <Card className="p-4 text-center mb-6 bg-blue-50 dark:bg-blue-900/50">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">القيمة الإجمالية للمخزون (حسب التكلفة)</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{formatCurrency(totalValue, Currency.SYP)}</p>
            </Card>
            <Table headers={['المنتج', 'الباركود', 'الكمية', 'سعر التكلفة', 'القيمة الإجمالية']}
                rows={valuedProducts.map(p => [p.name, p.sku, p.stock, p.cost, p.value])}
            />
        </ReportWrapper>
    )
};

const BestSellersReport: React.FC<{startDate: string, endDate: string}> = ({startDate, endDate}) => {
    const [sortBy, setSortBy] = useState<'quantity' | 'value'>('quantity');
    const sortedProducts = useBestSellersReport({ startDate, endDate, sortBy });
    const { formatCurrency } = useCurrency();

    return (
        <ReportWrapper title="أفضل المنتجات مبيعاً">
            <div className="flex justify-end mb-4 no-print">
                 <Select value={sortBy} onChange={e => setSortBy(e.target.value as any)} label="ترتيب حسب">
                     <option value="quantity">الكمية</option>
                     <option value="value">القيمة</option>
                 </Select>
            </div>
             <Table headers={['المنتج', 'الكمية المباعة', 'قيمة المبيعات الإجمالية']}
                rows={sortedProducts.map(p => [p.name, p.quantity, formatCurrency(p.value, Currency.SYP)])}
            />
        </ReportWrapper>
    );
};

const AccountStatementLinker: React.FC<{navigate: NavigateFunction}> = ({navigate}) => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    useEffect(() => {
        const fetchData = async () => {
            setCustomers((await LedgerRepository.getCustomers()).filter(c => c.id !== 'c-cash'));
            setSuppliers(await LedgerRepository.getSuppliers());
        };
        fetchData();
    }, []);
    const [partyType, setPartyType] = useState<'customer' | 'supplier'>('customer');
    const [partyId, setPartyId] = useState('');

    return (
        <ReportWrapper title="كشف حساب عميل / مورد">
             <div className="space-y-4">
                <Select label="نوع الطرف" value={partyType} onChange={e => {setPartyType(e.target.value as any); setPartyId('')}}>
                    <option value="customer">عميل</option>
                    <option value="supplier">مورد</option>
                </Select>
                <Select label="اختر الطرف" value={partyId} onChange={e => setPartyId(e.target.value)}>
                    <option value="">-- اختر --</option>
                    {(partyType === 'customer' ? customers : suppliers).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <Button onClick={() => navigate(Screen.AccountStatement, {partyId, partyType})} disabled={!partyId}>
                    عرض كشف الحساب
                </Button>
            </div>
        </ReportWrapper>
    )
};

const AgingSummaryReport: React.FC = () => {
    const { customers, suppliers } = useAgingSummaryReport();
    const { formatCurrency } = useCurrency();
    
    return (
        <ReportWrapper title="ملخص أعمار الذمم">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-bold text-lg mb-2 text-red-600">أرصدة العملاء المدينة (المستحقة لنا)</h3>
                    <Table headers={['العميل', 'الرصيد']} 
                        rows={customers.map(c => [c.name, formatCurrency(c.balance, c.balanceCurrency)])}
                    />
                </div>
                 <div>
                    <h3 className="font-bold text-lg mb-2 text-green-600">أرصدة الموردين الدائنة (المستحقة لهم)</h3>
                    <Table headers={['المورد', 'الرصيد']}
                        rows={suppliers.map(s => [s.name, formatCurrency(s.balance, s.balanceCurrency)])}
                    />
                </div>
            </div>
        </ReportWrapper>
    );
};

// --- Generic Table Component ---
const Table: React.FC<{headers: string[], rows: (string|number)[][]}> = ({headers, rows}) => (
    <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                    {headers.map(h => <th key={h} scope="col" className="px-6 py-3">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td colSpan={headers.length} className="text-center py-6">لا توجد بيانات لعرضها.</td></tr>
                ) : rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                        {row.map((cell, cellIndex) => <td key={cellIndex} className="px-6 py-4">{cell}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default ReportsScreen;