import React, { useState, useEffect, useRef } from 'react';
import { Screen, Product, Currency, Category, Invoice, InvoiceType } from '../types';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { useCurrency } from '../hooks/useCurrency';
import { useUsbScanner } from '../hooks/useUsbScanner';
import { BarcodeService } from '../services/barcodeService';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { ArrowRight, Camera, Download, Upload, FileText } from '../components/icons';
import { CURRENCY_INFO } from '../constants';
import { NavigateFunction } from '../App';
import Card from '../components/common/Card';
import useNotificationStore from '../store/useNotificationStore';
import { exportDataToJson, importDataFromJson } from '../services/dataService';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';

const InventoryScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isImportExportModalOpen, setImportExportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [queriedProduct, setQueriedProduct] = useState<Product | null>(null);
  
  // History Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  // New: Smart Invoice Details State inside History
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState<Invoice | null>(null);
  const [selectedHistoryPartyName, setSelectedHistoryPartyName] = useState('');

  const { formatCurrency, convertToSyp, convertFromSyp } = useCurrency();
  const notify = useNotificationStore((state) => state.notify);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputRef = useRef<HTMLInputElement>(null);

  useUsbScanner((code) => { setSearchTerm(code); notify(`تم المسح الضوئي: ${code}`, 'info'); });
  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (searchTerm.trim() === '') { setQueriedProduct(null); return; }
    const lowercasedTerm = searchTerm.toLowerCase();
    const foundProduct = products.find(p => p.name.toLowerCase().includes(lowercasedTerm) || (p.sku && p.sku.toLowerCase().includes(lowercasedTerm)));
    setQueriedProduct(foundProduct || null);
  }, [searchTerm, products]);

  const loadData = async () => {
    setProducts(await InventoryRepository.getProducts());
    setCategories(await InventoryRepository.getCategories());
  };

  const handleOpenProductModal = (product: Product | null = null) => { setEditingProduct(product); setIsProductModalOpen(true); };
  const handleCloseProductModal = () => { setIsProductModalOpen(false); setEditingProduct(null); };
  
  const handleSaveProduct = async (productData: Omit<Product, 'id'>) => {
      try {
        if (editingProduct) {
            await InventoryRepository.updateProduct({ ...editingProduct, ...productData });
            notify('تم تحديث المنتج بنجاح!', 'success');
        } else {
            await InventoryRepository.addProduct({ id: `p-${Date.now()}`, ...productData });
            notify('تمت إضافة المنتج بنجاح!', 'success');
        }
        await loadData();
        handleCloseProductModal();
    } catch (error: any) { notify(`فشل حفظ المنتج: ${error.message}`, 'error'); }
  };

  const handleDeleteProduct = async (id: string) => {
      if (window.confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
          await InventoryRepository.deleteProduct(id);
          await loadData();
          notify('تم حذف المنتج بنجاح', 'success');
      }
  }

  const handleSaveCategory = async (categoryData: Omit<Category, 'id'>) => {
      try {
        await InventoryRepository.addCategory({ id: `cat-${Date.now()}`, ...categoryData });
        await loadData();
        setIsCategoryModalOpen(false);
        notify('تمت إضافة الفئة بنجاح!', 'success');
    } catch (error: any) { notify(`فشل حفظ الفئة: ${error.message}`, 'error'); }
  };
  
  const handlePriceUpdate = async (data: { categoryId: string, amount: number, currency: Currency }) => {
    try {
        const { categoryId, amount, currency } = data;
        const allProducts = await InventoryRepository.getProducts();
        const amountInSyp = convertToSyp({ amount, currency });
        const productsToUpdate = categoryId === 'all' ? allProducts : allProducts.filter(p => p.categoryId === categoryId);
        const updatedProducts = allProducts.map(p => {
            const productToUpdate = productsToUpdate.find(ptu => ptu.id === p.id);
            if (productToUpdate) {
                const newProduct = { ...p };
                const priceObject = newProduct.sellingPrice;
                const originalPriceInSyp = convertToSyp(priceObject);
                const newPriceInSyp = originalPriceInSyp + amountInSyp;
                const newAmountInOriginalCurrency = convertFromSyp(newPriceInSyp, priceObject.currency);
                newProduct.sellingPrice = { ...priceObject, amount: Math.round(newAmountInOriginalCurrency * 100) / 100 };
                return newProduct;
            }
            return p;
        });
        await InventoryRepository.setProducts(updatedProducts);
        await loadData();
        setIsPriceModalOpen(false);
        notify('تم تحديث الأسعار بنجاح!', 'success');
    } catch (error: any) { notify(`فشل تحديث الأسعار: ${error.message}`, 'error'); }
  };
  
  const handleBarcodeScan = async () => {
    try {
        const { content, cancelled } = await BarcodeService.scanCamera();
        if (cancelled) return;
        if (content) { setSearchTerm(content); notify(`تم المسح: ${content}`, 'success'); }
    } catch (error: any) { notify(error.message, 'error'); }
  };

  const openProductHistory = (product: Product) => {
      setHistoryProduct(product);
      setIsHistoryModalOpen(true);
  };

  const handleInvoiceClick = async (invoiceId: string) => {
      try {
          const invoices = await SalesRepository.getInvoices();
          const invoice = invoices.find(inv => inv.id === invoiceId);
          if (!invoice) return;

          let partyName = 'غير معروف';
          if (invoice.customerId) {
              const customers = await LedgerRepository.getCustomers();
              partyName = customers.find(c => c.id === invoice.customerId)?.name || 'عميل نقدي';
          } else if (invoice.supplierId) {
              const suppliers = await LedgerRepository.getSuppliers();
              partyName = suppliers.find(s => s.id === invoice.supplierId)?.name || 'مورد غير محدد';
          }

          setSelectedHistoryInvoice(invoice);
          setSelectedHistoryPartyName(partyName);
          setIsInvoiceDetailsOpen(true);
      } catch (e) {
          notify('حدث خطأ أثناء تحميل الفاتورة', 'error');
      }
  };

  const handleExport = async (type: 'products' | 'categories') => {
    if (type === 'products') {
      const data = await InventoryRepository.getProducts();
      exportDataToJson(data, 'products');
    } else {
      const data = await InventoryRepository.getCategories();
      exportDataToJson(data, 'categories');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'products' | 'categories') => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await importDataFromJson(file, type);
      let result;
      if (type === 'products') { result = await InventoryRepository.importProducts(data as Product[]); } else { result = await InventoryRepository.importCategories(data as Category[]); }
      notify(`تم استيراد ${result.imported} عنصر جديد وتخطي ${result.skipped} عنصر مكرر.`, 'success');
      setImportExportModalOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) { notify(error.message, 'error'); } finally { if(event.target) event.target.value = ''; }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center">
            <button onClick={() => navigate(Screen.Home)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <ArrowRight />
            </button>
            <h1 className="text-3xl font-bold mx-4">إدارة المخزون</h1>
          </div>
        <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setImportExportModalOpen(true)}>استيراد/تصدير</Button>
            <Button onClick={() => setIsPriceModalOpen(true)}>تعديل سعر منتجات</Button>
            <Button variant="secondary" onClick={() => setIsCategoryModalOpen(true)}>إضافة فئة</Button>
            <Button onClick={() => handleOpenProductModal()}>إضافة منتج جديد</Button>
        </div>
      </header>

      <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">استعلام عن منتج</h2>
          <div className="relative flex gap-2">
            <Input type="text" placeholder="ابحث بالاسم أو امسح الباركود..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-grow" />
            <Button variant="ghost" onClick={handleBarcodeScan} className="!p-2" aria-label="Scan barcode"> <Camera className="h-6 w-6" /> </Button>
          </div>
      </div>
      
      {queriedProduct && (
        <Card className="mb-6 p-4 animate-fade-in border-2 border-primary/30">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <p className="text-sm text-gray-500">اسم المنتج</p>
                    <p className="font-bold text-lg text-primary cursor-pointer hover:underline" onClick={() => openProductHistory(queriedProduct)}>
                        {queriedProduct.name} 🔗
                    </p>
                </div>
                <div> <p className="text-sm text-gray-500">الباركود (SKU)</p> <p className="font-semibold">{queriedProduct.sku}</p> </div>
                <div> <p className="text-sm text-gray-500">الفئة</p> <p className="font-semibold">{categories.find(c => c.id === queriedProduct.categoryId)?.name || 'غير مصنف'}</p> </div>
                <div> <p className="text-sm text-gray-500">الكمية المتاحة</p> <p className="font-bold text-lg">{queriedProduct.stock}</p> </div>
                <div> <p className="text-sm text-gray-500">سعر التكلفة</p> <p className="font-semibold">{formatCurrency(queriedProduct.costPrice.amount, queriedProduct.costPrice.currency)}</p> </div>
                <div> <p className="text-sm text-gray-500">سعر الجملة</p> <p className="font-semibold">{formatCurrency(queriedProduct.wholesalePrice.amount, queriedProduct.wholesalePrice.currency)}</p> </div>
                <div> <p className="text-sm text-gray-500">سعر البيع</p> <p className="font-semibold">{formatCurrency(queriedProduct.sellingPrice.amount, queriedProduct.sellingPrice.currency)}</p> </div>
                <div className="flex items-center justify-end gap-2">
                     <Button size="sm" variant="secondary" onClick={() => openProductHistory(queriedProduct)} leftIcon={<FileText className="w-4 h-4"/>}> حركة </Button>
                     <Button size="sm" onClick={() => handleOpenProductModal(queriedProduct)}> تعديل </Button>
                </div>
            </div>
        </Card>
      )}

      <h2 className="text-xl font-semibold mb-2 mt-4">جميع المنتجات</h2>
      <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">اسم المنتج</th>
              <th scope="col" className="px-6 py-3">الفئة</th>
              <th scope="col" className="px-6 py-3">الكمية</th>
              <th scope="col" className="px-6 py-3">سعر البيع</th>
              <th scope="col" className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const categoryName = categories.find(c => c.id === p.categoryId)?.name || 'غير مصنف';
              return (
              <tr key={p.id} className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white cursor-pointer hover:text-primary transition-colors" onClick={() => openProductHistory(p)} title="اضغط لعرض الحركة">
                    {p.name}
                </td>
                <td className="px-6 py-4">{categoryName}</td>
                <td className={`px-6 py-4 font-bold ${p.stock <= 0 ? 'text-red-500' : 'text-green-500'}`}>{p.stock}</td>
                <td className="px-6 py-4">{formatCurrency(p.sellingPrice.amount, p.sellingPrice.currency)}</td>
                <td className="px-6 py-4 flex space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenProductModal(p)}>تعديل</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteProduct(p.id)}>حذف</Button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      
      <ProductFormModal isOpen={isProductModalOpen} onClose={handleCloseProductModal} onSave={handleSaveProduct} product={editingProduct} categories={categories} />
      <AddCategoryModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} onSave={handleSaveCategory} categories={categories} />
      <ModifyPricesModal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} onSave={handlePriceUpdate} categories={categories} />
      
      {isHistoryModalOpen && historyProduct && (
          <ProductHistoryModal 
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            product={historyProduct}
            onInvoiceClick={handleInvoiceClick}
          />
      )}

      {isInvoiceDetailsOpen && selectedHistoryInvoice && (
          <InvoiceDetailsModal 
            isOpen={isInvoiceDetailsOpen}
            onClose={() => setIsInvoiceDetailsOpen(false)}
            invoice={selectedHistoryInvoice}
            partyName={selectedHistoryPartyName}
          />
      )}

      <Modal isOpen={isImportExportModalOpen} onClose={() => setImportExportModalOpen(false)} title="استيراد / تصدير بيانات المخزون">
          <div className="space-y-4">
            <ImportExportSection label="المنتجات" onExport={() => handleExport('products')} onImport={() => productFileInputRef.current?.click()} />
             <ImportExportSection label="الفئات" onExport={() => handleExport('categories')} onImport={() => categoryFileInputRef.current?.click()} />
            <input type="file" ref={productFileInputRef} onChange={(e) => handleFileChange(e, 'products')} accept=".json" className="hidden" />
            <input type="file" ref={categoryFileInputRef} onChange={(e) => handleFileChange(e, 'categories')} accept=".json" className="hidden" />
          </div>
      </Modal>
    </div>
  );
};

