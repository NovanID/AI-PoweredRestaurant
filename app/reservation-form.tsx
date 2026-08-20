"use client";

import { useState } from "react";

export default function ReservationForm() {
  const [code, setCode] = useState("");

  if (code) {
    return <div className="confirmation" role="status"><span>Reservasi berhasil diajukan</span><strong>{code}</strong><p>Status: <b>Pending persetujuan staff</b></p><button type="button" onClick={() => setCode("")}>Buat reservasi lain</button></div>;
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); setCode("RM-0001"); }}>
      <label>Nama<input name="name" autoComplete="name" required /></label>
      <label>Nomor WhatsApp<input name="phone" type="tel" autoComplete="tel" required /></label>
      <div className="form-row"><label>Tanggal<input name="date" type="date" required /></label><label>Waktu<input name="time" type="time" required /></label></div>
      <label>Jumlah tamu<input name="guests" type="number" min="1" max="12" defaultValue="2" required /></label>
      <label>Catatan<textarea name="notes" rows={3} /></label>
      <button className="button" type="submit">Ajukan reservasi</button>
    </form>
  );
}
