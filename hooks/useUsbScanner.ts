import { useEffect } from 'react';
import { isElectron, isWeb } from '../services/platform';

/**
 * A hook that listens for rapid keyboard input, typical of a USB barcode scanner.
 * It buffers keystrokes and calls the onScan callback when a complete code is received (ending with 'Enter').
 * @param onScan Callback function that receives the scanned barcode string.
 */
export const useUsbScanner = (onScan: (code: string) => void) => {
  useEffect(() => {
    // This hook only works on desktop/web where a USB scanner acts as a keyboard.
    if (!isElectron && !isWeb) return;

    let buffer: string[] = [];
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      // Reset buffer if there's a pause of more than 100ms between keystrokes
      if (currentTime - lastKeyTime > 100) {
        buffer = [];
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        // A common barcode length is > 3. This is a simple validation.
        if (buffer.length > 3) {
          onScan(buffer.join(''));
        }
        buffer = [];
      } else if (e.key.length === 1) { // Ignore special keys like Shift, Ctrl, etc.
        buffer.push(e.key);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan]);
};
