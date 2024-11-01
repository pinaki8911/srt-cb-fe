import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import {
  Record,
  Stop,
  UploadSimple,
  Camera,
  XCircle,
  Warning,
  File,
} from '@phosphor-icons/react';
import { useReport } from '../context/ReportContext';

// Constants for video constraints
const VIDEO_CONSTRAINTS = {
  MAX_DURATION_SECONDS: 30,
  MAX_FILE_SIZE_MB: 50,
  ACCEPTED_TYPES: ['video/mp4', 'video/webm', 'video/quicktime'],
};

// Updated Alert Component
const Alert = ({ children, variant = 'default' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800 border-gray-300',
    destructive: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    success: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-4 ${variants[variant]}`}
    >
      {children}
    </div>
  );
};

const VideoRecorder = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  console.log(apiUrl);
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { setReportData } = useReport();

  // New state for recording timer and file upload
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingInterval, setRecordingIntervalId] = useState(null);
  const fileInputRef = useRef(null);

  // Clean up recording timer
  useEffect(() => {
    return () => {
      if (recordingInterval) {
        clearInterval(recordingInterval);
      }
    };
  }, [recordingInterval]);

  const resetStates = () => {
    setRecordedChunks([]);
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setRecordingDuration(0);
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingIntervalId(null);
    }
  };

  const handleStartRecording = () => {
    try {
      resetStates();
      mediaRecorderRef.current = new MediaRecorder(webcamRef.current.stream, {
        mimeType: 'video/webm',
      });
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);

      // Start recording timer
      const intervalId = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS - 1) {
            handleStopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
      setRecordingIntervalId(intervalId);
    } catch (err) {
      setError(
        'Failed to start recording. Please check your camera permissions.'
      );
    }
  };

  const handleDataAvailable = ({ data }) => {
    if (data.size > 0) {
      setRecordedChunks((prev) => prev.concat(data));
    }
  };

  const handleStopRecording = () => {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingIntervalId(null);
    }
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setShowPreview(false);
    setRecordingDuration(0);
  };

  // File upload handling
  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!VIDEO_CONSTRAINTS.ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload a valid video file (MP4, WebM, or QuickTime)');
      return;
    }

    // Validate file size
    if (file.size > VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(
        `Video must be smaller than ${VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`
      );
      return;
    }

    // Validate duration
    try {
      const duration = await getVideoDuration(file);
      if (duration > VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS) {
        setError(
          `Video must be shorter than ${VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS} seconds`
        );
        return;
      }

      // Valid file - update state
      resetStates();
      setRecordedChunks([file]);
      setShowPreview(false);
      setError(null);
    } catch (err) {
      setError('Error validating video. Please try another file.');
    }
  };

  // Helper function to get video duration
  const getVideoDuration = (file) => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = reject;
      video.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async () => {
    if (!recordedChunks.length) return;
    setIsUploading(true);
    setError(null);

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const formData = new FormData();
    formData.append('video', blob);

    try {
      // Initial upload and analysis request
      const response = await fetch(`${apiUrl}/api/analyse`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('Initial API Response:', result);

      if (!result.success) {
        throw new Error(result.message || 'Failed to analyze video');
      }

      const reportId = result.reportId;

      // Poll for data until it's available
      let attempts = 0;
      const maxAttempts = 10;
      const pollInterval = 2000; // 2 seconds

      const getReportData = async () => {
        try {
          const dataResponse = await fetch(`${apiUrl}/api/report/${reportId}`);
          const reportData = await dataResponse.json();
          console.log('Polling response:', reportData);

          if (
            reportData.success &&
            reportData.data &&
            Object.keys(reportData.data).length > 0
          ) {
            // We have the complete data
            setReportData(reportData);
            setIsUploading(false);
            navigate(`/report/${reportId}`);
            return true;
          }
          return false;
        } catch (error) {
          console.error('Error polling for data:', error);
          return false;
        }
      };

      const pollForData = async () => {
        if (attempts >= maxAttempts) {
          throw new Error('Timeout waiting for analysis results');
        }

        const hasData = await getReportData();
        if (!hasData) {
          attempts++;
          setTimeout(pollForData, pollInterval);
        }
      };

      // Start polling
      await pollForData();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video. Please try again.');
      setIsUploading(false);
    }
  };

  const handleRetake = () => {
    setRecordedChunks([]);
    setShowPreview(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-4xl space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Record Your SRT Test
          </h2>
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700"
          >
            <XCircle size={24} weight="duotone" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <Warning size={20} className="text-red-800" />
            <span>{error}</span>
          </Alert>
        )}

        {/* Recording Timer */}
        {isRecording && (
          <div className="text-center text-lg font-semibold text-red-500">
            Recording: {recordingDuration}s /{' '}
            {VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS}s
          </div>
        )}

        {/* Video Preview */}
        <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-inner">
          {showPreview ? (
            <Webcam
              ref={webcamRef}
              className="h-full w-full object-cover"
              mirrored
              audio={false}
            />
          ) : (
            <video
              className="h-full w-full object-cover"
              src={URL.createObjectURL(
                new Blob(recordedChunks, { type: 'video/webm' })
              )}
              controls
            />
          )}

          {!webcamRef.current && !recordedChunks.length && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Camera size={48} weight="duotone" className="text-gray-400" />
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50">
              <div className="mb-2 text-white">Analyzing Video...</div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4">
          {showPreview ? (
            <div className="flex space-x-4">
              <button
                onClick={
                  isRecording ? handleStopRecording : handleStartRecording
                }
                className={`${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                } flex items-center space-x-2 rounded-full p-4 text-white transition-colors`}
              >
                {isRecording ? (
                  <>
                    <Stop size={24} weight="fill" />
                    <span className="px-2">Stop Recording</span>
                  </>
                ) : (
                  <>
                    <Record size={24} weight="fill" />
                    <span className="px-2">Start Recording</span>
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 rounded-full bg-gray-500 px-6 py-3 text-white transition-colors hover:bg-gray-600"
                disabled={isRecording}
              >
                <File size={20} weight="bold" />
                <span>Upload Video</span>
              </button>
            </div>
          ) : (
            <div className="flex space-x-4">
              <button
                onClick={handleRetake}
                className="flex items-center space-x-2 rounded-full bg-gray-500 px-6 py-3 text-white transition-colors hover:bg-gray-600"
                disabled={isUploading}
              >
                <Camera size={20} weight="bold" />
                <span>Retake</span>
              </button>
              <button
                onClick={handleUpload}
                className="flex items-center space-x-2 rounded-full bg-green-500 px-6 py-3 text-white transition-colors hover:bg-green-600"
                disabled={isUploading}
              >
                <UploadSimple size={20} weight="bold" />
                <span>
                  {isUploading ? 'Analyzing...' : 'Upload and Analyze'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Instructions Panel */}
        <div className="mt-6 rounded-xl bg-blue-50 p-6">
          <h3 className="mb-3 font-semibold text-blue-900">
            Recording Instructions:
          </h3>
          <div className="grid gap-4 text-blue-800 md:grid-cols-2">
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Position yourself sideways to the camera</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Ensure your full body is visible</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>
                  Maximum video duration:{' '}
                  {VIDEO_CONSTRAINTS.MAX_DURATION_SECONDS} seconds
                </span>
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Find a well-lit space</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Clear the area around you</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span>
                  File size limit: {VIDEO_CONSTRAINTS.MAX_FILE_SIZE_MB}MB
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoRecorder;
