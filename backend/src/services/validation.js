// Server-side re-validation of everything the checkout form collects.
// The browser validates the same fields for UX; this is the copy that counts,
// because anyone can POST straight to the API.

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const PHONE_RE = /^(\+?91)?[6-9]\d{9}$/;
const PIN_RE = /^[1-9]\d{5}$/;

function clean(value, maxLength = 120) {
    return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, maxLength);
}

/** Returns { customer } or throws a message string via the caller's HttpError. */
function validateCustomer(input = {}) {
    const email = clean(input.email, 255).toLowerCase();
    const phone = clean(input.phone, 20).replace(/[\s-]/g, "");
    const fullName = clean(input.fullName);

    if (!email && !phone) return { error: "An email address or phone number is required" };
    if (email && !EMAIL_RE.test(email)) return { error: "Enter a valid email address" };
    if (phone && !PHONE_RE.test(phone)) return { error: "Enter a valid 10-digit Indian mobile number" };

    return {
        customer: {
            email: email || null,
            phone: phone || null,
            fullName: fullName || null,
            acceptsMarketing: input.acceptsMarketing === true,
        },
    };
}

/** Shipping address is required for any order that has to be delivered. */
function validateShippingAddress(input) {
    if (!input || typeof input !== "object") {
        return { error: "A shipping address is required" };
    }

    const address = {
        fullName: clean(input.fullName),
        phone: clean(input.phone, 20).replace(/[\s-]/g, ""),
        address1: clean(input.address1, 200),
        address2: clean(input.address2, 200),
        city: clean(input.city, 80),
        state: clean(input.state, 80),
        pincode: clean(input.pincode, 6),
        country: clean(input.country, 60) || "India",
    };

    if (!address.fullName) return { error: "Full name is required" };
    if (!PHONE_RE.test(address.phone)) return { error: "Enter a valid 10-digit Indian mobile number" };
    if (!address.address1) return { error: "Address line 1 is required" };
    if (!address.city) return { error: "City is required" };
    if (!address.state) return { error: "State is required" };
    if (!PIN_RE.test(address.pincode)) return { error: "Enter a valid 6-digit PIN code" };

    return { address };
}

module.exports = { validateCustomer, validateShippingAddress, clean, EMAIL_RE, PHONE_RE, PIN_RE };
