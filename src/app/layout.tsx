export const metadata = { title: 'AccessFix Dashboard' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{fontFamily:'ui-sans-serif, system-ui', color:'#e5e7eb', background:'#0b0b0b'}}>
        <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid #1f2937'}}>
          <div style={{fontWeight:700}}>AccessFix</div>
          <nav style={{fontSize:14,opacity:.8}}>Dashboard</nav>
        </header>
        <main style={{maxWidth:900, margin:'24px auto', padding:'0 16px'}}>{children}</main>
      </body>
    </html>
  );
}
