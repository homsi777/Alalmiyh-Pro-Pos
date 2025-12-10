import React from 'react';
import { Invoice } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import Modal from './common/Modal';
import Button from './common/Button';

interface InvoiceDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: Invoice;
    partyName: string;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({ isOpen, onClose, invoice, partyName }) => {
    const { formatCurrency } = useCurrency();
    const typeLabel = invoice.type === 'purchase' ? 'فاتورة شراء' : 'فاتورة مبيعات';
    const colorClass = invoice.type === 'purchase' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تفاصيل ${typeLabel}`}>
            <div className={`p-4 rounded-lg mb-4 ${colorClass}`}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">رقم الفاتورة</p>
                        <p className="font-bold font-mono text-lg">{invoice.id}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">التاريخ</p>
                        <p className="font-bold">{new Date(invoice.date).toLocaleString('ar-SY')}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">{invoice.type === 'purchase' ? 'المورد' : 'العميل'}</p>
                        <p className="font-bold text-primary">{partyName}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 dark:text-gray-400">طريقة الدفع</p>
                        <p className="font-bold">{invoice.paymentType === 'cash' ? 'نقدي' : 'آجل (ذمم)'}</p>
                    </div>
                    {invoice.vendorInvoiceNumber && (
                        <div className="col-span-2 bg-white dark:bg-gray-800 p-2 rounded border dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400">رقم مرجع المورد</p>
                            <p className="font-bold font-mono">{invoice.vendorInvoiceNumber}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-h-[40vh] overflow-y-auto mb-4 border rounded-lg dark:border-gray-700">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                        <tr>
                            <th className="p-2">المنتج</th>
                            <th className="p-2">الكمية</th>
                            <th className="p-2">السعر</th>
                            <th className="p-2">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoice.items.map((item, idx) => (
                            <tr key={idx} className="border-b dark:border-gray-600 last:border-0">
                                <td className="p-2 font-medium">{item.productName}</td>
                                <td className="p-2">{item.quantity}</td>
                                <td className="p-2">{formatCurrency(item.unitPrice.amount, item.unitPrice.currency)}</td>
                                <td className="p-2 font-bold">{formatCurrency(item.totalPrice.amount, item.totalPrice.currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <span className="font-bold text-lg">الإجمالي النهائي:</span>
                <span className="font-bold text-xl text-primary">{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
            </div>

            <div className="mt-4 flex justify-end">
                <Button onClick={onClose}>إغلاق</Button>
            </div>
        </Modal>
    );
};

export default InvoiceDetailsModal;