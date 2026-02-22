import React from 'react';
import { AlertCircle, CheckCircle, HelpCircle, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode;
}

interface ConfirmModalProps extends ModalProps {
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const AlertModal: React.FC<ModalProps & { type?: 'error' | 'success' | 'info' }> = ({ 
  isOpen, onClose, title, message, type = 'error' 
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch(type) {
      case 'error': return <AlertCircle className="h-10 w-10 text-red-500" />;
      case 'success': return <CheckCircle className="h-10 w-10 text-green-500" />;
      default: return <AlertCircle className="h-10 w-10 text-blue-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative transform transition-all scale-100">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 p-3 rounded-full ${type === 'error' ? 'bg-red-50' : type === 'success' ? 'bg-green-50' : 'bg-blue-50'}`}>
            {getIcon()}
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <div className="text-gray-500 mb-6">{message}</div>
          
          <button 
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isDestructive = false 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 relative">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 p-3 rounded-full ${isDestructive ? 'bg-red-50' : 'bg-yellow-50'}`}>
            {isDestructive ? (
               <AlertTriangle className="h-10 w-10 text-red-500" />
            ) : (
               <HelpCircle className="h-10 w-10 text-yellow-500" />
            )}
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <div className="text-gray-500 mb-6">{message}</div>
          
          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => { onConfirm(); onClose(); }}
              className={`flex-1 py-2.5 px-4 text-white font-medium rounded-lg transition-colors shadow-sm ${
                isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
