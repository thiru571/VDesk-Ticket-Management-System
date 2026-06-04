import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'default', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error:   (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
    info:    (msg) => addToast(msg, 'default'),
  };

  const icons = {
    success: (
      <svg className="flip-icon" viewBox="0 0 22 22" fill="none" width="22" height="22">
        <circle cx="11" cy="11" r="10" fill="#E1F5EE" stroke="#1D9E75" strokeWidth="1.5"/>
        <polyline className="tick-path" points="6,11.5 9.5,15 16,8"
          stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    error:   <span>❌</span>,
    warning: <span>⚠️</span>,
    default: <span>ℹ️</span>,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast-icon">{icons[t.type]}</div>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);