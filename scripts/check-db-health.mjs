const url = process.env.DB_HEALTH_URL || 'http://localhost:3000/api/db/health';

try {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Database health check failed:', data);
    process.exit(1);
  }
  console.log('Database health check OK:', data);
} catch (error) {
  console.error('Database health check request failed:', error.message);
  process.exit(1);
}
