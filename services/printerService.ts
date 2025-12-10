
import { Invoice, PaperSize, Customer, Supplier, Currency, CashTransactionType } from '../types';
import { CURRENCY_INFO } from '../constants';
import { isElectron, isCapacitor } from './platform';
import useGlobalStore from '../store/useGlobalStore';
import { LedgerRepository } from './repositories/LedgerRepository';
import { FinanceRepository } from './repositories/FinanceRepository';
import { BluetoothSerial } from '@awesome-cordova-plugins/bluetooth-serial';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import EscPosEncoder from '@point-of-sale/receipt-printer-encoder';

export type StatementData = {
    party: (Customer | Supplier) & { balance: number, balanceCurrency: Currency },
    transactions: {
        date: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
    }[],
}

type PrintContent = { type: 'invoice', data: Invoice } | { type: 'statement', data: StatementData };

interface InvoicePrintData {
    invoice: Invoice;
    customer?: Customer;
    paidAmount: number;
    remainingAmount: number;
    customerTotalBalance?: number;
}

export class PrinterService {
    
    // Lock to prevent duplicate printing actions
    private static isPrintingLock = false;

    // --- HTML Generators (For Electron/PDF) ---

    private static generateInvoiceThermalHtml(data: InvoicePrintData, paperSize: PaperSize): string {
        const { invoice, customer, paidAmount, remainingAmount, customerTotalBalance } = data;
        const currencyInfo = CURRENCY_INFO[invoice.currency];
        const companyInfo = useGlobalStore.getState().companyInfo;

        // Compact table rows with BOLD text
        const itemsHtml = invoice.items.map(item => `
            <tr style="border-bottom: 1px dashed #000;">
                <td style="padding: 4px 0; text-align: right; width: 45%; font-size: 14px; font-weight: 800; line-height: 1.1;">${item.productName}</td>
                <td style="padding: 4px 0; text-align: center; width: 10%; font-size: 14px; font-weight: 800;">${item.quantity}</td>
                <td style="padding: 4px 0; text-align: center; width: 20%; font-size: 14px; font-weight: 800;">${item.unitPrice.amount}</td>
                <td style="padding: 4px 0; text-align: left; width: 25%; font-size: 14px; font-weight: 800;">${item.totalPrice.amount}</td>
            </tr>
        `).join('');

        let paymentDetailsHtml = '';
        if (invoice.paymentType === 'credit') {
            paymentDetailsHtml = `
                <div style="border-top: 2px solid #000; margin-top: 5px; padding-top: 5px; font-size: 13px; font-weight: 800;">
                    <div style="display:flex; justify-content:space-between;"><span>المدفوع:</span><span>${paidAmount}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span>المتبقي:</span><span>${remainingAmount}</span></div>
                    ${customer ? `<div style="display:flex; justify-content:space-between;"><span>رصيد سابق:</span><span>${customerTotalBalance?.toFixed(0)}</span></div>` : ''}
                </div>
            `;
        }

        const width = paperSize === PaperSize.MM58 ? '370px' : '560px';

        return `
            <div style="width: ${width}; font-family: sans-serif; background: #fff; color: #000; padding: 10px 5px; box-sizing: border-box; overflow: hidden;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 8px;">
                    <h2 style="margin: 0 0 5px 0; font-size: 22px; font-weight: 900;">${companyInfo.name}</h2>
                    <p style="margin: 0; font-size: 14px; font-weight: 800;">${companyInfo.phone}</p>
                </div>
                
                <div style="border-bottom: 2px solid #000; margin: 5px 0;"></div>
                
                <!-- Meta Info Grid (Compact) -->
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; font-size: 13px; font-weight: 800; line-height: 1.4;">
                    <div style="width: 48%; text-align: right;">رقم: ${invoice.id.split('-')[1] || invoice.id}</div>
                    <div style="width: 48%; text-align: left;">${new Date(invoice.date).toLocaleDateString('ar-SY')}</div>
                    <div style="width: 100%; text-align: right;">العميل: ${customer ? customer.name.substring(0, 20) : 'نقدي'}</div>
                </div>

                <div style="border-bottom: 2px solid #000; margin: 5px 0;"></div>

                <!-- Table -->
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000;">
                            <th style="text-align: right; width: 45%; font-size: 13px; font-weight: 900; padding-bottom: 4px;">الصنف</th>
                            <th style="text-align: center; width: 10%; font-size: 13px; font-weight: 900; padding-bottom: 4px;">ك</th>
                            <th style="text-align: center; width: 20%; font-size: 13px; font-weight: 900; padding-bottom: 4px;">سعر</th>
                            <th style="text-align: left; width: 25%; font-size: 13px; font-weight: 900; padding-bottom: 4px;">إجمالي</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <div style="border-bottom: 2px solid #000; margin: 8px 0;"></div>

                <!-- Totals -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 900; font-size: 20px;">
                        <span>الإجمالي:</span>
                        <span>${invoice.totalAmount.toFixed(0)}</span>
                    </div>
                    ${paymentDetailsHtml}
                </div>

                <!-- Footer -->
                <div style="text-align: center; margin-top: 15px; font-size: 12px; font-weight: 800;">
                    <p style="margin:0;">شكراً لزيارتكم</p>
                    <p style="margin:2px 0 0 0; font-size: 10px;">Alalmiyh Pro System</p>
                </div>
            </div>
        `;
    }

