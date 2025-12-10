import React, { useState, useEffect, useMemo } from 'react';
import { Screen, Currency, Invoice, Product, Customer, PaymentType, Price, InvoiceType, Supplier, CashRegister, Category } from '../types';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { useCurrency } from '../hooks/useCurrency';
import useNotificationStore from '../store/useNotificationStore';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { ArrowRight, Camera, Plus } from '../components/icons';
import { CURRENCY_INFO } from '../constants';
import { NavigateFunction } from '../App';
import { BarcodeService } from '../services/barcodeService';

interface InvoiceFormScreenProps {
  navigate: NavigateFunction;
  type: 'sale' | 'purchase';
  invoiceId?: string;
}

interface TempInvoiceItem {
  product: Product;
  quantity: number | string;
  price: { amount: number | string, currency: Currency };
}

const InvoiceFormScreen: React.FC<InvoiceFormScreenProps> = ({ navigate, type, invoiceId }) => {
  const isSale = type === 'sale';
  const isEditing = !!invoiceId;

  const [originalInvoice, setOriginalInvoice] = useState<Invoice | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]); 
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [items, setItems] = useState<TempInvoiceItem[]>([]);
  
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [paymentCurrency, setPaymentCurrency] = useState<Currency>(Currency.SYP);
  const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.Cash);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');

  // Modals State
  const [isAddSupplierModalOpen, setAddSupplierModalOpen] = useState(false);
  const [isAddProductModalOpen, setAddProductModalOpen] = useState(false);

  const { convertToSyp, convertFromSyp, formatCurrency, getCurrencySymbol } = useCurrency();
  const notify = useNotificationStore((state) => state.notify);

  const loadData = async () => {
    const productsFromDb = await InventoryRepository.getProducts();
    setAllProducts(productsFromDb);
    const cats = await InventoryRepository.getCategories();
    setCategories(cats);
    const allCustomers = await LedgerRepository.getCustomers();
    setCustomers(allCustomers);
    const allSuppliers = await LedgerRepository.getSuppliers();
    setSuppliers(allSuppliers);
    const allRegisters = await FinanceRepository.getCashRegisters();
    setCashRegisters(allRegisters);

    if (isEditing) {
        const invoices = await SalesRepository.getInvoices();
        const invoiceToEdit = invoices.find(i => i.id === invoiceId);
        if (invoiceToEdit) {
            setOriginalInvoice(invoiceToEdit);
            setSelectedPartyId(invoiceToEdit.customerId || invoiceToEdit.supplierId || '');
            setPaymentCurrency(invoiceToEdit.currency);
            setPaymentType(invoiceToEdit.paymentType || PaymentType.Cash);
            setSelectedCashRegisterId(invoiceToEdit.cashRegisterId || (allRegisters.length > 0 ? allRegisters[0].id : ''));
            setVendorInvoiceNumber(invoiceToEdit.vendorInvoiceNumber || '');
            
            const populatedItems = invoiceToEdit.items.map(item => {
                const product = productsFromDb.find(p => p.id === item.productId);
                return {
                    product: product!,
                    quantity: item.quantity,
                    price: item.unitPrice
                };
            }).filter(item => item.product); 
            setItems(populatedItems);
        }
    } else {
        if (isSale) {
            setSelectedPartyId(allCustomers.find(c => c.id === 'c-cash')?.id || '');
        } else {
            // Supplier is optional for purchase, so we don't force select
            if (allSuppliers.length > 0) setSelectedPartyId(''); 
        }
        if (allRegisters.length > 0) setSelectedCashRegisterId(allRegisters[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, [isEditing, invoiceId, isSale]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const results = allProducts.filter(p => 
        (p.name.toLowerCase().includes(lowercasedTerm) || 
         p.sku.toLowerCase().includes(lowercasedTerm))
    );
    setSearchResults(results);
  }, [searchTerm, allProducts]);

  const handleSelectProduct = (product: Product) => {
    const existingItem = items.find((item) => item.product.id === product.id);
    if (existingItem) {
        const currentQty = parseFloat(existingItem.quantity.toString()) || 0;
        updateItem(product.id, 'quantity', currentQty + 1);
    } else {
        const price = isSale ? product.sellingPrice : product.costPrice;
        setItems([...items, { product, quantity: 1, price: { amount: price.amount, currency: price.currency } }]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const updateItem = (productId: string, field: 'quantity' | 'priceAmount' | 'priceCurrency', value: any) => {
      setItems(items.map(item => {
          if (item.product.id === productId) {
              if (field === 'quantity') return {...item, quantity: value };
              if (field === 'priceAmount') return {...item, price: { ...item.price, amount: value }};
              if (field === 'priceCurrency') return {...item, price: { ...item.price, currency: value as Currency }};
          }
          return item;
      }));
  };

  const removeItem = (productId: string) => {
      setItems(items.filter(item => item.product.id !== productId));
  };
  
  const totalInSyp = useMemo(() => {
    return items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity.toString()) || 0;
        const priceAmt = parseFloat(item.price.amount.toString()) || 0;
        const itemPriceInSyp = convertToSyp({ amount: priceAmt, currency: item.price.currency });
        return sum + itemPriceInSyp * qty;
    }, 0);
  }, [items, convertToSyp]);

  const totalInSelectedCurrency = useMemo(() => {
    return convertFromSyp(totalInSyp, paymentCurrency);
  }, [totalInSyp, paymentCurrency, convertFromSyp]);

  const handleSave = async () => {
    // Validate: Sales MUST have a customer. Purchases CAN be anonymous (no supplier).
    if (isSale && !selectedPartyId) {
        notify('الرجاء اختيار العميل', 'error');
        return;
    }

    if (items.length === 0) {
        notify('الرجاء إضافة منتجات إلى الفاتورة', 'error');
        return;
    }
    if (paymentType === PaymentType.Cash && !selectedCashRegisterId) {
        notify('الرجاء اختيار صندوق للدفع النقدي.', 'error');
        return;
    }

    const invoiceData: Omit<Invoice, 'id' | 'date'> = {
        type: isSale ? InvoiceType.Sale : InvoiceType.Purchase,
        paymentType: paymentType,
        items: items.map(item => {
            const qty = parseFloat(item.quantity.toString()) || 0;
            const priceAmt = parseFloat(item.price.amount.toString()) || 0;
            return {
                productId: item.product.id,
                productName: item.product.name,
                quantity: qty,
                unitPrice: { amount: priceAmt, currency: item.price.currency },
                totalPrice: { amount: priceAmt * qty, currency: item.price.currency }
            }
        }),
        currency: paymentCurrency,
        totalAmount: totalInSelectedCurrency,
        totalAmountInSyp: totalInSyp,
        customerId: isSale ? selectedPartyId : undefined,
        supplierId: !isSale ? selectedPartyId || undefined : undefined,
        cashRegisterId: paymentType === PaymentType.Cash ? selectedCashRegisterId : undefined,
        vendorInvoiceNumber: !isSale ? vendorInvoiceNumber : undefined,
    };

    const result = await SalesRepository.processInvoice(invoiceData, isEditing, originalInvoice);
    
    notify(result.message, result.success ? 'success' : 'error');
    if (result.success) {
        navigate(Screen.Invoices);
    }
  };

  const handleSupplierAdded = async (data: Omit<Supplier, 'id'>) => {
      try {
          const newId = `s-${Date.now()}`;
          await LedgerRepository.addSupplier({ id: newId, ...data });
          await loadData(); 
          setSelectedPartyId(newId); 
          setAddSupplierModalOpen(false);
          notify('تم إضافة المورد واختياره بنجاح', 'success');
      } catch (e: any) {
          notify(e.message, 'error');
      }
  };

  const handleProductAdded = async (data: Omit<Product, 'id'>) => {
      try {
          const newId = `p-${Date.now()}`;
          const newProduct = { id: newId, ...data };
          await InventoryRepository.addProduct(newProduct);
          await loadData(); 
          
          const price = isSale ? newProduct.sellingPrice : newProduct.costPrice;
          setItems(prev => [...prev, { product: newProduct, quantity: 1, price }]);
          
          setAddProductModalOpen(false);
          notify('تم تعريف المنتج وإضافته للفاتورة', 'success');
      } catch (e: any) {
          notify(e.message, 'error');
      }
  };

  const screenTitle = `${isEditing ? 'تعديل' : 'إنشاء'} ${isSale ? 'فاتورة بيع' : 'فاتورة شراء'}`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="flex items-center p-4 bg-background dark:bg-dark-background shadow-md z-10">
        <button onClick={() => navigate(Screen.Invoices)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ArrowRight />
        </button>
        <h1 className="text-2xl font-bold mx-4">{screenTitle}</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
        {isSale ? (
             <Select label="العميل" value={selectedPartyId} onChange={e => setSelectedPartyId(e.target.value)}>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
        ) : (
            <div className="flex items-end gap-2">
                <Select label="المورد (اختياري)" value={selectedPartyId} onChange={e => setSelectedPartyId(e.target.value)} className="flex-grow">
                    <option value="">-- بدون مورد (مشتريات عامة) --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Button onClick={() => setAddSupplierModalOpen(true)} className="mb-[2px] !px-3" title="إضافة مورد جديد">
                    <Plus className="w-5 h-5"/>
                </Button>
            </div>
        )}
        
        {!isSale && (
            <Input 
                label="رقم فاتورة المورد" 
                value={vendorInvoiceNumber} 
                onChange={e => setVendorInvoiceNumber(e.target.value)} 
                placeholder="أدخل الرقم المرجعي لفاتورة المورد" 
            />
        )}

        <Select label="نوع الدفع" value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)}>
            <option value={PaymentType.Cash}>{isSale ? 'بيع نقدي' : 'شراء نقدي'}</option>
            <option value={PaymentType.Credit}>{isSale ? 'بيع آجل (ذمم)' : 'شراء آجل (ذمم)'}</option>
        </Select>
        {paymentType === PaymentType.Cash && (
            <Select label="الصندوق" value={selectedCashRegisterId} onChange={e => setSelectedCashRegisterId(e.target.value)}>
                {cashRegisters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
        )}
        <Select label="عملة الدفع" value={paymentCurrency} onChange={e => setPaymentCurrency(e.target.value as Currency)}>
            {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
        </Select>
      </div>
      
      <div className="relative p-4 pt-0 flex gap-2 flex-wrap sm:flex-nowrap">
        <div className="flex-grow relative">
            <Input
            type="text"
            placeholder="ابحث عن منتج لإضافته..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            />
             {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-b-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {searchResults.map(p => (
                    <div key={p.id} onClick={() => handleSelectProduct(p)} className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b dark:border-gray-600">
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.sku}</p>
                    </div>
                    ))}
                </div>
            )}
        </div>
        
        <Button variant="ghost" className="!p-2">
            <Camera className="h-6 w-6" />
        </Button>
        
        {!isSale && (
            <Button onClick={() => setAddProductModalOpen(true)} variant="secondary" leftIcon={<Plus className="w-4 h-4" />}>
                تعريف منتج
            </Button>
        )}
      </div>

      <main className="flex-grow overflow-x-auto p-4 pt-0">
         <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
            <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                <th scope="col" className="px-2 py-3">المنتج</th>
                <th scope="col" className="px-2 py-3">السعر</th>
                <th scope="col" className="px-2 py-3">الكمية</th>
                <th scope="col" className="px-2 py-3">المجموع</th>
                <th scope="col" className="px-2 py-3"></th>
                </tr>
            </thead>
            <tbody>
                {items.length === 0 && (
                    <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">
                            لم يتم إضافة أي منتجات بعد
                        </td>
                    </tr>
                )}
                {items.map(item => {
                    const qty = parseFloat(item.quantity.toString()) || 0;
                    const priceAmt = parseFloat(item.price.amount.toString()) || 0;
                    return (
                    <tr key={item.product.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
                        <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">{item.product.name}</td>
                        <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                                <Input type="number" step="any" value={item.price.amount} onChange={e => updateItem(item.product.id, 'priceAmount', e.target.value)} className="!p-1 w-24"/>
                                <span>{getCurrencySymbol(item.price.currency)}</span>
                            </div>
                        </td>
                        <td className="px-2 py-2">
                            <Input type="number" step="any" value={item.quantity} onChange={e => updateItem(item.product.id, 'quantity', e.target.value)} className="!p-1 w-20 text-center"/>
                        </td>
                        <td className="px-2 py-2">{formatCurrency(priceAmt * qty, item.price.currency)}</td>
                        <td className="px-2 py-2">
                            <Button variant="danger" size="sm" onClick={() => removeItem(item.product.id)} className="!p-1">X</Button>
                        </td>
                    </tr>
                )})}
            </tbody>
            </table>
        </div>
      </main>

      <footer className="p-4 bg-background dark:bg-dark-background border-t-2 border-primary dark:border-primary-dark shadow-inner space-y-4">
          <div className="flex justify-between items-center text-xl font-bold">
              <span>الإجمالي:</span>
              <span>{formatCurrency(totalInSelectedCurrency, paymentCurrency)}</span>
          </div>
          <div className="flex gap-2">
             <Button onClick={() => navigate(Screen.Invoices)} variant="secondary" size="lg" className="w-full">إلغاء</Button>
            <Button onClick={handleSave} size="lg" className="w-full">حفظ الفاتورة</Button>
          </div>
      </footer>

      {/* --- Modals --- */}
      <SupplierFormModal 
        isOpen={isAddSupplierModalOpen} 
        onClose={() => setAddSupplierModalOpen(false)} 
        onSave={handleSupplierAdded} 
      />
      
      <ProductFormModal 
        isOpen={isAddProductModalOpen} 
        onClose={() => setAddProductModalOpen(false)} 
        onSave={handleProductAdded} 
        categories={categories}
      />

    </div>
  );
};

const SupplierFormModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (data: Omit<Supplier, 'id'>) => void}> = ({isOpen, onClose, onSave}) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [balance, setBalance] = useState('');
    const [balanceCurrency, setBalanceCurrency] = useState<Currency>(Currency.SYP);

    useEffect(() => {
        if (!isOpen) { setName(''); setPhone(''); setBalance(''); setBalanceCurrency(Currency.SYP); }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const balances = { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 };
        balances[balanceCurrency] = parseFloat(balance) || 0;
        onSave({ name, phone, balances });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة مورد جديد">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم المورد" value={name} onChange={e => setName(e.target.value)} required />
                <Input label="رقم الهاتف" value={phone} onChange={e => setPhone(e.target.value)} />
                <div className="flex gap-2">
                    <Input label="الرصيد الافتتاحي" type="number" step="any" value={balance} onChange={e => setBalance(e.target.value)} required />
                    <Select label="العملة" value={balanceCurrency} onChange={e => setBalanceCurrency(e.target.value as Currency)}>
                        {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                    </Select>
                </div>
                 <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ المورد</Button>
                </div>
            </form>
        </Modal>
    )
};

const ProductFormModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (data: Omit<Product, 'id'>) => void, categories: Category[]}> = ({isOpen, onClose, onSave, categories}) => {
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [stock, setStock] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [costPriceAmount, setCostPriceAmount] = useState('');
    const [costPriceCurrency, setCostPriceCurrency] = useState<Currency>(Currency.SYP);
    const [sellingPriceAmount, setSellingPriceAmount] = useState('');
    const [sellingPriceCurrency, setSellingPriceCurrency] = useState<Currency>(Currency.SYP);
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => {
        if(!isOpen) {
            setName(''); setSku(''); setStock(''); setCategoryId('');
            setCostPriceAmount(''); setCostPriceCurrency(Currency.SYP);
            setSellingPriceAmount(''); setSellingPriceCurrency(Currency.SYP);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const costPrice = { amount: parseFloat(costPriceAmount) || 0, currency: costPriceCurrency };
        const sellingPrice = { amount: parseFloat(sellingPriceAmount) || 0, currency: sellingPriceCurrency };
        
        onSave({ 
            name, sku, stock: parseFloat(stock) || 0, categoryId, 
            costPrice, 
            wholesalePrice: sellingPrice, 
            sellingPrice 
        });
    };
    
    const handleBarcodeScan = async () => {
        try {
            const { content } = await BarcodeService.scanCamera();
            if (content) { setSku(content); notify(`تم المسح: ${content}`, 'success'); }
        } catch (error: any) { notify(error.message, 'error'); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تعريف منتج جديد">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم المنتج" value={name} onChange={e => setName(e.target.value)} required />
                <div className="flex gap-2 items-end">
                    <Input label="الباركود (SKU)" value={sku} onChange={e => setSku(e.target.value)} />
                    <Button type="button" variant="ghost" onClick={handleBarcodeScan} className="!p-2"><Camera className="h-6 w-6"/></Button>
                </div>
                <Select label="الفئة" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">-- غير مصنف --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <Input label="الكمية الافتتاحية" type="number" step="any" value={stock} onChange={e => setStock(e.target.value)} required />
                <div className="flex gap-2">
                    <Input label="سعر التكلفة" type="number" step="any" value={costPriceAmount} onChange={e => setCostPriceAmount(e.target.value)} required />
                    <Select label="العملة" value={costPriceCurrency} onChange={e => setCostPriceCurrency(e.target.value as Currency)}>
                        {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                    </Select>
                </div>
                 <div className="flex gap-2">
                    <Input label="سعر البيع" type="number" step="any" value={sellingPriceAmount} onChange={e => setSellingPriceAmount(e.target.value)} required />
                    <Select label="العملة" value={sellingPriceCurrency} onChange={e => setSellingPriceCurrency(e.target.value as Currency)}>
                        {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                    </Select>
                </div>
                <div className="pt-4 flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
                    <Button type="submit">حفظ وإضافة للفاتورة</Button>
                </div>
            </form>
        </Modal>
    );
};

export default InvoiceFormScreen;