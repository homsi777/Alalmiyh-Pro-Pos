

import React, { useState, useEffect, useMemo } from 'react';
import { Screen, Customer, Supplier, Invoice, PaymentType, Currency, CashTransactionType, PaperSize } from '../types';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { useCurrency } from '../hooks/useCurrency';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Select from '../components/common/Select';
import { ArrowRight, Printer } from '../components/icons';
import { NavigateFunction } from '../App';
import useGlobalStore from '../store/useGlobalStore';
import { PrinterService } from '../services/printerService';
import useNotificationStore from '../store/useNotificationStore';
import { CURRENCY_INFO } from '../constants';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import { isCapacitor, isElectron } from '../services/platform';

interface AccountStatementScreenProps {
  navigate: NavigateFunction;
  partyId: string;
  partyType: 'customer' | 'supplier';
}

interface Transaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  currency: Currency;
  invoiceId?: string; // Added field for Smart Link (Sale/Purchase)
  linkedInvoiceId?: string; // Added field for Smart Link (Payment)
}

const AccountStatementScreen: React.FC<AccountStatementScreenProps> = ({ navigate, partyId, partyType }) => {
  const [party, setParty] = useState<Customer | Supplier | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(Currency.SYP);
  
  const { printerSettings } = useGlobalStore();
  const { formatCurrency } = useCurrency();
  const notify = useNotificationStore((state) => state.notify);

  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [printers, setPrinters] = useState<{name: string, address: string}[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const isCustomer = partyType === 'customer';
      const customers = await LedgerRepository.getCustomers();
      const suppliers = await LedgerRepository.getSuppliers();
      const partyData = isCustomer ? customers.find(c => c.id === partyId) : suppliers.find(s => s.id === partyId);
      
      if (partyData) {
        setParty(partyData);
        if (partyData.balances[Currency.USD] !== 0) setSelectedCurrency(Currency.USD);
        else setSelectedCurrency(Currency.SYP);
        
        const allInvoices = await SalesRepository.getInvoices();
        const relatedInvoices = allInvoices.filter(inv => inv.paymentType === PaymentType.Credit && (isCustomer ? inv.customerId === partyId : inv.supplierId === partyId));
        
        const allPayments = await FinanceRepository.getCashTransactions();
        const paymentTypeFilter = isCustomer ? CashTransactionType.PaymentReceived : CashTransactionType.PaymentMade;
        const relatedPayments = allPayments.filter(p => p.type === paymentTypeFilter && p.relatedId === partyId);

        const events = [
            ...relatedInvoices.map(inv => ({
                date: new Date(inv.date),
                type: 'invoice',
                amount: inv.totalAmount,
                currency: inv.currency,
                description: `فاتورة ${inv.type === 'purchase' ? 'شراء' : 'بيع'}`,
                invoiceId: inv.id,
                linkedInvoiceId: undefined
            })),
            ...relatedPayments.map(p => ({
                date: new Date(p.date),
                type: 'payment',
                amount: p.amount,
                currency: p.currency,
                description: p.description || (isCustomer ? 'دفعة مقبوضة' : 'دفعة مصروفة'),
                invoiceId: undefined,
                linkedInvoiceId: (p as any).linkedInvoiceId
            }))
        ].sort((a, b) => a.date.getTime() - b.date.getTime());

        const mappedTrx: Transaction[] = events.map(e => ({
            date: e.date.toISOString(),
            description: e.description,
            invoiceId: e.invoiceId,
            linkedInvoiceId: e.linkedInvoiceId,
            debit: (isCustomer && e.type === 'invoice') || (!isCustomer && e.type === 'payment') ? e.amount : 0,
            credit: (isCustomer && e.type === 'payment') || (!isCustomer && e.type === 'invoice') ? e.amount : 0,
            balance: 0, 
            currency: e.currency
        }));

        setAllTransactions(mappedTrx);
      }
    };
    loadData();
  }, [partyId, partyType]);

  const filteredTransactions = useMemo(() => {
      let runningBalance = 0;
      const filtered = allTransactions.filter(t => t.currency === selectedCurrency);
      
      const calculated = filtered.map(t => {
          const change = partyType === 'customer' 
              ? (t.debit - t.credit) 
              : (t.credit - t.debit);
          
          runningBalance += change;
          return { ...t, balance: runningBalance };
      });

      return calculated;
  }, [allTransactions, selectedCurrency, partyType]);

  const handleInvoiceClick = async (invoiceId: string) => {
      try {
          const invoices = await SalesRepository.getInvoices();
          const target = invoices.find(i => i.id === invoiceId);
          if (target) {
              setSelectedInvoice(target);
              setIsDetailsModalOpen(true);
          } else {
              notify('لم يتم العثور على الفاتورة.', 'error');
          }
      } catch (e) {
          notify('حدث خطأ أثناء جلب تفاصيل الفاتورة.', 'error');
      }
  }

  const handlePrintClick = async () => {
    if (!party) return;
    setIsSearchingPrinters(true);
    setPrinterModalOpen(true);
    try {
        let devices: {name: string, address: string}[] = [];
        if (isElectron) {
            devices = await PrinterService.listDevices();
        } else if (isCapacitor) {
            devices = await PrinterService.listBluetoothDevices();
             if (devices.length === 0) {
                   notify("لم يتم العثور على طابعات بلوتوث مقترنة. يرجى الاقتران بالطابعة من إعدادات البلوتوث في جهازك.", 'info');
              }
        } else {
            notify("الطباعة متاحة فقط على نسخة سطح المكتب أو تطبيق أندرويد.", 'error');
            setPrinterModalOpen(false);
        }
        setPrinters(devices);
    } catch (error: any) {
        notify(error.message, 'error');
        setPrinterModalOpen(false);
    } finally {
        setIsSearchingPrinters(false);
    }
  };

  const handleSelectPrinter = async (address: string) => {
      if (!party) return;
      setIsPrinting(true);
      const dataToPrint = {
        party: { ...party, balance: party.balances[selectedCurrency], balanceCurrency: selectedCurrency },
        transactions: filteredTransactions
      };
      try {
          if (isElectron) {
             await PrinterService.printDocument({ type: 'statement', data: dataToPrint as any }, address);
          } else if (isCapacitor) {
              await PrinterService.printStatementThermalCapacitor(dataToPrint, address, printerSettings.paperSize);
          }
          notify("تم إرسال أمر الطباعة!", "success");
      } catch (error: any) {
          notify(error.message, 'error');
      } finally {
          setIsPrinting(false);
          setPrinterModalOpen(false);
      }
  };

  if (!party) {
    return <div>جار التحميل...</div>;
  }

  const currentBalance = party.balances[selectedCurrency] || 0;
  const balanceColor = currentBalance > 0 ? 'text-red-500' : currentBalance < 0 ? 'text-green-500' : 'text-gray-500';

  return (
    <>
      <div className="p-4 sm:p-6 md:p-8">
        <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center">
              <button onClick={() => navigate(Screen.Clients)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                  <ArrowRight />
              </button>
              <h1 className="text-3xl font-bold mx-4">كشف حساب</h1>
            </div>
            <div className="flex gap-2">
                <Select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as Currency)} className="w-32">
                    {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].name}</option>)}
                </Select>
                <Button onClick={handlePrintClick} leftIcon={<Printer className="w-5 h-5"/>}>
                    طباعة
                </Button>
            </div>
        </header>

        <Card className="p-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
                <h2 className="text-xl font-bold text-primary">{party.name}</h2>
                <p className="text-gray-500 dark:text-gray-400">{party.phone}</p>
            </div>
             <div className="text-left">
                <p className="text-sm text-gray-500">الرصيد النهائي ({CURRENCY_INFO[selectedCurrency].symbol})</p>
                <p className={`font-bold text-3xl ${balanceColor}`}>{formatCurrency(Math.abs(currentBalance), selectedCurrency)}</p>
                <p className="text-xs text-gray-400 mt-1">{currentBalance > 0 ? (partyType === 'customer' ? 'مطلوب منه' : 'له بذمتنا') : (currentBalance < 0 ? (partyType === 'customer' ? 'له بذمتنا' : 'مطلوب منه') : 'متوازن')}</p>
            </div>
          </div>
        </Card>
        
        <StatementTable 
            transactions={filteredTransactions} 
            currency={selectedCurrency} 
            partyType={partyType} 
            onInvoiceClick={handleInvoiceClick}
        />
      </div>

      <PrinterModal 
        isOpen={isPrinterModalOpen}
        onClose={() => setPrinterModalOpen(false)}
        printers={printers}
        isLoading={isSearchingPrinters || isPrinting}
        onSelectPrinter={handleSelectPrinter}
      />

      {isDetailsModalOpen && selectedInvoice && (
          <InvoiceDetailsModal 
            isOpen={isDetailsModalOpen}
            onClose={() => setIsDetailsModalOpen(false)}
            invoice={selectedInvoice}
            partyName={party.name}
          />
      )}
    </>
  );
};

