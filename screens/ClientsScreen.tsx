import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, Customer, Supplier, Currency } from '../types';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { useCurrency } from '../hooks/useCurrency';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Select from '../components/common/Select';
import { ArrowRight, FileText, Upload, Download } from '../components/icons';
import { CURRENCY_INFO } from '../constants';
import { NavigateFunction } from '../App';
import useNotificationStore from '../store/useNotificationStore';
import { exportDataToJson, importDataFromJson } from '../services/dataService';

const ClientsScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchTerm, setSearchTerm] = useState('');

  const [isCustomerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isImportExportModalOpen, setImportExportModalOpen] = useState(false);
  
  // Summary Modal State
  const [summaryParty, setSummaryParty] = useState<Customer | Supplier | null>(null);
  
  const customerFileInputRef = useRef<HTMLInputElement>(null);
  const supplierFileInputRef = useRef<HTMLInputElement>(null);
  const notify = useNotificationStore((state) => state.notify);
  
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setCustomers(await LedgerRepository.getCustomers());
    setSuppliers(await LedgerRepository.getSuppliers());
  };

  const openCustomerModal = (customer: Customer | null = null) => {
    setEditingCustomer(customer);
    setCustomerModalOpen(true);
  };

  const openSupplierModal = (supplier: Supplier | null = null) => {
    setEditingSupplier(supplier);
    setSupplierModalOpen(true);
  };
  
  const handleSaveCustomer = async (customerData: Omit<Customer, 'id' | 'balances'> & { initialBalance: number, initialCurrency: Currency }) => {
    try {
        if (editingCustomer) {
            await LedgerRepository.updateCustomer({ ...editingCustomer, name: customerData.name, phone: customerData.phone });
            notify('تم تحديث بيانات العميل بنجاح!', 'success');
        } else {
            const balances = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
            balances[customerData.initialCurrency] = customerData.initialBalance;
            await LedgerRepository.addCustomer({ 
                id: `c-${Date.now()}`, 
                name: customerData.name, 
                phone: customerData.phone,
                balances
            });
            notify('تمت إضافة العميل بنجاح!', 'success');
        }
        await loadData();
        setCustomerModalOpen(false);
    } catch (error: any) {
        console.error("Failed to save customer:", error);
        notify(`فشل حفظ العميل: ${error.message}`, 'error');
    }
  };

  const handleSaveSupplier = async (supplierData: Omit<Supplier, 'id' | 'balances'> & { initialBalance: number, initialCurrency: Currency }) => {
    try {
        if (editingSupplier) {
            await LedgerRepository.updateSupplier({ ...editingSupplier, name: supplierData.name, phone: supplierData.phone });
            notify('تم تحديث بيانات المورد بنجاح!', 'success');
        } else {
             const balances = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
            balances[supplierData.initialCurrency] = supplierData.initialBalance;
            await LedgerRepository.addSupplier({ 
                id: `s-${Date.now()}`, 
                name: supplierData.name, 
                phone: supplierData.phone,
                balances
            });
            notify('تمت إضافة المورد بنجاح!', 'success');
        }
        await loadData();
        setSupplierModalOpen(false);
    } catch (error: any) {
        console.error("Failed to save supplier:", error);
        notify(`فشل حفظ المورد: ${error.message}`, 'error');
    }
  };

  const filteredCustomers = useMemo(() => 
    customers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) && c.id !== 'c-cash'), 
    [customers, searchTerm]
  );
  
  const filteredSuppliers = useMemo(() => 
    suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [suppliers, searchTerm]
  );

  // --- Import / Export Handlers ---
  const handleExport = async (type: 'customers' | 'suppliers') => {
    if (type === 'customers') {
      const data = await LedgerRepository.getCustomers();
      exportDataToJson(data, 'customers');
    } else {
      const data = await LedgerRepository.getSuppliers();
      exportDataToJson(data, 'suppliers');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'customers' | 'suppliers') => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await importDataFromJson(file, type);
      let result;
      if (type === 'customers') {
        result = await LedgerRepository.importCustomers(data as Customer[]);
      } else {
        result = await LedgerRepository.importSuppliers(data as Supplier[]);
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
            <h1 className="text-3xl font-bold mx-4">العملاء والموردون</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setImportExportModalOpen(true)}>استيراد/تصدير</Button>
            <Button onClick={() => openCustomerModal()}>إضافة عميل</Button>
            <Button variant="secondary" onClick={() => openSupplierModal()}>إضافة مورد</Button>
          </div>
      </header>

      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('customers')}
            className={`${activeTab === 'customers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            العملاء (${filteredCustomers.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`${activeTab === 'suppliers' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-600'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            الموردون (${filteredSuppliers.length})
          </button>
        </nav>
      </div>
      
      <div className="mb-4">
        <Input 
            type="text"
            placeholder="ابحث بالاسم..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div>
        {activeTab === 'customers' ? (
          <PartyList 
            parties={filteredCustomers} 
            onEdit={openCustomerModal} 
            onClick={(p) => setSummaryParty(p)} 
            navigate={navigate} 
            partyType="customer"
          />
        ) : (
          <PartyList 
            parties={filteredSuppliers} 
            onEdit={openSupplierModal} 
            onClick={(p) => setSummaryParty(p)} 
            navigate={navigate} 
            partyType="supplier"
          />
        )}
      </div>
      
      <CustomerFormModal isOpen={isCustomerModalOpen} onClose={() => setCustomerModalOpen(false)} onSave={handleSaveCustomer} customer={editingCustomer} />
      <SupplierFormModal isOpen={isSupplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSave={handleSaveSupplier} supplier={editingSupplier} />
      
      {/* Summary Modal */}
      {summaryParty && (
          <PartySummaryModal 
            isOpen={!!summaryParty}
            onClose={() => setSummaryParty(null)}
            party={summaryParty}
            navigate={navigate}
            type={activeTab === 'customers' ? 'customer' : 'supplier'}
          />
      )}

      <Modal isOpen={isImportExportModalOpen} onClose={() => setImportExportModalOpen(false)} title="استيراد / تصدير">
          <div className="space-y-4">
            <ImportExportSection
              label="العملاء"
              onExport={() => handleExport('customers')}
              onImport={() => customerFileInputRef.current?.click()}
            />
             <ImportExportSection
              label="الموردون"
              onExport={() => handleExport('suppliers')}
              onImport={() => supplierFileInputRef.current?.click()}
            />
            <input type="file" ref={customerFileInputRef} onChange={(e) => handleFileChange(e, 'customers')} accept=".json" className="hidden" />
            <input type="file" ref={supplierFileInputRef} onChange={(e) => handleFileChange(e, 'suppliers')} accept=".json" className="hidden" />
          </div>
      </Modal>

    </div>
  );
};

const PartyList: React.FC<{parties: (Customer|Supplier)[], onEdit: (party: any) => void, onClick: (p: any) => void, navigate: NavigateFunction, partyType: 'customer' | 'supplier'}> = ({ parties, onEdit, onClick, navigate, partyType }) => {
    const { formatCurrency } = useCurrency();
    if (parties.length === 0) {
        return <p className="text-center text-gray-500 py-8">لا توجد بيانات لعرضها.</p>
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parties.map(party => (
                <Card key={party.id} className="p-4 animate-fade-in hover:shadow-xl cursor-pointer border-2 border-transparent hover:border-primary/20" onClick={() => onClick(party)}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-lg text-primary">{party.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{party.phone}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(Screen.AccountStatement, { partyId: party.id, partyType }); }}>
                            <FileText className="w-5 h-5"/>
                        </Button>
                    </div>
                    <div className="mt-4 pt-4 border-t dark:border-gray-700">
                         <div className="space-y-1">
                             {Object.entries(party.balances).map(([currency, amount]) => (
                                 Math.abs(amount) > 0.01 && (
                                     <div key={currency} className="flex justify-between text-sm">
                                         <span className="text-gray-500">{CURRENCY_INFO[currency as Currency].name}</span>
                                         <span className={`font-bold ${amount > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                             {formatCurrency(amount, currency as Currency)}
                                         </span>
                                     </div>
                                 )
                             ))}
                             {Object.values(party.balances).every(v => Math.abs(v) < 0.01) && (
                                 <p className="text-center text-gray-400 text-sm">لا يوجد رصيد</p>
                             )}
                         </div>
                        <div className="flex justify-end mt-2">
                             <Button size="sm" onClick={(e) => { e.stopPropagation(); onEdit(party); }} variant="secondary">تعديل البيانات</Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

// Reusable Modal Props
type PartyFormProps = {
    isOpen: boolean, 
    onClose: () => void, 
    onSave: (data: any) => void, 
    party: any 
};

const CustomerFormModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (data: any) => void, customer: Customer | null}> = ({isOpen, onClose, onSave, customer}) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [initialCurrency, setInitialCurrency] = useState<Currency>(Currency.SYP);

    useEffect(() => {
        if(customer) {
            setName(customer.name);
            setPhone(customer.phone || '');
            setInitialBalance(''); // On edit, we don't show balance editing here
        } else {
            setName('');
            setPhone('');
            setInitialBalance('');
            setInitialCurrency(Currency.SYP);
        }
    }, [customer, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            name, 
            phone, 
            initialBalance: parseFloat(initialBalance) || 0, 
            initialCurrency 
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={customer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم العميل" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="رقم الهاتف (اختياري)" value={phone} onChange={e => setPhone(e.target.value)} />
                {!customer && (
                    <div className="flex gap-2">
                        <Input label="الرصيد الافتتاحي" type="number" step="any" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} required />
                        <Select label="العملة" value={initialCurrency} onChange={e => setInitialCurrency(e.target.value as Currency)}>
                            {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                        </Select>
                    </div>
                )}
                 <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ</Button>
                </div>
            </form>
        </Modal>
    )
};

const SupplierFormModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (data: any) => void, supplier: Supplier | null}> = ({isOpen, onClose, onSave, supplier}) => {
     const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [initialBalance, setInitialBalance] = useState('');
    const [initialCurrency, setInitialCurrency] = useState<Currency>(Currency.SYP);

    useEffect(() => {
        if(supplier) {
            setName(supplier.name);
            setPhone(supplier.phone || '');
             setInitialBalance('');
        } else {
            setName('');
            setPhone('');
            setInitialBalance('');
            setInitialCurrency(Currency.SYP);
        }
    }, [supplier, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ 
            name, 
            phone, 
            initialBalance: parseFloat(initialBalance) || 0, 
            initialCurrency 
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={supplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم المورد" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="رقم الهاتف (اختياري)" value={phone} onChange={e => setPhone(e.target.value)} />
                 {!supplier && (
                    <div className="flex gap-2">
                        <Input label="الرصيد الافتتاحي" type="number" step="any" value={initialBalance} onChange={e => setInitialBalance(e.target.value)} required />
                        <Select label="العملة" value={initialCurrency} onChange={e => setInitialCurrency(e.target.value as Currency)}>
                            {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                        </Select>
                    </div>
                )}
                 <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ</Button>
                </div>
            </form>
        </Modal>
    )
};

const ImportExportSection: React.FC<{label: string, onExport: () => void, onImport: () => void}> = ({ label, onExport, onImport }) => {
    const isElectron = window.electronAPI?.isElectron;
    return (
        <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-between items-center">
            <span className="font-semibold">{label}</span>
            <div className="flex gap-2">
                <Button onClick={onImport} variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>
                    استيراد
                </Button>
                {isElectron && (
                    <Button onClick={onExport} variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                        تصدير
                    </Button>
                )}
            </div>
        </div>
    );
};

// New Summary Modal
const PartySummaryModal: React.FC<{isOpen: boolean, onClose: () => void, party: any, navigate: any, type: string}> = ({ isOpen, onClose, party, navigate, type }) => {
    const { formatCurrency } = useCurrency();
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={party.name}>
            <div className="space-y-4 text-center">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-gray-500 mb-2">الأرصدة الحالية</p>
                    {Object.entries(party.balances).map(([curr, val]: any) => (
                        <p key={curr} className={`text-xl font-bold ${val > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatCurrency(val, curr)}
                        </p>
                    ))}
                </div>
                <div className="flex gap-2 justify-center">
                    <Button onClick={() => { onClose(); navigate(Screen.AccountStatement, { partyId: party.id, partyType: type }); }}>
                        عرض كشف الحساب الكامل
                    </Button>
                    <Button variant="secondary" onClick={onClose}>إغلاق</Button>
                </div>
            </div>
        </Modal>
    )
}

export default ClientsScreen;