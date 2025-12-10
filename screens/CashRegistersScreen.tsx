
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, CashRegister, Currency, CashTransaction, CashTransactionType, Customer, Supplier } from '../types';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { useCurrency } from '../hooks/useCurrency';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import { ArrowRight } from '../components/icons';
import { CURRENCY_INFO } from '../constants';
import { NavigateFunction } from '../App';
import useNotificationStore from '../store/useNotificationStore';

const CashRegistersScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
    const [registers, setRegisters] = useState<CashRegister[]>([]);
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isTransferModalOpen, setTransferModalOpen] = useState(false);
    const [isMovementModalOpen, setMovementModalOpen] = useState(false);
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [paymentType, setPaymentType] = useState<'received' | 'made'>('received');
    
    // Date Filters
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { formatCurrency } = useCurrency();
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setRegisters(await FinanceRepository.getCashRegisters());
        setTransactions(await FinanceRepository.getCashTransactions());
    };

    const handleSaveRegister = async (name: string) => {
        try {
            const newRegister: CashRegister = {
                id: `cr-${Date.now()}`,
                name,
                balances: { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 }
            };
            await FinanceRepository.addCashRegister(newRegister);
            await loadData();
            setAddModalOpen(false);
            notify('تمت إضافة الصندوق بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to save register:", error);
            notify(`فشل حفظ الصندوق: ${error.message}`, 'error');
        }
    };

    const handleSaveTransfer = async (fromId: string, toId: string, amount: number, currency: Currency) => {
        try {
            await FinanceRepository.transferFunds(fromId, toId, amount, currency);
            await loadData();
            setTransferModalOpen(false);
            notify('تم التحويل بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to transfer funds:", error);
            notify(`فشل التحويل: ${error.message}`, 'error');
        }
    };

    const handleSaveMovement = async (registerId: string, amount: number, currency: Currency, description: string) => {
        try {
            await FinanceRepository.recordMovement(registerId, movementType, amount, currency, description);
            await loadData();
            setMovementModalOpen(false);
            notify('تم تسجيل الحركة بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to record movement:", error);
            notify(`فشل تسجيل الحركة: ${error.message}`, 'error');
        }
    };

    const handleSavePayment = async (data: { partyId: string, registerId: string, amount: number, currency: Currency }) => {
        try {
            await FinanceRepository.recordPayment(paymentType, data.partyId, data.registerId, data.amount, data.currency);
            await loadData();
            setPaymentModalOpen(false);
            notify('تم تسجيل الدفعة بنجاح!', 'success');
        } catch (error: any) {
            console.error("Failed to record payment:", error);
            notify(`فشل تسجيل الدفعة: ${error.message}`, 'error');
        }
    };

    const openMovementModal = (type: 'deposit' | 'withdrawal') => {
        setMovementType(type);
        setMovementModalOpen(true);
    };

    const openPaymentModal = (type: 'received' | 'made') => {
        setPaymentType(type);
        setPaymentModalOpen(true);
    }

    const filteredTransactions = useMemo(() => {
        if (!selectedRegister) return [];
        return transactions
            .filter(t => {
                const tDate = t.date.split('T')[0];
                const start = startDate || '0000-01-01';
                const end = endDate || '9999-12-31';
                return t.registerId === selectedRegister.id && tDate >= start && tDate <= end;
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [selectedRegister, transactions, startDate, endDate]);

    const handleBack = () => {
        if (selectedRegister) {
            setSelectedRegister(null);
            setStartDate('');
            setEndDate('');
        } else {
            navigate(Screen.Home);
        }
    };

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
                <div className="flex items-center">
                    <button onClick={handleBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <ArrowRight />
                    </button>
                    <h1 className="text-3xl font-bold mx-4">{selectedRegister ? `كشف حساب: ${selectedRegister.name}` : 'إدارة الصناديق'}</h1>
                </div>
                {!selectedRegister && (
                    <div className="flex gap-2 flex-wrap">
                        <Button onClick={() => openPaymentModal('received')}>سند قبض</Button>
                        <Button onClick={() => openPaymentModal('made')}>سند دفع</Button>
                        <div className="border-l h-8 mx-2 dark:border-gray-600"></div>
                        <Button onClick={() => openMovementModal('deposit')} variant="secondary">إيداع نقدي</Button>
                        <Button onClick={() => openMovementModal('withdrawal')} variant="secondary">سحب نقدي</Button>
                        <Button onClick={() => setTransferModalOpen(true)} variant="secondary">تحويل رصيد</Button>
                        <Button onClick={() => setAddModalOpen(true)} variant="secondary">إضافة صندوق</Button>
                    </div>
                )}
            </header>

            {!selectedRegister ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {registers.map(reg => (
                        <Card key={reg.id} className="p-4 cursor-pointer hover:shadow-xl hover:-translate-y-1" onClick={() => setSelectedRegister(reg)}>
                            <h3 className="text-xl font-bold text-primary">{reg.name}</h3>
                            <div className="mt-2 space-y-1 border-t pt-2 dark:border-gray-700">
                                {Object.entries(reg.balances).map(([currency, balance]) => (
                                    <p key={currency} className="font-semibold text-lg flex justify-between">
                                        <span>{CURRENCY_INFO[currency as Currency].name}:</span>
                                        <span>{formatCurrency(balance, currency as Currency)}</span>
                                    </p>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <>
                    <div className="mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm flex flex-wrap gap-4 items-end animate-fade-in">
                        <div className="flex-grow">
                            <h3 className="font-bold text-gray-500 mb-2">فلترة الحركات</h3>
                            <div className="flex gap-2">
                                <Input label="من تاريخ" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <Input label="إلى تاريخ" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="text-left">
                            <p className="text-sm text-gray-400">الرصيد الحالي</p>
                            {Object.entries(selectedRegister.balances).map(([curr, val]) => (
                                <p key={curr} className="font-bold text-xl">{formatCurrency(val, curr as Currency)}</p>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow animate-fade-in">
                        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                <tr>
                                    <th scope="col" className="px-6 py-3">التاريخ</th>
                                    <th scope="col" className="px-6 py-3">البيان</th>
                                    <th scope="col" className="px-6 py-3">داخل</th>
                                    <th scope="col" className="px-6 py-3">خارج</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan={4} className="text-center p-4">لا توجد حركات في هذه الفترة.</td></tr>
                                )}
                                {filteredTransactions.map(tr => {
                                    const isIncome = [CashTransactionType.Sale, CashTransactionType.Deposit, CashTransactionType.TransferIn, CashTransactionType.PaymentReceived].includes(tr.type);
                                    return (
                                    <tr key={tr.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                                        <td className="px-6 py-4">{new Date(tr.date).toLocaleString('ar-SY')}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{tr.description}</td>
                                        <td className="px-6 py-4 text-green-500">{isIncome ? formatCurrency(tr.amount, tr.currency) : '-'}</td>
                                        <td className="px-6 py-4 text-red-500">{!isIncome ? formatCurrency(tr.amount, tr.currency) : '-'}</td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            
            <AddRegisterModal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} onSave={handleSaveRegister} />
            <TransferModal isOpen={isTransferModalOpen} onClose={() => setTransferModalOpen(false)} onSave={handleSaveTransfer} registers={registers} />
            <MovementModal isOpen={isMovementModalOpen} onClose={() => setMovementModalOpen(false)} onSave={handleSaveMovement} registers={registers} type={movementType} />
            <PaymentModal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)} onSave={handleSavePayment} registers={registers} type={paymentType} />
        </div>
    );
};

// --- Modals ---

const AddRegisterModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (name: string) => void}> = ({isOpen, onClose, onSave}) => {
    const [name, setName] = useState('');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name) onSave(name);
        setName('');
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة صندوق / حساب جديد">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم الصندوق" value={name} onChange={e => setName(e.target.value)} required />
                <div className="pt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ</Button></div>
            </form>
        </Modal>
    );
};

const TransferModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (from: string, to: string, amount: number, currency: Currency) => void, registers: CashRegister[]}> = ({isOpen, onClose, onSave, registers}) => {
    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>(Currency.SYP);
    const notify = useNotificationStore((state) => state.notify);
    useEffect(() => {
        if(isOpen && registers.length > 1) {
            setFromId(registers[0].id);
            setToId(registers[1].id);
            setAmount('');
        }
    }, [isOpen, registers]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (fromId && toId && fromId !== toId && numAmount > 0) {
            onSave(fromId, toId, numAmount, currency);
        } else {
            notify('بيانات التحويل غير صحيحة.', 'error');
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تحويل رصيد بين الصناديق">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select label="من صندوق" value={fromId} onChange={e => setFromId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
                <Select label="إلى صندوق" value={toId} onChange={e => setToId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
                <div className="flex gap-2">
                    <Input label="المبلغ" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
                    <Select label="العملة" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select>
                </div>
                <div className="pt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">تنفيذ التحويل</Button></div>
            </form>
        </Modal>
    );
};

const MovementModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (registerId: string, amount: number, currency: Currency, description: string) => void, registers: CashRegister[], type: 'deposit' | 'withdrawal'}> = ({isOpen, onClose, onSave, registers, type}) => {
    const [registerId, setRegisterId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>(Currency.SYP);
    const [description, setDescription] = useState('');
    const notify = useNotificationStore((state) => state.notify);
    useEffect(() => { if (isOpen && registers.length > 0) setRegisterId(registers[0].id); setAmount(''); setDescription(''); }, [isOpen, registers]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (registerId && numAmount > 0 && description) {
            onSave(registerId, numAmount, currency, description);
        } else {
            notify('الرجاء ملء كافة الحقول', 'error');
        }
    };
    const title = type === 'deposit' ? 'إيداع نقدي' : 'سحب نقدي';
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select label="الصندوق" value={registerId} onChange={e => setRegisterId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
                <div className="flex gap-2">
                    <Input label="المبلغ" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
                    <Select label="العملة" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select>
                </div>
                <Input label="البيان" value={description} onChange={e => setDescription(e.target.value)} required placeholder="مثال: إضافة رأس مال، سحب شخصي..."/>
                <div className="pt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ الحركة</Button></div>
            </form>
        </Modal>
    );
};

const PaymentModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSave: (data: { partyId: string, registerId: string, amount: number, currency: Currency }) => void,
    registers: CashRegister[],
    type: 'received' | 'made'
}> = ({ isOpen, onClose, onSave, registers, type }) => {
    const [parties, setParties] = useState<(Customer | Supplier)[]>([]);
    const [partyId, setPartyId] = useState('');
    const [registerId, setRegisterId] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<Currency>(Currency.SYP);
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => {
        if (isOpen) {
            const loadParties = async () => {
                if (type === 'received') {
                    const customers = await LedgerRepository.getCustomers();
                    setParties(customers.filter(c => c.id !== 'c-cash'));
                } else {
                    setParties(await LedgerRepository.getSuppliers());
                }
            };
            loadParties();
            setAmount('');
            if (registers.length > 0) setRegisterId(registers[0].id);
        }
    }, [isOpen, type, registers]);
    
     useEffect(() => {
        if (parties.length > 0) {
            setPartyId(parties[0].id);
        }
    }, [parties]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (partyId && registerId && numAmount > 0) {
            onSave({ partyId, registerId, amount: numAmount, currency });
        } else {
            notify('الرجاء ملء كافة الحقول بشكل صحيح', 'error');
        }
    };
    
    const title = type === 'received' ? 'سند قبض من عميل' : 'سند دفع لمورد';
    const partyLabel = type === 'received' ? 'العميل' : 'المورد';
    const registerLabel = type === 'received' ? 'إلى صندوق' : 'من صندوق';
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Select label={partyLabel} value={partyId} onChange={e => setPartyId(e.target.value)}>{parties.map(p=><option key={p.id} value={p.id}>{p.name} (رصيده: {(p.balances[currency] || 0).toFixed(2)} {CURRENCY_INFO[currency].symbol})</option>)}</Select>
                <Select label={registerLabel} value={registerId} onChange={e => setRegisterId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select>
                <div className="flex gap-2">
                    <Input label="المبلغ" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} required />
                    <Select label="العملة" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select>
                </div>
                <div className="pt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ السند</Button></div>
            </form>
        </Modal>
    );
};

export default CashRegistersScreen;
