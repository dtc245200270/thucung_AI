import { processChatConsultation } from '../server/chatService.js';

async function run() {
  console.log('Testing Chatbot with live pet data...\n');

  // Test Checklist 11: Hỏi cân nặng của Mèo Kiểm Thử
  console.log('--- TEST 1: Cân nặng của Mèo Kiểm Thử (id: pet-1792142788675) ---');
  const resCat = await processChatConsultation({
    userId: 'user_1791541299976_7ebbe5',
    userRole: 'pet_owner',
    petId: 'pet-1792142788675',
    message: 'Bé Mèo Kiểm Thử hiện tại nặng bao nhiêu kg?'
  });
  console.log('AI Reply:\n', resCat.reply);
  console.log('Sources:', resCat.sources);

  console.log('\n------------------------------------------------------------\n');

  // Test Checklist 1: Cho mèo ăn thưởng bao nhiêu là vừa?
  console.log('--- TEST 2: Cho mèo ăn thưởng bao nhiêu là vừa? ---');
  const resTreat = await processChatConsultation({
    userId: 'user_1791541299976_7ebbe5',
    userRole: 'pet_owner',
    petId: 'pet-1792142788675',
    message: 'Cho mèo ăn thưởng bao nhiêu là vừa?'
  });
  console.log('AI Reply:\n', resTreat.reply);
  console.log('Sources:', resTreat.sources.map(s => `${s.id} - ${s.name}`));
}

run().catch(console.error);
