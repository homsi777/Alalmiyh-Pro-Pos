
import React, { useState } from 'react';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Logo from '../components/Logo';
import useNotificationStore from '../store/useNotificationStore';
import { LITE_KEYS, PRO_KEYS, LICENSE_TYPES } from '../constants';
import { SettingsRepository } from '../services/repositories/SettingsRepository';
import { InventoryRepository } from '../services/repositories/InventoryRepository';
import { LedgerRepository } from '../services/repositories/LedgerRepository';
import { FinanceRepository } from '../services/repositories/FinanceRepository';
import { Currency, CashRegister, Customer, Supplier, Category, User, LicenseType } from '../types';
import { AuthRepository } from '../services/repositories/AuthRepository';

const STEPS = [
    'تفعيل النظام',
    'إنشاء المدير',
    'إضافة الفئات',
    'إضافة العملاء',
    'إضافة الموردين',
    'إعداد الصندوق'
];

interface SetupWizardProps {
    onComplete: () => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(1);
    const notify = useNotificationStore(s => s.notify);

    // --- State for Steps ---
    // Step 1: License
    const [licenseType, setLicenseType] = useState<string>('lite');
    const [licenseKey, setLicenseKey] = useState('');
    
    // Step 2: Admin
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step 3: Categories
    const [categoryName, setCategoryName] = useState('');
    const [addedCategories, setAddedCategories] = useState<Category[]>([]);

    // Step 4: Customers
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [addedCustomers, setAddedCustomers] = useState<Customer[]>([]);

    // Step 5: Suppliers
    const [supplierName, setSupplierName] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');
    const [addedSuppliers, setAddedSuppliers] = useState<Supplier[]>([]);

    // Step 6: Cash Register
    const [registerName, setRegisterName] = useState('الصندوق الرئيسي');

    const handleNext = async () => {
        try {
            if (step === 1) await validateLicense();
            if (step === 2) await validateAdmin();
            if (step === 3) { /* Categories are added instantly, just move next */ }
            if (step === 4) { /* Customers are added instantly */ }
            if (step === 5) { /* Suppliers are added instantly */ }
            if (step === 6) await finalizeSetup();
            
            if (step < 6) setStep(step + 1);
        } catch (e: any) {
            notify(e.message, 'error');
        }
    };

    const validateLicense = async () => {
        if (licenseType === 'full') {
            throw new Error('النسخة السحابية قيد التطوير والاختبار حالياً.');
        }
        
        const trimmedKey = licenseKey.trim();
        let isValid = false;

        if (licenseType === 'lite') {
            isValid = LITE_KEYS.includes(trimmedKey);
        } else if (licenseType === 'pro') {
            isValid = PRO_KEYS.includes(trimmedKey);
        }

        if (!isValid) {
            throw new Error('مفتاح التفعيل غير صحيح. يرجى التحقق من النسخة والمفتاح.');
        }

        // Save License Info
        await SettingsRepository.setLicenseInfo({
            type: licenseType as LicenseType,
            key: trimmedKey,
            activationDate: new Date().toISOString()
        });
    };

    const validateAdmin = async () => {
        if (!username || !password) throw new Error('الرجاء تعبئة جميع الحقول');
        if (password !== confirmPassword) throw new Error('كلمات المرور غير متطابقة');
        
        // Use AuthRepository to update or create the admin user
        // We use 'u-1' to overwrite the seed user or create a new primary admin
        const success = await AuthRepository.updateUser('u-1', username, password);
        
        if (!success) {
            throw new Error('فشل حفظ بيانات المدير. يرجى المحاولة مرة أخرى.');
        }
    };

    const addCategory = async () => {
        if(!categoryName) return;
        try {
            const newCat = { id: `cat-${Date.now()}`, name: categoryName };
            await InventoryRepository.addCategory(newCat);
            setAddedCategories([...addedCategories, newCat]);
            setCategoryName('');
        } catch (e: any) {
            notify(`فشل إضافة الفئة: ${e.message}`, 'error');
        }
    }

