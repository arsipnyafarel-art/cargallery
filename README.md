# Gallery Extractor - versi Netlify

Tempel link halaman, gambar muncul, download satuan atau ZIP.

## Deploy
Fungsi server (Netlify Functions) tidak ikut jalan kalau folder ini hanya di-drag ke Netlify Drop.
Pakai salah satu:
- **GitHub**: push folder ini ke repo, lalu di app.netlify.com pilih "Add new site > Import an existing project". Pengaturan build sudah ada di netlify.toml.
- **CLI**: `npm i -g netlify-cli`, lalu `netlify deploy --prod` di folder ini (pilih "Create & configure a new site"; publish directory: `public`).

Lokal: `netlify dev`.