const ProductHistoryModal: React.FC<{isOpen: boolean, onClose: () => void, product: Product, onInvoiceClick: (id: string) => void}> = ({isOpen, onClose, product, onInvoiceClick}) => {
    const [movements, setMovements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            const allInvoices = await SalesRepository.getInvoices();
            const relevantInvoices = allInvoices.filter(inv => inv.items.some(item => item.productId === product.id));
            const history = relevantInvoices.map(inv => {
                const item = inv.items.find(i => i.productId === product.id);
                const isPurchase = inv.type === InvoiceType.Purchase;
                return {
                    date: inv.date,
                    type: isPurchase ? 'شراء' : 'بيع',
                    invoiceId: inv.id,
                    qty: item ? item.quantity : 0,
                    direction: isPurchase ? 'in' : 'out',
                    price: item?.unitPrice
                };
            }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setMovements(history);
            setLoading(false);
        };
        if(isOpen) fetchHistory();
    }, [isOpen, product]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`حركة المنتج: ${product.name}`}>
            <div className="max-h-[60vh] overflow-y-auto">
                {loading ? <p className="text-center">جار التحميل...</p> : (
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                            <tr>
                                <th className="p-2">التاريخ</th>
                                <th className="p-2">نوع الحركة</th>
                                <th className="p-2">الكمية</th>
                                <th className="p-2">الفاتورة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {movements.length === 0 && <tr><td colSpan={4} className="text-center p-4">لا توجد حركات مسجلة.</td></tr>}
                            {movements.map((m, idx) => (
                                <tr key={idx} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="p-2">{new Date(m.date).toLocaleDateString('ar-SY')}</td>
                                    <td className="p-2"><span className={`px-2 py-1 rounded text-xs text-white ${m.direction === 'in' ? 'bg-green-500' : 'bg-red-500'}`}>{m.type}</span></td>
                                    <td className="p-2 font-bold">{m.qty}</td>
                                    <td className="p-2 text-xs">
                                        <button 
                                            onClick={() => onInvoiceClick(m.invoiceId)}
                                            className="text-primary hover:underline font-mono font-bold"
                                            title="عرض تفاصيل الفاتورة"
                                        >
                                            {m.invoiceId}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            <div className="mt-4 flex justify-end"><Button onClick={onClose}>إغلاق</Button></div>
        </Modal>
    );
};

interface ImportExportSectionProps { label: string; onExport: () => void; onImport: () => void; }
const ImportExportSection: React.FC<ImportExportSectionProps> = ({ label, onExport, onImport }) => {
    const isElectron = window.electronAPI?.isElectron;
    return (
        <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 flex justify-between items-center">
            <span className="font-semibold">{label}</span>
            <div className="flex gap-2">
                <Button onClick={onImport} variant="secondary" size="sm" leftIcon={<Upload className="w-4 h-4" />}>استيراد</Button>
                {isElectron && <Button onClick={onExport} variant="secondary" size="sm" leftIcon={<Download className="w-4 h-4" />}>تصدير</Button>}
            </div>
        </div>
    );
};

interface ProductFormModalProps { isOpen: boolean; onClose: () => void; onSave: (product: Omit<Product, 'id'>) => void; product: Product | null; categories: Category[]; }
const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, onSave, product, categories }) => {
    const [name, setName] = useState(''); const [sku, setSku] = useState(''); const [stock, setStock] = useState(''); const [categoryId, setCategoryId] = useState('');
    const [costPriceAmount, setCostPriceAmount] = useState(''); const [costPriceCurrency, setCostPriceCurrency] = useState<Currency>(Currency.SYP);
    const [wholesalePriceAmount, setWholesalePriceAmount] = useState(''); const [wholesalePriceCurrency, setWholesalePriceCurrency] = useState<Currency>(Currency.SYP);
    const [sellingPriceAmount, setSellingPriceAmount] = useState(''); const [sellingPriceCurrency, setSellingPriceCurrency] = useState<Currency>(Currency.SYP);
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => { if(product) { setName(product.name); setSku(product.sku); setStock(product.stock.toString()); setCategoryId(product.categoryId || ''); setCostPriceAmount(product.costPrice.amount.toString()); setCostPriceCurrency(product.costPrice.currency); setWholesalePriceAmount(product.wholesalePrice.amount.toString()); setWholesalePriceCurrency(product.wholesalePrice.currency); setSellingPriceAmount(product.sellingPrice.amount.toString()); setSellingPriceCurrency(product.sellingPrice.currency); } else { setName(''); setSku(''); setStock(''); setCategoryId(''); setCostPriceAmount(''); setCostPriceCurrency(Currency.SYP); setWholesalePriceAmount(''); setWholesalePriceCurrency(Currency.SYP); setSellingPriceAmount(''); setSellingPriceCurrency(Currency.SYP); } }, [product, isOpen]);

    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ name, sku, stock: parseFloat(stock) || 0, categoryId, costPrice: { amount: parseFloat(costPriceAmount) || 0, currency: costPriceCurrency }, wholesalePrice: { amount: parseFloat(wholesalePriceAmount) || 0, currency: wholesalePriceCurrency }, sellingPrice: { amount: parseFloat(sellingPriceAmount) || 0, currency: sellingPriceCurrency } }); };
    const handleBarcodeScan = async () => { try { const { content, cancelled } = await BarcodeService.scanCamera(); if (cancelled) return; if (content) { setSku(content); notify(`تم المسح: ${content}`, 'success'); } } catch (error: any) { notify(error.message, 'error'); } };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={product ? 'تعديل منتج' : 'إضافة منتج جديد'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم المنتج" value={name} onChange={e => setName(e.target.value)} required />
                <Select label="الفئة" value={categoryId} onChange={e => setCategoryId(e.target.value)}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="">-- غير مصنف --</option></Select>
                <div className="flex gap-2 items-end"><Input label="SKU / الباركود" value={sku} onChange={e => setSku(e.target.value)} /><Button type="button" variant="ghost" onClick={handleBarcodeScan} className="!p-2"><Camera className="h-6 w-6" /></Button></div>
                <Input label="الكمية في المخزون" type="number" step="any" value={stock} onChange={e => setStock(e.target.value)} required />
                <div className="flex gap-2"><Input label="سعر التكلفة" type="number" step="any" value={costPriceAmount} onChange={e => setCostPriceAmount(e.target.value)} required /><Select label="العملة" value={costPriceCurrency} onChange={e => setCostPriceCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select></div>
                <div className="flex gap-2"><Input label="سعر الجملة" type="number" step="any" value={wholesalePriceAmount} onChange={e => setWholesalePriceAmount(e.target.value)} required /><Select label="العملة" value={wholesalePriceCurrency} onChange={e => setWholesalePriceCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select></div>
                <div className="flex gap-2"><Input label="سعر البيع" type="number" step="any" value={sellingPriceAmount} onChange={e => setSellingPriceAmount(e.target.value)} required /><Select label="العملة" value={sellingPriceCurrency} onChange={e => setSellingPriceCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select></div>
                <div className="pt-4 flex justify-end space-x-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ</Button></div>
            </form>
        </Modal>
    );
};

interface AddCategoryModalProps { isOpen: boolean; onClose: () => void; onSave: (category: Omit<Category, 'id'>) => void; categories: Category[]; }
const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onSave, categories }) => {
    const [name, setName] = useState(''); const [parentId, setParentId] = useState('');
    useEffect(() => { if (!isOpen) { setName(''); setParentId(''); } }, [isOpen]);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave({ name, parentId: parentId || undefined }); }
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة فئة جديدة">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="اسم الفئة" value={name} onChange={e => setName(e.target.value)} required />
                <Select label="الفئة الرئيسية (اختياري)" value={parentId} onChange={e => setParentId(e.target.value)}><option value="">-- بدون فئة رئيسية --</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                <div className="pt-4 flex justify-end space-x-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">حفظ الفئة</Button></div>
            </form>
        </Modal>
    )
}

