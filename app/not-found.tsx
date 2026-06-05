export default function NotFound() {
  return (
    <div style={{
      background: '#050505',
      color: 'rgba(250,246,240,0.96)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Public Sans, sans-serif',
    }}>
      <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>404 — Page Not Found</h2>
      <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>
        The page you are looking for does not exist.
      </p>
      <a
        href="/"
        style={{
          padding: '8px 20px',
          borderRadius: '8px',
          border: '1px solid rgba(250,246,240,0.2)',
          color: 'rgba(250,246,240,0.96)',
          textDecoration: 'none',
          fontSize: '13px',
        }}
      >
        Go home
      </a>
    </div>
  );
}
