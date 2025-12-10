import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, Expense, ExpenseCategory, Currency, CashRegister } from '../types';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { useCurrency } from '../hooks/useCurrency';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import { ArrowRight, Plus, Upload, Download } from '../components/icons';
import { CURRENCY_INFO } from '../constants';
import { NavigateFunction } from '../App';
import useNotificationStore from '../store/useNotificationStore';
import { exportDataToJson, importDataFromJson } from '../services/dataService';

const ExpensesScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
    
    const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
    const [isCategoryModalOpen, setCategoryModalOpen] = useState(false);
    const [isImportExportModalOpen, setImportExportModalOpen] = useState(false);

    const [filterCategory, setFilterCategory] = useState('all');
    const [filterCurrency, setFilterCurrency] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    
    const { formatCurrency, convertToSyp } = useCurrency();
    const notify = useNotificationStore((state) => state.notify);
    const expenseFileInputRef = useRef<HTMLInputElement>(null);
    const categoryFileInputRef = useRef<HTMLInputElement>(null);
    const isElectron = window.electronAPI?.isElectron;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const fetchedExpenses = await FinanceRepository.getExpenses();
        setExpenses(fetchedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setCategories(await FinanceRepository.getExpenseCategories());
        setCashRegisters(await FinanceRepository.getCashRegisters());
    };

    const handleSaveExpense = async (newExpenseData: Omit<Expense, 'id' | 'amountInSyp'>) => {
        try {
            const expense: Expense = {
                id: `exp-${Date.now()}`,
                ...newExpenseData,
                amountInSyp: convertToSyp({amount: newExpenseData.amount, currency: newExpenseData.currency}),
            };
            await FinanceRepository.recordExpense(expense);
            await loadData();
            setExpenseModalOpen(false);
            notify('تم تسجيل المصروف بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to save expense:", error);
            notify(`فشل تسجيل المصروف: ${error.message}`, 'error');
        }
    };
    
    const handleSaveCategory = async (categoryName: string) => {
        try {
            const newCategory: ExpenseCategory = { id: `ec-${Date.now()}`, name: categoryName };
            await FinanceRepository.addExpenseCategory(newCategory);
            await loadData();
            setCategoryModalOpen(false);
            notify('تمت إضافة التصنيف بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to save category:", error);
            notify(`فشل حفظ التصنيف: ${error.message}`, 'error');
        }
    };

    const filteredExpenses = useMemo(() => {
        return expenses.filter(exp => {
            const expDate = exp.date.split('T')[0];
            const start = startDate || '0000-01-01';
            const end = endDate || '9999-12-31';
            
            const categoryMatch = filterCategory === 'all' || exp.categoryId === filterCategory;
            const currencyMatch = filterCurrency === 'all' || exp.currency === filterCurrency;
            const dateMatch = expDate >= start && expDate <= end;
            
            return categoryMatch && currencyMatch && dateMatch;
        });
    }, [expenses, filterCategory, filterCurrency, startDate, endDate]);
    
     // --- Import / Export Handlers ---
    const handleExport = async (type: 'expenses' | 'expenseCategories') => {
        if (type === 'expenses') {
            const data = await FinanceRepository.getExpenses();
            exportDataToJson(data, 'expenses');
        } else {
            const data = await FinanceRepository.getExpenseCategories();
            exportDataToJson(data, 'expenseCategories');
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'expenses' | 'expenseCategories') => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = await importDataFromJson(file, type);
            let result;
            if (type === 'expenses') {
                result = await FinanceRepository.importExpenses(data as Expense[]);
            } else {
                result = await FinanceRepository.importExpenseCategories(data as ExpenseCategory[]);
            }
            notify(`تم استيراد ${result.imported} عنصر جديد وتخطي ${result.skipped} عنصر مكرر.`, 'success');
            setImportExportModalOpen(false);
            await loadData();
        } catch (error: any) {
            notify(error.message, 'error');
        } finally {
            if(event.target) event.target.value = '';
        }
    };


    return (
        <div className="p-4 sm:p-6 md:p-8">
            <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <div className="flex items-center">
                    <button onClick={() => navigate(Screen.Home)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <ArrowRight />
                    </button>
                    <h1 className="text-3xl font-bold mx-4">إدارة المصاريف</h1>
                </div>
                 <div className="flex items-center gap-2 flex-wrap">
                    <Button onClick={() => setImportExportModalOpen(true)}>استيراد/تصدير</Button>
                    <Button onClick={() => setExpenseModalOpen(true)}>إضافة مصروف جديد</Button>
                </div>
            </header>

            <Card className="p-4 mb-6">
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <Input label="من تاريخ" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <Input label="إلى تاريخ" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    <Select label="تصنيف المصروف" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="all">الكل</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <Select label="العملة" value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}>
                        <option value="all">الكل</option>
                        {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].name}</option>)}
                    </Select>
                 </div>
            </Card>

            <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
                <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                        <tr>
                            <th scope="col" className="px-6 py-3">التاريخ</th>
                            <th scope="col" className="px-6 py-3">البيان</th>
                            <th scope="col" className="px-6 py-3">التصنيف</th>
                            <th scope="col" className="px-6 py-3">المبلغ</th>
                            <th scope="col" className="px-6 py-3">مصدر الدفع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredExpenses.map(exp => (
                            <tr key={exp.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                <td className="px-6 py-4">{new Date(exp.date).toLocaleDateString('ar-SY')}</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{exp.description}</td>
                                <td className="px-6 py-4">{categories.find(c => c.id === exp.categoryId)?.name || 'غير مصنف'}</td>
                                <td className="px-6 py-4">{formatCurrency(exp.amount, exp.currency)}</td>
                                <td className="px-6 py-4">{cashRegisters.find(r => r.id === exp.cashRegisterId)?.name || 'غير محدد'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddExpenseModal
                isOpen={isExpenseModalOpen}
                onClose={() => setExpenseModalOpen(false)}
                onSave={handleSaveExpense}
                categories={categories}
                cashRegisters={cashRegisters}
                onAddCategory={() => { setExpenseModalOpen(false); setCategoryModalOpen(true); }}
            />
            
            <AddExpenseCategoryModal
                isOpen={isCategoryModalOpen}
                onClose={() => { setCategoryModalOpen(false); setExpenseModalOpen(true); }}
                onSave={handleSaveCategory}
            />
            
            <Modal isOpen={isImportExportModalOpen} onClose={() => setImportExportModalOpen(false)} title="استيراد / تصدير بيانات المصاريف">
                <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-between items-center">
                        <span className="font-semibold">المصاريف</span>
                        <div className="flex gap-2">
                            <Button onClick={() => expenseFileInputRef.current?.click()} variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>استيراد</Button>
                            {isElectron && (
                                <Button onClick={() => handleExport('expenses')} variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>تصدير</Button>
                            )}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-between items-center">
                        <span className="font-semibold">تصنيفات المصاريف</span>
                        <div className="flex gap-2">
                            <Button onClick={() => categoryFileInputRef.current?.click()} variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>استيراد</Button>
                            {isElectron && (
                                <Button onClick={() => handleExport('expenseCategories')} variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>تصدير</Button>
                            )}
                        </div>
                    </div>
                    <input type="file" ref={expenseFileInputRef} onChange={(e) => handleFileChange(e, 'expenses')} accept=".json" className="hidden" />
                    <input type="file" ref={categoryFileInputRef} onChange={(e) => handleFileChange(e, 'expenseCategories')} accept=".json" className="hidden" />
                </div>
            </Modal>
        </div>
    );
};

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (expense: Omit<Expense, 'id' | 'amountInSyp'>) => void;
    onAddCategory: () => void;
    categories: ExpenseCategory[];
    cashRegisters: CashRegister[];
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onSave, onAddCategory, categories, cashRegisters }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>(Currency.SYP);
    const [categoryId, setCategoryId] = useState('');
    const [cashRegisterId, setCashRegisterId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => {
        if (isOpen) {
            setDescription('');
            setAmount('');
            setCurrency(Currency.SYP);
            setDate(new Date().toISOString().split('T')[0]);
            if (categories.length > 0) setCategoryId(categories[0].id);
            if (cashRegisters.length > 0) setCashRegisterId(cashRegisters[0].id);
        }
    }, [isOpen, categories, cashRegisters]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!description || !amount || !categoryId || !cashRegisterId) {
            notify("الرجاء ملء جميع الحقول الإلزامية.", 'error');
            return;
        }
        onSave({
            date,
            description,
            amount: parseFloat(amount),
            currency,
            categoryId,
            cashRegisterId,
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة مصروف جديد">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="وصف المصروف" value={description} onChange={e => setDescription(e.target.value)} required />
                <Input label="تاريخ المصروف" type="date" value={date} onChange={e => setDate(e.target.value)} required />
                <div className="flex gap-2">
                    <Input label="قيمة المصروف" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
                    <Select label="العملة" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
                        {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                    </Select>
                </div>
                <div className="flex items-end gap-2">
                    <Select label="تصنيف المصروف" value={categoryId} onChange={e => setCategoryId(e.target.value)} required className="flex-grow">
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <Button type="button" onClick={onAddCategory} variant="ghost" className="!p-2"><Plus/></Button>
                </div>
                <Select label="مصدر الدفع" value={cashRegisterId} onChange={e => setCashRegisterId(e.target.value)} required>
                    {cashRegisters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
                <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ المصروف</Button>
                </div>
            </form>
        </Modal>
    );
};

interface AddExpenseCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => void;
}

const AddExpenseCategoryModal: React.FC<AddExpenseCategoryModalProps> = ({ isOpen, onClose, onSave }) => {
    const [name, setName] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim());
            setName('');
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة تصنيف مصروف جديد">
             <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم التصنيف" value={name} onChange={e => setName(e.target.value)} required />
                <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ</Button>
                </div>
             </form>
        </Modal>
    )
}

export default ExpensesScreen;