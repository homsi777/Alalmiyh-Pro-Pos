

export enum Screen {
  Home,
  Pos,
  Inventory,
  Clients,
  Reports,
  Settings,
  Invoices,
  InvoiceForm,
  AccountStatement,
  Expenses,
  CashRegisters,
}

export enum Currency {
  SYP = 'SYP',
  USD = 'USD',
  TRY = 'TRY',
}

export enum PaymentType {
  Cash = 'cash',
  Credit = 'credit',
}

export enum InvoiceType {
  POS = 'pos',
  Sale = 'sale',
  Purchase = 'purchase',
}

export enum CashTransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  TransferIn = 'transfer-in',
  TransferOut = 'transfer-out',
  Sale = 'sale',
  Purchase = 'purchase',
  Expense = 'expense',
  OpeningBalance = 'opening-balance',
  PaymentReceived = 'payment-received', // سند قبض من عميل
  PaymentMade = 'payment-made', // سند دفع لمورد
}

export enum PaperSize {
  A4 = 'A4',
  MM80 = '80mm',
  MM58 = '58mm',
}

export type LicenseType = 'lite' | 'pro' | 'full' | 'unlicensed';

export interface LicenseInfo {
    type: LicenseType;
    key: string;
    activationDate: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
}

export interface Price {
  amount: number;
  currency: Currency;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  costPrice: Price;
  wholesalePrice: Price;
  sellingPrice: Price;
  categoryId?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  balances: Record<Currency, number>; // Multi-currency support
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  balances: Record<Currency, number>; // Multi-currency support
}

export interface CartItem {
  product: Product;
  quantity: number;
  overridePrice?: Price;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Price;
  totalPrice: Price;
}

export interface Invoice {
  id: string;
  date: string;
  items: InvoiceItem[];
  totalAmount: number;
  currency: Currency;
  paymentType: PaymentType;
  totalAmountInSyp: number;
  customerId?: string;
  supplierId?: string;
  type: InvoiceType;
  cashRegisterId?: string;
  vendorInvoiceNumber?: string; // رقم فاتورة المورد
}

export interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
    logo?: string;
}

export interface PrinterSettings {
  paperSize: PaperSize;
  defaultPrinterName?: string; // For silent printing (Electron)
  defaultPrinterAddress?: string; // For silent printing (Capacitor/Bluetooth)
}

export interface ExpenseCategory {
  id: string;
  name: string;
  parentId?: string;
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  categoryId: string;
  cashRegisterId: string;
  amount: number;
  currency: Currency;
  amountInSyp: number;
}

export interface CashRegister {
  id: string;
  name: string;
  balances: Record<Currency, number>;
}

export interface CashTransaction {
  id: string;
  date: string;
  registerId: string;
  type: CashTransactionType;
  amount: number; // always positive
  currency: Currency;
  amountInSyp: number;
  description: string;
  relatedId?: string; // invoice.id, expense.id, customer.id, supplier.id etc.
  linkedInvoiceId?: string;
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be a hash
  role: 'admin' | 'user';
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      // DB methods
      query: (sql: string, params?: any[]) => Promise<any[]>;
      run: (sql: string, params?: any[]) => Promise<{ changes: number; lastInsertRowid: number }>;
      get: (sql: string, params?: any[]) => Promise<any>;
      executeTransaction: (operations: { statement: string; values?: any[] }[]) => Promise<{ success: boolean; error?: string }>;
      // Printer methods
      printerList: () => Promise<Array<{name: string, address: string}>>;
      printJob: (html: string, options: any) => Promise<{success: boolean, error?: string}>;
      savePdf: (html: string, filename: string, options?: any) => Promise<{success: boolean, error?: string}>;
    };
  }
}
