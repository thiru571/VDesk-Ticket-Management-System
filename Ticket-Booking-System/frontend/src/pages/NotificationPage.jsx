import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../services/ticketService';

export default function NotificationPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationService
      .getAll({ limit: 50 })
      .then((res) => {
        setNotifications(res.data.notifications || []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        isRead: true
      }))
    );
  };

  const handleNotificationClick = (notification) => {
    // Mark notification as read in UI
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notification._id
          ? { ...n, isRead: true }
          : n
      )
    );

    // Navigate to ticket/page
    if (notification.link || notification.ticket) {
      navigate(
        notification.link || `/tickets/${notification.ticket}`
      );
    }
  };

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}
      >
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            margin: 0
          }}
        >
          <Bell size={28} />
          Notifications
        </h2>

        <button
          onClick={markAllRead}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            background: '#1F4E79',
            color: '#fff',
            fontWeight: '600'
          }}
        >
          Mark All Read
        </button>
      </div>

      {/* Notification List */}
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #E5E7EB',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
        }}
      >
        {loading ? (
          <div
            style={{
              padding: '40px',
              textAlign: 'center'
            }}
          >
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              padding: '50px',
              textAlign: 'center',
              color: '#6B7280'
            }}
          >
            No notifications found
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => handleNotificationClick(n)}
              style={{
                padding: '18px',
                display: 'flex',
                gap: '15px',
                cursor: 'pointer',
                borderBottom: '1px solid #E5E7EB',
                transition: '0.2s',

                // Seen / Unseen styling
                background: n.isRead
                  ? '#F9FAFB'
                  : '#EFF6FF',

                opacity: n.isRead ? 0.8 : 1,

                borderLeft: n.isRead
                  ? '4px solid #D1D5DB'
                  : '4px solid #2563EB'
              }}
            >
              {/* Notification Icon */}
              <div
                style={{
                  fontSize: '22px',
                  display: 'flex',
                  alignItems: 'flex-start'
                }}
              >
                {n.isRead ? '✓' : '🔔'}
              </div>

              <div style={{ flex: 1 }}>
                {/* Seen / Unseen Badge */}
                <div
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '700',
                    marginBottom: '8px',
                    background: n.isRead
                      ? '#E5E7EB'
                      : '#DBEAFE',
                    color: n.isRead
                      ? '#4B5563'
                      : '#1D4ED8'
                  }}
                >
                  {n.isRead ? '✓ Seen' : '🔵 Unseen'}
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: n.isRead ? '500' : '700',
                    color: '#111827',
                    marginBottom: '4px'
                  }}
                >
                  {n.title}
                </div>

                {/* Message */}
                <div
                  style={{
                    fontSize: '14px',
                    color: '#4B5563',
                    lineHeight: '1.5'
                  }}
                >
                  {n.message}
                </div>

                {/* Date */}
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#9CA3AF'
                  }}
                >
                  {n.createdAt
                    ? new Date(n.createdAt).toLocaleString()
                    : 'Just now'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}