import { spawnSync } from 'child_process';

console.log('========================================================================');
console.log('🚀 PETCARE PRO: RUNNER TỔNG HỢP TOÀN BỘ CÁC BỘ KIỂM THỬ (CŨ & MỚI)');
console.log('========================================================================\n');

const suites = [
  {
    id: 'REGRESSION_SUITE',
    name: 'Bộ Kiểm Thử Hồi Quy 10 Mục Hệ Thống (test_hardening_all.mjs)',
    command: 'node',
    args: ['scratch/test_hardening_all.mjs']
  },
  {
    id: 'INDEPENDENT_GROUP',
    name: 'Nhóm Kiểm Thử Độc Lập (8 ca đã có + Lỗi ghi Fixture + Hợp đồng Sync + Cache)',
    command: 'node',
    args: ['tests/test_independent.mjs']
  },
  {
    id: 'MUC1_SUITE',
    name: 'Mục 1: Lịch Chăm Sóc Lặp, Đồng Thời & Phân Quyền (test_muc1_schedules.mjs)',
    command: 'node',
    args: ['scratch/test_muc1_schedules.mjs']
  },
  {
    id: 'MUC2_SUITE',
    name: 'Mục 2: Backend, Filesystem Rollback, Retry & Mismatch (test_muc2_backend_and_fs.mjs)',
    command: 'node',
    args: ['tests/test_muc2_backend_and_fs.mjs']
  },
  {
    id: 'MUC3_SUITE',
    name: 'Mục 3: Thống Nhất Đơn Thuốc, Khóa Chốt, Đơn Nháp & Tương Thích Cũ (test_muc3_prescriptions.mjs)',
    command: 'node',
    args: ['tests/test_muc3_prescriptions.mjs']
  },
  {
    id: 'MUC6_SUITE',
    name: 'Mục 6: Thống Nhất Ngày Giờ Asia/Ho_Chi_Minh & iCalendar (test_muc6_datetime.mjs)',
    command: 'node',
    args: ['tests/test_muc6_datetime.mjs']
  }
];

const results = [];

for (const suite of suites) {
  console.log(`\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>`);
  console.log(`▶ ĐANG CHẠY: ${suite.name}`);
  console.log(`  Lệnh: ${suite.command} ${suite.args.join(' ')}`);
  console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n`);

  const startTime = Date.now();
  const proc = spawnSync(suite.command, suite.args, {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: process.cwd()
  });
  const durationMs = Date.now() - startTime;
  const passed = proc.status === 0;

  results.push({
    ...suite,
    passed,
    status: proc.status,
    durationMs
  });

  if (passed) {
    console.log(`\n✔ [HOÀN THÀNH XUẤT SẮC] ${suite.name} (${(durationMs / 1000).toFixed(2)}s)`);
  } else {
    console.error(`\n✖ [THẤT BẠI] ${suite.name} (Mã thoát: ${proc.status}, ${(durationMs / 1000).toFixed(2)}s)`);
  }
}

console.log('\n\n========================================================================');
console.log('📊 BẢNG TỔNG HỢP BÁO CÁO KẾT QUẢ TỪNG BỘ TEST');
console.log('========================================================================');

let allPassed = true;
results.forEach((r, idx) => {
  const icon = r.passed ? '✅ ĐẠT' : '❌ HỎNG';
  console.log(`${idx + 1}. [${icon}] ${r.name}`);
  console.log(`   Thời gian chạy: ${(r.durationMs / 1000).toFixed(2)}s | Exit code: ${r.status}`);
  if (!r.passed) allPassed = false;
});

console.log('========================================================================');
if (allPassed) {
  console.log('🎉 TẤT CẢ CÁC BỘ KIỂM THỬ ĐÃ VƯỢT QUA 100%!');
  console.log('   (Lưu ý: Bộ Browser E2E UI 2 Profile được tách riêng chạy bằng `npm run test:e2e`)');
  process.exit(0);
} else {
  console.error('⚠️ MỘT HOẶC NHIỀU BỘ KIỂM THỬ BỊ THẤT BẠI.');
  process.exit(1);
}
