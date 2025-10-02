import React, { useState, useEffect } from 'react';
import { X, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { isMobileDevice, hasCameraSupport, getDeviceOrientation } from '../lib/deviceDetection';

const ScanModal = ({ isOpen, onClose, onScanSuccess, onScanError }) => {
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [orientation, setOrientation] = useState('portrait');

  // Update orientation when device orientation changes
  useEffect(() => {
    const updateOrientation = () => setOrientation(getDeviceOrientation());

    updateOrientation(); // Initial check
    window.addEventListener('orientationchange', updateOrientation);

    return () => window.removeEventListener('orientationchange', updateOrientation);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setScanResult('');
      setError('');
      setIsScanning(true);
      setHasPermission(null);
    } else {
      setIsScanning(false);
    }
  }, [isOpen]);

  // Check camera permissions
  useEffect(() => {
    if (isOpen && isMobileDevice() && hasCameraSupport()) {
      checkCameraPermission();
    }
  }, [isOpen]);

  const checkCameraPermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' });
      setHasPermission(permissionStatus.state === 'granted');

      if (permissionStatus.state === 'denied') {
        setError('Camera permission denied. Please enable camera access in your browser settings.');
        return;
      }
    } catch (err) {
      // Permissions API not supported, assume we need to request
      setHasPermission(null);
    }
  };

  const handleScanResult = (err, result) => {
    if (result) {
      setScanResult(result.text);
      setIsScanning(false);

      // Parse the scanned result to extract internal_product_code
      const parsedCode = parseScannedCode(result.text);

      if (parsedCode) {
        onScanSuccess(parsedCode, result.text);
      } else {
        setError('Invalid product code format. Expected format: [8-digit prefix]JI4ACO-GCAS17BK04');
        onScanError && onScanError('Invalid format');
      }
    }

    if (err && err.name !== 'NotAllowedError') {
      setError('Scanning error occurred. Please try again.');
      onScanError && onScanError(err.message);
    }
  };

  const parseScannedCode = (scannedText) => {
    if (!scannedText || typeof scannedText !== 'string') {
      return null;
    }

    // Pattern 1: 8-digit prefix + internal code (e.g., "25000100JI4ACO-GCAS17BK04")
    const pattern1 = /^(\d{8})([A-Z0-9\-]+)$/;

    // Pattern 2: Just internal code (e.g., "JI4ACO-GCAS17BK04")
    const pattern2 = /^([A-Z0-9\-]+)$/;

    let match = scannedText.match(pattern1);
    if (match) {
      // Return only the internal product code part (without 8-digit prefix)
      return match[2];
    }

    match = scannedText.match(pattern2);
    if (match) {
      // Return the full internal product code
      return match[1];
    }

    return null;
  };

  const handleClose = () => {
    setIsScanning(false);
    setScanResult('');
    setError('');
    onClose();
  };

  const handleRetry = () => {
    setScanResult('');
    setError('');
    setIsScanning(true);
  };

  if (!isOpen) return null;

  const isMobile = isMobileDevice();
  const hasCamera = hasCameraSupport();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg w-full max-w-md ${orientation === 'landscape' ? 'max-h-96' : 'max-h-[90vh]'}`}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Scan Product Code
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {!isMobile ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Scanning is only available on mobile devices</p>
              <p className="text-sm text-gray-500">Please use a mobile device or tablet to scan product codes</p>
            </div>
          ) : !hasCamera ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Camera not supported</p>
              <p className="text-sm text-gray-500">Your device doesn't support camera access</p>
            </div>
          ) : hasPermission === false ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Camera permission required</p>
              <p className="text-sm text-gray-500 mb-4">
                Please allow camera access to scan product codes
              </p>
              <button
                onClick={checkCameraPermission}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Request Permission
              </button>
            </div>
          ) : isScanning ? (
            <div className="space-y-4">
              {/* Scanning instructions */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Point your camera at the product code
                </p>
                <p className="text-xs text-gray-500">
                  Supports formats: JI4ACO-GCAS17BK04 or 25000100JI4ACO-GCAS17BK04
                </p>
              </div>

              {/* Scanner component */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                <BarcodeScannerComponent
                  width="100%"
                  height="100%"
                  onUpdate={handleScanResult}
                  facingMode="environment" // Use back camera on mobile
                />

                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-24 border-2 border-white border-dashed rounded-lg opacity-50"></div>
                </div>
              </div>

              {/* Loading indicator */}
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            </div>
          ) : scanResult ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Product code scanned successfully!</p>
              <p className="text-sm font-mono bg-gray-100 p-2 rounded mb-4 break-all">
                {scanResult}
              </p>
              <div className="space-x-2">
                <button
                  onClick={handleRetry}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Scan Again
                </button>
                <button
                  onClick={handleClose}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Scan Error</p>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <div className="space-x-2">
                <button
                  onClick={handleRetry}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ScanModal;