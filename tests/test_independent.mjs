import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execFileSync } from 'child_process';

const BASE_URL = 'http://localhost:5000/api';
const DATA_DIR = path.resolve('server/data');

console.log('================================================================');
console.log('🧪 BẮT ĐẦU BỘ KIỂM THỬ ĐỘC LẬP: LỖI GHI, HỢP ĐỒNG ĐỒNG BỘ & CACHE');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function pass(name) {
  console.log(`  ✅ [PASS] ${name}`);
  totalPassed++;
}

function fail(name, err) {
  console.error(`  ❌ [FAIL] ${name}:`, err);
  totalFailed++;
}

async function runAll() {
  const initialAppSnapshot = fs.existsSync(path.join(DATA_DIR, 'appointments.json')) ? fs.readFileSync(path.join(DATA_DIR, 'appointments.json'), 'utf8') : null;
  const initialMedSnapshot = fs.existsSync(path.join(DATA_DIR, 'medical_records.json')) ? fs.readFileSync(path.join(DATA_DIR, 'medical_records.json'), 'utf8') : null;

  try {
  // --------------------------------------------------------------------------
  // PHẦN 1: CHẠY BỘ KIỂM THỬ ĐỘC LẬP ĐÃ CÓ (8 CA KIỂM THỬ TRONG scratch/test_regression_part2.mjs)
  // --------------------------------------------------------------------------
  console.log('--- PHẦN 1: CHẠY BỘ KIỂM THỬ ĐỘC LẬP ĐÃ CÓ (8 CA BẮT BUỘC) ---');
  try {
    const out = execFileSync('node', ['scratch/test_regression_part2.mjs'], {
      encoding: 'utf8',
      cwd: process.cwd()
    });
    console.log(out.trim());
    pass('8 Ca kiểm thử độc lập đã có vượt qua 100%');
  } catch (err) {
    fail('Bộ kiểm thử độc lập đã có (scratch/test_regression_part2.mjs) thất bại', err.stdout || err.message);
  }

  // --------------------------------------------------------------------------
  // PHẦN 2: XÁC MINH LỖI GHI CÓ KIỂM SOÁT TẠI WRITE/RENAME TRONG FIXTURE
  // --------------------------------------------------------------------------
  console.log('\n--- PHẦN 2: XÁC MINH LỖI GHI CÓ KIỂM SOÁT TẠI LỚP LƯU (FIXTURE TEST) ---');
  const dh = await import('../server/dataHandler.js');
  const medPath = path.join(DATA_DIR, 'medical_records.json');
  const appPath = path.join(DATA_DIR, 'appointments.json');

  // Đọc snapshot ban đầu
  const medOriginal = fs.readFileSync(medPath, 'utf8');
  const appOriginal = fs.readFileSync(appPath, 'utf8');

  // 2.1: Gây lỗi có kiểm soát tại File 1 (medical_records.json)
  console.log('\n[2.1] Gây lỗi có kiểm soát tại File 1 (fs.writeFileSync: medical_records.json)...');
  const origWrite = fs.writeFileSync;
  try {
    let interceptedFile1 = false;
    fs.writeFileSync = function(filePath, data, options) {
      const normalizedPath = String(filePath).replace(/\\/g, '/');
      if (normalizedPath.includes('medical_records.json')) {
        interceptedFile1 = true;
        const err = new Error('EACCES: permission denied, write');
        err.code = 'EACCES';
        err.syscall = 'write';
        err.path = filePath;
        console.log(`  -> [FIXTURE INJECTION] Thao tác thất bại: fs.writeFileSync('${path.basename(filePath)}'), Syscall: ${err.syscall}, Mã lỗi: ${err.code}`);
        throw err;
      }
      return origWrite.call(fs, filePath, data, options);
    };

    const targetRecord1 = { id: `rec-err1-${Date.now()}`, test: true };
    const targetApp1 = { id: `app-err1-${Date.now()}`, status: 'completed' };
    const ops1 = [
      { collection: 'medical_records', data: [...JSON.parse(medOriginal), targetRecord1] },
      { collection: 'appointments', data: [...JSON.parse(appOriginal), targetApp1] }
    ];

    const result1 = dh.saveMultipleCollections(ops1);
    assert.strictEqual(result1, false, 'saveMultipleCollections phải trả về false khi File 1 gặp lỗi');
    assert.strictEqual(interceptedFile1, true, 'Interceptor phải bắt đúng lệnh ghi File 1');

    // Đối chiếu file trên đĩa trước và sau
    const medAfter1 = fs.readFileSync(medPath, 'utf8');
    const appAfter1 = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(medAfter1, medOriginal, 'medical_records.json trên đĩa phải giữ nguyên 100% snapshot ban đầu');
    assert.strictEqual(appAfter1, appOriginal, 'appointments.json trên đĩa không được ghi dữ liệu một phần');
    pass('2.1: Lỗi ghi tại File 1 (EACCES/write) được ngăn chặn, zero partial update');
  } finally {
    fs.writeFileSync = origWrite;
  }

  // 2.2: Gây lỗi có kiểm soát tại File 2 (appointments.json) và CHỨNG MINH File 1 đã cập nhật trên đĩa trước khi rollback
  console.log('\n[2.2] Gây lỗi có kiểm soát tại File 2 và chứng minh File 1 đã cập nhật trên đĩa trước khi rollback...');
  try {
    let interceptedFile2 = false;
    let file1VerifiedOnDiskBeforeRollback = false;
    const testRecordId = `rec-err2-proven-${Date.now()}`;
    const targetRecord2 = { id: testRecordId, soap: { subjective: 'Triệu chứng kiểm thử rollback đĩa thật' } };
    const targetApp2 = { id: `app-err2-${Date.now()}`, status: 'completed' };

    fs.writeFileSync = function(filePath, data, options) {
      const normalizedPath = String(filePath).replace(/\\/g, '/');

      // Khi đến lượt ghi File 2 (appointments.json)
      if (normalizedPath.includes('appointments.json')) {
        interceptedFile2 = true;

        // BƯỚC QUAN TRỌNG: Đọc trực tiếp medical_records.json từ filesystem để CHỨNG MINH
        // rằng File 1 thực sự đã được ghi đĩa thành công với dữ liệu mới trước khi File 2 thất bại!
        const currentMedOnDisk = fs.readFileSync(medPath, 'utf8');
        const parsedCurrentMed = JSON.parse(currentMedOnDisk);
        const hasNewRecord = parsedCurrentMed.some(r => r.id === testRecordId);
        
        if (hasNewRecord) {
          file1VerifiedOnDiskBeforeRollback = true;
          console.log(`  -> [XÁC MINH TRỰC TIẾP TRÊN ĐĨA]: File 1 (medical_records.json) ĐÃ ĐƯỢC CẬP NHẬT THÀNH CÔNG trước khi File 2 ghi!`);
          console.log(`     Bản ghi mới tìm thấy trên đĩa: id="${testRecordId}"`);
        }

        // Sau đó ném lỗi hệ thống thực sự tại syscall write
        const err = new Error('EIO: i/o error, write');
        err.code = 'EIO';
        err.syscall = 'write';
        err.path = filePath;
        console.log(`  -> [FIXTURE INJECTION] Thao tác thất bại: fs.writeFileSync('${path.basename(filePath)}'), Syscall: ${err.syscall}, Mã lỗi: ${err.code}`);
        throw err;
      }

      // Cho phép File 1 ghi bình thường vào đĩa để có thể kiểm chứng
      return origWrite.call(fs, filePath, data, options);
    };

    const ops2 = [
      { collection: 'medical_records', data: [...JSON.parse(medOriginal), targetRecord2] },
      { collection: 'appointments', data: [...JSON.parse(appOriginal), targetApp2] }
    ];

    const result2 = dh.saveMultipleCollections(ops2);
    assert.strictEqual(result2, false, 'saveMultipleCollections phải trả về false khi File 2 lỗi');
    assert.strictEqual(interceptedFile2, true, 'Interceptor phải bắt đúng lệnh ghi File 2');
    assert.strictEqual(file1VerifiedOnDiskBeforeRollback, true, 'BẮT BUỘC chứng minh File 1 đã cập nhật trên đĩa TRƯỚC KHI rollback');

    // Sau khi saveMultipleCollections hoàn tất việc rollback, đối chiếu lại toàn bộ file trên đĩa
    const medAfter2 = fs.readFileSync(medPath, 'utf8');
    const appAfter2 = fs.readFileSync(appPath, 'utf8');
    assert.strictEqual(medAfter2, medOriginal, 'medical_records.json phải được rollback hoàn nguyên 100% về snapshot ban đầu');
    assert.strictEqual(appAfter2, appOriginal, 'appointments.json giữ nguyên snapshot ban đầu');
    pass('2.2: Chứng minh File 1 cập nhật trước khi rollback + Đối chiếu đĩa trước/sau hoàn nguyên 100%');
  } finally {
    fs.writeFileSync = origWrite;
    // Đảm bảo dữ liệu ban đầu được giữ nguyên vẹn
    fs.writeFileSync(medPath, medOriginal, 'utf8');
    fs.writeFileSync(appPath, appOriginal, 'utf8');
  }

  // --------------------------------------------------------------------------
  // PHẦN 3: KIỂM TRA HỢP ĐỒNG ĐỒNG BỘ (SYNC CONTRACT)
  // --------------------------------------------------------------------------
  console.log('\n--- PHẦN 3: KIỂM TRA HỢP ĐỒNG ĐỒNG BỘ (SYNC CONTRACT) ---');

  // Cài đặt môi trường mock cho localStorage & window
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (key) => storageMap.has(key) ? storageMap.get(key) : null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  };
  globalThis.window = {
    dispatchEvent: () => true
  };

  const apiService = await import('../src/services/apiService.js');
  const storageService = await import('../src/services/storageService.js');

  // 3.1: syncAllDataToCache khi thiếu token phải trả về 'skipped' (không trả về true)
  storageMap.clear();
  const syncNoToken = await apiService.syncAllDataToCache();
  assert.strictEqual(syncNoToken, 'skipped', "syncAllDataToCache phải trả về 'skipped' khi không có token");
  assert.notStrictEqual(syncNoToken, true, "syncAllDataToCache KHÔNG ĐƯỢC trả về true khi bỏ qua đồng bộ vì thiếu token");
  pass("3.1: syncAllDataToCache trả về 'skipped' khi thiếu token (phân biệt rõ ràng với thành công)");

  // 3.2: finalizeEhrAndAppointment khi syncAllDataToCache trả về false -> trả về syncWarning: true
  // Mock fetch cho apiFetch
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options = {}) => {
      // Mock /api/medical-records/finalize-ehr thành công
      if (String(url).includes('/finalize-ehr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              medicalRecord: { id: 'rec-test-sync', status: 'final' },
              appointment: { id: 'app-test-sync', status: 'completed' }
            }
          })
        };
      }
      // Giả lập lỗi đồng bộ khi gọi các collection
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Sync failed' })
      };
    };

    // Đặt token giả
    storageMap.set('petcare_token', 'mock_token_123');

    const resFalse = await storageService.finalizeEhrAndAppointment({
      appointmentId: 'app-test-sync',
      petId: 'pet-test-sync',
      soap: { subjective: 'Test sync failure' }
    });

    assert.strictEqual(resFalse.success, true, 'Backend finalize thành công thì res.success phải là true');
    assert.strictEqual(resFalse.syncWarning, true, 'Khi syncAllDataToCache trả false, finalizeEhrAndAppointment phải trả syncWarning: true');
    pass('3.2: syncAllDataToCache trả false -> finalizeEhrAndAppointment trả syncWarning: true');

    // 3.3: finalizeEhrAndAppointment khi syncAllDataToCache ném exception -> trả về syncWarning: true
    // Giả lập fetch ném Network Error
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes('/finalize-ehr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              medicalRecord: { id: 'rec-test-sync-2', status: 'final' },
              appointment: { id: 'app-test-sync-2', status: 'completed' }
            }
          })
        };
      }
      throw new Error('Network Connection Dropped');
    };

    const resException = await storageService.finalizeEhrAndAppointment({
      appointmentId: 'app-test-sync-2',
      petId: 'pet-test-sync-2',
      soap: { subjective: 'Test sync exception' }
    });

    assert.strictEqual(resException.success, true, 'Backend finalize thành công thì không báo chốt bệnh án thất bại');
    assert.strictEqual(resException.syncWarning, true, 'Khi syncAllDataToCache ném exception, finalizeEhrAndAppointment phải trả syncWarning: true');
    pass('3.3: syncAllDataToCache ném exception -> finalizeEhrAndAppointment trả syncWarning: true');

    // 3.4: finalizeEhrAndAppointment khi không có token (syncAllDataToCache trả 'skipped') -> syncWarning: true
    storageMap.clear(); // Xóa token
    globalThis.fetch = async (url) => {
      if (String(url).includes('/finalize-ehr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { medicalRecord: { id: 'rec-test-3' }, appointment: { id: 'app-test-3' } }
          })
        };
      }
      return { ok: true, json: async () => [] };
    };

    const resSkipped = await storageService.finalizeEhrAndAppointment({
      appointmentId: 'app-test-3',
      petId: 'pet-test-3',
      soap: { subjective: 'Test skipped token' }
    });
    assert.strictEqual(resSkipped.syncWarning, true, "Khi syncAllDataToCache trả về 'skipped', syncWarning phải là true");
    pass("3.4: syncAllDataToCache trả về 'skipped' -> finalizeEhrAndAppointment trả syncWarning: true");

    // 3.5: finalizeEhrAndAppointment khi syncAllDataToCache thành công (trả true) -> syncWarning: false
    storageMap.set('petcare_token', 'valid_token');
    globalThis.fetch = async (url) => {
      if (String(url).includes('/finalize-ehr')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { medicalRecord: { id: 'rec-test-ok' }, appointment: { id: 'app-test-ok' } }
          })
        };
      }
      // Tất cả collections trả về mảng rỗng thành công
      return {
        ok: true,
        status: 200,
        json: async () => []
      };
    };

    const resSuccess = await storageService.finalizeEhrAndAppointment({
      appointmentId: 'app-test-ok',
      petId: 'pet-test-ok',
      soap: { subjective: 'Test sync success' }
    });
    assert.strictEqual(resSuccess.success, true);
    assert.strictEqual(resSuccess.syncWarning, false, 'Khi syncAllDataToCache thành công, syncWarning phải là false');
    pass('3.5: syncAllDataToCache thành công -> finalizeEhrAndAppointment trả syncWarning: false');

    // 3.6: Kiểm tra giao diện ClinicOsView.jsx không bao giờ báo chốt thất bại khi backend đã lưu thành công
    const clinicOsCode = fs.readFileSync('src/components/clinic/ClinicOsView.jsx', 'utf8');
    assert(
      clinicOsCode.includes('finalizeRes?.syncWarning'),
      'ClinicOsView.jsx phải kiểm tra syncWarning'
    );
    assert(
      clinicOsCode.includes('Bệnh án và lịch khám đã được lưu thành công trên máy chủ!'),
      'ClinicOsView.jsx phải thông báo máy chủ lưu thành công khi có syncWarning thay vì báo thất bại'
    );
    pass('3.6: ClinicOsView.jsx thông báo lưu máy chủ thành công, không báo chốt thất bại');
  } finally {
    globalThis.fetch = origFetch;
  }

  // --------------------------------------------------------------------------
  // PHẦN 4: SAU LOGOUT KHÔNG HIỂN THỊ CACHE & REQUEST ĐANG CHẠY ĐƯỢC BẢO VỆ
  // --------------------------------------------------------------------------
  console.log('\n--- PHẦN 4: LOGOUT & BẢO VỆ REQUEST ĐANG CHẠY KHI ĐĂNG XUẤT ---');
  const authService = await import('../src/services/authService.js');

  // 4.1: Sau logout, không lưu danh sách tài khoản hay dữ liệu riêng trong localStorage
  storageMap.clear();
  storageMap.set(authService.AUTH_STORAGE_KEYS.USERS, JSON.stringify([{ id: 'u1', name: 'User 1' }]));
  storageMap.set('petcare_pets_v1', JSON.stringify([{ id: 'p1', name: 'Miu Miu' }]));
  storageMap.set('petcare_medical_records_v1', JSON.stringify([{ id: 'm1' }]));
  storageMap.set('petcare_appointments_v1', JSON.stringify([{ id: 'a1' }]));
  storageMap.set('petcare_active_appointments', JSON.stringify([{ id: 'a1' }]));
  storageMap.set('petcare_token', 'token_to_remove');
  storageMap.set('petcare_auth_token', 'token_to_remove');

  authService.logout();

  assert.strictEqual(storageMap.has(authService.AUTH_STORAGE_KEYS.USERS), false, 'AUTH_STORAGE_KEYS.USERS phải bị xóa hoàn toàn khỏi localStorage');
  assert.strictEqual(storageMap.has('petcare_pets_v1'), false, 'petcare_pets_v1 phải bị xóa hoàn toàn');
  assert.strictEqual(storageMap.has('petcare_medical_records_v1'), false, 'petcare_medical_records_v1 phải bị xóa hoàn toàn');
  assert.strictEqual(storageMap.has('petcare_appointments_v1'), false, 'petcare_appointments_v1 phải bị xóa hoàn toàn');
  assert.strictEqual(storageMap.has('petcare_active_appointments'), false, 'petcare_active_appointments phải bị xóa hoàn toàn');
  assert.strictEqual(storageMap.has('petcare_token'), false, 'petcare_token phải bị xóa');
  assert.strictEqual(storageMap.has('petcare_auth_token'), false, 'petcare_auth_token phải bị xóa');
  pass('4.1: Sau logout, localStorage được dọn sạch hoàn toàn, không rò rỉ danh sách tài khoản hay dữ liệu');

  // 4.2: Request syncAllDataToCache đang chạy khi logout phải bị hủy bỏ an toàn, không ghi vào localStorage
  storageMap.clear();
  storageMap.set('petcare_token', 'active_token_123');

  let delayResolve;
  globalThis.fetch = () => new Promise(res => {
    delayResolve = () => res({
      ok: true,
      status: 200,
      json: async () => [{ id: 'leaked_pet', name: 'Dữ liệu rò rỉ nếu ghi vào cache' }]
    });
  });

  // Kích hoạt syncAllDataToCache
  const inFlightSyncPromise = apiService.syncAllDataToCache();

  // Người dùng bấm đăng xuất ngay trong lúc request đang bay
  authService.logout();

  // Request từ backend phản hồi sau khi đã đăng xuất
  delayResolve();
  const inFlightResult = await inFlightSyncPromise;

  assert.strictEqual(inFlightResult, 'skipped', "Request đang bay khi logout phải trả về 'skipped'");
  assert.strictEqual(storageMap.has('petcare_pets_v1'), false, 'Dữ liệu của request in-flight KHÔNG ĐƯỢC ghi lén vào localStorage sau logout');
  pass('4.2: Request syncAllDataToCache đang chạy khi logout bị hủy an toàn, không ghi lén vào cache');

  // 4.3: Request syncUsersWithBackend đang chạy khi logout không được trả về danh sách tài khoản
  storageMap.clear();
  storageMap.set('petcare_auth_token', 'active_token_admin');

  let delayUsersResolve;
  globalThis.fetch = () => new Promise(res => {
    delayUsersResolve = () => res({
      ok: true,
      status: 200,
      json: async () => [{ id: 'user_leak', name: 'Tài khoản nhạy cảm' }]
    });
  });

  const inFlightUsersPromise = authService.syncUsersWithBackend();
  authService.logout();
  delayUsersResolve();
  const inFlightUsersResult = await inFlightUsersPromise;

  assert.deepStrictEqual(inFlightUsersResult, [], 'syncUsersWithBackend phải trả về mảng rỗng [] khi phát hiện phiên đã kết thúc');
  assert.strictEqual(storageMap.has(authService.AUTH_STORAGE_KEYS.USERS), false, 'Danh sách users không được ghi vào cache sau khi đã đăng xuất');
  pass('4.3: Request syncUsersWithBackend đang chạy khi logout hủy an toàn, không rò rỉ danh sách user');

  // --------------------------------------------------------------------------
  // PHẦN 5: CHU TRÌNH ĐĂNG NHẬP LẠI ĐA VAI TRÒ (OWNER <-> VET) QUA API THẬT
  // --------------------------------------------------------------------------
  console.log('\n--- PHẦN 5: CHU TRÌNH ĐĂNG NHẬP LẠI ĐA VAI TRÒ (OWNER <-> VET) ---');
  globalThis.fetch = origFetch; // Khôi phục fetch thật đến backend server

  // Bước 5.1: Đăng nhập Chủ nuôi qua API thật
  const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@petcare.ai', password: 'Owner@123456' })
  });
  const ownerLoginData = await ownerLoginRes.json();
  assert.strictEqual(ownerLoginRes.status, 200, 'Chủ nuôi đăng nhập thành công');
  const ownerToken = ownerLoginData.token;
  const ownerUser = ownerLoginData.user;
  assert.strictEqual(ownerUser.role, 'pet_owner');

  // Đọc danh sách thú cưng của Chủ nuôi
  const ownerPetsRes = await fetch(`${BASE_URL}/data/pets`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const ownerPets = await ownerPetsRes.json();
  assert(Array.isArray(ownerPets), 'Chủ nuôi đọc được danh sách thú cưng');

  // Kiểm tra phân quyền: Chủ nuôi gọi /auth/users bị từ chối 403
  const ownerUsersRes = await fetch(`${BASE_URL}/auth/users`, {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  assert.strictEqual(ownerUsersRes.status, 403, 'Chủ nuôi bị từ chối truy cập danh sách người dùng toàn hệ thống (HTTP 403)');

  // Chủ nuôi đăng xuất
  authService.logout();
  assert.strictEqual(storageMap.has('petcare_token'), false);

  // Bước 5.2: Bác sĩ đăng nhập qua API thật
  const vetLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetLoginData = await vetLoginRes.json();
  assert.strictEqual(vetLoginRes.status, 200, 'Bác sĩ đăng nhập thành công');
  const vetToken = vetLoginData.token;
  const vetUser = vetLoginData.user;
  assert.strictEqual(vetUser.role, 'vet_doctor');

  // Bác sĩ đọc danh sách lịch khám
  const vetApptsRes = await fetch(`${BASE_URL}/data/appointments`, {
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  const vetAppts = await vetApptsRes.json();
  assert(Array.isArray(vetAppts), 'Bác sĩ đọc danh sách lịch khám thành công');

  // Kiểm tra phân quyền: Bác sĩ gọi /auth/users cũng bị từ chối 403
  const vetUsersRes = await fetch(`${BASE_URL}/auth/users`, {
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  assert.strictEqual(vetUsersRes.status, 403, 'Bác sĩ bị từ chối truy cập danh sách người dùng toàn hệ thống (HTTP 403)');

  // Bác sĩ đăng xuất
  authService.logout();

  // Bước 5.3: Chủ nuôi đăng nhập lại
  const ownerReloginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@petcare.ai', password: 'Owner@123456' })
  });
  const ownerReloginData = await ownerReloginRes.json();
  assert.strictEqual(ownerReloginRes.status, 200, 'Chủ nuôi đăng nhập lại thành công');
  assert.strictEqual(ownerReloginData.user.role, 'pet_owner');
  pass('5: Chu trình đăng nhập lại đa vai trò (Owner -> Logout -> Vet -> Logout -> Owner) cô lập dữ liệu 100%');

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TỔNG KẾT BỘ TEST ĐỘC LẬP: ${totalPassed} PASS, ${totalFailed} FAIL`);
  console.log('================================================================');
  if (totalFailed > 0) {
    process.exit(1);
  }
  } finally {
    // Dọn dẹp triệt để mọi test fixture phát sinh trong quá trình chạy test
    try {
      const appFile = path.join(DATA_DIR, 'appointments.json');
      if (fs.existsSync(appFile)) {
        const apps = JSON.parse(fs.readFileSync(appFile, 'utf8'));
        const cleaned = apps.filter(a => !String(a.id || '').startsWith('app-err'));
        if (cleaned.length !== apps.length) {
          fs.writeFileSync(appFile, JSON.stringify(cleaned, null, 2), 'utf8');
        }
      }
      const medFile = path.join(DATA_DIR, 'medical_records.json');
      if (fs.existsSync(medFile)) {
        const meds = JSON.parse(fs.readFileSync(medFile, 'utf8'));
        const cleanedMeds = meds.filter(m => !String(m.id || '').startsWith('rec-err'));
        if (cleanedMeds.length !== meds.length) {
          fs.writeFileSync(medFile, JSON.stringify(cleanedMeds, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.warn('Cảnh báo khi dọn dẹp fixture độc lập:', e.message);
    }
  }
}

runAll().catch(err => {
  console.error('\n❌ LỖI KHÔNG MONG ĐỢI TRONG BỘ TEST ĐỘC LẬP:', err);
  process.exit(1);
});
