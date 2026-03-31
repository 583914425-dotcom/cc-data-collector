import React, { useEffect, useRef, useState } from 'react';
import { Niivue } from '@niivue/niivue';
import { X, Maximize2, Minimize2, Loader2 } from 'lucide-react';

interface ImageViewerModalProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ url, filename, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const nv = new Niivue({
      dragAndDropEnabled: false,
      backColor: [0, 0, 0, 1],
    });

    nv.attachToCanvas(canvasRef.current);

    const loadVolume = async () => {
      try {
        setLoading(true);
        setError(null);
        await nv.loadVolumes([{ url, name: filename }]);
      } catch (err: any) {
        console.error("Error loading volume:", err);
        setError(err.message || "无法加载影像文件");
      } finally {
        setLoading(false);
      }
    };

    loadVolume();

    return () => {
      // Cleanup if needed
    };
  }, [url, filename]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div 
        ref={containerRef}
        className={`bg-gray-900 rounded-xl overflow-hidden flex flex-col shadow-2xl border border-gray-800 ${
          isFullscreen ? 'w-full h-full rounded-none border-none' : 'w-full max-w-5xl h-[80vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-950 border-b border-gray-800">
          <h3 className="text-white font-medium truncate pr-4">{filename}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="flex-1 relative bg-black">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-300">正在加载影像数据...</p>
              <p className="text-gray-500 text-sm mt-2">文件较大时可能需要一些时间</p>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10 p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-400 font-medium mb-2">加载失败</p>
              <p className="text-gray-400 text-sm max-w-md">{error}</p>
            </div>
          )}

          <canvas ref={canvasRef} className="w-full h-full outline-none" />
          
          {/* Controls Hint */}
          {!loading && !error && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none">
              <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs text-gray-300">
                左键拖动: 调整窗宽窗位 | 右键拖动: 平移 | 滚轮: 缩放/切片
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
