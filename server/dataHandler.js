import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const DATA_DIR = process.env.PETCARE_DATA_DIR
  ? path.resolve(process.env.PETCARE_DATA_DIR)
  : path.resolve(__dirname, './data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const simulatedFailures = new Set();

export function simulateSaveFailure(collectionName) {
  if (process.env.NODE_ENV !== 'test') return;
  simulatedFailures.add(collectionName);
}

export function clearSimulatedSaveFailures() {
  simulatedFailures.clear();
}

export function getCollectionData(collectionName, isObject = false) {
  try {
    const filePath = path.join(DATA_DIR, `${collectionName}.json`);
    if (!fs.existsSync(filePath)) {
      return isObject ? {} : []; 
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading collection ${collectionName}:`, err);
    return isObject ? {} : [];
  }
}

export function saveCollectionData(collectionName, data) {
  // Chỉ kích hoạt mô phỏng lỗi ghi khi ở môi trường test
  if (process.env.NODE_ENV === 'test' && (simulatedFailures.has(collectionName) || simulatedFailures.has('*'))) {
    console.warn(`[SIMULATION] Simulated write failure for collection: ${collectionName}`);
    simulatedFailures.delete(collectionName);
    return false;
  }

  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  const tempPath = path.join(DATA_DIR, `.${collectionName}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  const content = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(tempPath, content, 'utf8');

    let replaced = false;
    let attempts = 0;
    let lastError = null;
    while (!replaced && attempts < 5) {
      try {
        fs.renameSync(tempPath, filePath);
        replaced = true;
      } catch (renameErr) {
        lastError = renameErr;
        attempts++;
        if (attempts >= 5) {
          // BỎ HOÀN TOÀN copyFileSync đè lên file đích!
          // Nếu rename vẫn thất bại sau retry, dọn dẹp file tạm, giữ nguyên file gốc và trả lỗi rõ ràng.
          try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          } catch {}
          console.error(`[ATOMIC WRITE FAILED] Không thể rename tệp tạm sang ${collectionName}.json sau ${attempts} lần thử. Giữ nguyên tệp gốc. Lỗi:`, lastError?.message || lastError);
          return false;
        } else {
          // Delay nhỏ để Windows giải phóng file lock
          const start = Date.now();
          while (Date.now() - start < 20) {}
        }
      }
    }
    return true;
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    console.error(`Error saving collection ${collectionName}:`, err);
    return false;
  }
}

/**
 * Lưu nhiều collection có cơ chế rollback toàn diện:
 * Nếu một collection ghi thất bại, toàn bộ các collection đã tham gia trong giao dịch
 * (bao gồm cả collection đang ghi lỗi) sẽ được hoàn tác về snapshot ban đầu.
 * Không bỏ qua bất kỳ lỗi rollback nào nếu hoàn tác gặp sự cố.
 */
export function saveMultipleCollections(operations) {
  if (!Array.isArray(operations) || operations.length === 0) return true;

  // 1. Chụp ảnh nhanh (snapshot) dữ liệu ban đầu của tất cả collections tham gia
  const snapshots = [];
  for (const op of operations) {
    const original = getCollectionData(op.collection, Boolean(op.isObject));
    snapshots.push({
      collection: op.collection,
      original: JSON.parse(JSON.stringify(original))
    });
  }

  // 2. Tiến hành ghi tuần tự
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const ok = saveCollectionData(op.collection, op.data);
    if (!ok) {
      console.error(`[TRANSACTION FAILED] Ghi thất bại tại collection '${op.collection}' (thứ tự ${i + 1}/${operations.length}). Đang hoàn tác toàn bộ giao dịch...`);
      
      // Hoàn tác TOÀN BỘ các collection từ index i trở về 0 (gồm cả collection đang ghi lỗi)
      const rollbackErrors = [];
      for (let j = i; j >= 0; j--) {
        const item = snapshots[j];
        try {
          const restored = saveCollectionData(item.collection, item.original);
          if (!restored) {
            rollbackErrors.push(`Không thể khôi phục collection '${item.collection}' về snapshot ban đầu.`);
          }
        } catch (rErr) {
          rollbackErrors.push(`Ngoại lệ khi rollback collection '${item.collection}': ${rErr.message}`);
        }
      }

      // Không bỏ qua lỗi rollback nếu có bất kỳ bước hoàn tác nào thất bại
      if (rollbackErrors.length > 0) {
        const errorMsg = `[CRITICAL ROLLBACK FAILURE] Lỗi nghiêm trọng khi hoàn tác giao dịch đa tệp: ${rollbackErrors.join(' | ')}`;
        console.error(errorMsg);
        const criticalError = new Error(errorMsg);
        criticalError.code = 'ROLLBACK_FAILED';
        criticalError.rollbackErrors = rollbackErrors;
        throw criticalError;
      }

      return false;
    }
  }

  return true;
}
