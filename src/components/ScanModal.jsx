import React, { useState, useEffect, useRef } from 'react';
import { X, Camera, AlertCircle, CheckCircle } from 'lucide-react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  NotFoundException
} from '@zxing/library';
import { isMobileDevice, hasCameraSupport, getDeviceOrientation, isSecureContext } from '../lib/deviceDetection';

const ScanModal = ({ isOpen, onClose, onScanSuccess, onScanError }) => {
  const [scanResult, setScanResult] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [orientation, setOrientation] = useState('portrait');

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);

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
      setIsScanning(false);
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
    if (isOpen && isMobileDevice()) {
      if (hasCameraSupport()) {
        startScanning();
      } else {
        setError('Camera not supported on this device.');
        setIsScanning(false);
      }
    }
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError('');
      setIsScanning(true);
      setHasPermission(null); // Reset permission state

      // Check if running in secure context (HTTPS required for camera)
      if (!isSecureContext()) {
        setError('Camera requires HTTPS. Please access the application over a secure connection.');
        setIsScanning(false);
        return;
      }

      // Check if camera permissions are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device.');
        setIsScanning(false);
        return;
      }

      // Mobile-optimized camera constraints
      const videoConstraints = isMobileDevice() ? {
        facingMode: { exact: 'environment' }, // Use back camera on mobile
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        focusMode: 'continuous', // Better focus for scanning
        exposureMode: 'continuous', // Better exposure for scanning
        whiteBalanceMode: 'continuous' // Better white balance for scanning
      } : {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
      };

      // Request camera permission and stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            startFrameProcessing();
          }).catch(e => {
            console.error('Error playing video:', e);
            setError('Unable to start camera preview.');
            stopScanning();
          });
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setIsScanning(false);

      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
        setHasPermission(false);
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setError('Camera is already in use by another application.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Camera doesn\'t support the requested settings. Try refreshing the page.');
      } else if (err.name === 'SecurityError') {
        setError('Camera access blocked for security reasons. Please check site permissions.');
      } else if (err.name === 'AbortError') {
        setError('Camera access was interrupted. Please try again.');
      } else {
        setError(`Camera error: ${err.message || 'Unable to access camera.'}`);
      }
      onScanError && onScanError(err.message);
    }
  };

  const startFrameProcessing = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const reader = new MultiFormatReader();
    codeReaderRef.current = reader;

    // Configure hints for better mobile scanning
    const hints = new Map();
    const formats = [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const processFrame = () => {
      if (!isScanning || !videoRef.current) return;

      try {
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get image data for ZXing processing
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const luminanceSource = new RGBLuminanceSource(imageData.data, imageData.width, imageData.height);
        const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

        // Try to decode the barcode
        try {
          const result = reader.decode(binaryBitmap, hints);
          if (result) {
            handleScanSuccess(result);
            return;
          }
        } catch (decodeErr) {
          // NotFoundException is expected when no barcode is found
          if (decodeErr.name !== 'NotFoundException') {
            console.warn('Decode warning:', decodeErr);
            // For mobile devices, we might want to be less strict with warnings
            if (!isMobileDevice()) {
              console.warn('Decode warning:', decodeErr);
            }
          }
        }

        // Continue processing frames
        animationFrameRef.current = requestAnimationFrame(processFrame);
      } catch (err) {
        console.error('Frame processing error:', err);
        if (isScanning) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
        }
      }
    };

    // Start processing frames
    processFrame();
  };

  const stopScanning = () => {
    setIsScanning(false);

    // Stop animation frame processing
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

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
  const hasCamera = hasCameraSupport() && isSecureContext();

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
              <p className="text-gray-600 mb-2">
                {!isSecureContext() ? 'HTTPS Required' : 'Camera not supported'}
              </p>
              <p className="text-sm text-gray-500 mb-4">
                {!isSecureContext()
                  ? 'Camera access requires a secure connection (HTTPS). Please access the application over HTTPS.'
                  : 'Your device doesn\'t support camera access or the page is not served over HTTPS.'
                }
              </p>
              {!isSecureContext() && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                  <p className="font-medium">To enable camera access:</p>
                  <p>• Use HTTPS instead of HTTP</p>
                  <p>• Or access via localhost for development</p>
                </div>
              )}
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
          ) : hasPermission === null && !isScanning ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Ready to scan</p>
              <p className="text-sm text-gray-500 mb-4">
                Click the button below to start scanning
              </p>
              <button
                onClick={startScanning}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 flex items-center gap-2 mx-auto"
              >
                <Camera className="h-5 w-5" />
                Start Scanning
              </button>
            </div>
          ) : isScanning ? (
            <div className="space-y-4">
              {/* Scanning instructions */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  {isMobileDevice()
                    ? 'Point your camera at the product code and hold steady'
                    : 'Point your camera at the product code'
                  }
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  Supports formats: JI4ACO-GCAS17BK04 or 25000100JI4ACO-GCAS17BK04
                </p>
                {isMobileDevice() && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-800">
                    <p className="font-medium">Mobile Tips:</p>
                    <p>• Use the back camera for better quality</p>
                    <p>• Ensure good lighting</p>
                    <p>• Hold device steady</p>
                  </div>
                )}
              </div>

              {/* Camera viewfinder */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '300px' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Hidden canvas for frame processing */}
                <canvas
                  ref={canvasRef}
                  className="hidden"
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