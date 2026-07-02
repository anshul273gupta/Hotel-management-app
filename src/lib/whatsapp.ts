/**
 * Click-to-chat WhatsApp link builder (wa.me deep links).
 */

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel Agrawal Inn";
const HOTEL_PHONE = process.env.HOTEL_PHONE ?? "";

function normalizeMobile(mobile: string): string {
  const digits = mobile.replace(/[^\d]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildWhatsAppLink(mobile: string, message: string): string {
  const phone = normalizeMobile(mobile);
  // Keep emoji and all non-ASCII chars as raw Unicode in the URL.
  // encodeURIComponent turns emoji into %F0%9F... which some Android/WhatsApp
  // versions fail to decode back to emoji in the pre-filled compose window.
  // Browsers handle raw Unicode in href attributes correctly.
  const text = Array.from(message).map((char) => {
    const cp = char.codePointAt(0) ?? 0;
    if (cp > 0x7F) return char;            // keep emoji and non-ASCII as raw Unicode
    if (cp === 0x20) return "%20";         // space
    if (cp === 0x0A) return "%0A";         // newline
    if (cp === 0x0D) return "";            // carriage return — strip
    if (cp < 0x20) return "";             // other control chars — strip
    if ("&=+?#%".includes(char)) return encodeURIComponent(char); // URL structure chars
    return char;
  }).join("");
  return `https://wa.me/${phone}?text=${text}`;
}

export const whatsappTemplates = {
  bookingConfirmation: (params: {
    guestName: string;
    roomNumber: string;
    checkInDate: string;
    expectedCheckOut: string;
    numberOfGuests: number;
  }) =>
    `Hello ${params.guestName}, \uD83D\uDE4F\n\n` +
    `Your booking at *${HOTEL_NAME}* is confirmed!\n\n` +
    `\uD83C\uDFE8 Room: ${params.roomNumber}\n` +
    `\uD83D\uDC65 Guests: ${params.numberOfGuests}\n` +
    `\uD83D\uDCC5 Check-in: ${params.checkInDate}\n` +
    `\uD83D\uDCC5 Check-out: ${params.expectedCheckOut}\n\n` +
    `We look forward to welcoming you!`,

  checkInDetails: (params: { guestName: string; roomNumber: string; floor: number | string }) =>
    `Hello ${params.guestName}, welcome to *${HOTEL_NAME}*! \uD83C\uDF89\n\n` +
    `You have been checked in successfully.\n\n` +
    `\uD83C\uDFE8 Room Number: ${params.roomNumber}\n` +
    `\uD83C\uDFE2 Floor: ${params.floor}\n\n` +
    `For any assistance, scan the QR code in your room. Enjoy your stay!`,

  roomNumber: (params: { guestName: string; roomNumber: string }) =>
    `Hello ${params.guestName}, your room number at *${HOTEL_NAME}* is *${params.roomNumber}*. ` +
    `Our staff will assist you with your luggage. Thank you!`,

  paymentReceipt: (params: {
    guestName: string;
    amount: string;
    method: string;
    roomNumber: string;
    balanceDue: string;
  }) =>
    `Hello ${params.guestName},\n\n` +
    `*Payment Receipt - ${HOTEL_NAME}*\n` +
    `Room: ${params.roomNumber}\n` +
    `Amount Paid: Rs. ${params.amount}\n` +
    `Payment Method: ${params.method}\n` +
    `Balance Due: Rs. ${params.balanceDue}\n\n` +
    `Thank you for choosing us!`,

  checkInGreeting: (params: { title: string; guestName: string; checkInTime: string; roomNumber: string }) =>
    `*${HOTEL_NAME}*\n\n` +
    `Welcome, ${params.title} ${params.guestName}!\n\n` +
    `We are delighted to have you stay with us.\n\n` +
    `\u2705 Check-In Time: ${params.checkInTime}\n` +
    `\uD83C\uDFE0 Room Number: ${params.roomNumber}\n\n` +
    `We hope you have a comfortable and pleasant stay. If you need housekeeping, room service, extra amenities, or any assistance, scan the QR code in your room.\n\n` +
    `Enjoy your stay! \uD83D\uDE4F`,

  checkOutGreeting: (params: { guestName: string; checkOutTime: string }) =>
    `*${HOTEL_NAME}*\n\n` +
    `\uD83D\uDE4F Thank You, ${params.guestName}!\n\n` +
    `We hope you enjoyed your stay with us.\n\n` +
    `\u2705 Check-Out Time: ${params.checkOutTime}\n\n` +
    `Thank you for choosing our hotel. Have a safe journey and see you soon!`,

  custom: (message: string) => message,
};

export { HOTEL_NAME, HOTEL_PHONE };