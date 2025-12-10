
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Screen, Currency, Product, Category, InvoiceType, Customer, PaymentType, CashRegister, CartItem, Price, Invoice } from '../types';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { useCurrency } from '../hooks/useCurrency';
import { useUsbScanner } from '../hooks/useUsbScanner';
import usePosStore from '../store/usePosStore';
import useNotificationStore from '../store/useNotificationStore';
import useGlobalStore from '../store/useGlobalStore';
import { PrinterService } from '../services/printerService';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import Modal from '../components/common/Modal';
import { ShoppingCart, Camera, ArrowRight, Printer, FileText, Plus, Moon } from '../components/icons';
import { NavigateFunction } from '../App';
import { isCapacitor, isElectron } from '../services/platform';
import { BarcodeService } from '../services/barcodeService';
import { CURRENCY_INFO } from '../constants';

interface PosScreenProps {
  navigate: NavigateFunction;
}

const CartItemRow = ({ item, updateQuantity, updateItemPrice, removeItem, formatCurrency }: { item: CartItem, updateQuantity: (id: string, q: number) => void, updateItemPrice: (id: string, p: Price) => void, removeItem: (id: string) => void, formatCurrency: any }) => {
    const priceToUse = item.overridePrice || item.product.sellingPrice;

    const handleQuantityChange = (delta: number) => {
        const newQuantity = Math.max(0, item.quantity + delta);
        if (newQuantity === 0) {
            removeItem(item.product.id);
        } else {
            updateQuantity(item.product.id, newQuantity);
        }
    };
    
    return (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-2 flex flex-col gap-2">
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-gray-800 dark:text-gray-200 text-base flex-1 pr-2">{item.product.name}</h4>
                <span className="font-bold text-primary text-lg">
                    {formatCurrency(priceToUse.amount * item.quantity, priceToUse.currency)}
                </span>
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">السعر:</span>
                    <span className="font-semibold">{formatCurrency(priceToUse.amount, priceToUse.currency)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => handleQuantityChange(1)} size="sm" className="!px-3 !py-1 rounded-full font-bold text-lg">+</Button>
                    <span className="font-bold text-lg w-8 text-center">{item.quantity}</span>
                    <Button onClick={() => handleQuantityChange(-1)} size="sm" variant="secondary" className="!px-3 !py-1 rounded-full font-bold text-lg">-</Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeItem(item.product.id)} className="!p-2 text-red-500 text-xs">
                   حذف
                </Button>
            </div>
        </div>
    )
}


const CartContents: React.FC<{ onCheckout: () => void }> = ({ onCheckout }) => {
    const { items, removeItem, updateQuantity, updateItemPrice, clearCart } = usePosStore();
    const { convertToSyp, formatCurrency } = useCurrency();

    const cartTotalInSyp = useMemo(() => {
        return items.reduce((sum, item) => {
            const priceToUse = item.overridePrice || item.product.sellingPrice;
            return sum + convertToSyp(priceToUse) * item.quantity;
        }, 0);
    }, [items, convertToSyp]);

    return (
        <>
            <div className="p-3 bg-primary text-white shadow-md flex justify-between items-center no-print">
                <h2 className="text-lg font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> السلة</h2>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">{items.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900/50">
                {items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                        <ShoppingCart className="w-16 h-16 mb-4" />
                        <p>السلة فارغة</p>
                    </div>
                ) : (
                    items.map(item => (
                        <CartItemRow
                            key={item.product.id}
                            item={item}
                            updateQuantity={updateQuantity}
                            updateItemPrice={updateItemPrice}
                            removeItem={removeItem}
                            formatCurrency={formatCurrency}
                        />
                    ))
                )}
            </div>

            <div className="p-3 bg-white dark:bg-gray-800 border-t dark:border-gray-700 space-y-3 no-print">
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300 px-1">
                    <span>المجموع:</span>
                    <span className="font-bold text-2xl text-primary">{formatCurrency(cartTotalInSyp, Currency.SYP)}</span>
                </div>

                <Button
                    onClick={onCheckout}
                    disabled={items.length === 0}
                    className="w-full py-3 text-lg shadow-lg"
                >
                    إتمام البيع
                </Button>

                <button onClick={clearCart} className="w-full text-red-500 text-xs hover:underline text-center pb-1">
                    إلغاء وإفراغ السلة
                </button>
            </div>
        </>
    );
}

