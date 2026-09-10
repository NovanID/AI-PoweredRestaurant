import { ActionButtonEngine } from '../lib/ai/action-button-engine';
import { restaurantStore } from '../lib/restaurant-store';

async function testActionButtonEngine() {
  const menuSnapshot = restaurantStore.getMenuItems();

  console.log('=== Skenario 1: User tanya "ayam bakar" ===');
  const buttons1 = ActionButtonEngine.generateButtons({
    userMessage: 'ayam bakar',
    replyText: 'Halo Kak! Ayam Bakar Padang kami seharga Rp 28.000... Mau langsung dipesan untuk makan di tempat atau dibungkus, Kak?',
    menuSnapshot,
  });
  console.log('Generated Buttons 1:\n', JSON.stringify(buttons1, null, 2));

  console.log('\n=== Skenario 2: User klik "Bungkus 1 Ayam Bakar Padang" -> calculate_order_total sukses ===');
  const buttons2 = ActionButtonEngine.generateButtons({
    userMessage: 'Saya mau pesan bungkus 1 porsi Ayam Bakar Padang',
    replyText: 'Estimasi pesanan: 1x Ayam Bakar Padang (Rp 28.000). Subtotal: Rp 28.000, PB1 (10%): Rp 2.800, Total: Rp 30.800.',
    toolExecuted: {
      tool: 'calculate_order_total',
      success: true,
      data: { total: 30800 },
      message: 'Estimasi pesanan...',
    },
    menuSnapshot,
  });
  console.log('Generated Buttons 2:\n', JSON.stringify(buttons2, null, 2));

  console.log('\n=== Skenario 3: User tanya ketersediaan meja -> check_availability sukses ===');
  const buttons3 = ActionButtonEngine.generateButtons({
    userMessage: 'Ada meja untuk 2 orang hari ini jam 19.00?',
    replyText: 'Tersedia 4 meja yang cocok untuk 2 orang pada hari ini pukul 19:00 WIB.',
    toolExecuted: {
      tool: 'check_availability',
      success: true,
      data: { available: true },
      message: 'Tersedia meja...',
    },
    menuSnapshot,
  });
  console.log('Generated Buttons 3:\n', JSON.stringify(buttons3, null, 2));
}

testActionButtonEngine();