interface StatementTableProps {
    transactions: Transaction[];
    currency: Currency;
    partyType: 'customer' | 'supplier';
    onInvoiceClick: (id: string) => void;
}

const StatementTable: React.FC<StatementTableProps> = ({ transactions, currency, partyType, onInvoiceClick }) => {
    const { formatCurrency } = useCurrency();
    const debitLabel = partyType === 'customer' ? 'عليه (مدين)' : 'لنا (مدين)';
    const creditLabel = partyType === 'customer' ? 'له (دائن)' : 'له (دائن)';

    return (
        <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
            <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                    <th scope="col" className="px-6 py-3">التاريخ</th>
                    <th scope="col" className="px-6 py-3">البيان</th>
                    <th scope="col" className="px-6 py-3 text-red-600">{debitLabel}</th>
                    <th scope="col" className="px-6 py-3 text-green-600">{creditLabel}</th>
                    <th scope="col" className="px-6 py-3">الرصيد</th>
                </tr>
                </thead>
                <tbody>
                {transactions.length === 0 ? (
                     <tr><td colSpan={5} className="text-center py-6">لا توجد حركات بهذه العملة.</td></tr>
                ) : transactions.map((tr, index) => (
                    <tr key={index} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                        <td className="px-6 py-4">{tr.date ? new Date(tr.date).toLocaleDateString('ar-SY') : '-'}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            {tr.description}
                            
                            {tr.invoiceId && (
                                <button 
                                    onClick={() => onInvoiceClick(tr.invoiceId!)}
                                    className="text-primary font-bold hover:underline bg-primary/10 px-2 py-0.5 rounded text-xs transition-colors"
                                    title="اضغط لعرض تفاصيل الفاتورة"
                                >
                                    #{tr.invoiceId}
                                </button>
                            )}

                            {tr.linkedInvoiceId && (
                                <button 
                                    onClick={() => onInvoiceClick(tr.linkedInvoiceId!)}
                                    className="text-green-600 font-bold hover:underline bg-green-100 px-2 py-0.5 rounded text-xs transition-colors"
                                    title="دفعة عن الفاتورة"
                                >
                                    (عن #{tr.linkedInvoiceId})
                                </button>
                            )}
                        </td>
                        <td className="px-6 py-4 text-red-500 font-bold">{tr.debit > 0 ? formatCurrency(tr.debit, currency) : '-'}</td>
                        <td className="px-6 py-4 text-green-500 font-bold">{tr.credit > 0 ? formatCurrency(tr.credit, currency) : '-'}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white" dir="ltr">{formatCurrency(tr.balance, currency)}</td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    )
}

const PrinterModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    printers: {name: string, address: string}[];
    isLoading: boolean;
    onSelectPrinter: (address: string) => void;
}> = ({ isOpen, onClose, printers, isLoading, onSelectPrinter }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="اختر طابعة">
            {isLoading && <p className="text-center">جار البحث عن الأجهزة...</p>}
            {!isLoading && printers.length === 0 && <p className="text-center">لم يتم العثور على طابعات. يرجى التأكد من اقتران طابعة بلوتوث أو تثبيت طابعة على النظام.</p>}
            {!isLoading && printers.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {printers.map(p => (
                        <button
                            key={p.address}
                            onClick={() => onSelectPrinter(p.address)}
                            className="w-full text-right p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <p className="font-bold">{p.name}</p>
                            <p className="text-sm text-gray-500">{p.address}</p>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}

export default AccountStatementScreen;