const PosScreen: React.FC<PosScreenProps> = ({ navigate }) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  
  // Printing State for Capacitor
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [printers, setPrinters] = useState<{name: string, address: string}[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);

  const { items, addItem, clearCart } = usePosStore();
  const { convertToSyp, formatCurrency } = useCurrency();
  const { printerSettings, setPrinterSettings } = useGlobalStore();
  const notify = useNotificationStore((state) => state.notify);

  const loadData = async () => {
    setAllProducts(await InventoryRepository.getProducts());
    setCategories(await InventoryRepository.getCategories());
    setCustomers(await LedgerRepository.getCustomers());
    setCashRegisters(await FinanceRepository.getCashRegisters());
  };

  useEffect(() => { loadData(); }, []);

  const handleBarcodeScanned = useCallback((code: string) => {
    const lowercasedCode = code.toLowerCase().trim();
    const product = allProducts.find(p => p.sku && p.sku.toLowerCase() === lowercasedCode);
    if (product) {
        if (product.stock > 0) {
            addItem(product);
            notify(`تمت إضافة: ${product.name}`, 'success');
            setSearchTerm(''); 
        } else {
            notify(`المنتج "${product.name}" نفد من المخزون`, 'error');
        }
    } else {
        notify(`لم يتم العثور على منتج: ${code}`, 'error');
    }
  }, [allProducts, addItem, notify]);
  
  useUsbScanner(handleBarcodeScanned);

  const handleCameraScan = async () => {
    try {
        const { content, cancelled } = await BarcodeService.scanCamera();
        if (cancelled) return;
        if (content) {
            handleBarcodeScanned(content);
        }
    } catch (error: any) {
        notify(error.message, 'error');
    }
  };

  const filteredProducts = useMemo(() => {
      let prods = allProducts;
      if (selectedCategoryId !== 'all') {
          prods = prods.filter(p => p.categoryId === selectedCategoryId);
      }
      if (searchTerm.trim() !== '') {
          const lowerTerm = searchTerm.toLowerCase();
          prods = prods.filter(p => 
              p.name.toLowerCase().includes(lowerTerm) || 
              (p.sku && p.sku.toLowerCase().includes(lowerTerm))
          );
      }
      return prods;
  }, [allProducts, selectedCategoryId, searchTerm]);

  const cartTotalInSyp = useMemo(() => {
    return items.reduce((sum, item) => {
        const priceToUse = item.overridePrice || item.product.sellingPrice;
        return sum + convertToSyp(priceToUse) * item.quantity;
    }, 0);
  }, [items, convertToSyp]);

  const handleProcessSale = async (data: any) => {
      try {
          const result = await SalesRepository.processInvoice({
              type: InvoiceType.POS,
              paymentType: data.paymentType,
              customerId: data.customerId,
              cashRegisterId: data.cashRegisterId,
              currency: Currency.SYP,
              items: items.map(i => ({
                  productId: i.product.id,
                  productName: i.product.name,
                  quantity: i.quantity,
                  unitPrice: i.overridePrice || i.product.sellingPrice,
                  totalPrice: { amount: (i.overridePrice?.amount || i.product.sellingPrice.amount) * i.quantity, currency: i.product.sellingPrice.currency }
              })),
              totalAmount: cartTotalInSyp,
              totalAmountInSyp: cartTotalInSyp,
          }, false, null);

          if (result.success) {
              if (data.paymentType === PaymentType.Credit && data.partialPaymentAmount > 0) {
                  await FinanceRepository.recordPayment(
                      'received', 
                      data.customerId, 
                      data.cashRegisterId, 
                      data.partialPaymentAmount, 
                      data.partialPaymentCurrency,
                      result.invoiceId
                  );
              }

              notify('تم حفظ الفاتورة بنجاح', 'success');
              clearCart();
              setIsCheckoutOpen(false);
              setIsCartModalOpen(false);
              loadData();

              // Handle Immediate Printing with Retry for Stability
              if (data.shouldPrint && result.invoiceId) {
                  
                  // Wait a short moment for DB transaction to fully settle
                  await new Promise(r => setTimeout(r, 200));

                  // Retry finding the invoice up to 3 times
                  const findInvoice = async (attempts = 3): Promise<Invoice | undefined> => {
                      const allInv = await SalesRepository.getInvoices();
                      const found = allInv.find(i => i.id === result.invoiceId);
                      if (found) return found;
                      if (attempts > 0) {
                          await new Promise(r => setTimeout(r, 300));
                          return findInvoice(attempts - 1);
                      }
                      return undefined;
                  };

                  const inv = await findInvoice();
                  
                  if (inv) {
                      if (isElectron && printerSettings.defaultPrinterName) {
                          await PrinterService.printDocument({ type: 'invoice', data: inv }, printerSettings.defaultPrinterName);
                      } else if (isCapacitor) {
                          const defaultAddress = printerSettings.defaultPrinterAddress;
                          if (defaultAddress) {
                              setInvoiceToPrint(inv);
                              notify('جار الطباعة على الطابعة الافتراضية...', 'info');
                              handleSelectPrinter(defaultAddress, inv);
                          } else {
                              setInvoiceToPrint(inv);
                              setIsSearchingPrinters(true);
                              setPrinterModalOpen(true);
                              try {
                                  const devices = await PrinterService.listBluetoothDevices();
                                  setPrinters(devices);
                                  if (devices.length === 0) {
                                      notify("لم يتم العثور على طابعات بلوتوث مقترنة.", 'info');
                                  }
                              } catch (error: any) {
                                  notify(error.message, 'error');
                              } finally {
                                  setIsSearchingPrinters(false);
                              }
                          }
                      }
                  } else {
                      notify('تم الحفظ، لكن فشل تحميل الفاتورة للطباعة. يرجى الطباعة من قسم الفواتير.', 'error');
                  }
              }
          } else {
            throw new Error(result.message);
          }
      } catch (e: any) {
          notify(e.message, 'error');
      }
  };

  const handleSelectPrinter = async (address: string, specificInvoice?: Invoice) => {
        const inv = specificInvoice || invoiceToPrint;
        if (!inv) return;
        
        setIsPrinting(true);
        try {
            await PrinterService.printInvoiceThermalCapacitor(inv, address, printerSettings.paperSize);
            
            notify("تم إرسال أمر الطباعة!", "success");
            setPrinterModalOpen(false);
            setInvoiceToPrint(null);
        } catch (error: any) {
            notify(error.message, 'error');
            // If failed with a default printer, maybe retry manual selection
            if (specificInvoice) {
                 setInvoiceToPrint(specificInvoice);
                 setPrinterModalOpen(true);
                 setIsSearchingPrinters(true);
                 const devices = await PrinterService.listBluetoothDevices();
                 setPrinters(devices);
                 setIsSearchingPrinters(false);
            }
        } finally {
            setIsPrinting(false);
        }
  };

  const handleResetPrinter = () => {
      // Clear default printer in global settings
      setPrinterSettings({ ...printerSettings, defaultPrinterAddress: undefined });
      notify('تم إلغاء حفظ الطابعة الافتراضية. يمكنك تعيينها مجدداً من الإعدادات أو عند الطباعة القادمة.', 'info');
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      
      {/* CATALOG (Main content) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="p-3 bg-white dark:bg-gray-800 shadow-sm z-10 flex gap-2 items-center no-print">
              <button onClick={() => navigate(Screen.Home)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <ArrowRight />
              </button>
              <div className="flex-grow relative">
                <Input 
                    placeholder="بحث (اسم / باركود)..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full"
                    autoFocus
                />
              </div>
              {isCapacitor && (
                  <div className="flex gap-1">
                    <Button variant="secondary" onClick={handleCameraScan} className="!p-2">
                            <Camera className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" onClick={() => navigate(Screen.Settings)} className="!p-2 text-xs" title="إعدادات الطابعة">
                        <Printer className="w-5 h-5" />
                    </Button>
                  </div>
              )}
          </div>

          <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-2 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2 no-print">
              <button 
                  onClick={() => setSelectedCategoryId('all')}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${selectedCategoryId === 'all' ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
              >
                  الكل
              </button>
              {categories.map(cat => (
                  <button 
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${selectedCategoryId === cat.id ? 'bg-primary text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'}`}
                  >
                      {cat.name}
                  </button>
              ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredProducts.map(p => (
                      <div 
                          key={p.id} 
                          onClick={() => { if(p.stock > 0) addItem(p); else notify('نفد المخزون', 'error'); }}
                          className={`p-3 rounded-xl border shadow-sm cursor-pointer transition-all active:scale-95 flex flex-col justify-between min-h-[100px] bg-white dark:bg-gray-800 dark:border-gray-700 hover:border-primary ${p.stock <= 0 ? 'opacity-60 grayscale' : ''}`}
                      >
                          <h3 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-2 leading-tight">{p.name}</h3>
                          <div className="mt-2 flex justify-between items-end">
                              <span className="font-bold text-primary text-sm">{formatCurrency(p.sellingPrice.amount, p.sellingPrice.currency)}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {p.stock}
                              </span>
                          </div>
                      </div>
                  ))}
                  {filteredProducts.length === 0 && (
                      <div className="col-span-full text-center py-10 text-gray-400">
                          لا توجد منتجات مطابقة
                      </div>
                  )}
              </div>
          </div>
      </div>

      {/* DESKTOP CART SIDEBAR */}
      <div className="hidden lg:flex w-[380px] max-w-[450px] bg-white dark:bg-gray-800 shadow-2xl z-20 flex-col border-r dark:border-gray-700">
          <CartContents onCheckout={() => setIsCheckoutOpen(true)} />
      </div>
      
      {/* MOBILE CART FAB */}
      <div className="lg:hidden fixed bottom-4 right-4 z-30 animate-slide-in-up no-print">
        <Button onClick={() => setIsCartModalOpen(true)} className="rounded-full !p-4 shadow-lg flex items-center gap-2" size="lg">
            <ShoppingCart className="w-6 h-6" />
            <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-sm">{items.length}</span>
            {items.length > 0 && (
                 <>
                    <div className="w-px h-6 bg-white/30 mx-1"></div>
                    <span className="font-bold text-base">{formatCurrency(cartTotalInSyp, Currency.SYP)}</span>
                </>
            )}
        </Button>
      </div>

      {/* MOBILE CART MODAL */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-transform duration-300 ${isCartModalOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="absolute inset-0 bg-black/30" onClick={() => setIsCartModalOpen(false)}></div>
        <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-gray-100 dark:bg-dark-background flex flex-col shadow-2xl">
           <CartContents onCheckout={() => setIsCheckoutOpen(true) } />
        </div>
      </div>


      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
          <CheckoutModal 
            isOpen={isCheckoutOpen}
            onClose={() => setIsCheckoutOpen(false)}
            onConfirm={handleProcessSale}
            totalAmount={cartTotalInSyp}
            customers={customers}
            cashRegisters={cashRegisters}
            formatCurrency={formatCurrency}
          />
      )}

      {/* PRINTER MODAL (For Capacitor Immediate Print) */}
      <PrinterModal 
        isOpen={isPrinterModalOpen}
        onClose={() => { setPrinterModalOpen(false); setInvoiceToPrint(null); }}
        printers={printers}
        isLoading={isSearchingPrinters || isPrinting}
        onSelectPrinter={(addr) => handleSelectPrinter(addr)}
      />

    </div>
  );
};

