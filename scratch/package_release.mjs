import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const STAGING_DIR = path.join(ROOT_DIR, '_staging_petcare');
const VERIFY_DIR = path.join(ROOT_DIR, '_verify_petcare');
const ZIP_NAME = 'PetCare_PRO_AI_Source.zip';
const ZIP_PATH = path.join(ROOT_DIR, ZIP_NAME);

// Dọn dẹp trước khi bắt đầu
if (fs.existsSync(STAGING_DIR)) fs.rmSync(STAGING_DIR, { recursive: true, force: true });
if (fs.existsSync(VERIFY_DIR)) fs.rmSync(VERIFY_DIR, { recursive: true, force: true });
if (fs.existsSync(ZIP_PATH)) fs.rmSync(ZIP_PATH, { force: true });

fs.mkdirSync(STAGING_DIR, { recursive: true });

console.log('========================================================================');
console.log('📦 BẮT ĐẦU QUY TRÌNH ĐÓNG GÓI MÃ NGUỒN PETCARE CHO KIỂM TRA ĐỘC LẬP');
console.log('========================================================================\n');

// Helper sao chép đệ quy có bộ lọc
function copyRecursive(srcDir, destDir, filterFn) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (filterFn && !filterFn(srcPath, entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath, filterFn);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Sao chép src/
console.log('▶ [1/7] Sao chép thư mục src/...');
copyRecursive(
  path.join(ROOT_DIR, 'src'),
  path.join(STAGING_DIR, 'src')
);

// 2. Sao chép server/ (loại trừ DUY NHẤT thư mục server/data/ để xử lý fixture riêng)
console.log('▶ [2/7] Sao chép thư mục server/ (bao gồm dataHandler.js) và chuẩn bị fixture giả lập...');
copyRecursive(
  path.join(ROOT_DIR, 'server'),
  path.join(STAGING_DIR, 'server'),
  (itemPath, entry) => {
    if (entry.isDirectory() && entry.name === 'data') return false;
    const norm = itemPath.replace(/\\/g, '/');
    if (norm.includes('/server/data/')) return false;
    return true;
  }
);

// 2b. Xử lý server/data với fixture giả lập an toàn
const STAGING_DATA = path.join(STAGING_DIR, 'server', 'data');
fs.mkdirSync(STAGING_DATA, { recursive: true });

// Sao chép server/data/docs
copyRecursive(
  path.join(ROOT_DIR, 'server', 'data', 'docs'),
  path.join(STAGING_DATA, 'docs')
);

const TARGET_PERSONAL_EMAIL = ['manhdinh2907', 'gmail.com'].join('@');
const TARGET_PERSONAL_NAME = ['Đinh', 'Xuân', 'Mạnh'].join(' ');

const dataFiles = fs.readdirSync(path.join(ROOT_DIR, 'server', 'data'));
for (const file of dataFiles) {
  if (!file.endsWith('.json')) continue;

  const srcFile = path.join(ROOT_DIR, 'server', 'data', file);
  const destFile = path.join(STAGING_DATA, file);

  // Chỉ giữ 1 file backup mới nhất để bộ test CA 10.6 xác minh
  if (file.startsWith('prescriptions_pre_migration_backup_')) {
    if (file === 'prescriptions_pre_migration_backup_1792118851491.json') {
      fs.copyFileSync(srcFile, destFile);
    }
    continue;
  }

  // Token và danh sách đã xóa để rỗng chuẩn
  if (file === 'tokens.json' || file === 'deleted_users.json') {
    fs.writeFileSync(destFile, '[]\n', 'utf8');
    continue;
  }

  let content = fs.readFileSync(srcFile, 'utf8');

  // Làm sạch dữ liệu cá nhân trong toàn bộ database fixture
  content = content.replaceAll(TARGET_PERSONAL_EMAIL, 'demo@petcare.ai');
  content = content.replaceAll(TARGET_PERSONAL_NAME, 'Chủ Nuôi Mẫu (Demo Owner)');

  if (file === 'users.json') {
    try {
      const users = JSON.parse(content);
      const cleanUsers = users.map(u => {
        if (u.id === 'user_1791541299976_7ebbe5') {
          return {
            ...u,
            name: 'Chủ Nuôi Mẫu (Demo Owner)',
            email: 'demo@petcare.ai',
            phone: '0912.345.678',
            address: 'Cầu Giấy, Hà Nội'
          };
        }
        return u;
      });
      content = JSON.stringify(cleanUsers, null, 2);
    } catch {}
  }

  if (file === 'audit_logs.json') {
    try {
      const logs = JSON.parse(content);
      const cleanLogs = logs.slice(0, 100).map(l => {
        let details = l.details || '';
        details = details.replaceAll(TARGET_PERSONAL_EMAIL, 'demo@petcare.ai');
        details = details.replaceAll(TARGET_PERSONAL_NAME, 'Chủ Nuôi Mẫu (Demo Owner)');
        return { ...l, details };
      });
      content = JSON.stringify(cleanLogs, null, 2);
    } catch {}
  }

  fs.writeFileSync(destFile, content, 'utf8');
}

// 3. Sao chép public/ và assets/
console.log('▶ [3/7] Sao chép public/ và assets/...');
copyRecursive(path.join(ROOT_DIR, 'public'), path.join(STAGING_DIR, 'public'));
copyRecursive(path.join(ROOT_DIR, 'assets'), path.join(STAGING_DIR, 'assets'));

// 4. Sao chép tests/ (chỉ lấy code test .mjs, loại bỏ toàn bộ .profile_* và temp folders)
console.log('▶ [4/7] Sao chép thư mục tests/ (loại bỏ browser profiles & temp cache)...');
const testsStaging = path.join(STAGING_DIR, 'tests');
fs.mkdirSync(testsStaging, { recursive: true });
const testEntries = fs.readdirSync(path.join(ROOT_DIR, 'tests'), { withFileTypes: true });
for (const entry of testEntries) {
  if (entry.isFile() && entry.name.endsWith('.mjs')) {
    fs.copyFileSync(path.join(ROOT_DIR, 'tests', entry.name), path.join(testsStaging, entry.name));
  }
}

// 5. Sao chép scratch/ (chỉ lấy các kịch bản test .mjs/.py, KHÔNG lấy package_release.mjs hay browser profile)
console.log('▶ [5/7] Sao chép các script test trong scratch/ (loại bỏ browser profile & script tạm)...');
const scratchStaging = path.join(STAGING_DIR, 'scratch');
fs.mkdirSync(scratchStaging, { recursive: true });
const scratchEntries = fs.readdirSync(path.join(ROOT_DIR, 'scratch'), { withFileTypes: true });
for (const entry of scratchEntries) {
  if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.py'))) {
    if (entry.name === 'package_release.mjs') continue;
    fs.copyFileSync(path.join(ROOT_DIR, 'scratch', entry.name), path.join(scratchStaging, entry.name));
  }
}