    private static generateInvoiceA4Html(data: InvoicePrintData): string {
        const { invoice, customer, paidAmount, remainingAmount, customerTotalBalance } = data;
        const companyInfo = useGlobalStore.getState().companyInfo;
        const currencyInfo = CURRENCY_INFO[invoice.currency];
        const itemsHtml = invoice.items.map((item, index) => `<tr><td>${index + 1}</td><td style="text-align: right;">${item.productName}</td><td>${item.quantity}</td><td>${item.unitPrice.amount.toFixed(2)}</td><td>${item.totalPrice.amount.toFixed(2)}</td></tr>`).join('');
        return `
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>Invoice ${invoice.id}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet"><style>body { font-family: 'Tajawal', sans-serif; margin: 0; padding: 40px; color: #333; background: #fff; } .header { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; } .company-details h1 { color: #2563eb; margin: 0 0 10px 0; } .company-details p { margin: 2px 0; color: #555; } .invoice-title { text-align: left; } .invoice-title h2 { font-size: 32px; margin: 0; color: #ccc; text-transform: uppercase; letter-spacing: 2px; } .invoice-meta { margin-top: 10px; text-align: left; } .invoice-meta p { margin: 5px 0; font-weight: bold; } .bill-to { margin-bottom: 30px; display: flex; gap: 50px; } .bill-to-col h3 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; width: 200px; } table { width: 100%; border-collapse: collapse; margin-bottom: 30px; } th { background-color: #f8fafc; color: #2563eb; padding: 12px; border-bottom: 2px solid #2563eb; text-align: center; } td { padding: 10px; border-bottom: 1px solid #eee; text-align: center; } td:nth-child(2) { text-align: right; } .summary-section { display: flex; justify-content: flex-end; } .summary-table { width: 350px; border-collapse: collapse; } .summary-table td { padding: 8px; border-bottom: 1px solid #ddd; text-align: left; } .summary-table td:first-child { font-weight: bold; color: #555; text-align: right; } .summary-table .total-row td { background-color: #2563eb; color: white; font-weight: bold; font-size: 18px; border: none; } .footer { margin-top: 50px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }</style></head>
            <body><div class="header"><div class="company-details"><h1>${companyInfo.name}</h1><p>${companyInfo.address}</p><p>${companyInfo.phone}</p></div><div class="invoice-title"><h2>فاتورة مبيعات</h2><div class="invoice-meta"><p>رقم الفاتورة: #${invoice.id}</p><p>التاريخ: ${new Date(invoice.date).toLocaleDateString('ar-SY')}</p></div></div></div>
            <div class="bill-to"><div class="bill-to-col"><h3>بيانات العميل</h3><p><strong>الاسم:</strong> ${customer ? customer.name : 'عميل نقدي'}</p>${customer?.phone ? `<p><strong>الهاتف:</strong> ${customer.phone}</p>` : ''}${customerTotalBalance !== undefined ? `<p><strong>الرصيد الكلي:</strong> ${customerTotalBalance.toFixed(2)} ${currencyInfo.symbol}</p>` : ''}</div><div class="bill-to-col"><h3>تفاصيل الدفع</h3><p><strong>طريقة الدفع:</strong> ${invoice.paymentType === 'cash' ? 'نقدي' : 'آجل (ذمم)'}</p><p><strong>العملة:</strong> ${currencyInfo.name}</p></div></div>
            <table><thead><tr><th width="5%">#</th><th width="40%" style="text-align:right;">المنتج / الخدمة</th><th width="15%">الكمية</th><th width="20%">سعر الوحدة</th><th width="20%">الإجمالي</th></tr></thead><tbody>${itemsHtml}</tbody></table>
            <div class="summary-section"><table class="summary-table"><tr class="total-row"><td>الإجمالي النهائي</td><td>${invoice.totalAmount.toFixed(2)} ${currencyInfo.symbol}</td></tr></table></div><div class="footer"><p>شكراً لتعاملكم معنا!</p></div></body></html>
        `;
    }

