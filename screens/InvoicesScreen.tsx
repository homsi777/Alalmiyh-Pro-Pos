
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, Invoice, Customer, InvoiceType, Supplier, PaperSize } from '../types';
import { SalesRepository } from '../services/repositories/SalesRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { useCurrency } from '../hooks/useCurrency';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import { ArrowRight, Printer, Upload, Download, FileText } from '../components/icons';
import useGlobalStore from '../store/useGlobalStore';
import { NavigateFunction } from '../App';
import { PrinterService } from '../services/printerService';
import useNotificationStore from '../store/useNotificationStore';
import { exportDataToJson, importDataFromJson } from '../services/dataService';
import InvoiceDetailsModal from '../components/InvoiceDetailsModal';
import { isCapacitor, isElectron } from '../services/platform';

const InvoicesScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { printerSettings } = useGlobalStore();
  const { formatCurrency } = useCurrency();
  const notify = useNotificationStore((state) => state.notify);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const [isPrinterModalOpen, setPrinterModalOpen] = useState(false);
  const [printers, setPrinters] = useState<{name: string, address: string}[]>([]);
  const [isSearchingPrinters, setIsSearchingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
      const fetchedInvoices = await SalesRepository.getInvoices();
      setInvoices(fetchedInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setCustomers(await LedgerRepository.getCustomers());
      setSuppliers(await LedgerRepository.getSuppliers());
    };

  const getPartyName = (invoice: Invoice) => {
    if (invoice.customerId) {
        return customers.find(c => c.id === invoice.customerId)?.name || 'Unknown Customer';
    }
    if (invoice.supplierId) {
        return suppliers.find(s => s.id === invoice.supplierId)?.name || 'Unknown Supplier';
    }
    return 'N/A';
  };

  const filteredInvoices = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return invoices;
    return invoices.filter(inv => {
        const partyName = getPartyName(inv).toLowerCase();
        return inv.id.toLowerCase().includes(lowercasedTerm) || 
               partyName.includes(lowercasedTerm) ||
               (inv.vendorInvoiceNumber && inv.vendorInvoiceNumber.toLowerCase().includes(lowercasedTerm));
    });
  }, [searchTerm, invoices, customers, suppliers]);

  const getRowClass = (type: InvoiceType) => {
    switch (type) {
        case InvoiceType.POS: return 'bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60';
        case InvoiceType.Sale: return 'bg-green-50 dark:bg-green-900/40 hover:bg-green-100 dark:hover:bg-green-900/60';
        case InvoiceType.Purchase: return 'bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60';
        default: return 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-600';
    }
  }
  
  const handleEdit = (invoice: Invoice) => {
    navigate(Screen.InvoiceForm, { type: invoice.type === 'purchase' ? 'purchase' : 'sale', invoiceId: invoice.id });
  };

  const handleOpenDetails = (invoice: Invoice) => {
      setSelectedInvoice(invoice);
      setIsDetailsModalOpen(true);
  }

  const handlePrintClick = async (invoice: Invoice) => {
      setInvoiceToPrint(invoice);
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
      if (!invoiceToPrint) return;
      setIsPrinting(true);
      try {
          if (isElectron) {
              await PrinterService.printDocument({ type: 'invoice', data: invoiceToPrint }, address);
          } else if (isCapacitor) {
              // Pass printerSettings.paperSize as the third argument
              await PrinterService.printInvoiceThermalCapacitor(invoiceToPrint, address, printerSettings.paperSize);
          }
          notify("تم إرسال أمر الطباعة!", "success");
      } catch (error: any) {
          notify(error.message, 'error');
      } finally {
          setIsPrinting(false);
          setPrinterModalOpen(false);
          setInvoiceToPrint(null);
      }
  }

  const handleSavePdf = async (invoice: Invoice) => {
      if (!isElectron) {
          notify("حفظ PDF مدعوم فقط في وضع سطح المكتب.", 'error');
          return;
      }
      try {
          const filename = `invoice_${invoice.id}.pdf`;
          const result = await PrinterService.saveToPdf({ type: 'invoice', data: invoice }, filename);
          if (result.success) {
              notify("تم حفظ ملف PDF بنجاح.", 'success');
          } else if (result.error !== 'تم إلغاء الحفظ') {
              notify(`فشل الحفظ: ${result.error}`, 'error');
          }
      } catch (e: any) {
          notify(e.message, 'error');
      }
  };

  const handleExport = async () => {
    const data = await SalesRepository.getInvoices();
    exportDataToJson(data, 'invoices');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = await importDataFromJson(file, 'invoices');
      const result = await SalesRepository.importInvoices(data as Invoice[]);
      notify(`تم استيراد ${result.imported} فاتورة جديدة وتخطي ${result.skipped} فاتورة مكررة.`, 'success');
      setTimeout(() => window.location.reload(), 1500);
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
            <h1 className="text-3xl font-bold mx-4">الفواتير</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isElectron && (
              <Button onClick={handleExport} variant="ghost" size="sm" leftIcon={<Download className="w-4 h-4"/>}>تصدير الفواتير</Button>
            )}
            <Button onClick={() => fileInputRef.current?.click()} variant="ghost" size="sm" leftIcon={<Upload className="w-4 h-4"/>}>استيراد الفواتير</Button>
            <div className="border-l h-8 mx-2 dark:border-gray-600"></div>
            <Button onClick={() => navigate(Screen.InvoiceForm, { type: 'sale' })}>إنشاء فاتورة بيع</Button>
            <Button variant="secondary" onClick={() => navigate(Screen.InvoiceForm, { type: 'purchase' })}>إنشاء فاتورة شراء</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
          </div>
      </header>
      
      <div className="mb-4">
        <Input 
            type="text"
            placeholder="ابحث برقم الفاتورة، رقم المورد، أو اسم العميل..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto bg-white dark:bg-gray-800/50 rounded-lg shadow">
        <table className="w-full text-sm text-right text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">رقم الفاتورة</th>
              <th scope="col" className="px-6 py-3">التاريخ</th>
              <th scope="col" className="px-6 py-3">العميل/المورد</th>
              <th scope="col" className="px-6 py-3">الإجمالي</th>
              <th scope="col" className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => (
              <tr key={inv.id} className={`${getRowClass(inv.type)} border-b dark:border-gray-700`}>
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    <p 
                        className="cursor-pointer hover:underline text-primary font-bold"
                        onClick={() => handleOpenDetails(inv)}
                        title="عرض التفاصيل"
                    >
                        {inv.id}
                    </p>
                    {inv.vendorInvoiceNumber && (
                        <p className="text-xs text-gray-500">مورد: {inv.vendorInvoiceNumber}</p>
                    )}
                </td>
                <td className="px-6 py-4">{new Date(inv.date).toLocaleDateString('ar-SY')}</td>
                <td className="px-6 py-4">{getPartyName(inv)}</td>
                <td className="px-6 py-4">{formatCurrency(inv.totalAmount, inv.currency)}</td>
                <td className="px-6 py-4 flex items-center gap-2 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(inv)}>
                    تعديل
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handlePrintClick(inv)} leftIcon={<Printer className="w-4 h-4" />}>
                    طباعة
                  </Button>
                  {isElectron && <Button variant="ghost" size="sm" onClick={() => handleSavePdf(inv)} leftIcon={<FileText className="w-4 h-4 text-red-500" />} title="حفظ كـ PDF">
                    PDF
                  </Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            partyName={getPartyName(selectedInvoice)}
          />
      )}
    </div>
  );
};

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

export default InvoicesScreen;
