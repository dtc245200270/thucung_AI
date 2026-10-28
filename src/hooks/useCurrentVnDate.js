import { useState, useEffect } from 'react';
import { getTodayVnDate, subscribeVnDateChange } from '../utils/dateUtils';

/**
 * Hook chuẩn dùng chung cập nhật ngày Việt Nam khi qua nửa đêm (Midnight Rollover)
 * Tự động đăng ký và dọn dẹp listener sạch sẽ khi component unmount.
 * @returns {string} todayVn (YYYY-MM-DD)
 */
export function useCurrentVnDate() {
  const [todayVn, setTodayVn] = useState(() => getTodayVnDate());

  useEffect(() => {
    // Luôn đồng bộ ngày mới nhất khi mount
    setTodayVn(getTodayVnDate());

    // Đăng ký nhận thông báo thay đổi ngày (qua 00:00 hoặc tick clock)
    const unsubscribe = subscribeVnDateChange((newDate) => {
      setTodayVn(newDate);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return todayVn;
}