    const addCustomer = async () => {
        if(!customerName) return;
        try {
            const newCust = { id: `c-${Date.now()}`, name: customerName, phone: customerPhone, balances: { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 } };
            await LedgerRepository.addCustomer(newCust);
            setAddedCustomers([...addedCustomers, newCust]);
            setCustomerName('');
            setCustomerPhone('');
        } catch (e: any) {
            notify(`فشل إضافة العميل: ${e.message}`, 'error');
        }
    }

    const addSupplier = async () => {
        if(!supplierName) return;
        try {
            const newSupp = { id: `s-${Date.now()}`, name: supplierName, phone: supplierPhone, balances: { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 } };
            await LedgerRepository.addSupplier(newSupp);
            setAddedSuppliers([...addedSuppliers, newSupp]);
            setSupplierName('');
            setSupplierPhone('');
        } catch (e: any) {
            notify(`فشل إضافة المورد: ${e.message}`, 'error');
        }
    }

    const finalizeSetup = async () => {
        // Create/Update Main Register
        const mainReg = { id: 'cr-1', name: registerName, balances: { [Currency.SYP]: 0, [Currency.USD]: 0, [Currency.TRY]: 0 } };
        
        // Use a new ID to avoid conflict if cr-1 exists and we are not using REPLACE
        // However, FinanceRepository uses INSERT. Let's try inserting a new one to be safe.
        // If cr-1 exists (from seed), we add another one.
        const regId = `cr-${Date.now()}`;
        await FinanceRepository.addCashRegister({ ...mainReg, id: regId }); 
        
        await SettingsRepository.setSetupCompleted(true);
        notify('تم إعداد النظام بنجاح! جاري الدخول...', 'success');
        setTimeout(onComplete, 1500);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
            <div className="w-full max-w-3xl">
                <div className="flex justify-center mb-8">
                    <Logo className="w-20 h-20" showText={true} />
                </div>
                
                {/* Steps Indicator */}
                <div className="flex justify-between mb-8 px-4">
                    {STEPS.map((label, idx) => {
                        const stepNum = idx + 1;
                        const isActive = step === stepNum;
                        const isCompleted = step > stepNum;
                        return (
                            <div key={idx} className="flex flex-col items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-2 transition-colors ${isActive ? 'bg-primary text-white scale-110 shadow-lg' : isCompleted ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                                    {isCompleted ? '✓' : stepNum}
                                </div>
                                <span className={`text-xs ${isActive ? 'text-primary font-bold' : 'text-gray-500'}`}>{label}</span>
                            </div>
                        )
                    })}
                </div>

                <Card className="p-8 shadow-2xl min-h-[400px] flex flex-col justify-between">
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-primary border-b pb-2">{STEPS[step - 1]}</h2>
                        
                        {/* STEP 1: LICENSE */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div 
                                        onClick={() => setLicenseType('lite')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${licenseType === 'lite' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                                    >
                                        <h3 className="font-bold text-lg">نسخة لايت (Lite)</h3>
                                        <p className="text-sm text-gray-500">محلية - لابتوب</p>
                                    </div>
                                    <div 
                                        onClick={() => setLicenseType('pro')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${licenseType === 'pro' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                                    >
                                        <h3 className="font-bold text-lg">نسخة برو (Pro)</h3>
                                        <p className="text-sm text-gray-500">محلية - حاسوب متطور</p>
                                    </div>
                                    <div 
                                        onClick={() => setLicenseType('full')}
                                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all hover:scale-105 ${licenseType === 'full' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                                    >
                                        <h3 className="font-bold text-lg">سحابية (Full)</h3>
                                        <p className="text-sm text-gray-500">تخزين سحابي كامل</p>
                                    </div>
                                </div>
                                
                                <Input 
                                    label="أدخل مفتاح التفعيل" 
                                    placeholder={licenseType === 'lite' ? 'APKL...' : 'APKP...'}
                                    value={licenseKey}
                                    onChange={e => setLicenseKey(e.target.value)}
                                    className="text-lg font-mono tracking-widest"
                                />
                                {licenseType === 'full' && (
                                    <p className="text-red-500 text-sm font-bold bg-red-50 p-2 rounded">
                                        تنبيه: النسخة السحابية قيد التطوير والاختبار حالياً ولا يمكن تفعيلها.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* STEP 2: ADMIN */}
                        {step === 2 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <Input label="اسم المستخدم للمدير" value={username} onChange={e => setUsername(e.target.value)} />
                                <Input label="كلمة المرور" type="password" value={password} onChange={e => setPassword(e.target.value)} />
                                <Input label="تأكيد كلمة المرور" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>
                        )}

                        {/* STEP 3: CATEGORIES */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input placeholder="اسم الفئة (مثال: مواد غذائية)" value={categoryName} onChange={e => setCategoryName(e.target.value)} className="flex-grow" />
                                    <Button onClick={addCategory}>إضافة</Button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg h-48 overflow-y-auto">
                                    {addedCategories.length === 0 ? <p className="text-gray-400 text-center">لا توجد فئات مضافة</p> : 
                                        <ul className="space-y-2">
                                            {addedCategories.map((c, i) => <li key={i} className="bg-white dark:bg-gray-700 p-2 rounded shadow-sm">📂 {c.name}</li>)}
                                        </ul>
                                    }
                                </div>
                            </div>
                        )}

                        {/* STEP 4: CUSTOMERS */}
                        {step === 4 && (
                            <div className="space-y-4">
                                <div className="flex gap-2 items-end">
                                    <Input label="اسم العميل" value={customerName} onChange={e => setCustomerName(e.target.value)} className="flex-grow" />
                                    <Input label="رقم الهاتف" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                                    <Button onClick={addCustomer} className="mb-1">إضافة</Button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg h-48 overflow-y-auto">
                                    {addedCustomers.length === 0 ? <p className="text-gray-400 text-center">لا يوجد عملاء مضافين</p> : 
                                        <ul className="space-y-2">
                                            {addedCustomers.map((c, i) => <li key={i} className="bg-white dark:bg-gray-700 p-2 rounded shadow-sm">👤 {c.name} - {c.phone}</li>)}
                                        </ul>
                                    }
                                </div>
                            </div>
                        )}

                        {/* STEP 5: SUPPLIERS */}
                        {step === 5 && (
                            <div className="space-y-4">
                                <div className="flex gap-2 items-end">
                                    <Input label="اسم المورد" value={supplierName} onChange={e => setSupplierName(e.target.value)} className="flex-grow" />
                                    <Input label="رقم الهاتف" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} />
                                    <Button onClick={addSupplier} className="mb-1">إضافة</Button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg h-48 overflow-y-auto">
                                    {addedSuppliers.length === 0 ? <p className="text-gray-400 text-center">لا يوجد موردين مضافين</p> : 
                                        <ul className="space-y-2">
                                            {addedSuppliers.map((s, i) => <li key={i} className="bg-white dark:bg-gray-700 p-2 rounded shadow-sm">🏢 {s.name} - {s.phone}</li>)}
                                        </ul>
                                    }
                                </div>
                            </div>
                        )}

                        {/* STEP 6: REGISTER */}
                        {step === 6 && (
                            <div className="space-y-6 text-center max-w-md mx-auto pt-8">
                                <p className="text-gray-600">أخيراً، قم بتسمية الصندوق الرئيسي الخاص بك:</p>
                                <Input label="اسم الصندوق" value={registerName} onChange={e => setRegisterName(e.target.value)} className="text-center text-lg" />
                                <div className="bg-green-50 p-4 rounded text-green-700 text-sm mt-4">
                                    أنت جاهز تماماً للبدء! اضغط على زر "إنهاء" للدخول إلى النظام.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-6 border-t mt-6">
                        <Button onClick={handleNext} size="lg" className="w-32">
                            {step === 6 ? 'إنهاء وبدء العمل' : 'التالي'}
                        </Button>
                    </div>
                </Card>
                
                <p className="text-center text-gray-400 mt-8 text-sm">
                    Alalmiyh Pro Pos System - Setup Wizard v1.0
                </p>
            </div>
        </div>
    );
};

export default SetupWizard;
