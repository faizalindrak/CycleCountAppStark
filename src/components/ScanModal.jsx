import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { isMobileDevice, hasCameraSupport, getDeviceOrientation } from '../lib/deviceDetection';

const ScanModal = ({ isOpen, onClose, onScanSuccess, onScanError }) => {
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [orientation, setOrientation] = useState('portrait');

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

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
      stopScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  // Check camera permissions and start scanning
  useEffect(() => {
    if (isOpen && isMobileDevice() && hasCameraSupport()) {
      startScanning();
    }
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError('');
      setIsScanning(true);

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // Initialize ZXing scanner
        const codeReader = new BrowserMultiFormatReader();
        codeReaderRef.current = codeReader;

        // Start continuous scanning
        const result = await codeReader.decodeOnceFromStream(stream, videoRef.current);

        if (result) {
          handleScanSuccess(result);
        }
      }
    } catch (err) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access to scan product codes.');
        setHasPermission(false);
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Unable to access camera. Please check camera permissions.');
      }
      setIsScanning(false);
      onScanError && onScanError(err.message);
    }
  };

  const stopScanning = () => {
    setIsScanning(false);

    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
      codeReaderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleScanSuccess = (result) => {
    const scannedText = result.text;
    setScanResult(scannedText);
    setIsScanning(false);
    stopScanning();

    // Parse the scanned result to extract internal_product_code
    const parsedCode = parseScannedCode(scannedText);

    if (parsedCode) {
      onScanSuccess(parsedCode, scannedText);
    } else {
      setError('Invalid product code format. Expected format: [8-digit prefix]JI4ACO-GCAS17BK04');
      onScanError && onScanError('Invalid format');
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
    stopScanning();
    setScanResult('');
    setError('');
    onClose();
  };

  const handleRetry = () => {
    setScanResult('');
    setError('');
    startScanning();
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
                onClick={startScanning}
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

              {/* Camera viewfinder */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-24 border-2 border-white border-dashed rounded-lg opacity-50"></div>
                </div>

                {/* Scanning indicator */}
                <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
                  Scanning...
                </div>
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