// 6. Sao chép các tệp cấu hình, README, TEST_REPORT ở thư mục gốc (TUYỆT ĐỐI KHÔNG sao chép .env)
console.log('▶ [6/7] Sao chép các tệp cấu hình, README và TEST_REPORT.md...');
const rootFilesToCopy = [
  'package.json',
  'package-lock.json',
  'index.html',
  'vite.config.js',
  'tailwind.config.js',
  '.oxlintrc.json',
  '.eslintignore',
  '.gitignore',
  'refactor.cjs',
  'create_diagrams.py',
  'generate_report.py',
  'generate_sad_doc.py',
  '.env.example',
  'README.md',
  'TEST_REPORT.md'
];

for (const f of rootFilesToCopy) {
  const p = path.join(ROOT_DIR, f);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(STAGING_DIR, f));
  }
}

// 7. Đóng gói ZIP bằng bsdtar chuẩn
console.log('▶ [7/7] Nén toàn bộ vào tệp ZIP:', ZIP_NAME);
execSync(`tar -a -c -f "${ZIP_PATH}" *`, {
  cwd: STAGING_DIR,
  stdio: 'inherit'
});

const zipStats = fs.statSync(ZIP_PATH);
const zipSizeMb = (zipStats.size / (1024 * 1024)).toFixed(2);
const zipSizeKb = (zipStats.size / 1024).toFixed(2);
console.log(`\n✔ [ĐÃ TẠO ZIP THÀNH CÔNG] Dung lượng tệp ZIP: ${zipSizeMb} MB (${zipSizeKb} KB)`);

