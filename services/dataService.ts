import { Product, Category, Customer, Supplier, Invoice, Expense, ExpenseCategory } from '../types';
import useNotificationStore from '../store/useNotificationStore';

export type DataType = 'products' | 'categories' | 'customers' | 'suppliers' | 'invoices' | 'expenses' | 'expenseCategories';

export const exportDataToJson = (data: any[], type: DataType) => {
    const notify = useNotificationStore.getState().notify;
    try {
        // Add a type identifier to the data for validation on import
        const dataToExport = {
            type: type,
            timestamp: new Date().toISOString(),
            data: data
        };
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify(`تم تصدير ${type} بنجاح.`, 'success');
    } catch (error) {
        console.error("Export failed", error);
        notify('فشل تصدير البيانات.', 'error');
    }
};


export const importDataFromJson = (file: File, expectedType: DataType): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                const parsedData = JSON.parse(content);

                // Validate the imported file type
                if (typeof parsedData !== 'object' || parsedData === null || parsedData.type !== expectedType) {
                    return reject(new Error(`ملف غير صالح. من المتوقع استيراد ${expectedType} ولكن تم العثور على ${parsedData.type || 'نوع غير معروف'}.`));
                }
                
                if (!Array.isArray(parsedData.data)) {
                    return reject(new Error('ملف غير صالح. يجب أن يحتوي الملف على مصفوفة بيانات.'));
                }

                resolve(parsedData.data);

            } catch (error) {
                console.error("Import parsing failed", error);
                reject(new Error('فشل في قراءة الملف. تأكد من أنه ملف JSON صالح.'));
            }
        };
        reader.onerror = (error) => {
            console.error("File reader error", error);
            reject(new Error('حدث خطأ أثناء قراءة الملف.'));
        };
        reader.readAsText(file);
    });
};