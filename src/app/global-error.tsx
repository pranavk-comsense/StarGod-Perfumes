"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#faf8f4" }}>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontWeight: 400 }}>Something went wrong</h1>
          <p style={{ color: "#6b625a" }}>Please refresh the page or try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", background: "#1c1917", color: "#fff", border: 0, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