    // --- Data Prep Methods ---

    private static async prepareInvoiceData(invoice: Invoice): Promise<InvoicePrintData> {
        let customer: Customer | undefined;
        let customerTotalBalance: number | undefined;
        
        if (invoice.customerId) {
            const customers = await LedgerRepository.getCustomers();
            customer = customers.find(c => c.id === invoice.customerId);
            if (customer) {
                customerTotalBalance = customer.balances[invoice.currency];
            }
        }
        
        let paidAmount = 0;
        let remainingAmount = invoice.totalAmount;
        
        if (invoice.paymentType === 'credit') {
            const transactions = await FinanceRepository.getCashTransactions();
            const explicitPayment = transactions.find(t => t.linkedInvoiceId === invoice.id);

            if (explicitPayment) {
                 paidAmount = explicitPayment.amount;
                 remainingAmount = invoice.totalAmount - paidAmount;
            }
        } else {
            paidAmount = invoice.totalAmount;
            remainingAmount = 0;
        }

        return { invoice, customer, paidAmount, remainingAmount, customerTotalBalance };
    }

    // --- Capacitor Printer Implementation (Image Mode) ---

    public static async listBluetoothDevices(): Promise<{name: string, address: string}[]> {
        if (!isCapacitor) return [];
        return new Promise((resolve, reject) => {
            BluetoothSerial.list().then(
                (devices: any[]) => resolve(devices.map(d => ({ name: d.name, address: d.address }))),
                (err: any) => reject(new Error('Failed to list devices: ' + JSON.stringify(err)))
            );
        });
    }

    /**
     * Converts HTML string to an image and sends it to the thermal printer via Bluetooth.
     * Uses Aggressive Chunking to prevent buffer overflow on long receipts.
     */
    private static async printHtmlToBluetooth(htmlContent: string, macAddress: string, paperSize: PaperSize): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Connect to Printer
                const isConnected = await BluetoothSerial.isConnected().catch(() => false);
                if (!isConnected) {
                    await new Promise<void>((res, rej) => {
                        BluetoothSerial.connect(macAddress).subscribe(res, rej);
                    });
                }

                // 2. Render HTML to a hidden DOM element
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.top = '-9999px';
                container.style.left = '0';
                container.style.zIndex = '-1';
                container.innerHTML = htmlContent;
                document.body.appendChild(container);

                // Wait slightly for DOM to settle
                await new Promise(r => setTimeout(r, 100));

                // 3. Convert to Canvas
                // Using 1.5 scale provides a balance between sharpness and data size
                const scale = 1.5; 
                let canvas = await html2canvas(container, {
                    scale: scale, 
                    logging: false,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    height: container.offsetHeight + 10 // Minimal padding
                });
                
                document.body.removeChild(container);

                // --- CRITICAL FIX FOR "Height must be a multiple of 8" ---
                // Thermal printers often require image height to be divisible by 8 or 24.
                // We will pad the canvas with white space at the bottom to satisfy this.
                if (canvas.height % 8 !== 0) {
                    const adjustment = 8 - (canvas.height % 8);
                    const newHeight = canvas.height + adjustment;
                    
                    const newCanvas = document.createElement('canvas');
                    newCanvas.width = canvas.width;
                    newCanvas.height = newHeight;
                    
                    const ctx = newCanvas.getContext('2d');
                    if (ctx) {
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
                        ctx.drawImage(canvas, 0, 0);
                        canvas = newCanvas; // Swap to the corrected canvas
                    }
                }
                // --- END FIX ---

                // 4. Encode Image to ESC/POS
                const encoder = new EscPosEncoder();
                const img = new Image();
                img.src = canvas.toDataURL('image/png');
                
                await new Promise((r) => { img.onload = r; });

                // Width calculation based on paper size
                const printerWidth = paperSize === PaperSize.MM58 ? 384 : 576; 

                const result = encoder
                    .initialize()
                    .align('center')
                    // 'atkinson' gives best text contrast for sharp text
                    .image(img, printerWidth, canvas.height, 'atkinson') 
                    .cut()
                    .encode();

                // 5. Send Data with Safe Chunking (CRITICAL FOR LONG RECEIPTS)
                // Reducing chunk size ensures the printer buffer doesn't overflow
                const CHUNK_SIZE = 150; // Kept small for stability
                const DELAY_MS = 30;    // Reduced delay for faster printing

                for (let i = 0; i < result.length; i += CHUNK_SIZE) {
                    const chunk = result.slice(i, i + CHUNK_SIZE);
                    await BluetoothSerial.write(chunk);
                    // Critical wait to let printer process buffer
                    await new Promise(r => setTimeout(r, DELAY_MS));
                }

