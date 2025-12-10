

import React, { useState, useRef, useEffect } from 'react';
import { Screen, CompanyInfo, PrinterSettings, PaperSize, LicenseInfo } from '../types';
import useGlobalStore from '../store/useGlobalStore';
import useNotificationStore from '../store/useNotificationStore';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import { ArrowRight } from '../components/icons';
import { SettingsRepository } from '../services/repositories/SettingsRepository';
import { NavigateFunction } from '../App';
import { PrinterService } from '../services/printerService';
import { isCapacitor, isElectron } from '../services/platform';

const SettingsScreen: React.FC<{ navigate: NavigateFunction }> = ({ navigate }) => {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <header className="flex items-center mb-6">
        <button onClick={() => navigate(Screen.Home)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
          <ArrowRight />
        </button>
        <h1 className="text-3xl font-bold mx-4">الإعدادات</h1>
      </header>

      <div className="space-y-6 max-w-2xl mx-auto">
        <LicenseSettings />
        <CurrencySettings />
        <InvoiceHeaderSettings />
        <PrinterSettingsComponent />
        <BackupRestoreSettings />
      </div>
    </div>
  );
};

const LicenseSettings = () => {
    const { licenseInfo } = useGlobalStore();
    
    const getLicenseTypeName = (type: string) => {
        switch(type) {
            case 'lite': return 'نسخة لايت (محلية)';
            case 'pro': return 'نسخة برو (محلية متقدمة)';
            case 'full': return 'نسخة كاملة (سحابية)';
            default: return 'غير مفعل';
        }
    }

    return (
        <Card className="p-6 border-2 border-primary/20">
            <h2 className="text-xl font-bold mb-4 text-primary">معلومات الترخيص والتفعيل</h2>
            <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">نوع النسخة:</span>
                    <span className="font-bold text-lg text-primary">{getLicenseTypeName(licenseInfo?.type || 'unlicensed')}</span>
                </div>
                {licenseInfo && (
                    <>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">مفتاح التفعيل:</span>
                            <span className="font-mono text-sm">{licenseInfo.key}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="font-semibold text-gray-700 dark:text-gray-300">تاريخ التفعيل:</span>
                            <span className="text-sm">{new Date(licenseInfo.activationDate).toLocaleDateString('ar-SY')}</span>
                        </div>
                        <div className="mt-4 text-center text-xs text-green-600 font-bold">
                            النسخة مفعلة وتعمل بشكل صحيح ✅
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
};

const CurrencySettings = () => {
  const { exchangeRates, setExchangeRates } = useGlobalStore();
  const [rates, setRates] = useState(exchangeRates);
  const notify = useNotificationStore((state) => state.notify);
  
  const handleSave = () => {
    setExchangeRates(rates);
    notify('تم حفظ أسعار الصرف بنجاح!', 'success');
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">إدارة العملات وأسعار الصرف</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <span className="w-24">1 دولار أمريكي =</span>
          <Input type="number" value={rates.USD} onChange={e => setRates({...rates, USD: parseFloat(e.target.value)})} />
          <span>ل.س</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="w-24">1 ليرة تركية =</span>
          <Input type="number" value={rates.TRY} onChange={e => setRates({...rates, TRY: parseFloat(e.target.value)})} />
          <span>ل.س</span>
        </div>
        <div className="flex justify-end">
            <Button onClick={handleSave}>حفظ التغييرات</Button>
        </div>
      </div>
    </Card>
  );
};

const InvoiceHeaderSettings = () => {
    const { companyInfo, setCompanyInfo } = useGlobalStore();
    const [info, setInfo] = useState<CompanyInfo>(companyInfo);
    const notify = useNotificationStore((state) => state.notify);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInfo({ ...info, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        setCompanyInfo(info);
        notify('تم حفظ معلومات الشركة!', 'success');
    }

    return (
        <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">ترويسة الفاتورة</h2>
            <div className="space-y-4">
                <Input label="اسم الشركة" name="name" value={info.name} onChange={handleChange} />
                <Input label="العنوان" name="address" value={info.address} onChange={handleChange} />
                <Input label="رقم الهاتف" name="phone" value={info.phone} onChange={handleChange} />
                 <div className="flex justify-end">
                    <Button onClick={handleSave}>حفظ المعلومات</Button>
                </div>
            </div>
        </Card>
    )
}

const BackupRestoreSettings = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mergeFileInputRef = useRef<HTMLInputElement>(null);
    const notify = useNotificationStore((state) => state.notify);

    const handleBackup = async () => {
        const data = await SettingsRepository.backup();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        notify('تم إنشاء النسخة الاحتياطية بنجاح.', 'success');
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;
                const result = await SettingsRepository.restore(content);
                notify(result.message, result.success ? 'success' : 'error');
                if (result.success) {
                    // Force a reload to reflect restored state
                    setTimeout(() => window.location.reload(), 2000);
                }
            };
            reader.readAsText(file);
        }
    };
    
    const handleMergeRestoreClick = () => {
        mergeFileInputRef.current?.click();
    };

    const handleMergeFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;
                const result = await SettingsRepository.restoreMerge(content);
                notify(result.message, result.success ? 'info' : 'error');
                 if (result.success) {
                    setTimeout(() => window.location.reload(), 2000);
                }
            };
            reader.readAsText(file);
        }
        if(event.target) event.target.value = '';
    };

    return (
        <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">النسخ الاحتياطي والاستعادة</h2>
            <div className="space-y-2">
                <h3 className="font-semibold">العمليات الأساسية</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    استخدم هذا الخيار لإنشاء نسخة احتياطية كاملة من جميع بياناتك.
                </p>
                <Button onClick={handleBackup}>إنشاء نسخة احتياطية</Button>
            </div>
            <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2">
                 <h3 className="font-semibold text-amber-600 dark:text-amber-400">الاستعادة الكاملة (حذف واستبدال)</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                    <strong className="text-red-600 dark:text-red-400">تحذير:</strong> هذا الخيار سيقوم بحذف جميع البيانات الحالية واستبدالها بالبيانات من الملف الذي تختاره. استخدمه فقط إذا كنت متأكداً.
                </p>
                <Button variant="danger" onClick={handleRestoreClick}>استعادة نسخة كاملة</Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
            </div>
            <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2">
                 <h3 className="font-semibold text-green-600 dark:text-green-400">الاستيراد والدمج</h3>
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                    هذا الخيار الذكي يقوم بدمج البيانات من ملف النسخة الاحتياطية مع بياناتك الحالية. سيتم إضافة الفواتير والمصاريف والعملاء الجدد فقط دون حذف أي شيء. مثالي لمزامنة البيانات بين الأجهزة.
                </p>
                <Button variant="secondary" onClick={handleMergeRestoreClick}>استيراد ودمج بيانات</Button>
                <input type="file" ref={mergeFileInputRef} onChange={handleMergeFileChange} accept=".json" className="hidden" />
            </div>
        </Card>
    );
};

