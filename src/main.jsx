import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary'

// Dọn dẹp có chọn lọc các khóa PetCare liên quan đến dữ liệu demo/cache cũ trong trình duyệt
// Tuyệt đối không xóa toàn bộ localStorage của trình duyệt
(function cleanLegacyPetcareDemoStorage() {
  try {
    const CLEAN_KEY = 'petcare_system_cleaned_v1';
    if (typeof localStorage !== 'undefined' && localStorage.getItem(CLEAN_KEY) !== 'done') {
      const DEMO_STORAGE_KEYS = [
        'petcare_pets_v1',
        'petcare_schedules_v1',
        'petcare_expenses_v1',
        'petcare_daily_logs_v1',
        'petcare_prescriptions_v1',
        'petcare_appointments_v1',
        'petcare_medical_records_v1',
        'petcare_daily_habits_v1',
        'petcare_home_routines',
        'petcare_pets_health_data',
        'petcare_pets_health_v1',
        'petcare_weight_tracker_histories',
        'petcare_lost_modes_v1',
        'petcare_auth_users_v1',
        'petcare_auth_token',
        'petcare_auth_session_v1',
        'petcare_active_user',
        'petcare_current_user',
        'petcare_is_authenticated',
        'petcare_v2_migrated',
        'petcare_migration_v3_clean_mock'
      ];
      DEMO_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
      localStorage.setItem(CLEAN_KEY, 'done');
      console.log('[PetCare Clean] Đã dọn dẹp các khóa dữ liệu demo của PetCare.');
    }
  } catch (e) {
    console.warn('[PetCare Clean] Không thể dọn localStorage:', e);
  }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </GlobalErrorBoundary>
  </StrictMode>,
)

