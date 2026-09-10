import { ActionButtonEngine } from '../lib/ai/action-button-engine';
import { restaurantStore } from '../lib/restaurant-store';

async function testComprehensiveActionButtons() {
  const profile = restaurantStore.getProfile();
  const menuSnapshot = restaurantStore.getMenuItems();

  console.log('====================================================');
  console.log('TEST 1: Negation & Allergy Exclusion Guard');
  console.log('User says: "Saya alergi ayam, jangan ayam bakar ya. Ada Rendang Daging Sapi?"');
  const buttons1 = ActionButtonEngine.generateButtons({
    userMessage: 'Saya alergi ayam, jangan ayam bakar ya. Ada Rendang Daging Sapi?',
    replyText: 'Halo Kak! Kami ada Rendang Daging Sapi seharga Rp 35.000...',
    menuSnapshot,
    profile,
    currentTime: '14:00',
  });
  console.log('Buttons 1:', buttons1.map((b) => b.label));
  const hasAyam = buttons1.some((b) => b.label.toLowerCase().includes('ayam'));
  console.log('Ayam excluded correctly?', !hasAyam ? '✅ PASSED' : '❌ FAILED');

  console.log('\n====================================================');
  console.log('TEST 2: Operating Hours Sensitivity (Closed at 23:30)');
  console.log('User says: "Rendang Daging Sapi" at 23:30 (After 22:00 close time)');
  const buttons2 = ActionButtonEngine.generateButtons({
    userMessage: 'Rendang Daging Sapi',
    replyText: 'Rendang Daging Sapi seharga Rp 35.000...',
    menuSnapshot,
    profile,
    currentTime: '23:30',
  });
  console.log('Buttons 2:', buttons2.map((b) => b.label));
  const hasTomorrow = buttons2.some((b) => b.label.includes('Besok'));
  const hasDineInNow = buttons2.some((b) => b.label === '🍽️ Makan di Tempat');
  console.log('Replaced with Booking Besok?', (hasTomorrow && !hasDineInNow) ? '✅ PASSED' : '❌ FAILED');

  console.log('\n====================================================');
  console.log('TEST 3: Multi-Dish Detection (Rendang + Ayam Pop)');
  console.log('User says: "Berapa harga Rendang Daging Sapi dan Ayam Pop Spesial?"');
  const buttons3 = ActionButtonEngine.generateButtons({
    userMessage: 'Berapa harga Rendang Daging Sapi dan Ayam Pop Spesial?',
    replyText: 'Rendang Daging Sapi Rp 35.000 dan Ayam Pop Spesial Rp 28.000...',
    menuSnapshot,
    profile,
    currentTime: '12:30',
  });
  console.log('Buttons 3:', buttons3.map((b) => b.label));
  const hasBoth = buttons3.some((b) => b.label.includes('Rendang')) && buttons3.some((b) => b.label.includes('Ayam Pop'));
  console.log('Both dishes suggested?', hasBoth ? '✅ PASSED' : '❌ FAILED');

  console.log('\n====================================================');
  console.log('TEST 4: Sold-Out Item Exclusion');
  const customMenu = menuSnapshot.map((m) =>
    m.name === 'Ayam Bakar Padang' ? { ...m, isAvailable: false } : m
  );
  const buttons4 = ActionButtonEngine.generateButtons({
    userMessage: 'Ayam Bakar',
    replyText: 'Maaf Ayam Bakar sedang habis...',
    menuSnapshot: customMenu,
    profile,
    currentTime: '13:00',
  });
  console.log('Buttons 4:', buttons4.map((b) => b.label));
  const hasSoldOut = buttons4.some((b) => b.label.includes('Ayam Bakar'));
  console.log('Sold-out item excluded?', !hasSoldOut ? '✅ PASSED' : '❌ FAILED');
}

testComprehensiveActionButtons();
