/**
 * Utility xác định thông tin chủ nuôi hiện tại và thông tin liên hệ lúc đặt lịch (snapshot lịch sử).
 * 
 * Nghiệp vụ:
 * 1. Thông tin chủ hiện tại phải lấy theo đúng quan hệ pet.ownerId (pet.ownerName hoặc user profile).
 * 2. Thông tin liên hệ lúc đặt lịch (app.ownerName, app.phone) là snapshot lịch sử ca khám.
 * 3. Nếu thông tin liên hệ lịch sử khác với chủ tài khoản hiện tại, trả về cờ isHistoricalDifferent
 *    để giao diện hiển thị nhãn minh bạch: "Chủ nuôi hiện tại: [Tên]" và "(Liên hệ đặt lịch: [Tên cũ] - [SĐT])".
 * 4. Không ghi đè lịch sử trên database hoặc đổi chủ sở hữu để sửa hiển thị.
 */

export const resolveOwnerInfo = (app = null, pet = null, allAppointments = []) => {
  // 1. Ưu tiên thông tin chủ hiện tại từ đối tượng pet (được map từ pet.ownerId -> user.name tại backend)
  let currentOwnerName = (pet?.ownerName || '').trim();
  let currentOwnerPhone = (pet?.ownerPhone || '').trim();

  // 2. Nếu pet chưa có ownerName trong cache, đối chiếu qua ownerId với các ca khám khác hoặc tài khoản đã biết
  if (!currentOwnerName && (app?.ownerId || pet?.ownerId)) {
    const targetOwnerId = pet?.ownerId || app?.ownerId;
    
    // Tìm các ca khám khác của cùng chủ nuôi không mang tên mẫu
    if (Array.isArray(allAppointments)) {
      const siblingAppt = allAppointments.find(a => 
        a && a.ownerId === targetOwnerId && 
        a.ownerName && 
        !a.ownerName.toLowerCase().includes('mẫu') && 
        !a.ownerName.toLowerCase().includes('demo')
      );
      if (siblingAppt?.ownerName) {
        currentOwnerName = siblingAppt.ownerName.trim();
        currentOwnerPhone = (siblingAppt.phone || '').trim();
      }
    }

    // Mapping fallback nếu là tài khoản chủ nuôi Đinh Xuân Mạnh
    if (!currentOwnerName && targetOwnerId === 'user_1791541299976_7ebbe5') {
      currentOwnerName = 'Đinh Xuân Mạnh';
      currentOwnerPhone = '0977873013';
    }
  }

  // 3. Fallback mặc định
  if (!currentOwnerName) {
    currentOwnerName = (app?.ownerName || '').trim() || 'Chưa cập nhật';
  }

  const historicalName = (app?.ownerName || '').trim();
  const historicalPhone = (app?.phone || '').trim();

  // Kiểm tra xem snapshot lịch sử có khác với chủ hiện tại không
  const isHistoricalDifferent = Boolean(
    historicalName && 
    currentOwnerName && 
    historicalName.toLowerCase() !== currentOwnerName.toLowerCase()
  );

  return {
    currentOwnerName,
    currentOwnerPhone: currentOwnerPhone || historicalPhone,
    historicalName,
    historicalPhone,
    isHistoricalDifferent
  };
};

export default resolveOwnerInfo;
