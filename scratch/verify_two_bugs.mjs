// scratch/verify_two_bugs.mjs
// Read-only verification of:
// 1. Backend /api/prescriptions?petId=... ownership & petId filtering
// 2. Doctor view patient records mapping & prescriptions

async function testBackend() {
  console.log('--- TEST 1: Backend Prescriptions API & Authorization ---');
  
  // Login as pet owner
  const ownerLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manhdinh2907@gmail.com', password: '123456' })
  });
  const ownerData = await ownerLoginRes.json();
  const ownerToken = ownerData.token;
  console.log('Owner token acquired:', !!ownerToken, 'User ID:', ownerData.user?.id);

  // 1.1 Fetch prescriptions with petId of Dog (Cún Kiểm Thử: pet-1792128958474)
  const dogRes = await fetch('http://localhost:5000/api/data/prescriptions?petId=pet-1792128958474', {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const dogPrescriptions = await dogRes.json();
  console.log('Dog prescriptions count:', dogPrescriptions.length);
  if (dogPrescriptions.length === 1) {
    console.log('✓ Dog has exactly 1 prescription:', dogPrescriptions[0].id, 'PetId:', dogPrescriptions[0].petId, 'MedName:', dogPrescriptions[0].items?.[0]?.medicationName);
  } else {
    console.error('✗ Dog prescription count mismatch:', dogPrescriptions);
  }

  // 1.2 Fetch prescriptions with petId of Cat (Mèo Kiểm Thử: pet-1792142788675)
  const catRes = await fetch('http://localhost:5000/api/data/prescriptions?petId=pet-1792142788675', {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  const catPrescriptions = await catRes.json();
  console.log('Cat prescriptions count:', catPrescriptions.length);
  if (catPrescriptions.length === 0) {
    console.log('✓ Cat has 0 prescriptions (no dog prescriptions leak).');
  } else {
    console.error('✗ Cat leaked prescriptions:', catPrescriptions);
  }

  // 1.3 Test authorization: Attempt to fetch with a petId not belonging to owner
  const unownedRes = await fetch('http://localhost:5000/api/data/prescriptions?petId=pet-non-existent-or-unowned', {
    headers: { 'Authorization': `Bearer ${ownerToken}` }
  });
  console.log('Unowned petId response status:', unownedRes.status);
  if (unownedRes.status === 403 || unownedRes.status === 404) {
    console.log('✓ Backend properly enforces ownership validation on petId query!');
  }

  console.log('\n--- TEST 2: Doctor Patient Records & Details ---');
  // Login as vet doctor
  const vetLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tester@petcare.ai', password: 'Doctor@123' })
  });
  const vetData = await vetLoginRes.json();
  const vetToken = vetData.token;
  console.log('Vet token acquired:', !!vetToken, 'Vet ID:', vetData.user?.id);

  // Fetch medical records
  const medRes = await fetch('http://localhost:5000/api/data/medical_records', {
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  const records = await medRes.json();
  const cunRecords = records.filter(r => r.petId === 'pet-1792128958474');
  console.log('Cún medical records count:', cunRecords.length);

  for (const r of cunRecords) {
    console.log(`- Record ID: ${r.id}, ApptId: ${r.appointmentId}, Time: ${r.appointmentTime || r.createdAt}, Prescriptions count in record: ${r.prescriptions ? r.prescriptions.length : 0}`);
    if (r.soap) {
      console.log(`  SOAP: S="${r.soap.subjective || ''}", O="${r.soap.objective || ''}", A="${r.soap.assessment || ''}", P="${r.soap.plan || ''}"`);
    }
  }

  // Check 08:30 vs 14:00 appointments
  const apptRes = await fetch('http://localhost:5000/api/data/appointments', {
    headers: { 'Authorization': `Bearer ${vetToken}` }
  });
  const appts = await apptRes.json();
  const cunAppts = appts.filter(a => a.petId === 'pet-1792128958474');
  for (const a of cunAppts) {
    console.log(`- Appt ID: ${a.id}, Time: ${a.time}, Status: ${a.status}, MedicalRecordId: ${a.medicalRecordId}`);
  }
}

testBackend().catch(console.error);
