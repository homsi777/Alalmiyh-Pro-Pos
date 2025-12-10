import { BarcodeScanner, PermissionStatus } from '@capacitor-mlkit/barcode-scanning';
import { isCapacitor } from './platform';

class BarcodeServiceController {

    public async scanCamera(): Promise<{ content: string | null, cancelled: boolean }> {
        if (!isCapacitor) {
            throw new Error("مسح الكاميرا متاح فقط على الأجهزة الأصلية (Capacitor).");
        }

        try {
            const hasPermission = await this.checkAndRequestPermission();
            if (!hasPermission) {
                return { content: null, cancelled: true };
            }

            // The new scan() method handles the UI overlay automatically.
            const { barcodes } = await BarcodeScanner.scan();

            if (barcodes.length > 0) {
                // Return the first scanned barcode's value.
                return { content: barcodes[0].displayValue, cancelled: false };
            }
            
            // If the barcodes array is empty, the user cancelled the scan.
            return { content: null, cancelled: true };
        
        } catch (e: any) {
             console.error('ML Kit Barcode scan failed', e);
             // It's possible for the user to deny permission at the last moment, which might throw an error.
             // Treat this as a cancellation.
             return { content: null, cancelled: true };
        }
    }

    private async checkAndRequestPermission(): Promise<boolean> {
        try {
            const permissionStatus: PermissionStatus = await BarcodeScanner.checkPermissions();

            if (permissionStatus.camera === 'granted') {
                return true;
            }

            if (permissionStatus.camera === 'denied') {
                alert('تم رفض إذن الوصول إلى الكاميرا بشكل دائم. يرجى تمكينه من إعدادات التطبيق.');
                return false;
            }
            
            // If not granted or denied, it needs to be requested.
            const requestedStatus: PermissionStatus = await BarcodeScanner.requestPermissions();
            return requestedStatus.camera === 'granted';

        } catch (e) {
            console.error("Permission check/request failed", e);
            return false;
        }
    }
}

export const BarcodeService = new BarcodeServiceController();