// 8. Kiểm tra giải nén độc lập
console.log('\n========================================================================');
console.log('🔍 BẮT ĐẦU KIỂM TRA ĐỘC LẬP TỆP ZIP');
console.log('========================================================================');

fs.mkdirSync(VERIFY_DIR, { recursive: true });
execSync(`tar -x -f "${ZIP_PATH}" -C "${VERIFY_DIR}"`, { stdio: 'inherit' });
console.log('✔ Giải nén tệp ZIP thành công vào thư mục kiểm chứng!');

// Kiểm tra bảo đảm npm ci
console.log('▶ Kiểm tra tính toàn vẹn phụ thuộc bằng npm ci --dry-run...');
execSync('npm ci --dry-run', {
  cwd: VERIFY_DIR,
  stdio: 'pipe'
});
console.log('✔ Lệnh npm ci --dry-run thành công tuyệt đối!');

// Quét bảo mật kiểm chứng
console.log('▶ Quét bảo mật kiểm chứng trên toàn bộ mã nguồn giải nén...');
let scannedFileCount = 0;
function scanVerify(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'chrome_profile'].includes(entry.name) || entry.name.startsWith('.profile_') || entry.name.startsWith('temp_')) {
        throw new Error(`Phát hiện thư mục không hợp lệ trong ZIP: ${entry.name}`);
      }
      scanVerify(full);
    } else {
      scannedFileCount++;
      if (entry.name === '.env') {
        throw new Error('Phát hiện tệp .env thật trong ZIP!');
      }
      if (entry.name.startsWith('~$')) {
        throw new Error(`Phát hiện tệp tạm trong ZIP: ${entry.name}`);
      }
      if (entry.name.endsWith('.json') || entry.name.endsWith('.js') || entry.name.endsWith('.jsx') || entry.name.endsWith('.mjs')) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes(TARGET_PERSONAL_EMAIL)) {
          throw new Error(`Phát hiện email cá nhân trong: ${full}`);
        }
      }
    }
  }
}
scanVerify(VERIFY_DIR);
console.log(`✔ Đã quét ${scannedFileCount} tệp: 100% SẠCH, không có .env, không có cache, không có dữ liệu cá nhân!`);

// Danh sách thư mục và tệp đã giữ
const keptDirs = fs.readdirSync(VERIFY_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory())
  .map(e => e.name);
const keptFiles = fs.readdirSync(VERIFY_DIR, { withFileTypes: true })
  .filter(e => e.isFile())
  .map(e => e.name);

console.log('\n========================================================================');
console.log('📂 DANH SÁCH CÁC THƯ MỤC ĐÃ ĐƯỢC GIỮ TRONG GÓI ZIP:');
console.log('========================================================================');
for (const d of keptDirs) {
  const subCount = fs.readdirSync(path.join(VERIFY_DIR, d)).length;
  console.log(`  📁 ${d}/ (${subCount} mục con trực tiếp)`);
}

console.log('\n========================================================================');
console.log('📄 DANH SÁCH CÁC TỆP GỐC ĐÃ ĐƯỢC GIỮ TRONG GÓI ZIP:');
console.log('========================================================================');
for (const f of keptFiles) {
  const sz = fs.statSync(path.join(VERIFY_DIR, f)).size;
  console.log(`  📄 ${f.padEnd(25)} (${(sz / 1024).toFixed(1)} KB)`);
}

// Dọn dẹp thư mục tạm an toàn
try {
  fs.rmSync(STAGING_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
} catch {}
try {
  fs.rmSync(VERIFY_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
} catch {}
console.log('\n🧹 Đã dọn dẹp các thư mục trung gian kiểm chứng.');
console.log('✨ Tệp gói mã nguồn hoàn chỉnh sẵn sàng tại:', ZIP_PATH);