                resolve();

            } catch (error: any) {
                console.error("Bluetooth print failed:", error);
                reject(new Error("فشل الطباعة: " + (error.message || JSON.stringify(error))));
            }
        });
    }

    public static async printInvoiceThermalCapacitor(invoice: Invoice, macAddress: string, paperSize: PaperSize) {
        if (this.isPrintingLock) return;
        this.isPrintingLock = true;
        try {
            const data = await this.prepareInvoiceData(invoice);
            const html = this.generateInvoiceThermalHtml(data, paperSize);
            await this.printHtmlToBluetooth(html, macAddress, paperSize);
        } finally {
            this.isPrintingLock = false;
        }
    }

    public static async printStatementThermalCapacitor(data: StatementData, macAddress: string, paperSize: PaperSize) {
         if (this.isPrintingLock) return;
        this.isPrintingLock = true;
        try {
             const companyInfo = useGlobalStore.getState().companyInfo;
             const width = paperSize === PaperSize.MM58 ? '370px' : '560px';
             
             const rows = data.transactions.map(t => `
                <tr style="border-bottom: 1px dotted #000;">
                    <td style="font-size:12px; font-weight:700; padding: 2px;">${new Date(t.date).toLocaleDateString('ar-SY')}</td>
                    <td style="font-size:12px; font-weight:700; padding: 2px;">${t.description}</td>
                    <td style="font-size:12px; font-weight:700; padding: 2px; text-align: left;">${t.balance.toFixed(0)}</td>
                </tr>
             `).join('');
             
             const html = `
                <div style="width: ${width}; font-family: 'Courier New', sans-serif; background: #fff; color: #000; padding: 5px;">
                     <div style="text-align: center; border-bottom: 1px solid #000; margin-bottom: 5px;">
                        <h2 style="margin:0; font-size: 18px; font-weight: 800;">${companyInfo.name}</h2>
                        <h3 style="font-size: 14px; font-weight: 700; margin: 2px 0;">كشف حساب: ${data.party.name}</h3>
                     </div>
                     <table style="width:100%; border-collapse:collapse; text-align:right;">
                        <thead><tr style="border-bottom:1px solid #000;">
                            <th style="font-size:11px; font-weight:800; padding-bottom:2px;">تاريخ</th>
                            <th style="font-size:11px; font-weight:800; padding-bottom:2px;">بيان</th>
                            <th style="font-size:11px; font-weight:800; padding-bottom:2px; text-align: left;">رصيد</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                     </table>
                     <div style="margin-top:10px; font-weight:800; font-size:14px; border-top:1px solid #000; padding-top:5px; text-align:center;">
                        الرصيد النهائي: ${data.party.balance.toFixed(0)} ${CURRENCY_INFO[data.party.balanceCurrency].symbol}
                     </div>
                </div>
             `;
             
             await this.printHtmlToBluetooth(html, macAddress, paperSize);
        } finally {
            this.isPrintingLock = false;
        }
    }

    // --- Electron / Web Implementation ---

    public static async printDocument(content: PrintContent, printerName?: string): Promise<{success: boolean, error?: string}> {
        if (!isElectron) return { success: false, error: "Not supported" };

        let html = '';
        const paperSize = useGlobalStore.getState().printerSettings.paperSize;

        if (content.type === 'invoice') {
             const data = await this.prepareInvoiceData(content.data);
             if (paperSize === PaperSize.A4) {
                 html = this.generateInvoiceA4Html(data);
             } else {
                 html = this.generateInvoiceThermalHtml(data, paperSize);
             }
        } else if (content.type === 'statement') {
             html = `<html><body><h1>Statement Print (A4 Not Implemented yet)</h1></body></html>`;
        }
        
        const options = { 
            deviceName: printerName,
            silent: !!printerName, 
            margins: paperSize !== PaperSize.A4 ? 'none' : 'default' 
        };
        
        return window.electronAPI!.printJob(html, options);
    }
    
    public static async saveToPdf(content: PrintContent, filename: string): Promise<{success: boolean, error?: string}> {
        if (!isElectron) return { success: false, error: "Not supported" };
        
        let html = '';
        const paperSize = useGlobalStore.getState().printerSettings.paperSize;

        if (content.type === 'invoice') {
             const data = await this.prepareInvoiceData(content.data);
             if (paperSize === PaperSize.A4) {
                 html = this.generateInvoiceA4Html(data);
             } else {
                 html = this.generateInvoiceThermalHtml(data, paperSize);
             }
        } 

        return window.electronAPI!.savePdf(html, filename, { paperSize });
    }

    public static async listDevices(): Promise<{name: string, address: string}[]> {
        if (isElectron) {
            return window.electronAPI!.printerList();
        }
        return [];
    }
}