interface ModifyPricesModalProps { isOpen: boolean; onClose: () => void; onSave: (data: { categoryId: string, amount: number, currency: Currency }) => void; categories: Category[]; }
const ModifyPricesModal: React.FC<ModifyPricesModalProps> = ({ isOpen, onClose, onSave, categories }) => {
    const [categoryId, setCategoryId] = useState('all'); const [amount, setAmount] = useState(''); const [currency, setCurrency] = useState<Currency>(Currency.SYP);
    const notify = useNotificationStore((state) => state.notify);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const numericAmount = parseFloat(amount); if (!isNaN(numericAmount)) { onSave({ categoryId, amount: numericAmount, currency }); } else { notify('الرجاء إدخال مبلغ صحيح.', 'error'); } };
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="تعديل أسعار البيع للمنتجات">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-500">سيتم إضافة المبلغ المدخل إلى سعر البيع الحالي للمنتجات المحددة. يمكن استخدام قيمة سالبة للتخفيض.</p>
                <Select label="تطبيق على فئة" value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="all">كل المنتجات</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                <div className="flex gap-2"><Input label="مبلغ الزيادة" type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500 or -1.5" required /><Select label="العملة" value={currency} onChange={e => setCurrency(e.target.value as Currency)}>{Object.values(Currency).map(c => <option key={c} value={c}>{CURRENCY_INFO[c].symbol}</option>)}</Select></div>
                <div className="pt-4 flex justify-end space-x-2"><Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button><Button type="submit">تطبيق التعديل</Button></div>
            </form>
        </Modal>
    )
}

export default InventoryScreen;