// --- Checkout Modal Component ---
interface CheckoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: any) => void;
    totalAmount: number;
    customers: Customer[];
    cashRegisters: CashRegister[];
    formatCurrency: any;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, onConfirm, totalAmount, customers, cashRegisters, formatCurrency }) => {
    const [customerId, setCustomerId] = useState<string>('');
    const [paymentType, setPaymentType] = useState<PaymentType>(PaymentType.Cash);
    const [cashRegisterId, setCashRegisterId] = useState<string>('');
    
    // Partial Payment State
    const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
    const [partialPaymentCurrency, setPartialPaymentCurrency] = useState<Currency>(Currency.SYP);

    const notify = useNotificationStore(s => s.notify);

    useEffect(() => {
        // Defaults
        const cashCust = customers.find(c => c.id === 'c-cash');
        if (cashCust) setCustomerId(cashCust.id);
        else if (customers.length > 0) setCustomerId(customers[0].id);

        if (cashRegisters.length > 0) setCashRegisterId(cashRegisters[0].id);
        
        setPartialPaymentAmount('');
    }, [customers, cashRegisters, isOpen]);

    const handleSubmit = (shouldPrint: boolean) => {
        // Validation
        if (paymentType === PaymentType.Credit && customerId === 'c-cash') {
            notify('لا يمكن إجراء بيع آجل لعميل نقدي عام. اختر عميلاً مسجلاً.', 'error');
            return;
        }
        
        const hasPartialPayment = paymentType === PaymentType.Credit && parseFloat(partialPaymentAmount) > 0;
        if ((paymentType === PaymentType.Cash || hasPartialPayment) && !cashRegisterId) {
            notify('يرجى اختيار الصندوق لاستلام المبلغ.', 'error');
            return;
        }

        onConfirm({
            customerId,
            paymentType,
            cashRegisterId: (paymentType === PaymentType.Cash || hasPartialPayment) ? cashRegisterId : undefined,
            partialPaymentAmount: parseFloat(partialPaymentAmount) || 0,
            partialPaymentCurrency,
            shouldPrint
        });
    }

    const selectedCustomer = customers.find(c => c.id === customerId);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إتمام عملية البيع">
            <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-xl text-center mb-4 border border-primary/20">
                    <p className="text-sm text-gray-500">المبلغ الإجمالي</p>
                    <p className="text-3xl font-bold text-primary">{formatCurrency(totalAmount, Currency.SYP)}</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <Select label="العميل" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        {selectedCustomer && selectedCustomer.id !== 'c-cash' && (
                            <div className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded flex flex-wrap gap-2">
                                <span className="font-bold text-gray-500">الرصيد الحالي:</span>
                                {Object.entries(selectedCustomer.balances).map(([curr, val]: any) => (
                                    val !== 0 && (
                                        <span key={curr} className={`font-bold ${val > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {formatCurrency(val, curr)}
                                        </span>
                                    )
                                ))}
                                {Object.values(selectedCustomer.balances).every((v: any) => v === 0) && <span>0</span>}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">طريقة الدفع</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setPaymentType(PaymentType.Cash)}
                                className={`p-3 rounded-lg border-2 font-bold transition-all ${paymentType === PaymentType.Cash ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                💵 نقدي (كامل)
                            </button>
                            <button 
                                onClick={() => setPaymentType(PaymentType.Credit)}
                                className={`p-3 rounded-lg border-2 font-bold transition-all ${paymentType === PaymentType.Credit ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                            >
                                📝 آجل (ذمم)
                            </button>
                        </div>
                    </div>

                    {paymentType === PaymentType.Credit && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
                            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-2">دفعة أولى / عربون (اختياري)</p>
                            <div className="flex gap-2">
                                <Input 
                                    type="number" 
                                    step="any" 
                                    placeholder="المبلغ المدفوع" 
                                    value={partialPaymentAmount} 
                                    onChange={e => setPartialPaymentAmount(e.target.value)} 
                                />
                                <Select value={partialPaymentCurrency} onChange={e => setPartialPaymentCurrency(e.target.value as Currency)} className="w-24">
                                    {Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}
                                </Select>
                            </div>
                        </div>
                    )}

                    {(paymentType === PaymentType.Cash || (paymentType === PaymentType.Credit && parseFloat(partialPaymentAmount) > 0)) && (
                        <Select label="الصندوق المستلم" value={cashRegisterId} onChange={e => setCashRegisterId(e.target.value)}>
                            {cashRegisters.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>
                    )}
                    
                    <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-center">
                        <p className="text-xs text-gray-500">التاريخ: {new Date().toLocaleDateString('ar-SY')}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t dark:border-gray-700">
                    <Button onClick={() => handleSubmit(true)} size="lg" className="w-full flex items-center justify-center gap-2" leftIcon={<Printer className="w-5 h-5"/>}>
                        حفظ وطباعة
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={() => handleSubmit(false)} variant="secondary" className="flex-1" leftIcon={<FileText className="w-4 h-4"/>}>
                            حفظ فقط
                        </Button>
                        <Button onClick={onClose} variant="danger" className="flex-1">
                            إلغاء
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}

// Printer Modal (Copied/Reused for consistency)
interface PrinterModalProps {
    isOpen: boolean;
    onClose: () => void;
    printers: {name: string, address: string}[];
    isLoading: boolean;
    onSelectPrinter: (address: string) => void;
}

const PrinterModal: React.FC<PrinterModalProps> = ({ isOpen, onClose, printers, isLoading, onSelectPrinter }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="اختر طابعة">
            {isLoading && <p className="text-center">جار البحث عن الأجهزة...</p>}
            {!isLoading && printers.length === 0 && <p className="text-center text-red-500">لم يتم العثور على طابعات بلوتوث.</p>}
            {!isLoading && printers.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {printers.map(p => (
                        <button
                            key={p.address}
                            onClick={() => onSelectPrinter(p.address)}
                            className="w-full text-right p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border dark:border-gray-600"
                        >
                            <p className="font-bold">{p.name}</p>
                            <p className="text-sm text-gray-500">{p.address}</p>
                        </button>
                    ))}
                </div>
            )}
            <div className="mt-4 pt-2 border-t dark:border-gray-700">
                <Button onClick={onClose} variant="secondary" className="w-full">إلغاء</Button>
            </div>
        </Modal>
    );
}

export default PosScreen;
