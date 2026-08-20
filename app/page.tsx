import ReservationForm from "./reservation-form";

const menu = [
  ["Rendang", "Daging sapi dimasak lama dengan santan dan rempah.", "Rp35.000"],
  ["Ayam Pop", "Ayam lembut khas Minang dengan sambal merah.", "Rp28.000"],
  ["Dendeng Balado", "Dendeng renyah dengan balado pedas.", "Rp38.000"],
];

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top">Raso Minang</a>
        <nav aria-label="Navigasi utama"><a href="#menu">Menu</a><a href="#reservasi">Reservasi</a></nav>
      </header>

      <section className="hero shell" id="top">
        <div>
          <p className="eyebrow">Masakan Padang autentik</p>
          <h1>Rasa Minang,<br />hangat di setiap meja.</h1>
          <p className="lead">Lihat menu favorit dan ajukan reservasi dalam beberapa langkah sederhana.</p>
          <a className="button" href="#reservasi">Reservasi meja</a>
        </div>
        <div className="hero-card" aria-label="Informasi restoran"><span>Buka hari ini</span><strong>10.00–22.00</strong><p>Jl. Rasa Nusantara No. 8, Jakarta</p></div>
      </section>

      <section className="section shell" id="menu">
        <p className="eyebrow">Menu pilihan</p>
        <div className="section-heading"><h2>Favorit dari dapur kami</h2><p>Harga dan ketersediaan masih berupa data demo untuk prototype pertama.</p></div>
        <div className="menu-grid">
          {menu.map(([name, description, price]) => <article key={name}><span>Tersedia</span><h3>{name}</h3><p>{description}</p><strong>{price}</strong></article>)}
        </div>
      </section>

      <section className="reservation" id="reservasi">
        <div className="shell reservation-grid">
          <div><p className="eyebrow">Reservasi</p><h2>Ajukan meja Anda</h2><p>Reservasi akan berstatus <strong>pending</strong> sampai staff menyetujuinya.</p></div>
          <ReservationForm />
        </div>
      </section>

      <footer className="shell"><strong>Raso Minang</strong><span>Prototype AI-Powered Restaurant · 2026</span></footer>
    </main>
  );
}
