async function testFastResponses() {
  const prompts = [
    'ayam goreng',
    'bebas, dan rencananya saya mau take away',
    'pesan meja 2 orang besok jam 1 siang',
  ];

  for (const p of prompts) {
    console.log(`\n💬 [CUSTOMER]: "${p}"`);
    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: p }),
      });

      const data = await res.json();
      console.log(`🤖 [AI REPLY]:\n${data.reply}`);
      console.log('-------------------------------------------------------------');
    } catch (e: any) {
      console.error('Error:', e.message);
    }
  }
}

testFastResponses();
