export const metadata = {
  title: "Kaylife CRM",
  description: "Dashboard y módulo de Calidad de Agua (demo)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
