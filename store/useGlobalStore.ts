
import { create } from 'zustand';
import { CompanyInfo, PrinterSettings, PaperSize, LicenseInfo } from '../types';
import { SettingsRepository } from '../services/repositories/SettingsRepository';
import { isElectron } from '../services/platform';

interface ExchangeRates {
  USD: number; // 1 USD = X SYP
  TRY: number; // 1 TRY = Y SYP
}

interface GlobalState {
  theme: 'light' | 'dark';
  isAuthenticated: boolean;
  isDbLoaded: boolean;
  isSetupCompleted: boolean; // New Flag
  exchangeRates: ExchangeRates;
  companyInfo: CompanyInfo;
  printerSettings: PrinterSettings;
  licenseInfo: LicenseInfo | null; // New License Info
  toggleTheme: () => void;
  login: () => void;
  logout: () => void;
  completeSetup: () => void; // New Action
  setExchangeRates: (rates: ExchangeRates) => void;
  setCompanyInfo: (info: CompanyInfo) => void;
  setPrinterSettings: (settings: PrinterSettings) => Promise<void>;
  loadInitialSettings: () => Promise<void>;
}

const useGlobalStore = create<GlobalState>((set) => ({
    theme: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    isAuthenticated: false,
    isDbLoaded: isElectron, // Electron DB is ready on startup
    isSetupCompleted: false, // Default false until loaded
    exchangeRates: { USD: 14000, TRY: 450 },
    companyInfo: { name: 'العالمية برو - Alalmiyh Pro', address: 'المكتب الرئيسي', phone: '09XXXXXXX' },
    printerSettings: { paperSize: PaperSize.MM80 },
    licenseInfo: null,
    toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
    login: () => set({ isAuthenticated: true }),
    logout: () => set({ isAuthenticated: false }),
    completeSetup: () => set({ isSetupCompleted: true }),
    setExchangeRates: async (rates) => {
        await SettingsRepository.setExchangeRates(rates);
        set({ exchangeRates: rates });
    },
    setCompanyInfo: async (info) => {
        await SettingsRepository.setCompanyInfo(info);
        set({ companyInfo: info });
    },
    setPrinterSettings: async (settings) => {
        await SettingsRepository.setPrinterSettings(settings);
        set({ printerSettings: settings });
    },
    loadInitialSettings: async () => {
        const rates = await SettingsRepository.getExchangeRates();
        const info = await SettingsRepository.getCompanyInfo();
        const printerSettings = await SettingsRepository.getPrinterSettings();
        const setupStatus = await SettingsRepository.isSetupCompleted();
        const license = await SettingsRepository.getLicenseInfo();

        set({ isSetupCompleted: setupStatus });
        
        if (rates) {
            set({ exchangeRates: rates });
        }
        if (info) {
            set({ companyInfo: info });
        }
        if (printerSettings) {
            set({ printerSettings });
        }
        if (license) {
            set({ licenseInfo: license });
        }
        
        // Capacitor will set this to true after its async initialization
        if (!isElectron) {
            set({ isDbLoaded: true });
        }
    }
}));

export default useGlobalStore;