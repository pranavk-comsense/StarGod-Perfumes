import { site } from "@/lib/site";

/** Floating WhatsApp chat button (store pages only). */
export function WhatsAppButton() {
  const text = encodeURIComponent("Hi StarGod Perfumes! I have a question.");
  return (
    <a
      href={`https://wa.me/${site.whatsapp}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-7" fill="currentColor">
        <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.04 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.98 1-3.63-.24-.37a9.82 9.82 0 0 1-1.5-5.22c0-5.42 4.42-9.84 9.85-9.84 2.63 0 5.1 1.03 6.96 2.89a9.78 9.78 0 0 1 2.88 6.96c0 5.43-4.42 9.84-9.86 9.84m8.39-18.23A11.78 11.78 0 0 0 12.04.1C5.5.1.17 5.42.17 11.97c0 2.09.55 4.13 1.59 5.93L.07 24.1l6.33-1.66a11.83 11.83 0 0 0 5.64 1.44h.01c6.54 0 11.87-5.33 11.87-11.88 0-3.17-1.24-6.16-3.49-8.4" />
      </svg>
    </a>
  );
}