const PrinterSettingsComponent = () => {
    const { printerSettings, setPrinterSettings } = useGlobalStore();
    const [settings, setSettings] = useState<PrinterSettings>(printerSettings);
    const [availablePrinters, setAvailablePrinters] = useState<{name: string, address: string}[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const notify = useNotificationStore((state) => state.notify);

    useEffect(() => {
        loadPrinters();
    }, []);

    const loadPrinters = async () => {
        setIsScanning(true);
        if (isElectron) {
            try {
                const devices = await PrinterService.listDevices();
                setAvailablePrinters(devices);
            } catch (e) {
                console.error("Failed to load printers", e);
            }
        } else if (isCapacitor) {
            try {
                const devices = await PrinterService.listBluetoothDevices();
                setAvailablePrinters(devices);
            } catch (e: any) {
                console.error("Failed to load bluetooth printers", e);
                notify(e.message, 'error');
            }
        }
        setIsScanning(false);
    }

    const handleSave = () => {
        setPrinterSettings(settings);
        notify('تم حفظ إعدادات الطابعة!', 'success');
    }
    
    if (!isElectron && !isCapacitor) {
        return (
            <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">إعدادات الطابعة</h2>
                <p className="text-gray-500 dark:text-gray-400">
                    إعدادات الطابعة متاحة فقط عند تشغيل البرنامج على سطح المكتب أو الهاتف.
                </p>
            </Card>
        )
    }

    return (
        <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">إعدادات الطابعة</h2>
            <div className="space-y-4">
                <Select 
                    label="حجم الورق الافتراضي للطباعة"
                    value={settings.paperSize}
                    onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}
                >
                    <option value={PaperSize.A4}>A4 (طابعة عادية)</option>
                    <option value={PaperSize.MM80}>80mm (طابعة حرارية)</option>
                    <option value={PaperSize.MM58}>58mm (طابعة حرارية)</option>
                </Select>
                
                {isElectron && (
                    <Select
                        label="طابعة الكاشير الافتراضية (للطباعة التلقائية)"
                        value={settings.defaultPrinterName || ''}
                        onChange={(e) => setSettings({ ...settings, defaultPrinterName: e.target.value })}
                    >
                        <option value="">-- اختر طابعة --</option>
                        {availablePrinters.map(p => (
                            <option key={p.address} value={p.name}>{p.name}</option>
                        ))}
                    </Select>
                )}

                {isCapacitor && (
                    <div className="space-y-2">
                        <div className="flex items-end gap-2">
                            <Select
                                label="طابعة البلوتوث الافتراضية (للطباعة التلقائية)"
                                value={settings.defaultPrinterAddress || ''}
                                onChange={(e) => setSettings({ ...settings, defaultPrinterAddress: e.target.value })}
                                className="flex-grow"
                            >
                                <option value="">-- اختر طابعة بلوتوث --</option>
                                {availablePrinters.map(p => (
                                    <option key={p.address} value={p.address}>{p.name} ({p.address})</option>
                                ))}
                            </Select>
                            <Button onClick={loadPrinters} variant="secondary" disabled={isScanning}>
                                {isScanning ? 'جار البحث...' : 'تحديث القائمة'}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                            تأكد من تفعيل البلوتوث واقتران الطابعة قبل البحث. عند تحديد طابعة هنا، سيتم الطباعة مباشرة دون السؤال في كل مرة.
                        </p>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button onClick={handleSave}>حفظ الإعدادات</Button>
                </div>
            </div>
        </Card>
    );
}

export default SettingsScreen;
