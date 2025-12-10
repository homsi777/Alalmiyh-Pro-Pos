import React from 'react';
import { Invoice, CompanyInfo, Customer } from '../types';
import { useCurrency } from '../hooks/useCurrency';

interface PrintableInvoiceProps {
  invoice: Invoice;
  companyInfo: CompanyInfo;
  customers: Customer[];
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, companyInfo, customers }) => {
  const { formatCurrency } = useCurrency();
  const customer = customers.find(c => c.id === invoice.customerId);

  return (
    <div id="printable-invoice" className="p-8 bg-white text-black font-sans text-sm">
      <header className="flex justify-between items-start pb-4 border-b-2 border-black">
        <div>
          <h1 className="text-2xl font-bold">{companyInfo.name}</h1>
          <p>{companyInfo.address}</p>
          <p>{companyInfo.phone}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">فاتورة {invoice.type === 'purchase' ? 'شراء' : 'مبيعات'}</h2>
          <p><strong>رقم الفاتورة:</strong> {invoice.id}</p>
          {invoice.vendorInvoiceNumber && (
              <p><strong>مرجع المورد:</strong> {invoice.vendorInvoiceNumber}</p>
          )}
          <p><strong>التاريخ:</strong> {new Date(invoice.date).toLocaleDateString('ar-SY')}</p>
        </div>
      </header>

      <section className="my-6">
        <h3 className="font-bold border-b border-black mb-2 pb-1">معلومات {invoice.type === 'purchase' ? 'المورد' : 'العميل'}</h3>
        <p><strong>الاسم:</strong> {customer?.name || (invoice.type === 'purchase' ? 'مورد غير محدد' : 'عميل نقدي')}</p>
        {customer?.phone && <p><strong>الهاتف:</strong> {customer.phone}</p>}
      </section>

      <section className="my-6">
        <table className="w-full text-right">
          <thead className="border-b-2 border-t-2 border-black">
            <tr>
              <th className="py-2 px-1">#</th>
              <th className="py-2 px-1">المنتج</th>
              <th className="py-2 px-1">الكمية</th>
              <th className="py-2 px-1">سعر الوحدة</th>
              <th className="py-2 px-1">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.productId} className="border-b border-gray-300">
                <td className="py-2 px-1">{index + 1}</td>
                <td className="py-2 px-1">{item.productName}</td>
                <td className="py-2 px-1">{item.quantity}</td>
                <td className="py-2 px-1">{formatCurrency(item.unitPrice.amount, item.unitPrice.currency)}</td>
                <td className="py-2 px-1">{formatCurrency(item.totalPrice.amount, item.totalPrice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="flex justify-end mt-8">
        <div className="w-1/2">
            <div className="flex justify-between p-2 bg-gray-200">
                <span className="font-bold">الإجمالي النهائي:</span>
                <span className="font-bold">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
            </div>
        </div>
      </footer>
       <div className="text-center mt-12 text-xs text-gray-600">
            <p>شكراً لتعاملكم معنا!</p>
        </div>
    </div>
  );
};

export default PrintableInvoice;